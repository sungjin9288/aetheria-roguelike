import { CLASSES } from '../data/classes';
import type { RuntimeEnvironment } from './runtimeEnvironment';

export const PRODUCT_EVENT_NAMES = [
    'boot',
    'character_created',
    'first_action',
    'mission_open',
    'move',
    'explore',
    'combat_start',
    'combat_end',
    'safe_expedition_return',
    'save',
    'restore',
    'feedback_submission',
    'fatal_error_boundary',
    'ad_offer',
    'ad_load',
    'ad_show',
    'ad_reward',
    'ad_failure',
] as const;

export type ProductEventName = typeof PRODUCT_EVENT_NAMES[number];
export type ProductEventOs = 'ios' | 'android' | 'web' | 'unknown';
export type LevelBand = '1-4' | '5-9' | '10-19' | '20-44' | '45-59' | '60-74' | '75+';
export type ElapsedBucket = '0-10s' | '11-30s' | '31-60s' | '1-3m' | '3-5m' | '5-10m' | '10-30m' | '30m+';

export const PRODUCT_EVENT_OUTCOMES: Record<ProductEventName, readonly string[]> = {
    boot: ['ready', 'offline', 'failed'],
    character_created: ['success'],
    first_action: ['mission_open', 'move', 'explore'],
    mission_open: ['success'],
    move: ['success', 'blocked'],
    explore: ['event', 'combat', 'nothing', 'blocked', 'failed'],
    combat_start: ['normal', 'boss'],
    combat_end: ['victory', 'defeat', 'escaped', 'interrupted'],
    safe_expedition_return: ['success'],
    save: ['success', 'failure', 'skipped'],
    restore: ['local', 'cloud', 'fresh', 'failure'],
    feedback_submission: ['success', 'validation_failed', 'transport_failed'],
    fatal_error_boundary: ['caught'],
    ad_offer: ['eligible'],
    ad_load: ['loaded'],
    ad_show: ['requested', 'shown', 'rewarded', 'dismissed'],
    ad_reward: ['pending', 'delivered'],
    ad_failure: ['load_failed', 'show_failed', 'reward_rejected'],
};

export interface ProductEventContext {
    releaseId: string;
    runtime: RuntimeEnvironment;
    os: ProductEventOs;
    sessionId: string;
    startedAt: number;
}

export interface ProductEventFields {
    job: string;
    level: number;
    outcome: string;
}

export interface ProductEvent {
    name: ProductEventName;
    releaseId: string;
    runtime: RuntimeEnvironment;
    os: ProductEventOs;
    sessionId: string;
    job: string;
    levelBand: LevelBand;
    elapsedBucket: ElapsedBucket;
    outcome: string;
}

const EVENT_NAME_SET = new Set<string>(PRODUCT_EVENT_NAMES);
const EVENT_FIELDS = new Set(['job', 'level', 'outcome']);
const VALID_JOBS = new Set([...Object.keys(CLASSES), 'unknown']);

export const normalizeProductEventJob = (job: unknown): string => {
    const normalized = String(job || '').trim();
    return VALID_JOBS.has(normalized) ? normalized : 'unknown';
};

export const getLevelBand = (level: number): LevelBand => {
    const normalized = Number.isFinite(level) ? Math.max(1, Math.floor(level)) : 1;
    if (normalized < 5) return '1-4';
    if (normalized < 10) return '5-9';
    if (normalized < 20) return '10-19';
    if (normalized < 45) return '20-44';
    if (normalized < 60) return '45-59';
    if (normalized < 75) return '60-74';
    return '75+';
};

export const getElapsedBucket = (elapsedMs: number): ElapsedBucket => {
    const normalized = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
    if (normalized <= 10_000) return '0-10s';
    if (normalized <= 30_000) return '11-30s';
    if (normalized <= 60_000) return '31-60s';
    if (normalized <= 180_000) return '1-3m';
    if (normalized <= 300_000) return '3-5m';
    if (normalized <= 600_000) return '5-10m';
    if (normalized <= 1_800_000) return '10-30m';
    return '30m+';
};

export const buildProductEvent = (
    name: string,
    fields: ProductEventFields,
    context: ProductEventContext,
    occurredAt = Date.now(),
): ProductEvent => {
    if (!EVENT_NAME_SET.has(name)) throw new Error(`Unsupported product event: ${name}`);
    if (!fields || typeof fields !== 'object' || Array.isArray(fields)) {
        throw new Error('Product event fields must be an object');
    }
    for (const field of Object.keys(fields)) {
        if (!EVENT_FIELDS.has(field)) throw new Error(`Unsupported product event field: ${field}`);
    }
    if (Object.keys(fields).length !== EVENT_FIELDS.size) {
        throw new Error('Product event requires job, level and outcome');
    }
    if (!Number.isFinite(occurredAt) || occurredAt < context.startedAt) {
        throw new Error('Invalid product event timestamp');
    }

    const eventName = name as ProductEventName;
    const job = String(fields.job || '').trim();
    if (normalizeProductEventJob(job) !== job) throw new Error('Unsupported product event job');
    const outcome = String(fields.outcome || '');
    if (!PRODUCT_EVENT_OUTCOMES[eventName].includes(outcome)) {
        throw new Error(`Unsupported outcome for ${eventName}`);
    }

    return {
        name: eventName,
        releaseId: context.releaseId,
        runtime: context.runtime,
        os: context.os,
        sessionId: context.sessionId,
        job,
        levelBand: getLevelBand(fields.level),
        elapsedBucket: getElapsedBucket(occurredAt - context.startedAt),
        outcome,
    };
};
