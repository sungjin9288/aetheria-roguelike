/**
 * jobOutfitAffinity.ts — 장비 = 직업 정체성 시스템 (cycle 45).
 *
 * 사용자 통찰: "장비를 교체했을때 아바타가 바뀌는건 직업이 바뀌는게 되는거잖아.
 * 각 장비에 그러한 내용이 들어가야 할거 같아."
 *
 * 기존 데이터 활용: items.js의 모든 장비에 `jobs: [...]` 배열이 있음.
 * weapon, armor, offhand 각 장비의 jobs[]에 player.job이 포함되는지 검사.
 * 매칭 카운트(0~3)에 따라 누적 보너스 — partial1 / partial2 / full.
 *
 * Pure 함수, side effect 없음.
 *
 * cycle 58: TypeScript 마이그레이션 시범 파일 (leaf 유틸).
 */

// cycle 295: 4 type exports → private (외부 consumer 0건, 모두 동일 파일 내부 사용만).
type AffinityTier = 'none' | 'partial1' | 'partial2' | 'full';

interface AffinityBonus {
    atkMult?: number;
    defMult?: number;
    mpBonus?: number;
    hpBonus?: number;
}

interface OutfitAffinity {
    matchCount: number;
    bonus: AffinityBonus;
    label: string | null;
    tier: AffinityTier;
    slots: { weapon: boolean; armor: boolean; offhand: boolean };
}

interface ItemLike {
    name?: string;
    type?: string;
    tier?: number;
    price?: number;
    jobs?: string[];
}

// cycle 60 phase D: Player 도메인 타입 사용 (any 대신).
// 이 함수는 player.job + player.equip.{weapon,armor,offhand}만 보면 되므로
// Player의 부분 인터페이스로 충분.
import type { Player } from '../types/index.js';

interface ItemsDb {
    weapons?: ItemLike[];
    armors?: ItemLike[];
}

interface SetCatalog {
    weapon: ItemLike[];
    armor: ItemLike[];
    offhand: ItemLike[];
}

const FULL_OUTFIT_BONUS: AffinityBonus = Object.freeze({ atkMult: 1.30, defMult: 1.20, mpBonus: 0.15, hpBonus: 0.10 });
const PARTIAL_2_BONUS: AffinityBonus = Object.freeze({ atkMult: 1.15, defMult: 1.10, mpBonus: 0.05, hpBonus: 0.05 });
const PARTIAL_1_BONUS: AffinityBonus = Object.freeze({ atkMult: 1.05 });

/**
 * 직업별 set 효과 명칭 — 정체성 + 분위기로 흥미 유발.
 *
 * partial1 (1/3): 손에 익기 시작한 단계 — 가벼운 어감
 * partial2 (2/3): 어우러지기 시작한 단계 — 본격 정체성
 * full (3/3):     완전 발현 단계 — 전설/극에 도달한 어감
 *
 * 직업이 매핑에 없으면 generic fallback (직업명 + 단계 어휘) 사용.
 */
const JOB_AFFINITY_NAMES: Record<string, { partial1: string; partial2: string; full: string }> = Object.freeze({
    모험가:   { partial1: '여정의 결', partial2: '방랑자의 약속', full: '방랑자의 별자리' },
    전사:     { partial1: '단련된 손', partial2: '강철의 의지', full: '전장의 군림' },
    나이트:   { partial1: '서약의 결', partial2: '기사의 맹세', full: '성역의 수호자' },
    버서커:   { partial1: '피의 자각', partial2: '광기의 각성', full: '광폭의 군주' },
    도적:     { partial1: '그림자 한 자락', partial2: '그림자의 손길', full: '야밤의 지배자' },
    어쌔신:   { partial1: '침묵의 결', partial2: '침묵의 칼날', full: '절대 영점' },
    레인저:   { partial1: '바람의 결', partial2: '야생의 호흡', full: '달빛 사냥꾼' },
    마법사:   { partial1: '마나의 결', partial2: '원소의 이해', full: '마나의 조율자' },
    아크메이지: { partial1: '고위 회로의 결', partial2: '고위 마법진', full: '원소의 군주' },
    흑마법사: { partial1: '금단의 결', partial2: '금단의 계약', full: '암흑의 지배자' },
    팔라딘:   { partial1: '성광의 결', partial2: '성광의 맹세', full: '성기사의 강림' },
    시간술사: { partial1: '시간의 결', partial2: '시공의 흐름', full: '시공의 지배자' },
    // cycle 361: '그림자주군' (공백 제거) 중복 키 제거 — buildAffinityLabel은 player.job
    //   ('그림자 주군' 정식 표기, CLASSES.ts와 동일)을 normalize 없이 직접 lookup.
    //   normalize 후 lookup하는 JOB_SPRITE_SLUG_MAP과는 다른 패턴이라 중복 키는 unreachable.
    '그림자 주군': { partial1: '어둠의 결', partial2: '그림자의 부름', full: '어둠의 군림' },
    대마법사: { partial1: '별빛의 결', partial2: '별의 회로', full: '별의 회랑' },
});

