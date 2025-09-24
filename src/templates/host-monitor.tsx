import { generateTailwindCSS } from 'src/util/generate-tailwindcss';
import { hostMonitor, type CPUInfo, type MemoryInfo } from '../util/host-monitor';

type DataPoint = {
  timestamp: number;
  cpuInfo: CPUInfo;
  memInfo: MemoryInfo;
};

const formatBytes = (bytes: number): string => {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
};

const formatPercentage = (value: number): string => {
  return `${value.toFixed(1)}%`;
};

const LineChart = ({
  data,
  getValue,
  label,
  color = '#3b82f6',
  unit = '%',
}: {
  data: DataPoint[];
  getValue: (point: DataPoint) => number;
  label: string;
  color?: string;
  unit?: string;
}) => {
  if (data.length === 0) return null;

  // Use fixed range for percentage units, dynamic for bytes
  const maxValue = unit === 'bytes' ? Math.max(...data.map(getValue)) : 100;
  const minValue = unit === 'bytes' ? Math.min(...data.map(getValue)) : 0;
  const range = maxValue - minValue || 1;

  const width = 600;
  const height = 200;
  const padding = 40;

  const points = data
    .map((point, index) => {
      const x = (index / (data.length - 1 || 1)) * (width - padding * 2) + padding;
      const y = height - padding - ((getValue(point) - minValue) / range) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(' ');

  const currentValue = data.length > 0 ? getValue(data[data.length - 1]) : 0;

  return (
    <div class="bg-white rounded-lg shadow-md p-4 mb-4">
      <div class="flex justify-between items-center mb-2">
        <h3 safe class="text-lg font-semibold text-gray-800">
          {label}
        </h3>
        <span safe class="text-xl font-bold" style={{ color }}>
          {unit === 'bytes' ? formatBytes(currentValue) : formatPercentage(currentValue)}
        </span>
      </div>
      <svg width={width} height={height} class="border rounded" style={{ width: '100%' }}>
        {/* Grid lines */}
        <defs>
          <pattern id={`grid-${label}`} width="50" height="40" patternUnits="userSpaceOnUse">
            <path d="M 50 0 L 0 0 0 40" fill="none" stroke="#e5e7eb" stroke-width="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#grid-${label})`} />

        {/* Y-axis labels */}
        {[0, 0.25, 0.5, 0.75, 1].map(ratio => {
          const y = height - padding - ratio * (height - padding * 2);
          const value = minValue + ratio * range;
          return (
            <g>
              <line
                x1={padding}
                y1={y}
                x2={width - padding}
                y2={y}
                stroke="#d1d5db"
                stroke-width="1"
              />
              <text safe x={padding - 5} y={y + 4} text-anchor="end" class="text-xs fill-gray-600">
                {unit === 'bytes' ? formatBytes(value) : formatPercentage(value)}
              </text>
            </g>
          );
        })}

        {/* Chart line */}
        <polyline
          points={points}
          fill="none"
          stroke={color}
          stroke-width="2"
          stroke-linejoin="round"
          stroke-linecap="round"
        />

        {/* Fill area under curve */}
        <polygon
          points={`${padding},${height - padding} ${points} ${width - padding},${height - padding}`}
          fill={color}
          fill-opacity="0.1"
        />
      </svg>
    </div>
  );
};

export const hostMonitorUI = async () => {
  // Convert replay data to include timestamps
  const dataPoints: DataPoint[] = hostMonitor.replay.map((point, index) => ({
    timestamp: Date.now() - (hostMonitor.replay.length - index - 1) * 1000,
    ...point,
  }));

  const htmlContent =
    '<!DOCTYPE html>' +
    (
      <html>
        <head>
          <title>Host Monitor</title>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <style>#TAILWIND_CSS</style>
          <style>
            {`
            .metric-card {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            }
            .metric-value {
              font-family: 'Courier New', monospace;
            }
          `}
          </style>
        </head>
        <body class="bg-gray-100 min-h-screen">
          <div class="container mx-auto px-4 py-8">
            <div class="mb-8">
              <h1 class="text-3xl font-bold text-gray-800 mb-2">Host Monitor Dashboard</h1>
              <p class="text-gray-600">Real-time system performance monitoring</p>
            </div>

            {/* Current Stats Cards */}
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {dataPoints.length > 0 &&
                (() => {
                  const latest = dataPoints[dataPoints.length - 1];
                  return (
                    <>
                      <div class="bg-blue-500 text-white rounded-lg p-4 shadow-lg">
                        <div class="flex items-center justify-between">
                          <div>
                            <p class="text-blue-100 text-sm">CPU Usage</p>
                            <p class="text-2xl font-bold metric-value" safe>
                              {formatPercentage(latest.cpuInfo.usage)}
                            </p>
                          </div>
                          <div class="text-blue-200">
                            <svg class="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
                            </svg>
                          </div>
                        </div>
                      </div>

                      <div class="bg-green-500 text-white rounded-lg p-4 shadow-lg">
                        <div class="flex items-center justify-between">
                          <div>
                            <p class="text-green-100 text-sm">Memory Usage</p>
                            <p class="text-2xl font-bold metric-value" safe>
                              {formatPercentage(latest.memInfo.percentage)}
                            </p>
                          </div>
                          <div class="text-green-200">
                            <svg class="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                            </svg>
                          </div>
                        </div>
                      </div>

                      <div class="bg-purple-500 text-white rounded-lg p-4 shadow-lg">
                        <div class="flex items-center justify-between">
                          <div>
                            <p class="text-purple-100 text-sm">Memory Used</p>
                            <p class="text-2xl font-bold metric-value" safe>
                              {formatBytes(latest.memInfo.used)}
                            </p>
                          </div>
                          <div class="text-purple-200">
                            <svg class="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                              <path
                                fill-rule="evenodd"
                                d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
                                clip-rule="evenodd"
                              />
                            </svg>
                          </div>
                        </div>
                      </div>

                      <div class="bg-orange-500 text-white rounded-lg p-4 shadow-lg">
                        <div class="flex items-center justify-between">
                          <div>
                            <p class="text-orange-100 text-sm">Memory Available</p>
                            <p class="text-2xl font-bold metric-value" safe>
                              {formatBytes(latest.memInfo.available)}
                            </p>
                          </div>
                          <div class="text-orange-200">
                            <svg class="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                              <path
                                fill-rule="evenodd"
                                d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 11-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z"
                                clip-rule="evenodd"
                              />
                            </svg>
                          </div>
                        </div>
                      </div>
                    </>
                  );
                })()}
            </div>

            {/* Charts */}
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <LineChart
                  data={dataPoints}
                  getValue={point => point.cpuInfo.usage}
                  label="CPU Usage"
                  color="#3b82f6"
                />
                <LineChart
                  data={dataPoints}
                  getValue={point => point.cpuInfo.idle}
                  label="CPU Idle"
                  color="#10b981"
                />
              </div>
              <div>
                <LineChart
                  data={dataPoints}
                  getValue={point => point.memInfo.percentage}
                  label="Memory Usage"
                  color="#8b5cf6"
                />
                <LineChart
                  data={dataPoints}
                  getValue={point => point.memInfo.used}
                  label="Memory Used (Bytes)"
                  color="#f59e0b"
                  unit="bytes"
                />
              </div>
            </div>

            {/* Auto-refresh script */}
            <script>
              {`
              // Auto-refresh every 5 seconds
              setInterval(() => {
                window.location.reload();
              }, 5000);
            `}
            </script>
          </div>
        </body>
      </html>
    );

  const patched = await generateTailwindCSS(htmlContent, 'host-monitor.css');
  return htmlContent.replace('#TAILWIND_CSS', patched);
};
