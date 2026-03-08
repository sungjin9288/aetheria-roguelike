import { BALANCE } from '../data/constants';

const MAGIC_WEAPON_KEYWORDS = ['지팡이', '스태프', '로드', '완드', '마법', '오브'];

const WEAPON_SKILL_BY_ELEM = {
    화염: { name: '이그니스 버스트', effect: 'burn', mp: 28, mult: 2.9, cooldown: 2 },
    냉기: { name: '프로스트 노바', effect: 'freeze', mp: 30, mult: 2.8, cooldown: 2 },
    어둠: { name: '섀도우 피어스', effect: 'curse', mp: 30, mult: 3.0, cooldown: 2 },
    빛: { name: '루멘 스피어', effect: 'stun', mp: 32, mult: 3.1, cooldown: 3 },
    자연: { name: '바인드 스파이크', effect: 'poison', mp: 26, mult: 2.7, cooldown: 2 },
    대지: { name: '테라 크래시', effect: 'stun', mp: 32, mult: 3.0, cooldown: 3 },
    물리: { name: '아케인 볼트', effect: null, mp: 22, mult: 2.3, cooldown: 1 },
};

export const isWeapon = (item) => item?.type === 'weapon';

export const isShield = (item) => item?.type === 'shield';

export const isFocusOffhand = (item) => isShield(item) && item?.subtype === 'focus';

export const getWeaponHands = (weapon) => Math.max(1, Number(weapon?.hands) || 1);

export const isTwoHandWeapon = (weapon) => isWeapon(weapon) && getWeaponHands(weapon) >= 2;

export const isOneHandWeapon = (weapon) => isWeapon(weapon) && !isTwoHandWeapon(weapon);

export const getEquipmentIdentity = (item) => {
    if (!item) return null;
    return item.id || `${item.type}:${item.name}`;
};

export const getWeaponAttackValue = (weapon, slot = 'main') => {
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

export const getWeaponCritBonus = (weapon, slot = 'main') => {
    if (!isOneHandWeapon(weapon)) return 0;
    if (typeof weapon?.crit === 'number') return weapon.crit;
    return slot === 'offhand' ? BALANCE.OFFHAND_ONE_HAND_CRIT_BONUS : BALANCE.ONE_HAND_CRIT_BONUS;
};

export const getWeaponEquipScore = (weapon, slot = 'main') => (
    getWeaponAttackValue(weapon, slot) + Math.round(getWeaponCritBonus(weapon, slot) * 100)
);

export const getOffhandCritBonus = (item) => {
    if (!item) return 0;
    if (isWeapon(item)) return getWeaponCritBonus(item, 'offhand');
    if (isShield(item)) return item.crit || 0;
    return 0;
};

export const getOffhandMpBonus = (item) => (isShield(item) ? item.mp || 0 : 0);

export const getEquipmentProfile = (equip = {}) => {
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
        mpBonus: getOffhandMpBonus(offhandItem),
    };
};

const pickBestOneHandPair = (weapons = [], requiredWeapon = null) => {
    const candidates = weapons.filter((weapon) => isOneHandWeapon(weapon));
    if (!candidates.length) return { mainWeapon: null, offhandWeapon: null };
    if (candidates.length === 1) return { mainWeapon: candidates[0], offhandWeapon: null };

    let bestPair = { mainWeapon: candidates[0], offhandWeapon: candidates[1] };
    let bestScore = Number.NEGATIVE_INFINITY;

    candidates.forEach((mainWeapon) => {
        candidates.forEach((offhandWeapon) => {
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

export const getNextEquipmentState = (equip = {}, item) => {
    if (!item || !['weapon', 'armor', 'shield'].includes(item.type)) return { ...equip };

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

export const isMagicWeapon = (weapon) => {
    if (!isWeapon(weapon)) return false;
    if (weapon.elem && weapon.elem !== '물리') return true;

    const name = String(weapon.name || '');
    return MAGIC_WEAPON_KEYWORDS.some((keyword) => name.includes(keyword));
};

export const getEquippedWeapons = (equip = {}) => {
    const list = [];
    if (isWeapon(equip.weapon)) list.push({ slot: 'main', weapon: equip.weapon });
    if (isWeapon(equip.offhand)) list.push({ slot: 'offhand', weapon: equip.offhand });
    return list;
};

const buildWeaponSkill = ({ slot, weapon }) => {
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

export const getWeaponMagicSkills = (equip = {}) => {
    const skills = [];
    const seen = new Set();

    getEquippedWeapons(equip).forEach((entry) => {
        if (!isMagicWeapon(entry.weapon)) return;
        const skill = buildWeaponSkill(entry);
        if (seen.has(skill.name)) return;
        seen.add(skill.name);
        skills.push(skill);
    });

    return skills;
};

export const getItemStatText = (item) => {
    if (!item) return '';

    const elemSuffix = item.elem ? `(${item.elem})` : '';

    if (isWeapon(item)) {
        if (isTwoHandWeapon(item)) {
            return `ATK+${getWeaponAttackValue(item, 'main')}${elemSuffix} / 2H`;
        }

        return `ATK+${getWeaponAttackValue(item, 'main')}${elemSuffix} / CRIT+${Math.round(getWeaponCritBonus(item, 'main') * 100)}% / 1H`;
    }

    if (isShield(item)) {
        const parts = [`DEF+${item.val || 0}${elemSuffix}`];
        if (typeof item.mp === 'number' && item.mp > 0) parts.push(`MP+${item.mp}`);
        if (typeof item.crit === 'number' && item.crit > 0) parts.push(`CRIT+${Math.round(item.crit * 100)}%`);
        parts.push(isFocusOffhand(item) ? '주문서' : '보조');
        return parts.join(' / ');
    }

    if (item.type === 'armor') return `DEF+${item.val || 0}${elemSuffix}`;
    if (item.type === 'hp') return `HP+${item.val || 0}`;
    if (item.type === 'mp') return `MP+${item.val || 0}`;

    return item.desc_stat || item.desc || '';
};
