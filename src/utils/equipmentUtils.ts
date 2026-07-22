// cycle 321: unused Player type import 제거 — equipmentUtils 어디에서도 Player 참조 0건.
import type { EquipSlots, Item } from '../types/index.js';
import { BALANCE } from '../data/constants.js';

const MAGIC_WEAPON_KEYWORDS: any = ['지팡이', '스태프', '로드', '완드', '마법', '오브'];

const WEAPON_SKILL_BY_ELEM: any = {
    화염: { name: '이그니스 버스트', effect: 'burn', mp: 28, mult: 2.9, cooldown: 2 },
    냉기: { name: '프로스트 노바', effect: 'freeze', mp: 30, mult: 2.8, cooldown: 2 },
    어둠: { name: '섀도우 피어스', effect: 'curse', mp: 30, mult: 3.0, cooldown: 2 },
    빛: { name: '루멘 스피어', effect: 'stun', mp: 32, mult: 3.1, cooldown: 3 },
    자연: { name: '바인드 스파이크', effect: 'poison', mp: 26, mult: 2.7, cooldown: 2 },
    대지: { name: '테라 크래시', effect: 'stun', mp: 32, mult: 3.0, cooldown: 3 },
    // cycle 256: '바람' / '에테르' element preset 추가 — items.ts에 정의된 폭풍의 창 (바람),
    //   에테르 검 / 차원절단자 (에테르) 무기들이 '물리' fallback (아케인 볼트)에 떨어져
    //   element 정체성 dispatch 0건이던 silent 회귀 fix.
    바람: { name: '게일 컷', effect: 'bleed', mp: 26, mult: 2.7, cooldown: 2 },
    에테르: { name: '디멘션 리프트', effect: 'stun', mp: 32, mult: 3.2, cooldown: 3 },
    물리: { name: '아케인 볼트', effect: null, mp: 22, mult: 2.3, cooldown: 1 },
};

export const isWeapon = (item: Item | null | undefined) => item?.type === 'weapon';

export const isShield = (item: Item | null | undefined) => item?.type === 'shield';

export const isFocusOffhand = (item: Item | null | undefined) => isShield(item) && item?.subtype === 'focus';

export const getWeaponHands = (weapon: any) => Math.max(1, Number(weapon?.hands) || 1);

export const isTwoHandWeapon = (weapon: any) => isWeapon(weapon) && getWeaponHands(weapon) >= 2;

export const isOneHandWeapon = (weapon: any) => isWeapon(weapon) && !isTwoHandWeapon(weapon);

export const getWeaponStyleLabel = (item: Item | null | undefined) => {
    if (!item) return '미장착';
    if (isWeapon(item)) return isTwoHandWeapon(item) ? '양손 무기' : '한손 무기';
    if (isFocusOffhand(item)) return '마력 보조 장비';
    if (isShield(item)) return '방어 보조 장비';
    if (item.type === 'armor') return '방어구';
    return '장비';
};

export const getEquipmentIdentity = (item: Item | null | undefined) => {
    if (!item) return null;
    return item.id || `${item.type}:${item.name}`;
};

// cycle 511: slot default 제거 — 모든 callsite 명시 전달이라 default 도달 불가.
//   util default 청소 메가 시리즈 9번째 (cycle 502-510).
export const getWeaponAttackValue = (weapon: any, slot: any) => {
    if (!isWeapon(weapon)) return 0;
    const baseVal = weapon.val || 0;

    if (isTwoHandWeapon(weapon)) {
        return Math.floor(baseVal * BALANCE.TWO_HAND_ATK_BONUS);
    }

    if (slot === 'offhand') {
        return Math.floor(baseVal * BALANCE.OFFHAND_WEAPON_RATIO);
    }

    return Math.floor(baseVal * BALANCE.ONE_HAND_ATK_RATIO);
};

// cycle 511: slot default 제거 — 모든 callsite 명시 전달이라 default 도달 불가.
export const getWeaponCritBonus = (weapon: any, slot: any) => {
    if (!isOneHandWeapon(weapon)) return 0;
    if (typeof weapon?.crit === 'number') return weapon.crit;
    return slot === 'offhand' ? BALANCE.OFFHAND_ONE_HAND_CRIT_BONUS : BALANCE.ONE_HAND_CRIT_BONUS;
};

// cycle 291: export 제거 — getEquipmentProfile 내부 사용만 (외부 consumer 0건).
// cycle 518: slot default 'main' 제거 — 2 internal callsite 모두 명시 전달
//   (mainWeapon, 'main' / offhandWeapon, 'offhand')이라 default 도달 불가.
//   util default 청소 메가 시리즈 16번째 (cycle 502-517).
const getWeaponEquipScore = (weapon: any, slot: any) => (
    getWeaponAttackValue(weapon, slot) + Math.round(getWeaponCritBonus(weapon, slot) * 100)
);

