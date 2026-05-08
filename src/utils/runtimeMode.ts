/**
 * runtimeMode.ts — URL 플래그 기반 런타임 모드 감지.
 *
 * smoke=1: smoke-gameplay.mjs 자동화 시나리오 (Firebase 스킵)
 * e2e=1:   Playwright E2E 테스트 (Firebase 스킵, 동일 경로 재사용)
 *
 * 두 플래그 모두 Firebase 익명 인증을 건너뛰고 INITIAL_STATE로 즉시 부팅.
 * 헤드리스 환경의 인증 변동성 회피.
 */

const hasFlag = (key: string): boolean => {
    if (typeof window === 'undefined') return false;
    try {
        return new URLSearchParams(window.location.search).get(key) === '1';
    } catch {
        return false;
    }
};

export const isSmokeRuntime = (): boolean => hasFlag('smoke');

// cycle 303: export 제거 — isMockRuntime 내부 1회만 사용, 외부 consumer 0건.
const isE2ERuntime = (): boolean => hasFlag('e2e');

/**
 * Firebase 익명 인증 + 클라우드 동기화를 스킵해야 하는 mock 모드.
 * 두 플래그 중 하나라도 켜져 있으면 true.
 */
export const isMockRuntime = (): boolean => isSmokeRuntime() || isE2ERuntime();
