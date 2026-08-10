import { loadFullScreenAd, showFullScreenAd } from '@apps-in-toss/web-framework';

export type RewardedAdShowEvent =
    | 'requested'
    | 'show'
    | 'impression'
    | 'clicked'
    | 'dismissed'
    | 'failedToShow'
    | 'userEarnedReward';

export interface RewardedAdPort {
    isSupported(): boolean;
    load(input: {
        adGroupId: string;
        onLoaded: () => void;
        onError: () => void;
    }): () => void;
    show(input: {
        adGroupId: string;
        onEvent: (event: RewardedAdShowEvent) => void;
        onError: () => void;
    }): () => void;
}

type LoadBridge = typeof loadFullScreenAd;
type ShowBridge = typeof showFullScreenAd;

export const createSdkRewardedAdPort = ({
    loadBridge = loadFullScreenAd,
    showBridge = showFullScreenAd,
}: {
    loadBridge?: LoadBridge;
    showBridge?: ShowBridge;
} = {}): RewardedAdPort => ({
    isSupported: () => {
        try {
            return loadBridge.isSupported() && showBridge.isSupported();
        } catch {
            return false;
        }
    },
    load: ({ adGroupId, onLoaded, onError }) => loadBridge({
        options: { adGroupId },
        onEvent: (event) => {
            if (event.type === 'loaded') onLoaded();
        },
        onError: () => onError(),
    }),
    show: ({ adGroupId, onEvent, onError }) => showBridge({
        options: { adGroupId },
        onEvent: (event) => onEvent(event.type),
        onError: () => onError(),
    }),
});

export const NOOP_REWARDED_AD_PORT: RewardedAdPort = {
    isSupported: () => false,
    load: () => () => undefined,
    show: () => () => undefined,
};

export const resolveRewardedAdGroupId = (
    configured: unknown,
    runtime: string,
): string | null => {
    if (!['toss', 'sandbox'].includes(runtime)) return null;
    const value = typeof configured === 'string' ? configured.trim() : '';
    if (value === 'ait-ad-test-rewarded-id') {
        return runtime === 'sandbox' ? value : null;
    }
    if (!value || ['test', 'test-ad-group-id', 'sample', 'demo'].includes(value.toLowerCase())) {
        return null;
    }
    return value;
};
