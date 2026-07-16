// RF API Service - Handles communication with backend/device
import { WiFiNetwork, BLEDevice, SubGHzSignal, Viewer, RFCapabilities } from '../store/rfStore';

export interface ScanResult {
  wifi: WiFiNetwork[];
  ble: BLEDevice[];
  subghz: SubGHzSignal[];
  errors?: Record<string, string>;
}

export interface ViewerData {
  viewers: Viewer[];
}

export interface SystemStatus {
  capabilities: RFCapabilities;
  mode: string;
  scanning: boolean;
}

// Mock data for development
const MOCK_WIFI: WiFiNetwork[] = [
  { ssid: "NEXUS_NODE_7", bssid: "A4:C3:F0:11", rssi: -45, channel: 6 },
  { ssid: "DARKNET_ACCESS", bssid: "B2:11:DC:44", rssi: -62, channel: 11 },
  { ssid: "GHOST_PROTOCOL", bssid: "F0:22:9A:88", rssi: -71, channel: 1 },
  { ssid: "HYDRA_MESH_2", bssid: "11:22:33:AB", rssi: -78, channel: 36 },
  { ssid: "CIPHER_RELAY_X", bssid: "CC:DD:EE:01", rssi: -83, channel: 6 },
];

const MOCK_BLE: BLEDevice[] = [
  { name: "GHOST_TAG_A1", addr: "DE:AD:BE:EF:01", rssi: -42, type: "BLE5" },
  { name: "NEXUS_TRACKER", addr: "CA:FE:BA:BE:22", rssi: -59, type: "BLE4" },
  { name: "[UNKNOWN]", addr: "F0:0D:CA:FE:33", rssi: -67, type: "BLE5" },
  { name: "CIPHER_NODE_B", addr: "AB:CD:EF:12:44", rssi: -74, type: "BLE4" },
  { name: "DRONE_CTRL_7", addr: "11:22:DE:AD:55", rssi: -81, type: "BLE5" },
];

const MOCK_SUBGHZ: SubGHzSignal[] = [
  { freq: 315.0, rssi: -38, count: 24, label: "KEYFOB" },
  { freq: 433.92, rssi: -52, count: 187, label: "ISM_BAND" },
  { freq: 868.35, rssi: -61, count: 43, label: "LORA_EU" },
  { freq: 915.0, rssi: -74, count: 12, label: "ISM_US" },
  { freq: 433.42, rssi: -88, count: 6, label: "UNKNOWN" },
];

const MOCK_VIEWERS: Viewer[] = [
  { kind: "wifi", addr: "B2:D4:F1:9A:12", rssi: -49, firstSeen: Date.now(), lastSeen: Date.now() },
  { kind: "ble", addr: "CA:FE:00:11:22", rssi: -61, firstSeen: Date.now(), lastSeen: Date.now() },
  { kind: "wifi", addr: "A1:B2:C3:D4:E5", rssi: -72, firstSeen: Date.now(), lastSeen: Date.now() },
];

class RFAPIService {
  private baseUrl: string;
  private wsUrl?: string;
  private mockMode: boolean = true; // Set to false when backend is ready

  constructor(baseUrl: string = process.env.REACT_APP_API_URL || 'http://localhost:3001', mockMode: boolean = true) {
    this.baseUrl = baseUrl;
    this.mockMode = mockMode;
  }

