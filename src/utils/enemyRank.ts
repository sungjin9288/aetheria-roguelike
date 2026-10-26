import type { Monster } from '../types/index.js';

/**
 * 전투 화면이 적을 그리는 무게(2026-10 감사 VD-02) — 보스 · 의뢰 우두머리 · 정예 · 일반.
 *
 * 판정은 적의 플래그 그대로이고 이 값은 표시(초상 테두리 · 교전 카드 · 생명 막대 색)만 정한다. 보스가 일반 적과 같은 카드 ·
 * 같은 크기에 '보스' 칩 하나만 달랐다. 보스이면서 우두머리인 적은 없지만, 있으면 보스가 먼저다.
 */
export type EnemyRank = 'boss' | 'champion' | 'elite' | 'normal';

export const getEnemyRank = (enemy: Monster | null | undefined): EnemyRank => {
    if (!enemy) return 'normal';
    if (enemy.isBoss) return 'boss';
    if (enemy.huntChampion) return 'champion';
    if (enemy.isElite) return 'elite';
    return 'normal';
};
