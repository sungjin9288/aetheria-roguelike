import { GS } from '../reducers/gameStates';
import type { GameMode } from '../reducers/gameStates';

/** App이 그리는 최상위 화면 — 부트 · 사망 · 이름 짓기(인트로) · 게임. */
export type AppScreen = 'boot' | 'dead' | 'intro' | 'game';

interface AppScreenInput {
    bootStage: string;
    gameState: GameMode;
    hasRunSummary: boolean;
    playerName: string | undefined;
}

/** App의 화면 분기 한 곳 — 렌더 분기와 연출 기준(`getPresentationKey`)이 같은 판정을 읽는다. */
export const getAppScreen = ({ bootStage, gameState, hasRunSummary, playerName }: AppScreenInput): AppScreen => {
    if (bootStage !== 'ready') return 'boot';
    if (gameState === GS.DEAD && hasRunSummary) return 'dead';
    if (!String(playerName || '').trim()) return 'intro';
    return 'game';
};

/**
 * 생명 변화 연출(피해 · 회복 숫자)의 기준 — 복원(`presentationEpoch`)과 화면 전환이 바뀌면 그 렌더의 생명을 기준으로만 잡는다.
 *   새 여정의 시작(인트로 → 게임)과 사망 뒤 다시 시작은 생명을 새로 정하는 전이라 회복이 아니다 — 화면 전환을 기준에 넣지 않던 동안
 *   새 게임 첫 화면에 일어나지 않은 회복 숫자('+27')가 떴다(다듬기 2026-10-30).
 */
export const getPresentationKey = (presentationEpoch: number, screen: AppScreen): string => `${presentationEpoch}:${screen}`;
