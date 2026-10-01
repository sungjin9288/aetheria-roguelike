import type { Player } from '../types/index.js';
import { isBorrowedRelic } from '../systems/chaosHeart.js';
import { clampVitalsToEffectiveMax } from './effectiveVitals.js';

/**
 * 이번 전투에만 있는 유물 효과를 끝낸다(2026-10 Wave 57) — 혼돈의 심장이 빌린 유물을 돌려주고 혼돈의 보석 표시를 지운다.
 *
 * 전투가 끝나는 모든 경로가 부른다: 승리(`handleVictory`, 정산 전) · 패배(`handleDefeat` 전) · 도주 · 전투가 아닌
 * 모드로 복원(`LOAD_DATA`). 빌린 유물이 최대 생명 · 기력을 올렸으면 돌려준 뒤 현재치를 실효 최대로 내린다
 * (`clampVitalsToEffectiveMax`, 올리지는 않는다). 둘 다 없으면 같은 참조를 돌려준다.
 */
export const endCombatScopedRelics = (player: Player): Player => {
    const relics = player.relics || [];
    const hasBorrowed = relics.some(isBorrowedRelic);
    const gemStat = player.combatFlags?.chaosGemStat;
    if (!hasBorrowed && !gemStat) return player;
    const next: Player = { ...player };
    if (hasBorrowed) next.relics = relics.filter((relic) => !isBorrowedRelic(relic));
    if (gemStat) {
        const { chaosGemStat: _ended, ...flags } = player.combatFlags || {};
        next.combatFlags = flags;
    }
    return clampVitalsToEffectiveMax(next);
};
