const getRegistry = () => {
    if (typeof window === 'undefined') return null;
    if (!window.__AETHERIA_PERF_REGISTRY__) {
        window.__AETHERIA_PERF_REGISTRY__ = {
            marks: new Set(),
            measures: new Set(),
        };
    }
    return window.__AETHERIA_PERF_REGISTRY__;
};

const getLatestEntry = (name: any, type: any) => {
    if (typeof performance === 'undefined') return null;
    const entries = performance.getEntriesByName(name, type);
    return entries.length > 0 ? entries[entries.length - 1] : null;
};

export const markPerf = (name: any) => {
    if (typeof performance === 'undefined') return null;
    performance.mark(name);
    return getLatestEntry(name, 'mark');
};

export const markPerfOnce = (name: any) => {
    const registry = getRegistry();
    if (!registry) return null;
    if (registry.marks.has(name)) return getLatestEntry(name, 'mark');
    registry.marks.add(name);
    return markPerf(name);
};

// cycle 303: export 제거 — measurePerfOnce 내부 1회만 사용, 외부 consumer 0건.
const measurePerf = (name: any, startMark: any, endMark: any) => {
    if (typeof performance === 'undefined') return null;
    try {
        performance.measure(name, startMark, endMark);
    } catch {
        return null;
    }
    return getLatestEntry(name, 'measure');
};

export const measurePerfOnce = (name: any, startMark: any, endMark: any) => {
    const registry = getRegistry();
    if (!registry) return null;
    if (registry.measures.has(name)) return getLatestEntry(name, 'measure');
    const entry = measurePerf(name, startMark, endMark);
    if (entry) registry.measures.add(name);
    return entry;
};

export const getPerfSnapshot = () => {
    if (typeof performance === 'undefined') return {};

    const snapshot: Record<string, any> = {};
    performance.getEntriesByType('measure')
        .filter((entry: any) => entry.name.startsWith('aetheria:'))
        .forEach((entry: any) => {
            snapshot[entry.name] = Number(entry.duration.toFixed(1));
        });

    performance.getEntriesByType('mark')
        .filter((entry: any) => entry.name.startsWith('aetheria:'))
        .forEach((entry: any) => {
            snapshot[`${entry.name}:mark`] = Number(entry.startTime.toFixed(1));
        });

    return snapshot;
};
