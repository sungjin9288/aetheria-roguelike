import type { TossSdkSurface } from './tossSdk';

// 토스 빌드가 아닌 빌드(웹 · iOS · Android)에서 앱인토스 SDK 자리에 들어가는 대역(scripts/tossSdkTarget.mjs가 푼다).
// 그 빌드의 런타임은 'toss' | 'sandbox'가 될 수 없어 앱은 SDK를 부르지 않는다. 불렀다면 그 문이 깨진 것이므로
// 흉내 내지 않고 던진다. 지원 여부(isSupported)만은 사실대로 false다.
const unavailable = (member: string): never => {
    throw new Error(`Apps in Toss SDK is not bundled in this build: ${member}`);
};

const unsupportedBridge = (member: string) => Object.assign(
    (): never => unavailable(member),
    { isSupported: () => false },
);

export const {
    Environment,
    Storage,
    SafeArea,
    Screen,
    generateHapticFeedback,
    graniteEvent,
    loadFullScreenAd,
    showFullScreenAd,
}: TossSdkSurface = {
    Environment: {
        get environment(): never {
            return unavailable('Environment.environment');
        },
        get deploymentId(): never {
            return unavailable('Environment.deploymentId');
        },
    },
    Storage: {
        getItem: () => unavailable('Storage.getItem'),
        setItem: () => unavailable('Storage.setItem'),
        removeItem: () => unavailable('Storage.removeItem'),
    },
    SafeArea: {
        get: () => unavailable('SafeArea.get'),
        subscribe: () => unavailable('SafeArea.subscribe'),
    },
    Screen: {
        close: () => unavailable('Screen.close'),
    },
    generateHapticFeedback: () => unavailable('generateHapticFeedback'),
    graniteEvent: {
        addEventListener: () => unavailable('graniteEvent.addEventListener'),
    },
    loadFullScreenAd: unsupportedBridge('loadFullScreenAd'),
    showFullScreenAd: unsupportedBridge('showFullScreenAd'),
};
