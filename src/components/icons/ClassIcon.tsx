import React from 'react';

/**
 * 직업별 고유 SVG 심볼 아이콘
 * viewBox="0 0 24 24", stroke-based
 * 티어별 색상: T0 slate, T1 cyber-blue, T2 cyber-purple, T3 legendary-gold
 */

const CLASS_PATHS = {
    // Tier 0
    '모험가': 'M12 2l2 4h4l-3 3 1 5-4-3-4 3 1-5-3-3h4l2-4ZM12 14v7M8 21h8',
    // Tier 1
    '전사': 'M7 2l3 7H4l6 5-2 8 4-6 4 6-2-8 6-5h-6l3-7ZM15 4l5 5M4 15l5 5',
    '마법사': 'M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M5 19l3-3M16 8l3-3M12 8a4 4 0 100 8 4 4 0 000-8Z',
    '도적': 'M18 3l-6 6M12 9l-4 4M5 21l3-8 5 5-8 3ZM14 5l5 5M17 2l5 5',
    '성직자': 'M12 2v8M8 6h8M12 14a5 5 0 100 0M7 17l-2 5M17 17l2 5M12 14v8',
    // Tier 2
    '나이트': 'M12 2 5 7v6c0 5 3 8 7 12 4-4 7-7 7-12V7l-7-5ZM12 7v6M9 10h6M9 17l3 2 3-2',
    '버서커': 'M8 2v6c-3 0-5 2-5 4s2 4 5 4v6M16 2v6c3 0 5 2 5 4s-2 4-5 4v6M10 12h4',
    '아크메이지': 'M12 2l2 5h5l-4 3 2 5-5-3-5 3 2-5-4-3h5l2-5ZM8 18l-2 4M16 18l2 4M12 16v6',
    '흑마법사': 'M12 2a4 4 0 01-1 8l-2 6h6l-2-6a4 4 0 01-1-8ZM6 16c0 3 3 6 6 6s6-3 6-6M12 16v6M9 20h6',
    '어쌔신': 'M12 2l3 3-3 3-3-3 3-3ZM12 8l-7 7 3 3M12 8l7 7-3 3M5 15l7 7 7-7',
    '레인저': 'M20 4 9 15l-5 5M4 4l4 2M6 10l2 4M9 15l-5-1M20 4l-2 6M14 12l5 2M9 15l5 1M3 21l6-6M15 21l-6-6',
    '무당': 'M12 2c-2 0-3 2-3 4 0 3 3 4 3 6s-3 3-3 5 1.5 4 3 4 3-2 3-4-3-3-3-5 0-2 3-3 3-6 0-2-1-4-3-4ZM7 12h10',
    // Tier 3
    '팔라딘': 'M12 2 5 6v5c0 6 3 9 7 13 4-4 7-7 7-13V6l-7-4ZM12 6l-4 3v4c0 3 1.5 5 4 7 2.5-2 4-4 4-7V9l-4-3Z',
    '드래곤 나이트': 'M4 12c0-5 3-9 8-10 1 3 4 5 4 5s3-2 4-5c5 1 8 5 8 10s-4 8-8 10c-1-2-4-4-4-4s-3 2-4 4c-4-2-8-5-8-10Z',
    '대마법사': 'M12 2l3 5 5 1-3 4 1 5-6-2-6 2 1-5-3-4 5-1 3-5ZM12 14l-4 8M12 14l4 8M12 14v8',
    '그림자 주군': 'M12 2c-3 0-6 3-6 7 0 2 1 4 2 5l4 5 4-5c1-1 2-3 2-5 0-4-3-7-6-7ZM12 14l-5 8h10l-5-8ZM9 7h6',
    '시간술사': 'M12 2a10 10 0 100 20 10 10 0 000-20ZM12 6v6l4 4M7 2h10M7 22h10',
    '사냥의 군주': 'M4 20l8-8 8 8M12 4v8M8 6l4-4 4 4M3 12h4M17 12h4M7 17l2-2M15 17l2-2',
};

const TIER_COLORS = {
    0: '#9ca3af',   // slate
    1: '#00ccff',   // cyber-blue
    2: '#bc13fe',   // cyber-purple
    3: '#f59e0b',   // legendary gold
};

/**
 * ClassIcon — 직업 아이콘 컴포넌트
 * @param {{ className: string, size?: number, tier?: number, showBorder?: boolean, style?: string }} props
 */
const ClassIcon = ({ className: jobName, size = 28, tier = 0, showBorder = false, cssClass = '' }) => {
    const path = CLASS_PATHS[jobName] || CLASS_PATHS['모험가'];
    const color = TIER_COLORS[tier] ?? TIER_COLORS[0];

    return (
        <div
            className={`inline-flex items-center justify-center shrink-0 ${cssClass}`}
            style={{
                width: size,
                height: size,
                ...(showBorder ? {
                    border: `1.5px solid ${color}50`,
                    borderRadius: 8,
                    background: `${color}15`,
                } : {}),
            }}
        >
            <svg
                width={size * 0.75}
                height={size * 0.75}
                viewBox="0 0 24 24"
                fill="none"
                stroke={color}
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path d={path} />
            </svg>
        </div>
    );
};

export default ClassIcon;
