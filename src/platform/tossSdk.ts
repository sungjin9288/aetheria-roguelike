// 앱인토스 SDK를 앱에서 읽는 유일한 곳이다. SDK는 토스 빌드에만 들어가고, 다른 빌드는 패키지를
// ./tossSdkUnavailable로 푼다(scripts/tossSdkTarget.mjs). 앱의 SDK 사용은 모두 런타임 'toss' | 'sandbox' 뒤에 있다.
// `export … from` 대신 이름 가져오기를 쓴다 — tests/launch-no-payment-contract.test.js가 SDK에서 가져오는 이름을 읽는다.
import {
    Environment as SdkEnvironment,
    SafeArea as SdkSafeArea,
    Screen as SdkScreen,
    Storage as SdkStorage,
    graniteEvent as sdkGraniteEvent,
    loadFullScreenAd as sdkLoadFullScreenAd,
    showFullScreenAd as sdkShowFullScreenAd,
} from '@apps-in-toss/web-framework';

/**
 * 앱이 부르는 SDK 표면. 대역(tossSdkUnavailable)도 같은 표면을 구현하므로, 새 멤버를 쓰려면 여기에 더하고
 * 대역에도 구현해야 컴파일된다.
 */
export interface TossSdkSurface {
    Environment: Pick<typeof SdkEnvironment, 'environment' | 'deploymentId'>;
    Storage: Pick<typeof SdkStorage, 'getItem' | 'setItem' | 'removeItem'>;
    SafeArea: Pick<typeof SdkSafeArea, 'get' | 'subscribe'>;
    Screen: Pick<typeof SdkScreen, 'close'>;
    graniteEvent: typeof sdkGraniteEvent;
    loadFullScreenAd: typeof sdkLoadFullScreenAd;
    showFullScreenAd: typeof sdkShowFullScreenAd;
}

export const {
    Environment,
    Storage,
    SafeArea,
    Screen,
    graniteEvent,
    loadFullScreenAd,
    showFullScreenAd,
}: TossSdkSurface = {
    Environment: SdkEnvironment,
    Storage: SdkStorage,
    SafeArea: SdkSafeArea,
    Screen: SdkScreen,
    graniteEvent: sdkGraniteEvent,
    loadFullScreenAd: sdkLoadFullScreenAd,
    showFullScreenAd: sdkShowFullScreenAd,
};