export const getOffhandCritBonus = (item: Item | null | undefined) => {
    if (!item) return 0;
    if (isWeapon(item)) return getWeaponCritBonus(item, 'offhand');
    if (isShield(item)) return item.crit || 0;
    return 0;
};

export const getOffhandMpBonus = (item: Item | null | undefined) => (isShield(item) ? (item?.mp || 0) : 0);

// cycle 224: weapon/armor의 mpBonus 또는 mp 필드 합산. 4 items(빙결 지팡이 / 빙하의 지팡이 /
//   상급 폭풍 로브 / 차원의 로브)이 desc_stat에 'MP+N'을 표시하지만 코드가 'mp'만 read해서
//   mpBonus가 silent dead config였음. 본 헬퍼로 양 필드 모두 처리 (shield의 mp 컨벤션 + 별도 mpBonus).
const getItemMpContribution = (item: Item | null | undefined) => {
    if (!item) return 0;
    return ((item as any)?.mpBonus || 0) + ((item as any)?.mp || 0);
};

// cycle 225: armor의 hpBonus 필드 합산. 2 armors(용암 판금갑 / 용비늘 갑주)가 desc_stat에
//   'HP+N'을 표시하지만 코드가 hpBonus를 read 안 해 합계 +230 HP가 silent dead config였음.
const getItemHpContribution = (item: Item | null | undefined) => {
    if (!item) return 0;
    return ((item as any)?.hpBonus || 0);
};

export const getEquipmentProfile = (equip: EquipSlots) => {
    const mainWeapon = isWeapon(equip.weapon) ? equip.weapon : null;
    const offhandItem = equip.offhand || null;
    const offhandWeapon = isWeapon(offhandItem) ? offhandItem : null;
    const offhandShield = isShield(offhandItem) ? offhandItem : null;

    return {
        mainWeapon,
        offhandItem,
        offhandWeapon,
        offhandShield,
        mainAttack: getWeaponAttackValue(mainWeapon, 'main'),
        offhandAttack: getWeaponAttackValue(offhandWeapon, 'offhand'),
        shieldDef: offhandShield?.val || 0,
        critBonus: getWeaponCritBonus(mainWeapon, 'main') + getOffhandCritBonus(offhandItem),
        // cycle 224: main weapon + armor + offhand 3개 슬롯 모두에서 mpBonus 합산.
        //   기존엔 offhand shield의 mp만 처리해서 weapon/armor mpBonus 4종이 silent dead.
        mpBonus: getOffhandMpBonus(offhandItem)
            + getItemMpContribution(mainWeapon)
            + getItemMpContribution(equip.armor as any),
        // cycle 225: armor의 hpBonus 필드 합산 (cycle 224 mpBonus 패턴 동일).
        //   2 armors(용암 판금갑 / 용비늘 갑주) +230 HP가 dead config이던 회귀 fix.
        //   weapon/offhand도 미래 대비 합산 — 현재 hpBonus 정의된 weapon/offhand는 0건.
        hpBonus: getItemHpContribution(mainWeapon)
            + getItemHpContribution(equip.armor as any)
            + getItemHpContribution(offhandItem),
    };
};

/** 장비 비교(diff) 스탯 — atk/def/crit(%)/mp 변화량. ShopPanel/SmartInventory 공용 표현. */
export interface EquipmentStatDiff {
    atk: number;
    def: number;
    /** 크리티컬 변화량 — 퍼센트 정수 (예: +3 = crit +3%p). */
    crit: number;
    mp: number;
}

export type EquipmentDetailMode = 'auto' | 'summary' | 'full';

interface EquipmentDisclosurePlayer {
    level?: number;
    job?: string;
    settings?: { equipmentDetailMode?: string };
}

export const getEquipmentDisclosure = (player: EquipmentDisclosurePlayer | null | undefined) => {
    const requestedMode = player?.settings?.equipmentDetailMode;
    const mode: EquipmentDetailMode = requestedMode === 'summary' || requestedMode === 'full'
        ? requestedMode
        : 'auto';
    const isEarlyJourney = (player?.level || 1) < 5 && (!player?.job || player.job === '모험가');

    return {
        mode,
        isEarlyJourney,
        showDetails: mode === 'full' || (mode === 'auto' && !isEarlyJourney),
    };
};

// cycle 2026-07 감사: ShopPanel.tsx(getComparisonMeta) / SmartInventory.tsx(isEquipUpgrade)에
//   동일하게 인라인 중복되던 장비 가치평가 공식을 단일화. 가중치는 BALANCE로 상수화
//   (EQUIP_SCORE_CRIT_WEIGHT / EQUIP_SCORE_MP_DIVISOR) — 계산 결과는 기존과 1:1 동일.
export const getEquipmentScore = ({ atk, def, crit, mp }: EquipmentStatDiff): number => (
    atk + def + (crit * BALANCE.EQUIP_SCORE_CRIT_WEIGHT) + Math.floor(mp / BALANCE.EQUIP_SCORE_MP_DIVISOR)
);