  private async fetchJSON<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Failed to fetch ${endpoint}:`, error);
      throw error;
    }
  }

  /**
   * Get system capabilities
   */
  async getCapabilities(): Promise<RFCapabilities> {
    if (this.mockMode) {
      return {
        wifi: true,
        ble: true,
        subghz: true,
        subghzRssi: true,
        wifiViewers: true,
        bleViewers: true,
      };
    }

    return this.fetchJSON<RFCapabilities>('/api/rf/capabilities');
  }

  /**
   * Initiate RF scan (WiFi, BLE, SubGHz)
   */
  async scanRF(): Promise<ScanResult> {
    if (this.mockMode) {
      return this.mockScan();
    }

    return this.fetchJSON<ScanResult>('/api/rf/scan', {
      method: 'POST',
      body: JSON.stringify({ timeout_ms: 3500 }),
    });
  }

  /**
   * Scan WiFi networks
   */
  async scanWiFi(timeout_ms: number = 3500): Promise<WiFiNetwork[]> {
    if (this.mockMode) {
      // Simulate scan with slight variation
      return MOCK_WIFI.map(net => ({
        ...net,
        rssi: net.rssi + (Math.random() * 6 - 3), // Add ±3 dBm variation
      }));
    }

    return this.fetchJSON<WiFiNetwork[]>('/api/rf/wifi/scan', {
      method: 'POST',
      body: JSON.stringify({ timeout_ms, passive: true }),
    });
  }

  /**
   * Scan BLE devices
   */
  async scanBLE(duration_ms: number = 2500): Promise<BLEDevice[]> {
    if (this.mockMode) {
      return MOCK_BLE.map(dev => ({
        ...dev,
        rssi: dev.rssi + (Math.random() * 6 - 3),
      }));
    }

    return this.fetchJSON<BLEDevice[]>('/api/rf/ble/scan', {
      method: 'POST',
      body: JSON.stringify({ duration_ms, passive: true }),
    });
  }

  /**
   * Scan SubGHz spectrum
   */
  async scanSubGHz(frequencies?: number[]): Promise<SubGHzSignal[]> {
    if (this.mockMode) {
      return MOCK_SUBGHZ.map(sig => ({
        ...sig,
        rssi: sig.rssi ? sig.rssi + (Math.random() * 8 - 4) : null,
        count: sig.count + Math.floor(Math.random() * 10),
      }));
    }

    return this.fetchJSON<SubGHzSignal[]>('/api/rf/subghz/scan', {
      method: 'POST',
      body: JSON.stringify({ frequencies }),
    });
  }

  /**
   * Get active viewers (devices scanning/connecting to you)
   */
  async getViewers(): Promise<Viewer[]> {
    if (this.mockMode) {
      return MOCK_VIEWERS.map(v => ({
        ...v,
        lastSeen: Date.now(),
        rssi: v.rssi + (Math.random() * 4 - 2),
      }));
    }

    return this.fetchJSON<Viewer[]>('/api/rf/viewers');
  }

  /**
   * Set device mode (SCAN, BROADCAST, STEALTH)
   */
  async setMode(mode: 'SCAN' | 'BROADCAST' | 'STEALTH'): Promise<{ status: string }> {
    if (this.mockMode) {
      return { status: `Mode changed to ${mode}` };
    }

    return this.fetchJSON<{ status: string }>('/api/rf/mode', {
      method: 'POST',
      body: JSON.stringify({ mode }),
    });
  }

  /**
   * Get system status
   */
  async getStatus(): Promise<SystemStatus> {
    if (this.mockMode) {
      return {
        capabilities: {
          wifi: true,
          ble: true,
          subghz: true,
          subghzRssi: true,
          wifiViewers: true,
          bleViewers: true,
        },
        mode: 'SCAN',
        scanning: false,
      };
    }

    return this.fetchJSON<SystemStatus>('/api/status');
  }

  /**
   * Mock scan with sequential phases
   */
  private async mockScan(): Promise<ScanResult> {
    const errors: Record<string, string> = {};

    // Simulate sequential scanning
    const wifi = await this.scanWiFi(1000);
    const ble = await this.scanBLE(800);
    const subghz = await this.scanSubGHz();

    return { wifi, ble, subghz, errors };
  }

  /**
   * Stream real-time RF data via WebSocket
   */
  subscribeToRFData(onData: (data: Partial<ScanResult>) => void, onError: (error: Error) => void) {
    if (this.mockMode) {
      // Mock subscription with polling
      const interval = setInterval(async () => {
        try {
          const data = await this.mockScan();
          onData(data);
        } catch (error) {
          onError(error as Error);
        }
      }, 5000);

      return () => clearInterval(interval);
    }

    if (!this.wsUrl) {
      onError(new Error('WebSocket not configured'));
      return () => {};
    }

    const ws = new WebSocket(this.wsUrl);

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'subscribe', channel: 'rf_data' }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onData(data);
      } catch (error) {
        onError(error as Error);
      }
    };

    ws.onerror = (event) => {
      onError(new Error(`WebSocket error: ${event}`));
    };

    return () => ws.close();
  }

  /**
   * Export scan data
   */
  async exportData(format: 'json' | 'csv' = 'json'): Promise<Blob> {
    if (this.mockMode) {
      const data = {
        timestamp: new Date().toISOString(),
        wifi: MOCK_WIFI,
        ble: MOCK_BLE,
        subghz: MOCK_SUBGHZ,
      };
      return new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    }

    const response = await fetch(`${this.baseUrl}/api/rf/export?format=${format}`);
    if (!response.ok) throw new Error('Export failed');
    return response.blob();
  }

  /**
   * Get historical scan data
   */
  async getHistory(limit: number = 10): Promise<ScanResult[]> {
    if (this.mockMode) {
      return [await this.mockScan()];
    }

    return this.fetchJSON<ScanResult[]>(`/api/rf/history?limit=${limit}`);
  }

  /**
   * Clear all cached data
   */
  async clearCache(): Promise<{ status: string }> {
    if (this.mockMode) {
      return { status: 'Cache cleared' };
    }

    return this.fetchJSON<{ status: string }>('/api/cache/clear', {
      method: 'POST',
    });
  }
}

export default new RFAPIService();
