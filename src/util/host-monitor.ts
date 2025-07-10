import { info } from 'src/logger';

export type CPUInfo = {
  usage: number;
  idle: number;
};

export type MemoryInfo = {
  total: number;
  available: number;
  used: number;
  free: number;
  percentage: number;
};

class HostMonitor {
  readonly replay = new Array<{
    cpuInfo: CPUInfo;
    memInfo: MemoryInfo;
  }>();

  async #update() {
    const cpuInfo = await (async () => {
      const cpuData = await Bun.file('/host/proc/stat').text();
      const cpuLine = cpuData.split('\n').at(0)?.split(/\s+/);
      if (!cpuLine) return undefined;

      const idle = parseInt(cpuLine[4], 10);
      const total = cpuLine.slice(1, 8).reduce((acc, val) => acc + parseInt(val, 10), 0);

      return {
        usage: ((total - idle) / total) * 100,
        idle: (idle / total) * 100,
      } satisfies CPUInfo;
    })();

    const memInfo = await (async () => {
      const memData = await Bun.file('/host/proc/meminfo').text();
      const lines = memData.split('\n');

      const memTotal = parseInt(
        lines.find(line => line.startsWith('MemTotal:'))?.split(/\s+/)[1] || '0',
        10,
      );
      const memFree = parseInt(
        lines.find(line => line.startsWith('MemFree:'))?.split(/\s+/)[1] || '0',
        10,
      );
      const memAvailable = parseInt(
        lines.find(line => line.startsWith('MemAvailable:'))?.split(/\s+/)[1] || '0',
        10,
      );

      return {
        total: memTotal * 1024,
        available: memAvailable * 1024,
        used: (memTotal - memAvailable) * 1024,
        free: memFree * 1024,
        percentage: ((memTotal - memAvailable) / memTotal) * 100,
      } satisfies MemoryInfo;
    })();

    if (cpuInfo && memInfo) {
      this.replay.push({ cpuInfo, memInfo });
      if (this.replay.length > 60) {
        this.replay.shift();
      }
    }

    setTimeout(() => {
      this.#update();
    }, 1000);
  }

  constructor() {
    this.#update();
  }

  get prometheusMetrics(): string {
    const latest = this.replay.at(-1);
    if (!latest) return '# No data available\n';

    const { cpuInfo, memInfo } = latest;
    const timestamp = Date.now();

    return (
      `# HELP host_cpu_usage_percent CPU usage percentage
      # TYPE host_cpu_usage_percent gauge
      host_cpu_usage_percent ${cpuInfo.usage.toFixed(2)} ${timestamp}

      # HELP host_cpu_idle_percent CPU idle percentage
      # TYPE host_cpu_idle_percent gauge
      host_cpu_idle_percent ${cpuInfo.idle.toFixed(2)} ${timestamp}

      # HELP host_memory_total_bytes Total memory in bytes
      # TYPE host_memory_total_bytes gauge
      host_memory_total_bytes ${memInfo.total} ${timestamp}

      # HELP host_memory_available_bytes Available memory in bytes
      # TYPE host_memory_available_bytes gauge
      host_memory_available_bytes ${memInfo.available} ${timestamp}

      # HELP host_memory_used_bytes Used memory in bytes
      # TYPE host_memory_used_bytes gauge
      host_memory_used_bytes ${memInfo.used} ${timestamp}

      # HELP host_memory_free_bytes Free memory in bytes
      # TYPE host_memory_free_bytes gauge
      host_memory_free_bytes ${memInfo.free} ${timestamp}

      # HELP host_memory_usage_percent Memory usage percentage
      # TYPE host_memory_usage_percent gauge
      host_memory_usage_percent ${memInfo.percentage.toFixed(2)} ${timestamp}
      `
        .split('\n')
        .map(line => line.trim())
        .join('\n') + '\n'
    );
  }
}

export const hostMonitor = new HostMonitor();