const buildAffinityLabel = (job: string, tier: AffinityTier): string => {
    const flavor = JOB_AFFINITY_NAMES[job];
    if (flavor && tier !== 'none' && flavor[tier]) return flavor[tier];
    if (tier === 'full') return `${job}의 정점`;
    if (tier === 'partial2') return `${job}의 호흡`;
    return `${job}의 결`;
};

const isJobMatch = (item: ItemLike | null | undefined, job: string): boolean => {
    if (!item || !job) return false;
    const jobs = Array.isArray(item.jobs) ? item.jobs : [];
    return jobs.includes(job);
};

/**
 * matchCount=3 → 풀 보너스. matchCount=2 → 중간. matchCount=1 → 약 ATK. 0 → 없음.
 */
// cycle 346: totalSlots 출력 dead 정리 — affinity.totalSlots / aff.totalSlots read 0건이던 dead.
//   OutfitAffinity interface에서도 totalSlots 제거 (private interface).
export const getJobOutfitAffinity = (player: Player): OutfitAffinity => {
    const empty: OutfitAffinity = {
        matchCount: 0,
        bonus: {},
        label: null,
        tier: 'none',
        slots: { weapon: false, armor: false, offhand: false },
    };
    if (!player?.job) return empty;

    const job = player.job;
    const slots = {
        weapon: isJobMatch(player.equip?.weapon, job),
        armor: isJobMatch(player.equip?.armor, job),
        offhand: isJobMatch(player.equip?.offhand, job),
    };
    const matchCount =
        (slots.weapon ? 1 : 0) +
        (slots.armor ? 1 : 0) +
        (slots.offhand ? 1 : 0);

    if (matchCount === 0) {
        return { ...empty, slots };
    }

    let bonus: AffinityBonus;
    let tier: AffinityTier;
    if (matchCount >= 3) {
        bonus = { ...FULL_OUTFIT_BONUS };
        tier = 'full';
    } else if (matchCount === 2) {
        bonus = { ...PARTIAL_2_BONUS };
        tier = 'partial2';
    } else {
        bonus = { ...PARTIAL_1_BONUS };
        tier = 'partial1';
    }
    const label = buildAffinityLabel(job, tier);

    return { matchCount, bonus, label, tier, slots };
};

/**
 * 직업 세트 카탈로그 — items DB에서 해당 직업 호환 장비 추출.
 * 각 슬롯별 후보를 tier → price 오름차순 정렬 (초급 → 고급).
 */
export const getJobSetCatalog = (job: string | undefined | null, items: ItemsDb | undefined | null): SetCatalog => {
    const empty: SetCatalog = { weapon: [], armor: [], offhand: [] };
    if (!job || !items) return empty;
    const matchesJob = (item: ItemLike) => Array.isArray(item.jobs) && item.jobs.includes(job);
    const byTier = (a: ItemLike, b: ItemLike) => (a.tier || 0) - (b.tier || 0) || (a.price || 0) - (b.price || 0);
    const weapons = (items.weapons || []).filter(matchesJob).sort(byTier);
    const armors = (items.armors || []).filter((it: any) => it.type === 'armor' && matchesJob(it)).sort(byTier);
    const offhands = (items.armors || []).filter((it: any) => it.type === 'shield' && matchesJob(it)).sort(byTier);
    return { weapon: weapons, armor: armors, offhand: offhands };
};

