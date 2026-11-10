import type { Monster, Player } from '../types/index.js';
import { estimateEnemyMaxHit } from './enemyThreat.js';

/**
 * 판단 기록 (2026-11 재미 분석 G3 — 소유자 결정 Q4 "예").
 *
 * 실력은 전투 수읽기가 아니라 위험을 다루는 판단(생명을 채우고 맞서기 · 물러나기)으로 드러난다. 회차 요약이 그 사실만 센다 — 추천 ·
 * 평가 문구는 없다(Wave 88 "정보는 주고 반응은 플레이어 몫").
 *
 * - `faced`: 정예 · 보스가 나타난 수. 적이 나타나는 모든 게임 경로가 지나는 `SET_ENEMY`(값 payload) 한 곳에서 센다(정예 목격 칭호와 같은 지점).
 * - `ready`: 그중 나타난 순간의 생명이 예상 가장 센 한 방(`estimateEnemyMaxHit` — 위협 줄과 같은 추정기, 게임 난수를 쓰지 않는다)보다 많았던 수.
 * - `escaped`: 정예 · 보스에게서 도주에 성공한 수(`combatActionTurn`의 두 도주 경로).
 *
 * 평생 누적이고 계정 단위다(`pickPermanentPlayerState`가 운반). 회차 값은 회차 시작 기준점(`meta.cycleStart.judgment`)과의 차이다.
 */
export interface JudgmentLedger {
    faced: number;
    ready: number;
    escaped: number;
}

export const EMPTY_JUDGMENT_LEDGER: JudgmentLedger = Object.freeze({ faced: 0, ready: 0, escaped: 0 });

const count = (value: unknown): number => (
    typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : 0
);

export const readJudgmentLedger = (value: unknown): JudgmentLedger => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...EMPTY_JUDGMENT_LEDGER };
    const candidate = value as Record<string, unknown>;
    return { faced: count(candidate.faced), ready: count(candidate.ready), escaped: count(candidate.escaped) };
};

/** 위협 줄 · 위협 칩을 받는 적 — 정예 또는 보스(의뢰 우두머리는 정예다). */
export const isThreatEnemy = (enemy: Monster | null | undefined): enemy is Monster => Boolean(enemy?.isBoss || enemy?.isElite);

const withLedger = (player: Player, patch: Partial<JudgmentLedger>): Player => {
    const ledger = readJudgmentLedger(player.stats?.judgmentLedger);
    return { ...player, stats: { ...(player.stats || {}), judgmentLedger: { ...ledger, ...patch } } };
};

/** 정예 · 보스가 나타난 순간 — 그 밖의 적이면 같은 참조. */
export const recordThreatAppearance = (player: Player, enemy: Monster | null | undefined): Player => {
    if (!isThreatEnemy(enemy)) return player;
    const ledger = readJudgmentLedger(player.stats?.judgmentLedger);
    const hp = Number(player.hp) || 0;
    const ready = hp > estimateEnemyMaxHit(player, enemy);
    return withLedger(player, { faced: ledger.faced + 1, ready: ledger.ready + (ready ? 1 : 0) });
};

/** 정예 · 보스에게서 도주에 성공한 순간 — 그 밖의 적이면 같은 참조. */
export const recordThreatEscape = (player: Player, enemy: Monster | null | undefined): Player => {
    if (!isThreatEnemy(enemy)) return player;
    const ledger = readJudgmentLedger(player.stats?.judgmentLedger);
    return withLedger(player, { escaped: ledger.escaped + 1 });
};
