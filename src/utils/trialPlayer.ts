import type { Player } from '../types/player.js';

/**
 * 오늘의 시련을 걷는 플레이어인가 — 시련 플레이어만 `trialRun`을 든다(본편 플레이어에는 생기지 않는다).
 * 탐험 · 지도 · 보상의 시련 분기는 모두 이 판정 하나를 읽는다. 본편 상태의 격리는 리듀서(`reducers/dailyTrial.ts`)가 소유한다.
 */
export const isTrialPlayer = (player: Pick<Player, 'trialRun'> | null | undefined): boolean => Boolean(player?.trialRun);
