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

export const getWeaponHands = (weapon) => Math.max(1, Number(weapon?.hands) || 1);

export const isTwoHandWeapon = (weapon) => isWeapon(weapon) && getWeaponHands(weapon) >= 2;

export const isOneHandWeapon = (weapon) => isWeapon(weapon) && !isTwoHandWeapon(weapon);

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
