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
    let label;
    let tier;
    if (matchCount >= 3) {
        bonus = { ...FULL_OUTFIT_BONUS };
        label = `${job} 풀 정체성`;
        tier = 'full';
    } else if (matchCount === 2) {
        bonus = { ...PARTIAL_2_BONUS };
        label = `${job} 정체성 강화`;
        tier = 'partial2';
    } else {
        bonus = { ...PARTIAL_1_BONUS };
        label = `${job} 친화 장비`;
        tier = 'partial1';
    }

    return { matchCount, totalSlots, bonus, label, tier, slots };
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
