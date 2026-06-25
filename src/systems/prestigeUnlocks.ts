import { BALANCE } from '../data/constants';
import { MAX_RELICS_PER_RUN } from '../data/relics';

/**
 * getPrestigeUnlocks — 프레스티지(환생) rank별 해금 효과의 단일 진실 원천.
 *
 * PR #8 (2026-06): AscensionScreen의 PRESTIGE_UNLOCKS가 광고하던 rank별 해금이
 *   대부분 dead display text(미구현)였다. 이를 실제로 구현하면서, rank→효과 매핑을
 *   한 곳에 모아 모든 소비처(essence 획득 / 유물 발견·선택 / 엘리트 스폰 / 스탯 합성)가
 *   동일 규칙을 참조하게 한다. 순수 함수 — rank만 받아 효과 객체를 반환.
 *
 *   구현 해금(비퇴행·순수 보너스/난이도):
 *   - rank≥1: 에센스 획득 +10%
 *   - rank≥2: 유물 최대 보유 +1(5→6) · 유물 선택지 4지선다
 *   - rank≥3: 엘리트 출현 확률 +25% · 보스 처치 시 희귀(고티어) 장비 보장 (PR #10)
 *   - rank≥10: 영구 스탯 보너스 ×2 (에테르 초월) · 숨겨진 보스 에테르 군주 등장 (PR #11)
 *
 *   (지역 개방 해금은 해당 지역이 이미 전원 개방돼 있어 잠그면 콘텐츠 퇴행 →
 *    의도적으로 미구현.)
 */
export interface PrestigeUnlocks {
    essenceMult: number;
    maxRelics: number;
    relicChoices: number;
    eliteChanceBonus: number;
    guaranteedRareBossDrop: boolean;
    statMult: number;
}

export const getPrestigeUnlocks = (rank: number | undefined | null): PrestigeUnlocks => {
    const r = Math.max(0, Number(rank) || 0);
    return {
        essenceMult: 1 + (r >= 1 ? BALANCE.PRESTIGE_ESSENCE_BONUS : 0),
        maxRelics: MAX_RELICS_PER_RUN + (r >= 2 ? BALANCE.PRESTIGE_RELIC_SLOT_BONUS : 0),
        relicChoices: BALANCE.RELIC_CHOICE_BASE + (r >= 2 ? 1 : 0),
        eliteChanceBonus: r >= 3 ? BALANCE.PRESTIGE_ELITE_BONUS : 0,
        guaranteedRareBossDrop: r >= 3,
        statMult: r >= 10 ? BALANCE.PRESTIGE_R10_STAT_MULT : 1,
    };
};
