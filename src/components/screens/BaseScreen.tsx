// Base screen component wrapper - maintains 528x352 aspect ratio
import React, { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface ScreenProps {
  children: ReactNode;
  className?: string;
  scrollable?: boolean;
}

/**
 * EpaperScreen - Base container maintaining e-paper display aspect ratio
 * Width: 528px, Height: 352px (3:2 ratio)
 */
export const EpaperScreen: React.FC<ScreenProps> = ({
  children,
  className,
  scrollable = false,
}) => {
  return (
    <div
      className={cn(
        'w-[528px] h-[352px]',
        'bg-white border-2 border-black',
        'flex flex-col',
        'relative overflow-hidden',
        className,
      )}
      role="region"
      aria-label="E-paper display"
    >
      {scrollable ? (
        <div className="flex-1 overflow-y-auto overflow-x-hidden">{children}</div>
      ) : (
        children
      )}
    </div>
  );
};

/**
 * ScreenHeader - Standard header for all screens
 * 28px height with title and mode indicator
 */
export interface ScreenHeaderProps {
  title: string;
  pageNum?: number;
  totalPages?: number;
  mode?: string;
  modeIcon?: ReactNode;
}

export const ScreenHeader: React.FC<ScreenHeaderProps> = ({
  title,
  pageNum,
  totalPages,
  mode,
  modeIcon,
}) => {
  return (
    <div className="h-7 bg-black text-white flex items-center justify-between px-2.5 flex-shrink-0 border-b border-gray-400">
      <div className="flex items-center gap-1.5">
        <span className="opacity-40 text-xs font-mono">〔</span>
        <span className="font-mono font-bold text-xs tracking-wide animate-pulse">
          {title}
        </span>
        <span className="opacity-40 text-xs font-mono">〕</span>
        {pageNum !== undefined && totalPages !== undefined && (
          <span className="text-xs opacity-50 font-mono ml-1">
            {pageNum}/{totalPages}
          </span>
        )}
      </div>

      {mode && (
        <div className="flex items-center gap-1 border border-gray-400 px-1.5 py-0.5 rounded-sm">
          {modeIcon && <span className="text-xs">{modeIcon}</span>}
          <span className="text-xs font-mono font-bold">{mode}</span>
        </div>
      )}
    </div>
  );
};

/**
 * ScreenFooter - Standard footer with status and controls
 */
export interface ScreenFooterProps {
  status: string;
  controls: string;
  scanning?: boolean;
}

export const ScreenFooter: React.FC<ScreenFooterProps> = ({
  status,
  controls,
  scanning = false,
}) => {
  return (
    <>
      {/* Status Line */}
      <div className="h-5 border-t border-gray-300 flex items-center px-2 gap-1.5 bg-white flex-shrink-0">
        <span
          className={cn(
            'w-1.5 h-1.5 rounded-full flex-shrink-0 inline-block',
            scanning ? 'bg-white animate-blink' : 'bg-black',
            scanning && 'shadow-glow',
          )}
        />
        <span className="text-xs font-mono text-black overflow-hidden text-ellipsis whitespace-nowrap">
          {status}
        </span>
      </div>

      {/* Control Hints */}
      <div className="h-5 border-t-2 border-black flex items-center px-2 bg-gray-200 flex-shrink-0">
        <span className="text-xs font-mono text-gray-700 tracking-tight">
          {controls}
        </span>
      </div>
    </>
  );
};

/**
 * ScreenContent - Main content area with proper padding
 */
export interface ScreenContentProps {
  children: ReactNode;
  className?: string;
  scrollable?: boolean;
  noPadding?: boolean;
}

export const ScreenContent: React.FC<ScreenContentProps> = ({
  children,
  className,
  scrollable = false,
  noPadding = false,
}) => {
  return (
    <div
      className={cn(
        'flex-1 overflow-hidden flex flex-col',
        !noPadding && 'px-2 py-1.5',
        scrollable && 'overflow-y-auto',
        className,
      )}
    >
      {children}
    </div>
  );
};

/**
 * ScreenRow - Single data row with label and value
 */
export interface ScreenRowProps {
  label: string;
  value: string | number;
  secondaryValue?: string;
  className?: string;
}

export const ScreenRow: React.FC<ScreenRowProps> = ({
  label,
  value,
  secondaryValue,
  className,
}) => {
  return (
    <div
      className={cn(
        'flex items-center justify-between py-1 px-1 border-b border-gray-200 last:border-b-0',
        'text-xs font-mono',
        className,
      )}
    >
      <span className="font-semibold text-gray-800">{label}</span>
      <div className="flex items-center gap-2">
        {secondaryValue && (
          <span className="text-gray-600">{secondaryValue}</span>
        )}
        <span className="text-black font-bold">{value}</span>
      </div>
    </div>
  );
};

/**
 * RSSIBar - Visual signal strength indicator
 */
export interface RSSIBarProps {
  rssi: number;
  width?: number;
  showLabel?: boolean;
  className?: string;
}

export const RSSIBar: React.FC<RSSIBarProps> = ({
  rssi,
  width = 100,
  showLabel = true,
  className,
}) => {
  // Convert RSSI to percentage: -100 dBm = 0%, -30 dBm = 100%
  const percent = Math.max(0, Math.min(100, ((rssi + 100) / 70) * 100));
  const fillWidth = Math.round((width * percent) / 100);

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* Bar */}
      <div
        className="border border-black relative"
        style={{ width: `${width}px`, height: '6px' }}
      >
        <div
          className="bg-black h-full transition-all"
          style={{ width: `${fillWidth}px` }}
        />
        {/* Grid lines at 25%, 50%, 75% */}
        {[25, 50, 75].map((pct) => (
          <div
            key={pct}
            className="absolute top-0 bottom-0 w-px bg-gray-400 opacity-50"
            style={{ left: `${pct}%` }}
          />
        ))}
      </div>

      {showLabel && (
        <span className="text-xs font-mono font-bold w-12">{rssi}dBm</span>
      )}
    </div>
  );
};

