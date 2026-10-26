import { Capacitor, registerPlugin } from '@capacitor/core';
import { generateHapticFeedback } from './tossSdk';
import { getRuntimeEnvironment, type RuntimeEnvironment } from './runtimeEnvironment';

/**
 * 진동 피드백 포트 — 2026-10-26 소유자 결정 D3(감사 GF-04). 소리는 출시 뒤라 여기에 없다.
 *
 * 계기는 다섯이다: 내가 맞음 · 치명타 · 레벨 상승 · 전설 획득 · 사망. 언제 울릴지는 표시 계층(`hooks/useHapticFeedback.ts`)이
 * 정하고, 이 모듈은 "어떻게 울릴지"만 소유한다 — 게임 판정(CombatEngine · 리듀서)은 이 모듈을 모른다.
 *
 * 뒤쪽(백엔드)은 런타임마다 하나를 고른다(위가 우선):
 *   1. Capacitor 네이티브 `Haptics` 플러그인이 런타임에 등록돼 있으면 그것 — `@capacitor/haptics` 패키지를 가져오지 않고
 *      `registerPlugin('Haptics')`로 같은 이름의 네이티브 구현을 부른다. 패키지가 설치 · `cap sync`되기 전에는
 *      `isPluginAvailable`이 거짓이라 이 길을 타지 않는다(컴파일은 패키지 없이 된다).
 *   2. 앱인토스 런타임(toss · sandbox)이면 SDK의 `generateHapticFeedback`(결제 API가 아니다 — 출시 결제 금지 계약 밖).
 *   3. 그 밖의 웹은 `navigator.vibrate`가 있으면 그것(iOS Safari에는 없다).
 *   4. 아무것도 없으면 울리지 않는다.
 *
 * 실패는 게임을 멈추지 않는다 — 개발 빌드에서만 경고를 남긴다(제품 텔레메트리 · 저장소 실패와 같은 원칙: 게임으로 전파하지 않고,
 * 성공으로 꾸미지도 않는다).
 */

export type FeedbackCue = 'hit' | 'crit' | 'levelUp' | 'legendary' | 'death';
export type HapticBackendKind = 'native' | 'toss' | 'web' | 'none';

/** `@capacitor/haptics`의 네이티브 메서드 중 이 포트가 부르는 것만(패키지 타입을 가져오지 않는다). */
export interface NativeHapticsPlugin {
    impact(options: { style: 'HEAVY' | 'MEDIUM' | 'LIGHT' }): Promise<void>;
    notification(options: { type: 'SUCCESS' | 'WARNING' | 'ERROR' }): Promise<void>;
}

type TossHapticType = Parameters<typeof generateHapticFeedback>[0]['type'];
type VibratePattern = number | number[];

export interface FeedbackEnvironment {
    readonly runtime: RuntimeEnvironment;
    readonly isNativePluginAvailable: (name: string) => boolean;
    readonly getNativeHaptics: () => NativeHapticsPlugin;
    readonly tossHaptic: (options: { type: TossHapticType }) => Promise<void>;
    /** `navigator.vibrate`(없으면 null). */
    readonly vibrate: ((pattern: VibratePattern) => boolean) | null;
    readonly reportFailure: (backend: HapticBackendKind, cue: FeedbackCue, error: unknown) => void;
}

export interface FeedbackPort {
    readonly kind: HapticBackendKind;
    play(cue: FeedbackCue): void;
}

export const NATIVE_HAPTICS_PLUGIN_NAME = 'Haptics';

// 네이티브: 맞음 · 치명타는 짧은 충격, 레벨 · 전설은 성공 알림, 사망은 오류 알림.
const NATIVE_CUES: Readonly<Record<FeedbackCue, (plugin: NativeHapticsPlugin) => Promise<void>>> = {
    hit: (plugin) => plugin.impact({ style: 'MEDIUM' }),
    crit: (plugin) => plugin.impact({ style: 'HEAVY' }),
    levelUp: (plugin) => plugin.notification({ type: 'SUCCESS' }),
    legendary: (plugin) => plugin.notification({ type: 'SUCCESS' }),
    death: (plugin) => plugin.notification({ type: 'ERROR' }),
};

