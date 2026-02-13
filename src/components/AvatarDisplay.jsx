import React from 'react';

const AvatarDisplay = ({ player }) => {
    const genderClass = player?.gender === 'female' ? 'gender-f' : 'gender-m';

    // Job Mapping
    const getJobClass = (job) => {
        const j = job || '모험가';
        if (['전사', '나이트', '버서커'].includes(j)) return 'job-war';
        if (['마법사', '아크메이지', '흑마법사'].includes(j)) return 'job-mag';
        if (['도적', '어쌔신', '레인저'].includes(j)) return 'job-rog';
        return 'job-adv';
    };

    const jobClass = getJobClass(player?.job);

    // Dynamic Color Logic
    const getElementColor = (item) => {
        if (!item) return null;
        const name = item.name || '';
        const desc = item.desc_stat || '';

        if (name.includes('화염') || name.includes('불') || desc.includes('화')) return '#ef4444'; // Red-500
        if (name.includes('냉기') || name.includes('얼음') || name.includes('서리') || desc.includes('냉')) return '#3b82f6'; // Blue-500
        if (name.includes('자연') || name.includes('독') || desc.includes('독')) return '#22c55e'; // Green-500
        if (name.includes('빛') || name.includes('신성') || desc.includes('빛')) return '#eab308'; // Yellow-500
        if (name.includes('어둠') || name.includes('암흑') || desc.includes('암')) return '#a855f7'; // Purple-500
        return null;
    };

    const weaponColor = getElementColor(player?.equip?.weapon);
    const armorColor = getElementColor(player?.equip?.armor);

    const styleVars = {
        '--accent-color': weaponColor || '#e74c3c', // Default Red
        '--armor-color': armorColor || '#95a5a6' // Default Silver
    };

    return (
        <div className="relative w-full aspect-square bg-cyber-dark/50 rounded-lg border border-cyber-blue/30 overflow-hidden shadow-[0_0_20px_rgba(0,204,255,0.1)] group hover:shadow-[0_0_30px_rgba(0,204,255,0.3)] transition-all">
            {/* Background Noise */}
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 pointer-events-none"></div>

            {/* USER PROVIDED CUTE SVG */}
            <svg
                className={`character-avatar ${genderClass} ${jobClass} w-full h-full`}
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 100 100"
                style={{ ...styleVars, background: 'transparent', border: 'none' }} // Override user's demo styles
            >
                <style>{`
                    /* --- Core Visibility Logic --- */
                    .part-m, .part-f,
                    .job-adv-gear, .job-war-gear, .job-mag-gear, .job-rog-gear { display: none; }

                    /* Gender Activation */
                    .gender-m .part-m { display: block; }
                    .gender-f .part-f { display: block; }

                    /* Job Activation */
                    .job-adv .job-adv-gear { display: block; }
                    .job-war .job-war-gear { display: block; }
                    .job-mag .job-mag-gear { display: block; }
                    .job-rog .job-rog-gear { display: block; }

                    /* --- Styles --- */
                    .outline { stroke: #222; stroke-width: 2px; stroke-linejoin: round; stroke-linecap: round; }
                    .skin { fill: #FFE0BD; }
                    .eye { fill: #222; }
                    .blush { fill: #FF9999; opacity: 0.5; }

                    /* Job Colors */
                    .adv-main { fill: #8B4513; }
                    .adv-sub { fill: #F4A460; }

                    .war-main { fill: var(--armor-color); }
                    .war-sub { fill: #7f8c8d; }
                    .war-accent { fill: var(--accent-color); transition: fill 0.5s ease; }

                    .mag-main { fill: #8e44ad; }
                    .mag-sub { fill: #9b59b6; }
                    .mag-accent { fill: var(--accent-color); transition: fill 0.5s ease; }

                    .rog-main { fill: #2c3e50; }
                    .rog-sub { fill: #34495e; }
                `}</style>

                {/* --- SVG CONTENT --- */}
                {/* Global Breathing Group */}
                <g className="animate-breathe">
                    <rect x="0" y="82" width="100" height="18" fill="#2ecc71" className="job-rog-gear" style={{ fill: '#555' }} />
                    <g id="base-body">
                        <rect x="38" y="58" width="24" height="22" rx="4" className="outline skin" />
                        <rect x="40" y="78" width="8" height="12" className="outline skin" />
                        <rect x="52" y="78" width="8" height="12" className="outline skin" />
                    </g>

                    <g className="job-adv-gear outline">
                        <rect x="38" y="58" width="24" height="15" className="adv-sub" />
                        <rect x="38" y="73" width="24" height="7" className="adv-main" />
                    </g>
                    <g className="job-war-gear outline">
                        <rect x="36" y="58" width="28" height="18" className="war-main" rx="2" />
                        <path d="M36 58 L64 58 M36 76 L64 76" stroke="#bdc3c7" strokeWidth="1" />
                        <rect x="35" y="56" width="6" height="8" className="war-sub" rx="1" />
                        <rect x="59" y="56" width="6" height="8" className="war-sub" rx="1" />
                        <rect x="40" y="78" width="8" height="12" className="war-sub" />
                        <rect x="52" y="78" width="8" height="12" className="war-sub" />
                    </g>
                    <g className="job-mag-gear outline">
                        <path d="M36 58 L64 58 L68 88 L32 88 Z" className="mag-main" />
                        <path d="M50 58 L50 88" stroke="#7f8c8d" strokeWidth="1" opacity="0.5" />
                        <rect x="38" y="58" width="24" height="6" className="mag-sub" />
                    </g>
                    <g className="job-rog-gear outline">
                        <rect x="38" y="58" width="24" height="22" className="rog-main" />
                        <rect x="38" y="78" width="8" height="12" className="rog-sub" />
                        <rect x="52" y="78" width="8" height="12" className="rog-sub" />
                        <rect x="38" y="68" width="24" height="4" fill="#111" />
                    </g>

                    <g id="head-group">
                        <circle cx="50" cy="40" r="22" className="outline skin" />
                        <g id="face-elements">
                            {/* Blinking Eyes */}
                            <g className="animate-blink">
                                <ellipse cx="42" cy="42" rx="3.5" ry="4.5" className="eye" />
                                <ellipse cx="58" cy="42" rx="3.5" ry="4.5" className="eye" />
                                <circle cx="43.5" cy="40.5" r="1.5" fill="white" />
                                <circle cx="59.5" cy="40.5" r="1.5" fill="white" />
                            </g>
                            <ellipse cx="39" cy="47" rx="4" ry="2.5" className="blush" />
                            <ellipse cx="61" cy="47" rx="4" ry="2.5" className="blush" />
                            <path d="M47 50 Q50 53 53 50" fill="none" stroke="#222" strokeWidth="1.5" strokeLinecap="round" />
                        </g>

                        <g className="job-rog-gear outline">
                            <path className="part-m rog-main" d="M30 40 Q50 52 70 40 L70 58 Q50 65 30 58 Z" />
                            <path className="part-f rog-main" d="M32 45 Q50 55 68 45 L65 58 Q50 63 35 58 Z" />
                        </g>
                    </g>

                    <g className="part-m outline">
                        <g className="job-adv-gear">
                            <path className="adv-main" d="M28 38 Q50 10 72 38 L72 45 Q50 35 28 45 Z" />
                            <path className="adv-main" d="M28 38 Q35 45 40 38" fill="none" />
                        </g>

                        <g className="job-war-gear">
                            <path d="M26 36 Q50 8 74 36 L74 50 L26 50 Z" className="war-main" />
                            <path d="M50 12 L50 36" stroke="#7f8c8d" strokeWidth="1.5" />
                            <path d="M26 36 L18 30 L26 24" className="war-sub" />
                            <path d="M74 36 L82 30 L74 24" className="war-sub" />
                        </g>

                        <g className="job-mag-gear">
                            <path d="M25 35 L75 35 L50 2 Z" className="mag-main" />
                            <rect x="25" y="33" width="50" height="4" className="mag-sub" rx="1" />
                            <circle cx="50" cy="2" r="3.5" className="mag-accent" />
                        </g>

                        <g className="job-rog-gear">
                            <path className="rog-main" d="M28 38 Q50 10 72 38 L72 42 L28 42 Z" />
                        </g>
                    </g>

                    <g className="part-f outline">
                        <path className="adv-sub" d="M30 38 Q50 28 70 38 L70 44 Q50 38 30 44 Z" />

                        <g className="job-adv-gear adv-sub">
                            <circle cx="24" cy="46" r="9" /> <circle cx="76" cy="46" r="9" />
                            <circle cx="30" cy="42" r="3" fill="#e74c3c" /> <circle cx="70" cy="42" r="3" fill="#e74c3c" />
                        </g>

                        <g className="job-war-gear">
                            <circle cx="75" cy="38" r="11" className="adv-sub" />
                            <rect x="30" y="28" width="40" height="7" rx="2" className="war-main" />
                            <circle cx="50" cy="31.5" r="3" className="war-accent" />
                        </g>

                        <g className="job-mag-gear">
                            <path d="M35 32 L65 32 L58 5 L42 5 Z" className="mag-main" />
                            <path d="M30 32 L70 32" stroke="#mag-sub" strokeWidth="4" strokeLinecap="round" />
                            <circle cx="45" cy="28" r="4" className="mag-accent" />
                        </g>

                        <g className="job-rog-gear">
                            <path className="rog-main" d="M28 38 Q50 15 72 38 L72 50 L28 50 Z" />
                        </g>
                    </g>

                    <g className="job-adv-gear outline">
                        <rect x="70" y="50" width="6" height="35" fill="#8B4513" rx="2" transform="rotate(-15 70 50)" />
                    </g>

                    <g className="job-war-gear outline">
                        <rect x="22" y="60" width="18" height="24" rx="4" className="war-main" />
                        <path d="M31 60 L31 84 M22 72 L40 72" stroke="#war-sub" strokeWidth="2" />
                        <g transform="translate(72, 52) rotate(-20)">
                            <rect x="-3" y="0" width="6" height="28" fill="#bdc3c7" />
                            <rect x="-7" y="28" width="14" height="4" className="war-sub" />
                            <rect x="-3" y="32" width="6" height="8" fill="#8B4513" />
                        </g>
                    </g>

                    <g className="job-mag-gear outline">
                        <rect x="72" y="40" width="5" height="45" fill="#8B4513" rx="2" />
                        <circle cx="74.5" cy="38" r="8" className="mag-main" />
                        <circle cx="74.5" cy="38" r="4" className="mag-accent" />
                        <circle cx="65" cy="30" r="2" fill="#f1c40f" opacity="0.8">
                            <animate attributeName="opacity" values="0.8;0.2;0.8" dur="1.5s" repeatCount="indefinite" />
                        </circle>
                        <circle cx="85" cy="35" r="1.5" fill="#f1c40f" opacity="0.8">
                            <animate attributeName="opacity" values="0.8;0.2;0.8" dur="1s" repeatCount="indefinite" />
                        </circle>
                    </g>

                    <g className="job-rog-gear outline">
                        <rect x="24" y="68" width="10" height="12" className="rog-sub" rx="2" />
                        <path d="M26 68 L22 62 M30 68 L34 62 M32 68 L30 60" stroke="#bdc3c7" strokeWidth="2" />
                        <rect x="66" y="68" width="10" height="12" className="rog-sub" rx="2" />
                        <path d="M68 68 L64 62 M72 68 L76 62 M70 68 L72 60" stroke="#bdc3c7" strokeWidth="2" />
                    </g>
                </g>

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
