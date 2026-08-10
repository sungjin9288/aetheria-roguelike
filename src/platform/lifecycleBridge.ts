import { SafeArea, Screen, graniteEvent } from '@apps-in-toss/web-framework';

import type { RuntimeEnvironment } from './runtimeEnvironment';

type LifecycleSource = 'visibility' | 'home';

interface SafeAreaValue {
    top: number;
    right: number;
    bottom: number;
    left: number;
}

interface DocumentTarget {
    visibilityState?: string;
    documentElement?: {
        style: {
            setProperty(name: string, value: string): void;
        };
    };
    addEventListener(name: string, listener: () => void): void;
    removeEventListener(name: string, listener: () => void): void;
}

interface TossLifecycleBridge {
    getSafeArea(): SafeAreaValue;
    subscribeSafeArea(listener: (value: SafeAreaValue) => void): () => void;
    subscribeBack(listener: () => void): () => void;
    subscribeHome(listener: () => void): () => void;
    close(): Promise<void>;
}

interface LifecycleCallbacks {
    onBackground?: (source: LifecycleSource) => void;
    onForeground?: (source: LifecycleSource) => void;
    onBack?: () => boolean | Promise<boolean>;
    onError?: (error: unknown) => void;
}

interface BindLifecycleBridgeOptions {
    environment: RuntimeEnvironment;
    documentTarget?: DocumentTarget;
    callbacks: LifecycleCallbacks;
    tossBridge?: TossLifecycleBridge;
}

const defaultTossBridge: TossLifecycleBridge = {
    getSafeArea: () => SafeArea.get(),
    subscribeSafeArea: (listener) => SafeArea.subscribe({ onEvent: listener }),
    subscribeBack: (listener) => graniteEvent.addEventListener('backEvent', { onEvent: listener }),
    subscribeHome: (listener) => graniteEvent.addEventListener('homeEvent', { onEvent: listener }),
    close: () => Screen.close(),
};

const normalizeInset = (value: unknown) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 0;
    return Math.min(200, Math.max(0, parsed));
};

const applySafeArea = (documentTarget: DocumentTarget, value: SafeAreaValue) => {
    const style = documentTarget.documentElement?.style;
    if (!style) return;
    for (const edge of ['top', 'right', 'bottom', 'left'] as const) {
        style.setProperty(`--aether-safe-area-${edge}`, `${normalizeInset(value[edge])}px`);
    }
};

export const bindLifecycleBridge = ({
    environment,
    documentTarget = document,
    callbacks,
    tossBridge = defaultTossBridge,
}: BindLifecycleBridgeOptions): (() => void) => {
    const cleanups: Array<() => void> = [];
    let lifecycleState = documentTarget.visibilityState === 'hidden' ? 'background' : 'foreground';
    const transition = (next: 'background' | 'foreground', source: LifecycleSource) => {
        if (lifecycleState === next) return;
        lifecycleState = next;
        if (next === 'background') callbacks.onBackground?.(source);
        else callbacks.onForeground?.(source);
    };
    const onVisibilityChange = () => {
        transition(
            documentTarget.visibilityState === 'hidden' ? 'background' : 'foreground',
            'visibility',
        );
    };
    documentTarget.addEventListener('visibilitychange', onVisibilityChange);
    cleanups.push(() => documentTarget.removeEventListener('visibilitychange', onVisibilityChange));

    if (environment === 'toss' || environment === 'sandbox') {
        try {
            applySafeArea(documentTarget, tossBridge.getSafeArea());
        } catch (error) {
            callbacks.onError?.(error);
        }
        try {
            cleanups.push(tossBridge.subscribeSafeArea((value) => applySafeArea(documentTarget, value)));
        } catch (error) {
            callbacks.onError?.(error);
        }
        try {
            cleanups.push(tossBridge.subscribeBack(() => {
                void (async () => {
                    let handled = false;
                    try {
                        handled = await callbacks.onBack?.() ?? false;
                    } catch (error) {
                        callbacks.onError?.(error);
                    }
                    if (handled) return;
                    try {
                        await tossBridge.close();
                    } catch (error) {
                        callbacks.onError?.(error);
                    }
                })();
            }));
        } catch (error) {
            callbacks.onError?.(error);
        }
        try {
            cleanups.push(tossBridge.subscribeHome(() => transition('background', 'home')));
        } catch (error) {
            callbacks.onError?.(error);
        }
    }

    return () => {
        for (const cleanup of cleanups.reverse()) cleanup();
    };
};
