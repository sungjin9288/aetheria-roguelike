import { Capacitor } from '@capacitor/core';
import { Environment } from '@apps-in-toss/web-framework';

import type { ProductEventContext, ProductEventOs } from './productEvents';
import { getRuntimeEnvironment, type RuntimeEnvironment } from './runtimeEnvironment';

const SAFE_ID = /^[A-Za-z0-9._:-]{1,96}$/;

const assertSafeId = (value: unknown, label: string): string => {
    const normalized = String(value || '').trim();
    if (!SAFE_ID.test(normalized)) throw new Error(`Invalid ${label}`);
    return normalized;
};

export const resolveProductEventOs = ({
    nativePlatform = Capacitor.getPlatform(),
    userAgent = typeof navigator === 'undefined' ? '' : navigator.userAgent,
}: {
    nativePlatform?: string;
    userAgent?: string;
} = {}): ProductEventOs => {
    const normalizedPlatform = String(nativePlatform).toLowerCase();
    const normalizedAgent = String(userAgent).toLowerCase();
    if (normalizedPlatform === 'ios' || /iphone|ipad|ipod/.test(normalizedAgent)) return 'ios';
    if (normalizedPlatform === 'android' || normalizedAgent.includes('android')) return 'android';
    if (normalizedPlatform === 'web') return 'web';
    return 'unknown';
};

export const readProductReleaseId = ({
    runtime,
    readTossDeploymentId = () => Environment.deploymentId,
    buildReleaseId = import.meta.env?.VITE_RELEASE_ID,
}: {
    runtime: RuntimeEnvironment;
    readTossDeploymentId?: () => string;
    buildReleaseId?: string | null;
}): string | null => {
    const candidate = runtime === 'toss' || runtime === 'sandbox'
        ? (() => {
            try {
                return readTossDeploymentId();
            } catch {
                return null;
            }
        })()
        : buildReleaseId;
    const normalized = String(candidate || '').trim();
    if (!SAFE_ID.test(normalized) || ['local', 'unknown'].includes(normalized.toLowerCase())) return null;
    return normalized;
};

export const createMemorySessionId = (
    randomUuid = () => globalThis.crypto?.randomUUID?.()
        || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
): string => `session:${assertSafeId(randomUuid(), 'session uuid')}`;

export const createProductEventContext = ({
    releaseId,
    runtime,
    os,
    sessionId,
    startedAt = Date.now(),
}: ProductEventContext): ProductEventContext => {
    if (!['web', 'capacitor', 'toss', 'sandbox'].includes(runtime)) {
        throw new Error('Invalid runtime environment');
    }
    if (!['ios', 'android', 'web', 'unknown'].includes(os)) throw new Error('Invalid operating system');
    if (!Number.isFinite(startedAt) || startedAt < 0) throw new Error('Invalid session start time');
    return {
        releaseId: assertSafeId(releaseId, 'release id'),
        runtime,
        os,
        sessionId: assertSafeId(sessionId, 'session id'),
        startedAt,
    };
};

export const createRuntimeProductEventContext = (): ProductEventContext | null => {
    const runtime = getRuntimeEnvironment();
    const releaseId = readProductReleaseId({ runtime });
    if (!releaseId) return null;
    return createProductEventContext({
        releaseId,
        runtime,
        os: resolveProductEventOs(),
        sessionId: createMemorySessionId(),
        startedAt: Date.now(),
    });
};

let runtimeProductEventContext: ProductEventContext | null | undefined;

export const getRuntimeProductEventContext = (): ProductEventContext | null => {
    if (runtimeProductEventContext !== undefined) return runtimeProductEventContext;
    runtimeProductEventContext = createRuntimeProductEventContext();
    return runtimeProductEventContext;
};
