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
export const getPresentationKey = (presentationEpoch: number, screen: AppScreen, combatExits = 0): string => (
    `${presentationEpoch}:${screen}:${combatExits}`
);

/**
 * 전투가 끝난 횟수(이번 세션) — 생명 변화 연출의 기준에 들어간다(2026-11 재미 분석 F5).
 *   승리 정산(처치 회복 · 레벨 상승 회복)은 전투를 끝내는 같은 전이에서 생명을 바꾸는데, 그 렌더는 이미 필드 화면이라
 *   전투 밖 숫자(`DamageNumber`, 화면 가운데)가 떠서 임무 카드 위에 겹쳤다 — 그 변화는 결과 카드 · 레벨 상승 띠가 말한다.
 *   전투 시작은 세지 않는다 — 들어가는 전이의 생명 변화는 전투 생명 막대 옆 숫자가 보인다(위 계약: 행동은 기준을 바꾸지 않는다).
 */
export interface CombatExitTrack {
    inCombat: boolean;
    exits: number;
}

export const nextCombatExitTrack = (track: CombatExitTrack, inCombat: boolean): CombatExitTrack => {
    if (track.inCombat === inCombat) return track;
    return { inCombat, exits: track.exits + (track.inCombat ? 1 : 0) };
};
