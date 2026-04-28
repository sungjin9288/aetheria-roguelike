/**
 * jobOutfitAffinity.js — 장비 = 직업 정체성 시스템 (cycle 45).
 *
 * 사용자 통찰: "장비를 교체했을때 아바타가 바뀌는건 직업이 바뀌는게 되는거잖아.
 * 각 장비에 그러한 내용이 들어가야 할거 같아."
 *
 * 기존 데이터 활용: items.js의 모든 장비에 `jobs: [...]` 배열이 있음 (어떤 직업이
 * 사용 적합한지 정의). 이걸 outfit affinity 매칭으로 활용:
 *   - weapon, armor, offhand 각 장비의 jobs[]에 player.job이 포함되는지 검사
 *   - 매칭 카운트 (0~3)에 따라 누적 보너스
 *   - 매칭 카운트가 높을수록 "직업 정체성이 강하게 발현"
 *
 * Pure 함수, side effect 없음.
 */

const FULL_OUTFIT_BONUS = Object.freeze({ atkMult: 1.30, defMult: 1.20, mpBonus: 0.15, hpBonus: 0.10 });
const PARTIAL_2_BONUS = Object.freeze({ atkMult: 1.15, defMult: 1.10, mpBonus: 0.05, hpBonus: 0.05 });
const PARTIAL_1_BONUS = Object.freeze({ atkMult: 1.05 });

/**
 * 직업별 set 효과 명칭 — 정체성 + 분위기로 흥미 유발.
 *
 * partial1 (1/3): 손에 익기 시작한 단계 — 가벼운 어감
 * partial2 (2/3): 어우러지기 시작한 단계 — 본격 정체성
 * full (3/3):     완전 발현 단계 — 전설/극에 도달한 어감
 *
 * 직업이 매핑에 없으면 generic fallback (직업명 + 단계 어휘) 사용.
 */
const JOB_AFFINITY_NAMES = Object.freeze({
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
    '그림자 주군': { partial1: '어둠의 결', partial2: '그림자의 부름', full: '어둠의 군림' },
    그림자주군: { partial1: '어둠의 결', partial2: '그림자의 부름', full: '어둠의 군림' },
    대마법사: { partial1: '별빛의 결', partial2: '별의 회로', full: '별의 회랑' },
});

const buildAffinityLabel = (job, tier) => {
    const flavor = JOB_AFFINITY_NAMES[job];
    if (flavor && flavor[tier]) return flavor[tier];
    // fallback: 직업이 매핑에 없을 때 generic 어휘 (이질감 최소)
    if (tier === 'full') return `${job}의 정점`;
    if (tier === 'partial2') return `${job}의 호흡`;
    return `${job}의 결`;
};

/**
 * 단일 슬롯의 jobs[] 매칭 검사.
 *
 * @param {object | null | undefined} item
 * @param {string} job
 * @returns {boolean}
 */
const isJobMatch = (item, job) => {
    if (!item || !job) return false;
    const jobs = Array.isArray(item.jobs) ? item.jobs : [];
    return jobs.includes(job);
};

/**
 * @param {object} player
 * @returns {{
 *   matchCount: number,
 *   totalSlots: number,
 *   bonus: { atkMult?: number, defMult?: number, mpBonus?: number, hpBonus?: number },
 *   label: string | null,
 *   tier: 'none' | 'partial1' | 'partial2' | 'full',
 *   slots: { weapon: boolean, armor: boolean, offhand: boolean }
 * }}
 *
 * matchCount=3 (full outfit) → 강한 보너스 + "풀 직업 정체성"
 * matchCount=2 → 중간 보너스
 * matchCount=1 → 약한 ATK 보너스
 * matchCount=0 → 보너스 없음
 */
export const getJobOutfitAffinity = (player) => {
    const empty = {
        matchCount: 0,
        totalSlots: 0,
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
    const totalSlots =
        (player.equip?.weapon ? 1 : 0) +
        (player.equip?.armor ? 1 : 0) +
        (player.equip?.offhand ? 1 : 0);

    if (matchCount === 0) {
        return { ...empty, totalSlots, slots };
    }

    let bonus;
    let tier;
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

    return { matchCount, totalSlots, bonus, label, tier, slots };
};

/**
 * 직업 세트 카탈로그 — items DB에서 해당 직업 호환 장비 추출.
 *
 * @param {string} job - 한글 직업명
 * @param {object} items - DB.ITEMS (weapons, armors 배열 보유)
 * @returns {{ weapon: object[], armor: object[], offhand: object[] }}
 *
 * 각 슬롯별 후보를 tier 오름차순 정렬. 사용자가 "어떤 아이템을 모아야
 * 세트가 발동하는가" 직접 보고 모험을 계획할 수 있도록.
 */
export const getJobSetCatalog = (job, items) => {
    const empty = { weapon: [], armor: [], offhand: [] };
    if (!job || !items) return empty;
    const matchesJob = (item) => Array.isArray(item.jobs) && item.jobs.includes(job);
    const byTier = (a, b) => (a.tier || 0) - (b.tier || 0) || (a.price || 0) - (b.price || 0);
    const weapons = (items.weapons || []).filter(matchesJob).sort(byTier);
    const armors = (items.armors || []).filter((it) => it.type === 'armor' && matchesJob(it)).sort(byTier);
    const offhands = (items.armors || []).filter((it) => it.type === 'shield' && matchesJob(it)).sort(byTier);
    return { weapon: weapons, armor: armors, offhand: offhands };
};

/**
 * UI용: outfit affinity tone (gold gradation by tier).
 */
export const getOutfitAffinityTone = (tier) => {
    if (tier === 'full') return { color: '#f6e7a2', glow: 'rgba(246,231,162,0.42)' };
    if (tier === 'partial2') return { color: '#d5b180', glow: 'rgba(213,177,128,0.32)' };
    if (tier === 'partial1') return { color: '#7dd4d8', glow: 'rgba(125,212,216,0.28)' };
    return { color: '#94a3b8', glow: 'rgba(148,163,184,0.16)' };
};