const TOSS_CUES: Readonly<Record<FeedbackCue, TossHapticType>> = {
    hit: 'tickMedium',
    crit: 'basicMedium',
    levelUp: 'success',
    legendary: 'confetti',
    death: 'error',
};

// 웹 진동 길이(밀리초) — 맞음은 한 번 짧게, 치명타는 두 번, 레벨 · 전설은 세 박자, 사망은 길게.
const WEB_CUES: Readonly<Record<FeedbackCue, VibratePattern>> = {
    hit: 30,
    crit: [20, 40, 40],
    levelUp: [40, 60, 40],
    legendary: [30, 50, 30, 50, 80],
    death: [120, 80, 200],
};

const settle = (
    run: () => Promise<void> | boolean | void,
    onFailure: (error: unknown) => void,
): void => {
    try {
        const result = run();
        if (result instanceof Promise) result.catch(onFailure);
    } catch (error) {
        onFailure(error);
    }
};

/** 뒤쪽 고르기 — 순수 판정(테스트가 환경을 주입한다). */
export const selectHapticBackendKind = (env: FeedbackEnvironment): HapticBackendKind => {
    if (env.runtime === 'capacitor' && env.isNativePluginAvailable(NATIVE_HAPTICS_PLUGIN_NAME)) return 'native';
    if (env.runtime === 'toss' || env.runtime === 'sandbox') return 'toss';
    if (env.vibrate) return 'web';
    return 'none';
};

export const createFeedbackPort = (env: FeedbackEnvironment): FeedbackPort => {
    const kind = selectHapticBackendKind(env);
    let nativePlugin: NativeHapticsPlugin | null = null;
    const play = (cue: FeedbackCue): void => {
        const onFailure = (error: unknown) => env.reportFailure(kind, cue, error);
        switch (kind) {
            case 'native':
                settle(() => {
                    nativePlugin ??= env.getNativeHaptics();
                    return NATIVE_CUES[cue](nativePlugin);
                }, onFailure);
                return;
            case 'toss':
                settle(() => env.tossHaptic({ type: TOSS_CUES[cue] }), onFailure);
                return;
            case 'web':
                settle(() => env.vibrate?.(WEB_CUES[cue]), onFailure);
                return;
            case 'none':
                return;
            default: {
                const exhaustive: never = kind;
                return exhaustive;
            }
        }
    };
    return { kind, play };
};

const reportFailureInDev = (backend: HapticBackendKind, cue: FeedbackCue, error: unknown): void => {
    if (!import.meta.env?.DEV) return;
    console.warn(`[feedbackPort] ${backend} haptic failed for ${cue}`, error);
};

const readNavigatorVibrate = (): FeedbackEnvironment['vibrate'] => {
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return null;
    return (pattern) => navigator.vibrate(pattern);
};

export const createRuntimeFeedbackEnvironment = (): FeedbackEnvironment => ({
    runtime: getRuntimeEnvironment(),
    isNativePluginAvailable: (name) => Capacitor.isPluginAvailable(name),
    getNativeHaptics: () => registerPlugin<NativeHapticsPlugin>(NATIVE_HAPTICS_PLUGIN_NAME),
    tossHaptic: (options) => generateHapticFeedback(options),
    vibrate: readNavigatorVibrate(),
    reportFailure: reportFailureInDev,
});

let runtimePort: FeedbackPort | null = null;

/** 앱이 부르는 진입점 — 런타임 뒤쪽은 처음 울릴 때 한 번 고른다. */
export const playFeedbackCue = (cue: FeedbackCue): void => {
    runtimePort ??= createFeedbackPort(createRuntimeFeedbackEnvironment());
    runtimePort.play(cue);
};