// cycle 528: weapons / requiredWeapon defaults 제거 — 1 internal callsite
//   (line 197) pickBestOneHandPair(filter(Boolean) array, item) 2 args 명시
//   전달이라 두 default 모두 도달 불가. body의 requiredWeapon truthy 가드는
//   별개 보존. util default 청소 메가 시리즈 25번째 (cycle 502-527).
const pickBestOneHandPair = (weapons: any[], requiredWeapon: any) => {
    const candidates = weapons.filter((weapon: any) => isOneHandWeapon(weapon));
    if (!candidates.length) return { mainWeapon: null, offhandWeapon: null };
    if (candidates.length === 1) return { mainWeapon: candidates[0], offhandWeapon: null };

    let bestPair = { mainWeapon: candidates[0], offhandWeapon: candidates[1] };
    let bestScore = Number.NEGATIVE_INFINITY;

    candidates.forEach((mainWeapon: any) => {
        candidates.forEach((offhandWeapon: any) => {
            if (mainWeapon === offhandWeapon) return;
            if (requiredWeapon && mainWeapon !== requiredWeapon && offhandWeapon !== requiredWeapon) return;

            const score = getWeaponEquipScore(mainWeapon, 'main') + getWeaponEquipScore(offhandWeapon, 'offhand');
            if (score > bestScore) {
                bestPair = { mainWeapon, offhandWeapon };
                bestScore = score;
            }
        });
    });

    return bestPair;
};

export const getNextEquipmentState = (equip: EquipSlots, item: Item | null | undefined) => {
    if (!item || !['weapon', 'armor', 'shield'].includes(item.type as string)) return { ...equip };

    const nextEquip = { ...equip };

    if (item.type === 'armor') {
        nextEquip.armor = item;
        return nextEquip;
    }

    if (item.type === 'shield') {
        if (isTwoHandWeapon(nextEquip.weapon)) return nextEquip;
        nextEquip.offhand = item;
        return nextEquip;
    }

    const currentMain = nextEquip.weapon;
    const currentOffhand = nextEquip.offhand;

    if (isTwoHandWeapon(item)) {
        nextEquip.weapon = item;
        nextEquip.offhand = null;
        return nextEquip;
    }

    if (!isWeapon(currentMain)) {
        nextEquip.weapon = item;
        return nextEquip;
    }

    if (isTwoHandWeapon(currentMain)) {
        nextEquip.weapon = item;
        return nextEquip;
    }

    if (isShield(currentOffhand)) {
        nextEquip.weapon = item;
        return nextEquip;
    }

    const { mainWeapon, offhandWeapon } = pickBestOneHandPair(
        [currentMain, isWeapon(currentOffhand) ? currentOffhand : null, item].filter(Boolean),
        item
    );
    nextEquip.weapon = mainWeapon || item;
    nextEquip.offhand = offhandWeapon || null;
    return nextEquip;
};

const getPrimaryEquipmentDelta = (item: Item, diff: EquipmentStatDiff) => {
    const orderedStats = item.type === 'weapon'
        ? [
            { key: 'atk', label: '공격력', suffix: '' },
            { key: 'crit', label: '치명타', suffix: '%' },
            { key: 'mp', label: '기력', suffix: '' },
            { key: 'def', label: '방어력', suffix: '' },
        ]
        : [
            { key: 'def', label: '방어력', suffix: '' },
            { key: 'atk', label: '공격력', suffix: '' },
            { key: 'mp', label: '기력', suffix: '' },
            { key: 'crit', label: '치명타', suffix: '%' },
        ];
    const primary = orderedStats.find(({ key }) => diff[key as keyof EquipmentStatDiff] !== 0) || orderedStats[0];
    const value = diff[primary.key as keyof EquipmentStatDiff];

    return {
        ...primary,
        value,
        text: `${primary.label} ${value > 0 ? '+' : ''}${value}${primary.suffix}`,
    };
};

interface EquipmentDecisionPlayer {
    job?: string;
    equip?: EquipSlots;
}

