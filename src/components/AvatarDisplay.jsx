import React from 'react';

const JOB_TYPE_COLORS = {
    adventurer: '#5f6b77',
    warrior: '#5f6f85',
    mage: '#6b56a4',
    rogue: '#4b5f5a'
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const normalizeHex = (hex, fallback = '#6b7280') => {
    if (typeof hex !== 'string') return fallback;
    const match = hex.trim().match(/^#([a-fA-F0-9]{6})$/);
    return match ? `#${match[1]}` : fallback;
};

const shiftHex = (hex, shift) => {
    const normalized = normalizeHex(hex);
    const r = clamp(parseInt(normalized.slice(1, 3), 16) + shift, 0, 255);
    const g = clamp(parseInt(normalized.slice(3, 5), 16) + shift, 0, 255);
    const b = clamp(parseInt(normalized.slice(5, 7), 16) + shift, 0, 255);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
};

const resolveJobType = (job) => {
    const name = String(job || '모험가');
    if (['전사', '나이트', '버서커'].includes(name)) return 'warrior';
    if (['마법사', '아크메이지', '흑마법사'].includes(name)) return 'mage';
    if (['도적', '어쌔신', '레인저'].includes(name)) return 'rogue';
    return 'adventurer';
};

const resolveJobMotionClass = (jobType) => {
    if (jobType === 'warrior') return 'animate-avatar-warrior';
    if (jobType === 'mage') return 'animate-avatar-mage';
    if (jobType === 'rogue') return 'animate-avatar-rogue';
    return 'animate-avatar-adventurer';
};

const resolveCombatMotionClass = (jobType, gameState) => {
    if (gameState !== 'combat') return '';
    if (jobType === 'warrior') return 'animate-avatar-combat-warrior';
    if (jobType === 'mage') return 'animate-avatar-combat-mage';
    if (jobType === 'rogue') return 'animate-avatar-combat-rogue';
    return 'animate-avatar-combat-adventurer';
};

const resolveWeaponSwingClass = (jobType, gameState) => {
    if (gameState !== 'combat') return '';
    if (jobType === 'warrior') return 'animate-avatar-weapon-swing-heavy';
    if (jobType === 'mage') return 'animate-avatar-weapon-swing-cast';
    if (jobType === 'rogue') return 'animate-avatar-weapon-swing-fast';
    return 'animate-avatar-weapon-swing';
};

const resolveStatusFlags = (statusList) => {
    const values = Array.isArray(statusList) ? statusList.map((s) => String(s).toLowerCase()) : [];
    const has = (patterns) => patterns.some((pattern) => values.some((value) => value.includes(pattern)));
    return {
        poison: has(['poison', '독']),
        burn: has(['burn', '화상', '불']),
        freeze: has(['freeze', '빙결', '냉기']),
        curse: has(['curse', '저주'])
    };
};

const resolveElementColor = (item) => {
    if (!item) return null;
    const source = `${item.name || ''} ${item.desc_stat || ''}`;

    if (/화염|불|용암|phoenix/i.test(source)) return '#f97316';
    if (/냉기|얼음|서리|빙결/i.test(source)) return '#38bdf8';
    if (/자연|독|정령|세계수/i.test(source)) return '#22c55e';
    if (/빛|신성|천상|심판/i.test(source)) return '#facc15';
    if (/어둠|암흑|혼돈|마왕/i.test(source)) return '#a855f7';
    return null;
};

const isUnarmedWeapon = (weapon) => {
    if (!weapon) return true;
    const name = String(weapon.name || '');
    return /맨손|주먹|unarmed/i.test(name);
};

const resolveWeaponType = (weapon) => {
    if (isUnarmedWeapon(weapon)) return null;
    const name = String(weapon?.name || '');

    if (/지팡이|스태프|로드|봉/i.test(name)) return 'staff';
    if (/활|궁/i.test(name)) return 'bow';
    if (/창/i.test(name)) return 'spear';
    if (/도끼/i.test(name)) return 'axe';
    if (/망치|해머|메이스|철퇴/i.test(name)) return 'hammer';
    if (/낫/i.test(name)) return 'scythe';
    if (/단검|표창|송곳니/i.test(name)) return 'dagger';
    if (/검|소드|시미터|칼|라그나로크/i.test(name)) return 'sword';
    return 'sword';
};

const resolveWeaponStyle = (weaponType, weapon) => {
    if (!weaponType) return null;
    const name = String(weapon?.name || '');

    if (weaponType === 'sword' && (weapon?.hands === 2 || /양손|대검|성검|라그나로크|암흑의 대검/i.test(name))) {
        return 'greatsword';
    }
    if (weaponType === 'staff' && /아크|로드|천벌|세계수|스태프/i.test(name)) {
        return 'arcane-staff';
    }
    if (weaponType === 'bow' && /장궁|궁극|불사조/i.test(name)) {
        return 'longbow';
    }
    if (weaponType === 'dagger' && /표창|송곳니/i.test(name)) {
        return 'short-dagger';
    }

    return weaponType;
};

const resolveArmorType = (armor, jobType) => {
    const name = String(armor?.name || '');

    if (/로브|예복|도복/i.test(name)) return 'robe';
    if (/가죽|망토|외투|야복|두건/i.test(name)) return 'light';
    if (/갑옷|흉갑|갑주|판금|비늘/i.test(name)) return 'heavy';

    if (jobType === 'mage') return 'robe';
    if (jobType === 'rogue') return 'light';
    if (jobType === 'warrior') return 'heavy';
    return 'adventurer';
};

const SET_DEFINITIONS = [
    { id: 'dragon', label: 'DRAGON SET', color: '#f97316', keywords: ['용', '드래곤'] },
    { id: 'shadow', label: 'SHADOW SET', color: '#a855f7', keywords: ['암흑', '어둠', '마왕', '혼돈'] },
    { id: 'holy', label: 'HOLY SET', color: '#facc15', keywords: ['성', '신성', '심판', '천상'] },
    { id: 'frost', label: 'FROST SET', color: '#38bdf8', keywords: ['빙결', '냉기', '서리', '얼음'] },
    { id: 'nature', label: 'NATURE SET', color: '#22c55e', keywords: ['자연', '정령', '세계수'] }
];

const resolveEquipmentSetBonus = ({ weapon, armor, offhand }) => {
    if (!weapon || !armor) return null;

    const weaponName = String(weapon.name || '');
    const armorName = String(armor.name || '');
    const offhandName = String(offhand?.name || '');

    for (const setDef of SET_DEFINITIONS) {
        const hasWeapon = setDef.keywords.some((kw) => weaponName.includes(kw));
        const hasArmor = setDef.keywords.some((kw) => armorName.includes(kw));
        const hasOffhand = setDef.keywords.some((kw) => offhandName.includes(kw));

        if (hasWeapon && hasArmor) {
            return {
                ...setDef,
                pieces: hasOffhand ? 3 : 2
            };
        }
    }

    const weaponElem = weapon.elem;
    const armorElem = armor.elem;
    if (weaponElem && armorElem && weaponElem === armorElem) {
        return {
            id: `${weaponElem}-sync`,
            label: `${weaponElem} SYNC`,
            color: resolveElementColor(weapon) || '#60a5fa',
            pieces: offhand?.elem === weaponElem ? 3 : 2
        };
    }

    return null;
};

const renderArmor = ({ armorType, armorColor, armorShade, accentColor, armorTier }) => {
    if (armorType === 'heavy') {
        return (
            <g>
                <path d="M44 56 L76 56 L80 86 L40 86 Z" fill={armorColor} stroke={armorShade} strokeWidth="1.2" />
                <path d="M44 56 Q60 49 76 56 L74 63 Q60 59 46 63 Z" fill={armorShade} opacity="0.7" />
                <circle cx="43" cy="61" r="4" fill={armorShade} />
                <circle cx="77" cy="61" r="4" fill={armorShade} />
                <rect x="57" y="56" width="6" height="30" rx="2" fill={shiftHex(accentColor, -8)} opacity="0.7" />
                {armorTier >= 3 && (
                    <>
                        <path d="M42 60 L33 66 L37 75 L45 70 Z" fill={shiftHex(armorShade, -8)} opacity="0.85" />
                        <path d="M78 60 L87 66 L83 75 L75 70 Z" fill={shiftHex(armorShade, -8)} opacity="0.85" />
                    </>
                )}
            </g>
        );
    }

    if (armorType === 'robe') {
        return (
            <g>
                <path d="M45 56 L75 56 L84 92 L36 92 Z" fill={armorColor} stroke={armorShade} strokeWidth="1.2" />
                <path d="M45 56 Q60 52 75 56 L70 66 Q60 63 50 66 Z" fill={armorShade} opacity="0.75" />
                <rect x="47" y="72" width="26" height="3" rx="1.5" fill={shiftHex(accentColor, -6)} opacity="0.8" />
                {armorTier >= 3 && (
                    <path d="M52 56 L60 64 L68 56" fill="none" stroke={shiftHex(accentColor, 12)} strokeWidth="1.2" opacity="0.8" />
                )}
            </g>
        );
    }

    if (armorType === 'light') {
        return (
            <g>
                <path d="M45 57 L75 57 L77 86 L43 86 Z" fill={armorColor} stroke={armorShade} strokeWidth="1.1" />
                <path d="M45 57 L53 74 L45 86" fill="none" stroke={armorShade} strokeWidth="1.3" opacity="0.65" />
                <path d="M75 57 L67 74 L75 86" fill="none" stroke={armorShade} strokeWidth="1.3" opacity="0.65" />
                <rect x="46" y="68" width="28" height="3" rx="1.5" fill={shiftHex(accentColor, -14)} opacity="0.75" />
                {armorTier >= 4 && <rect x="56.5" y="58" width="7" height="7" rx="2" fill={shiftHex(accentColor, 8)} opacity="0.8" />}
            </g>
        );
    }

    return (
        <g>
            <path d="M46 58 L74 58 L76 86 L44 86 Z" fill={armorColor} stroke={armorShade} strokeWidth="1.1" />
            <rect x="46" y="70" width="28" height="4" rx="2" fill={shiftHex(accentColor, -12)} opacity="0.72" />
            {armorTier >= 2 && <rect x="50" y="62" width="20" height="2.5" rx="1.25" fill={shiftHex(accentColor, 6)} opacity="0.7" />}
        </g>
    );
};

const renderWeapon = ({ weaponType, weaponStyle, weaponColor, twoHanded, weaponTier }) => {
    if (!weaponType) return null;
    const gripTransform = twoHanded ? 'translate(93 66) rotate(22)' : 'translate(96 64) rotate(14)';

    if (weaponStyle === 'arcane-staff') {
        return (
            <g transform={gripTransform}>
                <rect x="-2" y="-46" width="4" height="58" rx="2" fill="#7b5a3e" />
                <polygon points="-6,-49 0,-57 6,-49 0,-43" fill={weaponColor} stroke={shiftHex(weaponColor, -26)} strokeWidth="1.5" />
                <circle cx="0" cy="-57" r={weaponTier >= 5 ? 4 : 2.8} fill={shiftHex(weaponColor, 24)} opacity="0.85" />
                {weaponTier >= 4 && <circle cx="0" cy="-57" r="7.5" fill={weaponColor} opacity="0.18" />}
            </g>
        );
    }

    if (weaponType === 'staff') {
        return (
            <g transform={gripTransform}>
                <rect x="-2" y="-44" width="4" height="56" rx="2" fill="#7b5a3e" />
                <circle cx="0" cy="-46" r="7" fill={weaponColor} stroke={shiftHex(weaponColor, -26)} strokeWidth="1.5" />
                <circle cx="0" cy="-46" r="3" fill={shiftHex(weaponColor, 28)} opacity="0.8" />
                {weaponTier >= 4 && <circle cx="0" cy="-46" r="9" fill={weaponColor} opacity="0.16" />}
            </g>
        );
    }

    if (weaponStyle === 'longbow') {
        return (
            <g transform={twoHanded ? 'translate(95 65) rotate(8)' : 'translate(97 64) rotate(8)'}>
                <path d="M-8 -36 Q11 -18 -8 0" fill="none" stroke={shiftHex(weaponColor, -20)} strokeWidth="3.5" strokeLinecap="round" />
                <path d="M6 -36 Q-13 -18 6 0" fill="none" stroke={weaponColor} strokeWidth="3.5" strokeLinecap="round" />
                <line x1="-7" y1="-35" x2="5" y2="-1" stroke="#d1d5db" strokeWidth="1.4" />
                {weaponTier >= 4 && <circle cx="-1" cy="-18" r="1.7" fill={shiftHex(weaponColor, 16)} />}
            </g>
        );
    }

    if (weaponType === 'bow') {
        return (
            <g transform={twoHanded ? 'translate(95 65) rotate(8)' : 'translate(97 64) rotate(8)'}>
                <path d="M-6 -30 Q8 -16 -6 -2" fill="none" stroke={shiftHex(weaponColor, -18)} strokeWidth="3" strokeLinecap="round" />
                <path d="M4 -30 Q-10 -16 4 -2" fill="none" stroke={weaponColor} strokeWidth="3" strokeLinecap="round" />
                <line x1="-5" y1="-29" x2="3" y2="-3" stroke="#d1d5db" strokeWidth="1.2" />
            </g>
        );
    }

    if (weaponType === 'spear') {
        return (
            <g transform={gripTransform}>
                <rect x="-1.5" y="-48" width="3" height="58" rx="1.5" fill="#8a6643" />
                <path d="M0 -56 L6 -45 L0 -42 L-6 -45 Z" fill={weaponColor} stroke={shiftHex(weaponColor, -22)} strokeWidth="1" />
                {weaponTier >= 4 && <path d="M0 -48 L4 -45 L0 -41 L-4 -45 Z" fill={shiftHex(weaponColor, 22)} opacity="0.85" />}
            </g>
        );
    }

    if (weaponType === 'axe') {
        return (
            <g transform={gripTransform}>
                <rect x="-1.8" y="-36" width="3.6" height="46" rx="1.6" fill="#7a5840" />
                <path d="M2 -32 Q18 -28 14 -15 Q8 -9 2 -13 Z" fill={weaponColor} stroke={shiftHex(weaponColor, -24)} strokeWidth="1.3" />
                {weaponTier >= 4 && <path d="M2 -31 Q10 -27 9 -19 Q6 -15 2 -17 Z" fill={shiftHex(weaponColor, 18)} opacity="0.75" />}
            </g>
        );
    }

    if (weaponType === 'hammer') {
        return (
            <g transform={gripTransform}>
                <rect x="-1.7" y="-32" width="3.4" height="42" rx="1.5" fill="#78583f" />
                <rect x="-10" y="-35" width="20" height="8" rx="2" fill={weaponColor} stroke={shiftHex(weaponColor, -20)} strokeWidth="1.2" />
                {weaponTier >= 3 && <rect x="-6" y="-33.5" width="12" height="2.8" rx="1.4" fill={shiftHex(weaponColor, 14)} opacity="0.8" />}
            </g>
        );
    }

    if (weaponType === 'scythe') {
        return (
            <g transform={gripTransform}>
                <rect x="-1.5" y="-46" width="3" height="56" rx="1.5" fill="#7a5840" />
                <path d="M0 -47 Q20 -42 14 -28 Q9 -25 1 -30 Z" fill={weaponColor} stroke={shiftHex(weaponColor, -20)} strokeWidth="1.2" />
                {weaponTier >= 4 && <path d="M2 -45 Q13 -41 11 -33 Q8 -30 4 -32 Z" fill={shiftHex(weaponColor, 16)} opacity="0.75" />}
            </g>
        );
    }

    if (weaponStyle === 'short-dagger') {
        return (
            <g transform="translate(96 66) rotate(24)">
                <rect x="-1.3" y="-16" width="2.6" height="18" rx="1.3" fill="#cbd5e1" />
                <polygon points="-4,-18 0,-24 4,-18 0,-14" fill={weaponColor} stroke={shiftHex(weaponColor, -26)} strokeWidth="1" />
                <circle cx="0" cy="1.5" r="1.8" fill={shiftHex(weaponColor, -12)} />
            </g>
        );
    }

    if (weaponType === 'dagger') {
        return (
            <g transform="translate(96 66) rotate(24)">
                <rect x="-1.6" y="-20" width="3.2" height="22" rx="1.4" fill="#cbd5e1" />
                <path d="M0 -28 L4 -19 L0 -15 L-4 -19 Z" fill={weaponColor} stroke={shiftHex(weaponColor, -26)} strokeWidth="1" />
                <rect x="-5" y="1" width="10" height="3" rx="1.5" fill={shiftHex(weaponColor, -10)} />
                {weaponTier >= 4 && <circle cx="0" cy="-16" r="1.5" fill={shiftHex(weaponColor, 22)} opacity="0.8" />}
            </g>
        );
    }

    if (weaponStyle === 'greatsword') {
        return (
            <g transform="translate(93 67) rotate(22)">
                <rect x="-2.8" y="-52" width="5.6" height="56" rx="2" fill="#d6dce6" stroke="#94a3b8" strokeWidth="1.2" />
                <path d="M0 -60 L4 -52 L0 -48 L-4 -52 Z" fill={shiftHex(weaponColor, 10)} stroke={shiftHex(weaponColor, -26)} strokeWidth="1" />
                <rect x="-10" y="3" width="20" height="4" rx="2" fill={shiftHex(weaponColor, -8)} />
                <rect x="-2" y="7" width="4" height="14" rx="1.8" fill="#7a5840" />
                {weaponTier >= 5 && <line x1="0" y1="-48" x2="0" y2="-6" stroke={shiftHex(weaponColor, 16)} strokeWidth="1.3" opacity="0.7" />}
            </g>
        );
    }

    return (
        <g transform={gripTransform}>
            <rect x="-2" y="-38" width="4" height="42" rx="1.5" fill="#d4dbe5" stroke="#94a3b8" strokeWidth="1" />
            <rect x="-8" y="2" width="16" height="3.6" rx="1.8" fill={shiftHex(weaponColor, -10)} />
            <rect x="-1.6" y="5" width="3.2" height="10" rx="1.5" fill="#7a5840" />
            {weaponTier >= 4 && <line x1="0" y1="-36" x2="0" y2="-6" stroke={shiftHex(weaponColor, 15)} strokeWidth="1" opacity="0.7" />}
        </g>
    );
};

const renderOffhand = ({ offhand, armorColor, accentColor, offhandTier }) => {
    if (!offhand) return null;

    if (offhand.type === 'shield') {
        return (
            <g transform="translate(32 69) rotate(-12)">
                <path d="M0 -16 L10 -10 L9 6 Q5 14 0 17 Q-5 14 -9 6 L-10 -10 Z" fill={armorColor} stroke={shiftHex(armorColor, -24)} strokeWidth="1.4" />
                <path d="M0 -11 L6 -7 L5 4 Q2 9 0 11 Q-2 9 -5 4 L-6 -7 Z" fill={shiftHex(accentColor, -6)} opacity="0.75" />
                {offhandTier >= 4 && <circle cx="0" cy="-3" r="2.2" fill={shiftHex(accentColor, 16)} opacity="0.8" />}
            </g>
        );
    }

    return (
        <g transform="translate(30 68)">
            <circle cx="0" cy="0" r="6" fill={shiftHex(accentColor, 8)} stroke={shiftHex(accentColor, -20)} strokeWidth="1.2" />
            <circle cx="0" cy="0" r="2.5" fill="#e2e8f0" opacity="0.85" />
        </g>
    );
};

const renderHair = ({ gender, hairColor }) => {
    if (gender === 'female') {
        return (
            <g>
                <path d="M44 31 Q60 16 76 31 L76 48 Q70 58 60 60 Q50 58 44 48 Z" fill={hairColor} />
                <path d="M43 40 Q38 51 40 61 Q45 57 47 49" fill={hairColor} />
                <path d="M77 40 Q82 51 80 61 Q75 57 73 49" fill={hairColor} />
            </g>
        );
    }

    return (
        <g>
            <path d="M45 32 Q60 20 75 32 L74 42 Q61 36 46 42 Z" fill={hairColor} />
            <path d="M45 32 Q49 26 54 30" fill="none" stroke={shiftHex(hairColor, 15)} strokeWidth="1" opacity="0.6" />
        </g>
    );
};

const renderBackAttachment = ({ armorTier, armorType, accentColor }) => {
    if (armorTier < 4) return null;
    if (armorType === 'robe') {
        return (
            <path d="M47 58 L73 58 L82 96 Q60 104 38 96 Z" fill={shiftHex(accentColor, -34)} opacity="0.45" />
        );
    }
    return (
        <path d="M46 58 L74 58 L80 94 Q60 101 40 94 Z" fill={shiftHex(accentColor, -32)} opacity="0.42" />
    );
};

const renderTierAura = ({ armorTier, weaponTier, accentColor }) => {
    const peakTier = Math.max(armorTier, weaponTier);
    if (peakTier < 5) return null;

    return (
        <g>
            <circle cx="60" cy="33" r="24" fill={accentColor} opacity="0.12" />
            <path d="M42 12 Q60 2 78 12" fill="none" stroke={shiftHex(accentColor, 18)} strokeWidth="1.4" opacity="0.8" />
            <circle cx="60" cy="8" r="1.7" fill={shiftHex(accentColor, 24)} />
        </g>
    );
};

const renderSetEffect = ({ setBonus }) => {
    if (!setBonus) return null;
    const setColor = normalizeHex(setBonus.color || '#60a5fa');

    return (
        <g>
            <circle cx="60" cy="33" r={setBonus.pieces >= 3 ? 26 : 23} fill="none" stroke={setColor} strokeWidth="1.3" opacity="0.45" />
            <path d="M47 16 L60 11 L73 16 L60 21 Z" fill={shiftHex(setColor, 10)} opacity="0.7" />
            <path d="M47 50 L60 55 L73 50" fill="none" stroke={shiftHex(setColor, 16)} strokeWidth="1.1" opacity="0.75" />
            {setBonus.pieces >= 3 && <circle cx="60" cy="9" r="2.1" fill={shiftHex(setColor, 22)} opacity="0.9" />}
        </g>
    );
};

const renderStatusEffects = ({ statusFlags }) => {
    return (
        <g>
            {statusFlags.poison && (
                <>
                    <circle cx="44" cy="92" r="8" fill="#22c55e" opacity="0.16" className="animate-status-poison" />
                    <circle cx="76" cy="90" r="6" fill="#22c55e" opacity="0.14" className="animate-status-poison" />
                </>
            )}
            {statusFlags.burn && (
                <>
                    <path d="M39 81 Q43 75 46 81 Q43 88 39 81 Z" fill="#fb923c" opacity="0.62" className="animate-status-burn" />
                    <path d="M74 79 Q78 72 82 79 Q79 86 74 79 Z" fill="#f97316" opacity="0.62" className="animate-status-burn" />
                </>
            )}
            {statusFlags.freeze && (
                <>
                    <path d="M42 58 L44 62 L48 64 L44 66 L42 70 L40 66 L36 64 L40 62 Z" fill="#7dd3fc" opacity="0.7" className="animate-status-freeze" />
                    <path d="M78 60 L80 63 L84 65 L80 67 L78 70 L76 67 L72 65 L76 63 Z" fill="#7dd3fc" opacity="0.7" className="animate-status-freeze" />
                </>
            )}
            {statusFlags.curse && (
                <ellipse cx="60" cy="34" rx="28" ry="24" fill="none" stroke="#7c3aed" strokeWidth="1.2" opacity="0.45" className="animate-status-curse" />
            )}
        </g>
    );
};

const AvatarDisplay = ({ player, gameState = 'idle' }) => {
    const equip = player?.equip || {};
    const weapon = equip.weapon || null;
    const armor = equip.armor || null;
    const offhand = equip.offhand || null;

    const gender = player?.gender === 'female' ? 'female' : 'male';
    const jobType = resolveJobType(player?.job);
    const weaponType = resolveWeaponType(weapon);
    const weaponStyle = resolveWeaponStyle(weaponType, weapon);
    const armorType = resolveArmorType(armor, jobType);
    const weaponTier = Number(weapon?.tier || 1);
    const armorTier = Number(armor?.tier || 1);
    const offhandTier = Number(offhand?.tier || 1);
    const peakTier = Math.max(weaponTier, armorTier, offhandTier);
    const jobMotionClass = resolveJobMotionClass(jobType);
    const combatMotionClass = resolveCombatMotionClass(jobType, gameState);
    const weaponSwingClass = resolveWeaponSwingClass(jobType, gameState);
    const statusFlags = resolveStatusFlags(player?.status);
    const setBonus = resolveEquipmentSetBonus({ weapon, armor, offhand });

    const weaponColor = normalizeHex(resolveElementColor(weapon) || '#94a3b8');
    const armorBase = normalizeHex(resolveElementColor(armor) || JOB_TYPE_COLORS[jobType] || JOB_TYPE_COLORS.adventurer);
    const armorShade = shiftHex(armorBase, -22);
    const accentColor = shiftHex(weaponColor, 8);

    const skinBase = '#f1c6a8';
    const skinShade = '#e0a987';
    const hairColor = gender === 'female' ? '#3a2a20' : '#2f241d';

    return (
        <div className="relative w-full aspect-square bg-cyber-dark/50 rounded-lg border border-cyber-blue/30 overflow-hidden shadow-[0_0_20px_rgba(0,204,255,0.1)] group hover:shadow-[0_0_30px_rgba(0,204,255,0.3)] transition-all">
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 pointer-events-none"></div>

            <svg
                className="w-full h-full"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 120 120"
                aria-label="player-avatar"
            >
                <defs>
                    <radialGradient id="avatarBg" cx="50%" cy="25%" r="75%">
                        <stop offset="0%" stopColor="#182436" />
                        <stop offset="100%" stopColor="#090d14" />
                    </radialGradient>
                    <linearGradient id="skinGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={shiftHex(skinBase, 8)} />
                        <stop offset="100%" stopColor={skinBase} />
                    </linearGradient>
                </defs>

                <rect x="0" y="0" width="120" height="120" fill="url(#avatarBg)" />
                <ellipse cx="60" cy="104" rx="26" ry="6" fill="#05070c" opacity="0.55" />

                <g className="animate-breathe" transform="translate(0 1)">
                    <g className={jobMotionClass}>
                        <g className={combatMotionClass}>
                            {renderTierAura({ armorTier, weaponTier, accentColor })}
                            {renderStatusEffects({ statusFlags })}
                            {renderSetEffect({ setBonus })}
                            {renderBackAttachment({ armorTier, armorType, accentColor })}
                            <path d="M52 84 L56 102 H48 Z" fill={shiftHex(armorShade, -5)} />
                            <path d="M68 84 L72 102 H64 Z" fill={shiftHex(armorShade, -5)} />
                            <rect x="46" y="100" width="12" height="4" rx="2" fill="#1f2937" />
                            <rect x="62" y="100" width="12" height="4" rx="2" fill="#1f2937" />

                            <rect x="50" y="50" width="20" height="28" rx="8" fill="url(#skinGrad)" />
                            {renderArmor({ armorType, armorColor: armorBase, armorShade, accentColor, armorTier })}

                            <path d="M38 62 Q45 58 47 66 L45 79 Q37 77 35 69 Z" fill={armorBase} stroke={armorShade} strokeWidth="1.1" />
                            <path d="M82 62 Q75 58 73 66 L75 79 Q83 77 85 69 Z" fill={armorBase} stroke={armorShade} strokeWidth="1.1" />

                            <circle cx="43" cy="79" r="3.5" fill={skinBase} />
                            <circle cx="77" cy="79" r="3.5" fill={skinBase} />

                            {renderOffhand({ offhand, armorColor: armorBase, accentColor, offhandTier })}
                            <g className={weaponSwingClass || undefined}>
                                {renderWeapon({ weaponType, weaponStyle, weaponColor, twoHanded: weapon?.hands === 2, weaponTier })}
                            </g>

                            <rect x="56" y="45" width="8" height="6" rx="3" fill={skinShade} />
                            <circle cx="60" cy="33" r="17" fill="url(#skinGrad)" />
                            <ellipse cx="43.5" cy="33" rx="2.5" ry="4.5" fill={skinShade} opacity="0.55" />
                            <ellipse cx="76.5" cy="33" rx="2.5" ry="4.5" fill={skinShade} opacity="0.55" />

                            {renderHair({ gender, hairColor })}

                            <g className="animate-blink">
                                <ellipse cx="53" cy="34" rx="2.2" ry="2.8" fill="#111827" />
                                <ellipse cx="67" cy="34" rx="2.2" ry="2.8" fill="#111827" />
                                <circle cx="53.8" cy="33.2" r="0.7" fill="#f8fafc" />
                                <circle cx="67.8" cy="33.2" r="0.7" fill="#f8fafc" />
                            </g>

                            <path d="M50 29 Q53 27 56 29" fill="none" stroke="#52321f" strokeWidth="1" strokeLinecap="round" />
                            <path d="M64 29 Q67 27 70 29" fill="none" stroke="#52321f" strokeWidth="1" strokeLinecap="round" />

                            <ellipse cx="49" cy="39" rx="2.4" ry="1.2" fill="#fda4af" opacity="0.45" />
                            <ellipse cx="71" cy="39" rx="2.4" ry="1.2" fill="#fda4af" opacity="0.45" />
                            <path d="M55 43 Q60 46 65 43" fill="none" stroke="#7c2d12" strokeWidth="1.4" strokeLinecap="round" />
                        </g>
                    </g>
                </g>
            </svg>

            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyber-blue/5 to-transparent animate-scanline pointer-events-none"></div>
            {peakTier >= 5 && (
                <div className="absolute inset-0 border border-yellow-300/35 rounded-lg pointer-events-none animate-avatar-legendary" />
            )}

            <div className="absolute bottom-1 right-2 text-[10px] font-fira text-cyber-blue/60 text-right leading-tight max-w-[70%]">
                {weapon?.name && <div className="truncate">WPN: {weapon.name}</div>}
                {armor?.name && <div className="truncate">ARM: {armor.name}</div>}
                {offhand?.name && <div className="truncate">SUB: {offhand.name}</div>}
            </div>
            <div className="absolute top-2 left-2 text-[10px] font-fira text-cyber-blue/60 leading-tight">
                <div>JOB: {player?.job || '모험가'}</div>
                <div>TIER: {peakTier}</div>
                {setBonus && <div className="text-cyber-green/80">{setBonus.label} ({setBonus.pieces})</div>}
            </div>
        </div>
    );
};

export default AvatarDisplay;
