import type { Player } from '../types/index.js';
import { endCombatScopedRelics } from './combatScopedRelics.js';

/**
 * 전투 한 판의 범위를 끝낸다(2026-10 Wave 66) — 전투가 끝나는 모든 경로가 이것 하나를 부른다:
 * 승리(`handleVictory`, 정산 전) · 패배(`handleDefeat` 전) · 도주 · 전투가 아닌 모드로 복원(`LOAD_DATA`) · 다음 전투 시작.
 *
 * - 이번 전투 한정 유물 효과(빌린 유물 · 혼돈의 보석)를 끝낸다(`endCombatScopedRelics`, Wave 57).
 * - 기술 재사용 대기를 비운다(소유자 결정 "기술 대기시간은 전투마다 새로 시작" — 기술 남용은 기력 비용이 막는다).
 *   대기는 전투 턴에만 줄어서, 비우지 않던 동안 대기 상태 스냅숏의 92.1%가 잠긴 기술을 들고 다음 전투를 시작했다
 *   (휴식 · 귀환에서도 그대로였다, 원장 §67.6). 마왕 처치 직후 이어지는 진 보스전도 승리 정산이 이것을 거친다.
 *
 * 끝낼 것이 없으면 같은 참조를 돌려준다.
 */
export const endCombatScope = (player: Player): Player => {
    const relicEnded = endCombatScopedRelics(player);
    const loadout = relicEnded.skillLoadout;
    if (!loadout || !Object.values(loadout.cooldowns || {}).some((turns) => turns > 0)) return relicEnded;
    return { ...relicEnded, skillLoadout: { ...loadout, cooldowns: {} } };
};
