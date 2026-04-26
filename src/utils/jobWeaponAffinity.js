/**
 * jobWeaponAffinity.js — 직업-무기 적합도 매칭 (cycle 44).
 *
 * 사용자 결정 (방향 A 소프트): 모든 직업이 모든 무기 착용 가능, 단 직업의 typical
 * loadout과 매칭되는 weapon style일 때 stat 보너스. 페널티는 없음 — 자유도 보존.
 *
 * 직업 typical loadout은 avatarSpriteCandidates.JOB_TYPICAL_LOADOUT에서 정의.
 * 여기서는 각 typical loadout에 매칭되는 weapon visual key set을 정의.
 *
 * Pure 함수, side effect 없음.
 */

import { JOB_TYPICAL_LOADOUT } from './avatarSpriteCandidates.js';
import { JOB_SPRITE_SLUG_MAP } from './avatarSpriteCandidates.js';
import { getWeaponVisualKey, getOffhandVisualKey } from './itemVisuals.js';

/**
 * Typical loadout key → 그에 매칭되는 weapon visual key set
 *
 * 예: 'caster' typical → staff/rod/wand가 매칭. dagger를 들면 mismatch.
 */
const LOADOUT_WEAPON_MATCH = Object.freeze({
    sword:    new Set(['sword', 'greatsword', 'rapier', 'saber', 'falchion', 'fork']),
    dagger:   new Set(['dagger', 'fang-dagger', 'throwing-blade', 'twinblade']),
    archer:   new Set(['bow', 'longbow']),
    caster:   new Set(['staff', 'rod', 'wand']),
    heavy:    new Set(['greataxe', 'greatsword', 'axe', 'hammer', 'mace']),
    guardian: new Set(['sword', 'mace', 'hammer']),  // shield + 1H weapon
    lancer:   new Set(['spear', 'lance', 'scythe']),
});

/**
 * Affinity 보너스 — 매칭되면 +20% ATK (관전 무기) 또는 +15% MP (마법 무기).
 * 페널티는 없음.
 */
const AFFINITY_BONUS = Object.freeze({
    sword:    { atkMult: 1.20 },
    dagger:   { atkMult: 1.20, critBonus: 0.05 },  // 단검은 크리도 살짝
    archer:   { atkMult: 1.20 },
    caster:   { mpBonus: 0.15, atkMult: 1.10 },  // 마법은 MP 위주
    heavy:    { atkMult: 1.25 },                   // 양손은 더
    guardian: { atkMult: 1.10, defMult: 1.15 },    // 방어자
    lancer:   { atkMult: 1.20 },
});

const normalizeJobSlug = (job) => {
    const normalized = String(job || '모험가').replace(/\s+/g, '');
    return JOB_SPRITE_SLUG_MAP[normalized] || JOB_SPRITE_SLUG_MAP[job] || 'adventurer';
};

/**
 * @param {object} player
 * @returns {{ matched: boolean, typical: string | null, weaponKey: string | null,
 *             bonus: { atkMult?: number, defMult?: number, mpBonus?: number, critBonus?: number },
 *             label: string | null }}
 *
 * matched=true면 player.equip.weapon이 player.job의 typical loadout과 매칭.
 * label은 UI에 표시할 한글 라벨 ("직업 보너스 활성" 등).
 */
export const getJobWeaponAffinity = (player) => {
    const empty = { matched: false, typical: null, weaponKey: null, bonus: {}, label: null };
    if (!player?.job || !player?.equip?.weapon) return empty;

    const jobSlug = normalizeJobSlug(player.job);
    const typical = JOB_TYPICAL_LOADOUT[jobSlug];
    if (!typical) return empty;  // 모험가 등 typical 없는 직업

    const weaponKey = getWeaponVisualKey(player.equip.weapon);
    const offhandKey = getOffhandVisualKey(player.equip.offhand);

    let matched = false;
    if (typical === 'guardian') {
        // guardian = shield + 1H weapon. 둘 다 충족해야 매칭.
        matched = offhandKey === 'shield' && LOADOUT_WEAPON_MATCH.guardian.has(weaponKey);
    } else if (typical === 'caster') {
        // caster = magic weapon 또는 book offhand
        matched = LOADOUT_WEAPON_MATCH.caster.has(weaponKey) || offhandKey === 'book';
    } else {
        const matchSet = LOADOUT_WEAPON_MATCH[typical];
        matched = matchSet ? matchSet.has(weaponKey) : false;
    }

    if (!matched) {
        return { matched: false, typical, weaponKey, bonus: {}, label: null };
    }

    return {
        matched: true,
        typical,
        weaponKey,
        bonus: AFFINITY_BONUS[typical] || {},
        label: '직업 전문 무기',
    };
};
