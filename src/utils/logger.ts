// Conditional logging utility for production performance

const ENABLE_PERF_LOGS = false; // Off by default, enable for debugging
const ENABLE_DEBUG_LOGS = false; // Off by default, enable for debugging

export const perfLog = (...args: any[]) => {
  if (ENABLE_PERF_LOGS) console.log(...args);
};

export const debugLog = (...args: any[]) => {
  if (ENABLE_DEBUG_LOGS) console.log(...args);
};

export const errorLog = console.error; // Always enabled

export const measurePerf = <T>(label: string, fn: () => T): T => {
  if (!ENABLE_PERF_LOGS) return fn();

  const start = performance.now();
  const result = fn();
  const end = performance.now();

  console.log(`[PERF] ${label}: ${(end - start).toFixed(2)}ms`);
  return result;
};
