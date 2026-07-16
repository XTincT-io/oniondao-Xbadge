// SUMMARY Screen - Overview of all RF activity
import React from 'react';
import {
  EpaperScreen,
  ScreenHeader,
  ScreenContent,
  ScreenFooter,
  StatBox,
  RSSIBar,
} from './BaseScreen';
import { useWifi, useBLE, useSubGHz, useDelta, useCurrentMode } from '@/store/rfStore';

export const SummaryScreen: React.FC = () => {
  const wifi = useWifi();
  const ble = useBLE();
  const subghz = useSubGHz();
  const delta = useDelta();
  const mode = useCurrentMode();

  const wifiBest = wifi[0];
  const bleBest = ble[0];
  const subBest = subghz[0];

  const getTrendIcon = (value?: number) => {
    if (!value) return 'neutral';
    return value > 0 ? 'up' : value < 0 ? 'down' : 'neutral';
  };

  return (
    <EpaperScreen>
      <ScreenHeader
        title="SUMMARY"
        pageNum={1}
        totalPages={6}
        mode={mode}
        modeIcon={getModeIcon(mode)}
      />

      <ScreenContent scrollable>
        <div className="space-y-2">
          {/* WiFi Summary */}
          <div className="border border-black p-1.5 rounded-sm">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-mono font-bold">≋ WIFI APs</span>
              <span className="text-xs font-mono text-gray-700">{wifi.length} found</span>
            </div>
            {wifiBest ? (
              <>
                <div className="text-xs font-mono text-black mb-1">
                  Best: {wifiBest.ssid.substring(0, 20)}
                </div>
                <RSSIBar rssi={wifiBest.rssi} width={90} showLabel={true} />
                {delta.wifi && (
                  <div className="text-xs font-mono mt-1 flex justify-between">
                    <span>Δ {delta.wifi > 0 ? '+' : ''}{delta.wifi}dBm</span>
                    <span className={delta.wifi > 0 ? 'text-green-600' : 'text-red-600'}>
                      {delta.wifi > 0 ? '↑' : '↓'}
                    </span>
                  </div>
                )}
              </>
            ) : (
              <div className="text-xs font-mono text-gray-600">Ready to scan</div>
            )}
          </div>

          {/* BLE Summary */}
          <div className="border border-black p-1.5 rounded-sm">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-mono font-bold">β BLE DEVICES</span>
              <span className="text-xs font-mono text-gray-700">{ble.length} found</span>
            </div>
            {bleBest ? (
              <>
                <div className="text-xs font-mono text-black mb-1">
                  Best: {bleBest.name.substring(0, 20)}
                </div>
                <RSSIBar rssi={bleBest.rssi} width={90} showLabel={true} />
                {delta.ble && (
                  <div className="text-xs font-mono mt-1 flex justify-between">
                    <span>Δ {delta.ble > 0 ? '+' : ''}{delta.ble}dBm</span>
                    <span className={delta.ble > 0 ? 'text-green-600' : 'text-red-600'}>
                      {delta.ble > 0 ? '↑' : '↓'}
                    </span>
                  </div>
                )}
              </>
            ) : (
              <div className="text-xs font-mono text-gray-600">Ready to scan</div>
            )}
          </div>

          {/* SubGHz Summary */}
          <div className="border border-black p-1.5 rounded-sm">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-mono font-bold">∿ SUBGHZ</span>
              <span className="text-xs font-mono text-gray-700">{subghz.length} freqs</span>
            </div>
            {subBest ? (
              <>
                <div className="text-xs font-mono text-black mb-1">
                  {subBest.freq.toFixed(2)} MHz • {subBest.label}
                </div>
                {subBest.rssi && (
                  <>
                    <RSSIBar rssi={subBest.rssi} width={90} showLabel={true} />
                    {delta.subghz && (
                      <div className="text-xs font-mono mt-1 flex justify-between">
                        <span>Δ {delta.subghz > 0 ? '+' : ''}{delta.subghz}dBm</span>
                        <span className={delta.subghz > 0 ? 'text-green-600' : 'text-red-600'}>
                          {delta.subghz > 0 ? '↑' : '↓'}
                        </span>
                      </div>
                    )}
                  </>
                )}
                <div className="text-xs font-mono text-gray-700 mt-1">
                  {subBest.count} hits
                </div>
              </>
            ) : (
              <div className="text-xs font-mono text-gray-600">Ready to scan</div>
            )}
          </div>
        </div>
      </ScreenContent>

      <ScreenFooter
        status="SELECT to scan • L/R pages"
        controls="[◄►:PAGES] [●:SCAN] [✕:MODE]"
      />
    </EpaperScreen>
  );
};

function getModeIcon(mode: string) {
  switch (mode) {
    case 'SCAN':
      return '◉';
    case 'BROADCAST':
      return '📢';
    case 'STEALTH':
      return '👻';
    default:
      return '●';
  }
}

export default SummaryScreen;