/**
 * DataTable - For listing networks, devices, etc.
 */
export interface DataTableProps {
  headers: string[];
  rows: (string | number)[][];
  className?: string;
  rowHeight?: number;
}

export const DataTable: React.FC<DataTableProps> = ({
  headers,
  rows,
  className,
  rowHeight = 20,
}) => {
  return (
    <div className={cn('w-full border border-black', className)}>
      {/* Headers */}
      <div className="flex border-b border-black bg-gray-100">
        {headers.map((header, i) => (
          <div
            key={i}
            className="flex-1 px-1 py-0.5 text-xs font-mono font-bold text-gray-700 border-r border-gray-300 last:border-r-0"
          >
            {header}
          </div>
        ))}
      </div>

      {/* Rows */}
      {rows.map((row, rowIdx) => (
        <div key={rowIdx} className="flex border-b border-gray-200 last:border-b-0">
          {row.map((cell, colIdx) => (
            <div
              key={colIdx}
              className="flex-1 px-1 py-0.5 text-xs font-mono text-black border-r border-gray-300 last:border-r-0 overflow-hidden text-ellipsis whitespace-nowrap"
              style={{ minHeight: `${rowHeight}px` }}
            >
              {cell}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

/**
 * StatBox - Key metric display
 */
export interface StatBoxProps {
  label: string;
  value: string | number;
  unit?: string;
  trend?: 'up' | 'down' | 'neutral';
  className?: string;
}

export const StatBox: React.FC<StatBoxProps> = ({
  label,
  value,
  unit,
  trend,
  className,
}) => {
  return (
    <div
      className={cn(
        'border border-black p-2 rounded-sm',
        'flex flex-col items-center justify-center gap-1',
        className,
      )}
    >
      <span className="text-xs font-mono text-gray-700">{label}</span>
      <div className="flex items-baseline gap-1">
        {trend === 'up' && <span className="text-xs text-green-600">↑</span>}
        {trend === 'down' && <span className="text-xs text-red-600">↓</span>}
        <span className="text-lg font-bold font-mono text-black">{value}</span>
        {unit && <span className="text-xs text-gray-600">{unit}</span>}
      </div>
    </div>
  );
};

/**
 * Loading Indicator - Animated scanning overlay
 */
export interface LoadingIndicatorProps {
  message?: string;
  progress?: number;
}

export const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({
  message = 'SCANNING...',
  progress,
}) => {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-black/20">
      <svg width="112" height="112" viewBox="0 0 112 112" className="mb-4">
        <circle
          cx="56"
          cy="56"
          r="52"
          stroke="black"
          strokeWidth="1.5"
          fill="rgba(255,255,255,0.92)"
        />
        <circle
          cx="56"
          cy="56"
          r="38"
          stroke="black"
          strokeWidth="1"
          fill="none"
          opacity="0.45"
        />
        <circle
          cx="56"
          cy="56"
          r="22"
          stroke="black"
          strokeWidth="0.8"
          fill="none"
          opacity="0.35"
        />
        <circle cx="56" cy="56" r="8" stroke="black" strokeWidth="0.8" fill="none" />
        <circle cx="56" cy="56" r="2.5" fill="black" />
        <line
          x1="56"
          y1="56"
          x2="108"
          y2="56"
          stroke="black"
          strokeWidth="1.5"
          className="animate-spin origin-center"
          style={{ animationDuration: '2s' }}
        />
      </svg>

      <div className="bg-white border-2 border-black px-4 py-1.5 rounded-sm mb-2">
        <span className="text-sm font-mono font-bold text-black">{message}</span>
      </div>

      {progress !== undefined && (
        <div className="w-64 h-2 border border-black bg-gray-100">
          <div
            className="h-full bg-black transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      <div className="text-xs font-mono text-black mt-2">[CAN] to abort</div>
    </div>
  );
};

/**
 * Spectrum Visualizer - For SubGHz display
 */
export interface SpectrumVisualizerProps {
  frequencies: Array<{ freq: number; rssi: number | null; selected?: boolean }>;
  width?: number;
  height?: number;
}

export const SpectrumVisualizer: React.FC<SpectrumVisualizerProps> = ({
  frequencies,
  width = 510,
  height = 78,
}) => {
  const minR = -100;
  const maxR = -25;

  const toY = (r: number) => ((r - maxR) / (minR - maxR)) * (height - 14) + 4;
  const toX = (i: number) => 20 + (i / Math.max(1, frequencies.length - 1)) * (width - 40);

  const noiseY = toY(-95);
  const noisePts = Array.from({ length: 60 })
    .map(
      (_, i) =>
        `${(i / 59) * width},${noiseY + Math.sin(i * 2.3) * 2 + Math.cos(i * 0.8) * 1.5}`,
    )
    .join(' L ');

  return (
    <svg width={width} height={height} className="border border-black">
      {/* Grid lines */}
      {[-50, -70, -90].map((r) => (
        <g key={r}>
          <line x1={0} y1={toY(r)} x2={width} y2={toY(r)} stroke="black" strokeWidth="0.4" opacity="0.2" />
          <text x={3} y={toY(r) - 1} fontSize="6" fontFamily="monospace" fill="gray">
            {r}
          </text>
        </g>
      ))}

      {/* Noise floor */}
      <polyline points={noisePts} fill="none" stroke="lightgray" strokeWidth="0.8" />

      {/* Frequency bars */}
      {frequencies.map((f, i) => {
        const x = toX(i);
        const y = toY(f.rssi || -100);
        const sel = f.selected;
        const bw = sel ? 16 : 9;

        return (
          <g key={f.freq}>
            <rect x={x - bw / 2} y={y} width={bw} height={noiseY - y} fill={sel ? 'black' : 'gray'} />
            <circle cx={x} cy={y} r={sel ? 4 : 2.5} fill="black" />
            {sel && f.rssi && (
              <text x={x} y={y - 5} textAnchor="middle" fontSize="7" fontFamily="monospace" fill="black">
                {f.rssi}dBm
              </text>
            )}
            <text
              x={x}
              y={height - 1}
              textAnchor="middle"
              fontSize="7"
              fontFamily="monospace"
              fill={sel ? 'black' : 'gray'}
            >
              {f.freq.toFixed(2)}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

export default {
  EpaperScreen,
  ScreenHeader,
  ScreenFooter,
  ScreenContent,
  ScreenRow,
  RSSIBar,
  DataTable,
  StatBox,
  LoadingIndicator,
  SpectrumVisualizer,
};
