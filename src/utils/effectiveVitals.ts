import type { Player } from '../types';
import { calculateFullStats } from './statsCalculator';

/**
 * 현재 생명/기력을 **유효 최대치**(UI가 그리는 `calculateFullStats(player)`)로 깎는다
 * (2026-09 Wave 27 N2, D8).
 *
 * 최대치는 저장값(`player.maxHp`/`maxMp`)이 아니라 장비·유물·성향·칭호가 합쳐진 파생값이라,
 * 그 입력을 바꾸는 전이가 최대치를 **낮출** 수 있다 — 감사에서 기력 보조장비를 벗는 교체 뒤
 * 133/123, 유물 획득으로 빌드 성향(기력 +10)이 바뀐 뒤 718/708이 나왔다. 생명도 같은 전이
 * (`hpBonus` 방어구 교체, `fortress` 유물 교체)로 넘칠 수 있다.
 *
 * 최대치를 낮출 수 있는 전이의 끝에서만 부른다. 올리는 방향으로는 절대 건드리지 않고,
 * 이미 최대치 이하면 **같은 참조**를 돌려준다. `endDevourBonus`(adventureRelicBonuses.ts)가
 * 같은 규칙으로 생명을 맞추는 선례다.
 */
export const clampVitalsToEffectiveMax = (player: Player): Player => {
    const stats = calculateFullStats(player);
    if (!stats) return player;
    const { hp, mp } = player;
    const hpOver = typeof hp === 'number' && Number.isFinite(stats.maxHp) && stats.maxHp > 0 && hp > stats.maxHp;
    const mpOver = typeof mp === 'number' && Number.isFinite(stats.maxMp) && stats.maxMp >= 0 && mp > stats.maxMp;
    if (!hpOver && !mpOver) return player;
    return {
        ...player,
        ...(hpOver ? { hp: stats.maxHp } : {}),
        ...(mpOver ? { mp: stats.maxMp } : {}),
    };
};
