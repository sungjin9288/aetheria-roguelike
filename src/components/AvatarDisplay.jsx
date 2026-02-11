import React, { useMemo } from 'react';

// --- ASSET REPOSITORY ---
// Simple geometric paths for Chibi style (ViewBox 0 0 100 100)

const BASES = {
    male: {
        body: "M35,60 Q35,80 50,80 Q65,80 65,60 L65,45 Q65,40 50,40 Q35,40 35,45 Z", // Torso
        head: "M25,25 Q25,5 50,5 Q75,5 75,25 Q75,45 50,45 Q25,45 25,25 Z", // Head
        legs: "M40,80 L40,95 M60,80 L60,95", // Legs
        arms: "M35,50 L20,60 M65,50 L80,60", // Arms
        face: '<circle cx="40" cy="25" r="3" fill="#000"/><circle cx="60" cy="25" r="3" fill="#000"/>' // Eyes
    },
    female: {
        body: "M38,60 Q35,80 50,80 Q65,80 62,60 L62,45 Q62,40 50,40 Q38,40 38,45 Z", // Torso (slightly slimmer)
        head: "M25,25 Q25,5 50,5 Q75,5 75,25 Q75,45 50,45 Q25,45 25,25 Z",
        legs: "M42,80 L42,95 M58,80 L58,95",
        arms: "M38,50 L25,60 M62,50 L75,60",
        face: '<circle cx="40" cy="25" r="3" fill="#000"/><circle cx="60" cy="25" r="3" fill="#000"/><path d="M38,32 Q50,35 62,32" stroke="#000" fill="none" stroke-width="0.5"/>' // Eyes + Smile
    }
};

const HAIRSTYLES = {
    male: "M25,20 Q20,10 50,5 Q80,10 75,20 Q75,10 65,10 Q50,0 35,10 Q25,10 25,20", // Spiky
    female: "M20,25 Q20,0 50,0 Q80,0 80,25 Q85,45 80,55 L75,25 Q75,10 50,10 Q25,10 25,25 L20,55 Q15,45 20,25" // Long
};

const ARMORS = {
    cloth: {
        path: "M34,45 L66,45 L70,80 L30,80 Z", // Robe-like
        color: "#60a5fa" // Blue
    },
    leather: {
        path: "M35,45 L65,45 L65,65 L35,65 Z", // Vest
        color: "#a855f7" // Purple
    },
    plate: {
        path: "M33,43 L67,43 L67,60 L50,70 L33,60 Z", // Breastplate
        color: "#cbd5e1" // Silver
    }
};

const WEAPONS = {
    sword: {
        path: "M80,60 L90,50 L95,55 L85,65 L80,60 M90,50 L100,40", // Simple Blade
        stroke: "#22d3ee"
    },
    staff: {
        path: "M80,60 L95,30 M92,27 A 5 5 0 1 1 98 33", // Staff with orb
        stroke: "#f472b6"
    },
    bow: {
        path: "M75,50 Q65,60 75,70 M75,50 L75,70", // Bow arc and string
        stroke: "#bef264"
    }
};

// --- HELPER FUNCTIONS ---

const getArmorType = (name = '') => {
    if (name.includes('판금') || name.includes('갑주') || name.includes('철제') || name.includes('사슬')) return 'plate';
    if (name.includes('가죽') || name.includes('조끼') || name.includes('여행자')) return 'leather';
    if (name.includes('로브') || name.includes('천') || name.includes('튜닉')) return 'cloth';
    return null; // Basic clothes
};

const getWeaponType = (name = '') => {
    if (name.includes('지팡이') || name.includes('로드') || name.includes('봉')) return 'staff';
    if (name.includes('활') || name.includes('궁')) return 'bow';
    if (name.includes('검') || name.includes('도끼') || name.includes('창') || name.includes('단검')) return 'sword';
    return null;
};

const AvatarDisplay = ({ player }) => {
    const gender = player?.gender === 'female' ? 'female' : 'male';
    const base = BASES[gender];
    const hair = HAIRSTYLES[gender];

    const armorType = useMemo(() => getArmorType(player?.equip?.armor?.name), [player?.equip?.armor]);
    const weaponType = useMemo(() => getWeaponType(player?.equip?.weapon?.name), [player?.equip?.weapon]);

    return (
        <div className="relative w-full aspect-square bg-cyber-dark/50 rounded-lg border border-cyber-blue/30 overflow-hidden shadow-[0_0_20px_rgba(0,204,255,0.1)] group hover:shadow-[0_0_30px_rgba(0,204,255,0.3)] transition-all">
            {/* Background Noise */}
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 pointer-events-none"></div>

            {/* SVG AVATAR */}
            <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-lg">
                {/* 1. Body Base (Skin) */}
                <path d={base.body} fill="#fca5a5" stroke="none" />
                <path d={base.arms} stroke="#fca5a5" strokeWidth="6" strokeLinecap="round" />
                <path d={base.legs} stroke="#334155" strokeWidth="6" strokeLinecap="round" /> {/* Legs/Pants default dark */}
                <path d={base.head} fill="#fca5a5" />

                {/* 2. Face */}
                <g dangerouslySetInnerHTML={{ __html: base.face }} />

                {/* 3. Armor Overlay */}
                {armorType && (
                    <path
                        d={ARMORS[armorType].path}
                        fill={ARMORS[armorType].color}
                        stroke="#0f172a"
                        strokeWidth="1"
                        opacity="0.9"
                    />
                )}

                {/* 4. Hair */}
                <path d={hair} fill={gender === 'female' ? '#fbbf24' : '#60a5fa'} stroke="#0f172a" strokeWidth="0.5" />

                {/* 5. Weapon Overlay */}
                {weaponType && (
                    <path
                        d={WEAPONS[weaponType].path}
                        stroke={WEAPONS[weaponType].stroke}
                        strokeWidth="3"
                        fill="none"
                        strokeLinecap="round"
                        className="animate-pulse" // Slight glow for weapon
                    />
                )}
            </svg>

            {/* Scanline overlay */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyber-blue/5 to-transparent animate-scanline pointer-events-none"></div>

            {/* Text Info Overlay */}
            <div className="absolute bottom-1 right-2 text-[10px] font-fira text-cyber-blue/50 text-right leading-tight">
                {player?.equip?.weapon && <div>{player.equip.weapon.name}</div>}
                {player?.equip?.armor && <div>{player.equip.armor.name}</div>}
            </div>
        </div>
    );
};

export default AvatarDisplay;