export const getEquipmentDecision = (
    player: EquipmentDecisionPlayer | null | undefined,
    item: Item | null | undefined
) => {
    const isEquipment = Boolean(item && ['weapon', 'armor', 'shield'].includes(item.type as string));
    if (!item || !isEquipment) return null;

    const equip = player?.equip || {};
    const currentProfile = getEquipmentProfile(equip);
    const nextEquip = getNextEquipmentState(equip, item);
    const nextProfile = getEquipmentProfile(nextEquip);
    const diff: EquipmentStatDiff = {
        atk: (nextProfile.mainAttack + nextProfile.offhandAttack) - (currentProfile.mainAttack + currentProfile.offhandAttack),
        def: ((nextEquip.armor?.val || 0) + nextProfile.shieldDef) - ((equip.armor?.val || 0) + currentProfile.shieldDef),
        crit: Math.round((nextProfile.critBonus - currentProfile.critBonus) * 100),
        mp: nextProfile.mpBonus - currentProfile.mpBonus,
    };
    const equipable = !Array.isArray(item.jobs) || item.jobs.includes(player?.job as string);
    const score = getEquipmentScore(diff);
    const matchesJob = equipable && Array.isArray(item.jobs) && item.jobs.includes(player?.job as string);
    const setContribution = matchesJob ? (isTwoHandWeapon(item) ? 2 : 1) : 0;

    return {
        diff,
        equipable,
        score,
        recommendation: !equipable ? '직업 제한' : score > 0 ? '추천 교체' : score < 0 ? '능력치 하락' : '비슷한 성능',
        tone: !equipable ? 'blocked' : score > 0 ? 'positive' : score < 0 ? 'negative' : 'neutral',
        primaryDelta: getPrimaryEquipmentDelta(item, diff),
        setContribution,
        setContributionText: setContribution > 0 ? `${player?.job} 세트 +${setContribution}` : '세트 기여 없음',
    };
};

export const isMagicWeapon = (weapon: any) => {
    if (!isWeapon(weapon)) return false;
    if (weapon.elem && weapon.elem !== '물리') return true;

    const name = String(weapon.name || '');
    return MAGIC_WEAPON_KEYWORDS.some((keyword: any) => name.includes(keyword));
};

export const getEquippedWeapons = (equip: EquipSlots) => {
    const list: any[] = [];
    if (isWeapon(equip.weapon)) list.push({ slot: 'main', weapon: equip.weapon });
    if (isWeapon(equip.offhand)) list.push({ slot: 'offhand', weapon: equip.offhand });
    return list;
};

const buildWeaponSkill = ({ slot, weapon }: any) => {
    const elem = weapon.elem || '물리';
    const preset = WEAPON_SKILL_BY_ELEM[elem] || WEAPON_SKILL_BY_ELEM.물리;
    const slotLabel = slot === 'offhand' ? '좌수' : '우수';
    const weaponPowerBonus = Math.min(1.2, (weapon.val || 0) / 120);
    const mult = Number((preset.mult + weaponPowerBonus).toFixed(2));
    const mp = Math.max(16, Math.floor(preset.mp + (weapon.val || 0) * 0.05));

    return {
        name: `${preset.name} · ${weapon.name}`,
        type: elem,
        effect: preset.effect || undefined,
        mult,
        mp,
        cooldown: preset.cooldown,
        fromWeapon: true,
        weaponName: weapon.name,
        slot,
        desc: `${slotLabel} 무기 [${weapon.name}]의 공명으로 자동 생성된 무기 마법`,
    };
};

export const getWeaponMagicSkills = (equip: EquipSlots) => {
    const skills: any[] = [];
    const seen = new Set();

    getEquippedWeapons(equip).forEach((entry: any) => {
        if (!isMagicWeapon(entry.weapon)) return;
        const skill = buildWeaponSkill(entry);
        if (seen.has(skill.name)) return;
        seen.add(skill.name);
        skills.push(skill);
    });

    return skills;
};

export const getItemStatText = (item: Item | null | undefined) => {
    if (!item) return '';

    const elemSuffix = item.elem ? ` · ${item.elem} 속성` : '';

    if (isWeapon(item)) {
        if (isTwoHandWeapon(item)) {
            return `양손 무기 · 공격력 +${getWeaponAttackValue(item, 'main')}${elemSuffix} · 강한 일격`;
        }

        return `한손 무기 · 공격력 +${getWeaponAttackValue(item, 'main')}${elemSuffix} · 치명타 +${Math.round(getWeaponCritBonus(item, 'main') * 100)}%`;
    }

    if (isShield(item)) {
        const parts = [`방어력 +${item.val || 0}${elemSuffix}`];
        if (typeof item.mp === 'number' && item.mp > 0) parts.push(`기력 +${item.mp}`);
        if (typeof item.crit === 'number' && item.crit > 0) parts.push(`치명타 +${Math.round(item.crit * 100)}%`);
        parts.push(isFocusOffhand(item) ? '마력 보조 장비' : '방어 보조 장비');
        return parts.join(' · ');
    }

    if (item.type === 'armor') return `방어력 +${item.val || 0}${elemSuffix}`;
    if (item.type === 'hp') return `생명 +${item.val || 0}`;
    if (item.type === 'mp') return `기력 +${item.val || 0}`;

    return item.desc_stat || item.desc || '';
};
