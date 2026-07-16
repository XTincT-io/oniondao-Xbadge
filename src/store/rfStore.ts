// RF Data Store - Manages all RF scanning state and viewers
import { create } from 'zustand';

export type ScreenName = "SUMMARY" | "WIFI" | "BLE" | "SUBGHZ" | "SECURITY" | "SETTINGS";
export type Mode = "SCAN" | "BROADCAST" | "STEALTH";
export type ScanPhase = "idle" | "wifi" | "ble" | "subghz" | "done";

export interface WiFiNetwork {
  ssid: string;
  bssid: string;
  rssi: number;
  channel: number;
  delta?: number;
}

export interface BLEDevice {
  name: string;
  addr: string;
  rssi: number;
  type: "BLE4" | "BLE5";
  delta?: number;
}

export interface SubGHzSignal {
  freq: number;
  rssi: number | null;
  count: number;
  label: string;
  delta?: number;
}

export interface Viewer {
  kind: "wifi" | "ble";
  addr: string;
  firstSeen: number;
  lastSeen: number;
  rssi: number;
}

export interface RFCapabilities {
  wifi: boolean;
  ble: boolean;
  subghz: boolean;
  subghzRssi: boolean;
  wifiViewers: boolean;
  bleViewers: boolean;
}

export interface RFDelta {
  wifi?: number;
  ble?: number;
  subghz?: number;
}

export interface RFState {
  // UI State
  currentScreen: ScreenName;
  currentMode: Mode;
  status: string;
  
  // Scanning
  scanPhase: ScanPhase;
  scanError?: string;
  lastScan: number;
  
  // RF Data
  wifi: WiFiNetwork[];
  ble: BLEDevice[];
  subghz: SubGHzSignal[];
  viewers: Viewer[];
  
  // Capabilities
  capabilities: RFCapabilities;
  
  // Deltas
  delta: RFDelta;
  
  // Previous scan for delta calculation
  prevWifiBest?: number;
  prevBleBest?: number;
  prevSubghzBest?: number;
}

interface RFActions {
  // Screen navigation
  setScreen: (screen: ScreenName) => void;
  nextScreen: () => void;
  prevScreen: () => void;
  
  // Mode
  setMode: (mode: Mode) => void;
  nextMode: () => void;
  
  // Status
  setStatus: (status: string) => void;
  
  // Scanning
  startScan: () => void;
  setScanPhase: (phase: ScanPhase, error?: string) => void;
  updateScanProgress: (phase: ScanPhase, status: string, error?: string) => void;
  completeScan: (delta: RFDelta) => void;
  
  // RF Data
  setWifi: (networks: WiFiNetwork[]) => void;
  setBLE: (devices: BLEDevice[]) => void;
  setSubGHz: (signals: SubGHzSignal[]) => void;
  
  // Viewers
  upsertViewer: (viewer: Viewer) => void;
  clearViewers: () => void;
  
  // Capabilities
  setCapabilities: (caps: RFCapabilities) => void;
  
  // Reset
  reset: () => void;
}

const SCREENS: ScreenName[] = ["SUMMARY", "WIFI", "BLE", "SUBGHZ", "SECURITY", "SETTINGS"];
const MODES: Mode[] = ["SCAN", "BROADCAST", "STEALTH"];

const initialState: RFState = {
  currentScreen: "SUMMARY",
  currentMode: "SCAN",
  status: "System ready. [SEL] to scan.",
  scanPhase: "idle",
  lastScan: 0,
  wifi: [],
  ble: [],
  subghz: [],
  viewers: [],
  capabilities: {
    wifi: false,
    ble: false,
    subghz: false,
    subghzRssi: false,
    wifiViewers: false,
    bleViewers: false,
  },
  delta: {},
};

export const useRFStore = create<RFState & RFActions>((set, get) => ({
  ...initialState,
  
  // Screen navigation
  setScreen: (screen: ScreenName) => set({ currentScreen: screen }),
  nextScreen: () => {
    const current = get().currentScreen;
    const idx = SCREENS.indexOf(current);
    const next = SCREENS[(idx + 1) % SCREENS.length];
    set({ currentScreen: next });
  },
  prevScreen: () => {
    const current = get().currentScreen;
    const idx = SCREENS.indexOf(current);
    const next = SCREENS[(idx - 1 + SCREENS.length) % SCREENS.length];
    set({ currentScreen: next });
  },
  
  // Mode
  setMode: (mode: Mode) => set({ currentMode: mode }),
  nextMode: () => {
    const current = get().currentMode;
    const idx = MODES.indexOf(current);
    const next = MODES[(idx + 1) % MODES.length];
    set({ currentMode: next, status: `Mode: ${next}` });
  },
  
  // Status
  setStatus: (status: string) => set({ status }),
  
  // Scanning
  startScan: () => {
    const state = get();
    if (state.scanPhase !== "idle") return;
    
    set({
      scanPhase: "wifi",
      status: "Scanning passive RF...",
      scanError: undefined,
      delta: {},
      lastScan: Date.now(),
      prevWifiBest: state.wifi[0]?.rssi,
      prevBleBest: state.ble[0]?.rssi,
      prevSubghzBest: state.subghz[0]?.rssi,
    });
  },
  
  setScanPhase: (phase: ScanPhase, error?: string) => {
    set({
      scanPhase: phase,
      scanError: error,
    });
  },
  
  updateScanProgress: (phase: ScanPhase, status: string, error?: string) => {
    set({
      scanPhase: phase,
      status,
      scanError: error,
    });
  },
  
  completeScan: (delta: RFDelta) => {
    set({
      scanPhase: "idle",
      delta,
      status: "Scan complete. Move badge; SELECT rescans.",
    });
  },
  
  // RF Data
  setWifi: (networks: WiFiNetwork[]) => set({ wifi: networks }),
  setBLE: (devices: BLEDevice[]) => set({ ble: devices }),
  setSubGHz: (signals: SubGHzSignal[]) => set({ subghz: signals }),
  
  // Viewers
  upsertViewer: (viewer: Viewer) => {
    const viewers = get().viewers;
    const idx = viewers.findIndex(v => v.kind === viewer.kind && v.addr === viewer.addr);
    
    if (idx >= 0) {
      viewers[idx] = { ...viewers[idx], ...viewer, lastSeen: Date.now() };
    } else {
      viewers.push(viewer);
    }
    
    set({ viewers: [...viewers] });
  },
  
  clearViewers: () => set({ viewers: [] }),
  
  // Capabilities
  setCapabilities: (caps: RFCapabilities) => set({ capabilities: caps }),
  
  // Reset
  reset: () => set(initialState),
}));

// Derived selectors
export const useCurrentScreenName = () => useRFStore(s => s.currentScreen);
export const useCurrentMode = () => useRFStore(s => s.currentMode);
export const useScanPhase = () => useRFStore(s => s.scanPhase);
export const useStatus = () => useRFStore(s => s.status);
export const useWifi = () => useRFStore(s => s.wifi);
export const useBLE = () => useRFStore(s => s.ble);
export const useSubGHz = () => useRFStore(s => s.subghz);
export const useViewers = () => useRFStore(s => s.viewers);
export const useDelta = () => useRFStore(s => s.delta);
export const useCapabilities = () => useRFStore(s => s.capabilities);
