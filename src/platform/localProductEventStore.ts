import {
    normalizeProductEventJob, PRODUCT_EVENT_NAMES, PRODUCT_EVENT_OUTCOMES,
    type ProductEvent, type ProductEventName,
} from './productEvents';
import type { AiFallbackReason, AiRequestKind } from './aiEventPolicy';
import type { ProductEventSink } from './productEventSink';

// 기기 진단 보관 한도이며 게임 밸런스와 독립적이다. 오래된 항목부터 제거한다.
export const PRODUCT_EVENT_STORAGE_KEY = 'aetheria.product-events.v1';
export const PRODUCT_EVENT_LIMIT = 200;
export const PRODUCT_EVENT_MAX_BYTES = 128 * 1024;
type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export type LocalActivityEvent = ProductEvent | (Pick<ProductEvent, 'releaseId' | 'runtime' | 'os' | 'sessionId'> & {
    name: 'ai_fallback'; requestKind: AiRequestKind; reason: AiFallbackReason;
});
let lastWriteFailed = false;
export const didProductEventWriteFail = (): boolean => lastWriteFailed;
export interface ProductEventReadResult {
    status: 'ready' | 'invalid' | 'unavailable';
    events: LocalActivityEvent[];
}
const defaultStorage = (): StorageLike | null => {
    try { return globalThis.localStorage ?? null; } catch { return null; }
};
const safeId = (value: unknown): value is string => typeof value === 'string'
    && /^[A-Za-z0-9._:-]{1,96}$/.test(value);

const projectEvent = (value: unknown): LocalActivityEvent | null => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const row = value as Record<string, unknown>;
    const { name, releaseId, runtime, os, sessionId, job, levelBand, elapsedBucket, outcome } = row;
    if (!safeId(releaseId) || ['local', 'unknown'].includes(releaseId.toLowerCase())
        || !safeId(sessionId)
        || typeof runtime !== 'string' || !['web', 'capacitor', 'toss', 'sandbox'].includes(runtime)
        || typeof os !== 'string' || !['ios', 'android', 'web', 'unknown'].includes(os)) return null;
    if (name === 'ai_fallback') {
        const { requestKind, reason } = row;
        if ((requestKind !== 'event' && requestKind !== 'story') || typeof reason !== 'string'
            || !['mock-runtime', 'quota', 'proxy-disabled', 'proxy-unavailable', 'proxy-rejected',
                'malformed-response', 'recent-duplicate'].includes(reason)) return null;
        return { name, releaseId, runtime, os, sessionId, requestKind, reason } as LocalActivityEvent;
    }
    if (typeof name !== 'string' || !PRODUCT_EVENT_NAMES.includes(name as ProductEventName)
        || typeof job !== 'string' || normalizeProductEventJob(job) !== job
        || typeof levelBand !== 'string' || !['1-4', '5-9', '10-19', '20-44', '45-59', '60-74', '75+'].includes(levelBand)
        || typeof elapsedBucket !== 'string' || !['0-10s', '11-30s', '31-60s', '1-3m', '3-5m', '5-10m', '10-30m', '30m+'].includes(elapsedBucket)
        || typeof outcome !== 'string' || !PRODUCT_EVENT_OUTCOMES[name as ProductEventName].includes(outcome)) return null;
    // 저장소에서 읽은 객체를 spread하지 않는다. 내보내기도 이 9필드만 통과한다.
    return { name, releaseId, runtime, os, sessionId, job, levelBand, elapsedBucket, outcome } as ProductEvent;
};
const byteLength = (raw: string) => new TextEncoder().encode(raw).length;

export const readProductEvents = (storage = defaultStorage()): ProductEventReadResult => {
    let raw: string | null;
    try {
        if (!storage) return { status: 'unavailable', events: [] };
        raw = storage.getItem(PRODUCT_EVENT_STORAGE_KEY);
    } catch { return { status: 'unavailable', events: [] }; }
    if (raw === null) return { status: 'ready', events: [] };
    if (raw.length > PRODUCT_EVENT_MAX_BYTES || byteLength(raw) > PRODUCT_EVENT_MAX_BYTES) {
        return { status: 'invalid', events: [] };
    }
    try {
        const parsed = JSON.parse(raw);
        if (parsed?.version !== 1 || !Array.isArray(parsed.events)) return { status: 'invalid', events: [] };
        const events = parsed.events.slice(-PRODUCT_EVENT_LIMIT)
            .map(projectEvent).filter((event: LocalActivityEvent | null): event is LocalActivityEvent => event !== null);
        return { status: 'ready', events };
    } catch { return { status: 'invalid', events: [] }; }
};

export const appendProductEvent = (value: unknown, storage = defaultStorage()): boolean => {
    lastWriteFailed = true;
    try {
        const event = projectEvent(value);
        if (!event || !storage) return false;
        const current = readProductEvents(storage);
        if (current.status === 'unavailable') return false;
        const events = [...current.events, event].slice(-PRODUCT_EVENT_LIMIT);
        let raw = JSON.stringify({ version: 1, events });
        while (byteLength(raw) > PRODUCT_EVENT_MAX_BYTES && events.length > 1) {
            events.shift();
            raw = JSON.stringify({ version: 1, events });
        }
        if (byteLength(raw) > PRODUCT_EVENT_MAX_BYTES) return false;
        storage.setItem(PRODUCT_EVENT_STORAGE_KEY, raw);
        lastWriteFailed = false;
        return true;
    } catch { return false; }
};

export const clearProductEvents = (storage = defaultStorage()): boolean => {
    try {
        if (!storage) return false;
        storage.removeItem(PRODUCT_EVENT_STORAGE_KEY);
        return storage.getItem(PRODUCT_EVENT_STORAGE_KEY) === null;
    } catch { return false; }
};

export const LOCAL_PRODUCT_EVENT_SINK: ProductEventSink = {
    async send(event) {
        if (!appendProductEvent(event)) throw new Error('Local product event storage unavailable');
    },
};
