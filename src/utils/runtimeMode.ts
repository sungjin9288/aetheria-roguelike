/**
 * runtimeMode.ts — URL 플래그 기반 런타임 모드 감지.
 *
 * smoke=1: smoke-gameplay.mjs 자동화 시나리오 (Firebase 스킵)
 * e2e=1:   Playwright E2E 테스트 (Firebase 스킵, 동일 경로 재사용)
 * VITE_DEVICE_QA_SCENARIO: 운영 데이터와 분리된 실기기 QA 시나리오
 *
 * URL test flag는 VITE_ENABLE_TEST_API=1로 빌드한 검증 번들에서만 활성화한다.
 * production/native build에서 query string만으로 mock runtime을 열 수 없다.
 */

export const ITEM_INVESTMENT_DEVICE_QA_SCENARIO = 'item-investment';
export const GRAVE_RECOVERY_DEVICE_QA_SCENARIO = 'grave-recovery';

const DEVICE_QA_SCENARIOS = new Set([
    ITEM_INVESTMENT_DEVICE_QA_SCENARIO,
    GRAVE_RECOVERY_DEVICE_QA_SCENARIO,
]);

const isTestHarnessBuild = (): boolean => {
    if (import.meta.env) return import.meta.env.VITE_ENABLE_TEST_API === '1';
    return typeof process !== 'undefined';
};

const hasFlag = (key: string): boolean => {
    if (typeof window === 'undefined') return false;
    try {
        return new URLSearchParams(window.location.search).get(key) === '1';
    } catch {
        return false;
    }
};

export const isSmokeRuntime = (): boolean => isTestHarnessBuild() && hasFlag('smoke');

// cycle 303: export 제거 — isMockRuntime 내부 1회만 사용, 외부 consumer 0건.
const isE2ERuntime = (): boolean => isTestHarnessBuild() && hasFlag('e2e');

export const getDeviceQaScenario = (): string | null => {
    const scenario = String(import.meta.env?.VITE_DEVICE_QA_SCENARIO || '').trim();
    return DEVICE_QA_SCENARIOS.has(scenario) ? scenario : null;
};

export const isDeviceQaRuntime = (): boolean => getDeviceQaScenario() !== null;

/**
 * Firebase 익명 인증 + 클라우드 동기화를 스킵해야 하는 mock 모드.
 * test harness URL flag 또는 isolated device QA scenario가 켜져 있으면 true.
 */
export const isMockRuntime = (): boolean => isSmokeRuntime() || isE2ERuntime() || isDeviceQaRuntime();
