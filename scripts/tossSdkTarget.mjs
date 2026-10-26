import path from 'node:path';

// 앱인토스 SDK(@apps-in-toss/web-framework)는 토스 빌드(VITE_PLATFORM_TARGET=toss)에만 들어간다.
// 앱의 SDK 사용은 모두 런타임 'toss' | 'sandbox' 뒤에 있고 resolveRuntimeEnvironment는 그 둘을 토스 빌드에서만 낸다 —
// 웹 · iOS · Android 진입 청크에 SDK와 의존성(semver · valibot · @webview-bridge, 약 200KB)이 실려 매번 내려받고 파싱됐다.
// 그 밖의 빌드는 패키지를 같은 표면의 대역(아래 모듈)으로 푼다. 앱이 SDK를 읽는 곳은 src/platform/tossSdk.ts 하나다.
export const TOSS_SDK_SPECIFIER = '@apps-in-toss/web-framework';
export const TOSS_SDK_UNAVAILABLE_MODULE = 'src/platform/tossSdkUnavailable.ts';

/** 런타임이 읽는 값(import.meta.env.VITE_PLATFORM_TARGET)과 같은 해석된 env로 판정한다. */
export const bundlesTossSdk = (env) => env?.VITE_PLATFORM_TARGET === 'toss';

export const tossSdkTargetPlugin = ({ repoRoot }) => {
    const unavailableModule = path.join(repoRoot, TOSS_SDK_UNAVAILABLE_MODULE);
    let bundleSdk = true;

    return {
        name: 'aetheria:toss-sdk-target',
        enforce: 'pre',
        configResolved(config) {
            bundleSdk = bundlesTossSdk(config.env);
        },
        resolveId(source) {
            if (bundleSdk || source !== TOSS_SDK_SPECIFIER) return null;
            return unavailableModule;
        },
    };
};
