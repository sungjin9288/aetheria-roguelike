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

const getLatestEntry = (name, type) => {
    if (typeof performance === 'undefined') return null;
    const entries = performance.getEntriesByName(name, type);
    return entries.length > 0 ? entries[entries.length - 1] : null;
};

export const markPerf = (name) => {
    if (typeof performance === 'undefined') return null;
    performance.mark(name);
    return getLatestEntry(name, 'mark');
};

export const markPerfOnce = (name) => {
    const registry = getRegistry();
    if (!registry) return null;
    if (registry.marks.has(name)) return getLatestEntry(name, 'mark');
    registry.marks.add(name);
    return markPerf(name);
};

export const measurePerf = (name, startMark, endMark) => {
    if (typeof performance === 'undefined') return null;
    try {
        performance.measure(name, startMark, endMark);
    } catch {
        return null;
    }
    return getLatestEntry(name, 'measure');
};

export const measurePerfOnce = (name, startMark, endMark) => {
    const registry = getRegistry();
    if (!registry) return null;
    if (registry.measures.has(name)) return getLatestEntry(name, 'measure');
    const entry = measurePerf(name, startMark, endMark);
    if (entry) registry.measures.add(name);
    return entry;
};

export const getPerfSnapshot = () => {
    if (typeof performance === 'undefined') return {};

    const snapshot = {};
    performance.getEntriesByType('measure')
        .filter((entry) => entry.name.startsWith('aetheria:'))
        .forEach((entry) => {
            snapshot[entry.name] = Number(entry.duration.toFixed(1));
        });

    performance.getEntriesByType('mark')
        .filter((entry) => entry.name.startsWith('aetheria:'))
        .forEach((entry) => {
            snapshot[`${entry.name}:mark`] = Number(entry.startTime.toFixed(1));
        });

    return snapshot;
};
