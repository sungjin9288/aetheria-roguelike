import { GS } from '../reducers/gameStates';

/**
 * 조작판 모드 전환 박자 — 2026-10 (감사 GF-09). 탐험 → 전투 → 결과로 넘어갈 때 조작판이 그냥 바뀌었다.
 * 컨테이너를 다시 마운트하지 않고(조작판의 지역 상태를 지키려고) 클래스 이름만 바꿔 CSS 애니메이션을 다시 돌린다 —
 * 같은 칸에서 연달아 바뀌어도 다시 돌도록 이름이 다른 두 클래스를 번갈아 쓴다.
 * 처음 마운트는 알리지 않는다(화면 전체 등장 애니메이션이 이미 있다). 모션 감소 설정은 CSS가 `animation: none`으로 끈다.
 */
export interface ModeTransition {
    mode: string;
    parity: 0 | 1;
    entered: boolean;
}

export const createModeTransition = (mode: string): ModeTransition => ({ mode, parity: 0, entered: false });

export const advanceModeTransition = (state: ModeTransition, mode: string): ModeTransition => (
    state.mode === mode
        ? state
        : { mode, parity: state.parity === 0 ? 1 : 0, entered: true }
);

/** 전투에 들어갈 때는 전투 진입 박자, 그 밖의 모드 전환은 짧은 페이드다. */
export const getModeEnterClass = (state: ModeTransition): string => {
    if (!state.entered) return '';
    if (state.mode === GS.COMBAT) return 'animate-combat-start';
    return state.parity === 0 ? 'aether-mode-enter-a' : 'aether-mode-enter-b';
};
