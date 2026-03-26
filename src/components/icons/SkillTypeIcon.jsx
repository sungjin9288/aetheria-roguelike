import React from 'react';

/**
 * 스킬/속성 타입별 SVG 아이콘
 * viewBox="0 0 24 24", stroke-based
 */

const TYPE_PATHS = {
    // 원소
    '물리': 'M7 2l3 7H4l6 5-2 8 4-6 4 6-2-8 6-5h-6l3-7',
    '화염': 'M12 22c-4 0-7-3-7-7 0-3 2-5 4-8l3-4 3 4c2 3 4 5 4 8 0 4-3 7-7 7ZM10 16a2 2 0 104 0',
    '냉기': 'M12 2v20M17 5l-5 5-5-5M7 19l5-5 5 5M2 12h20M5 7l5 5-5 5M19 7l-5 5 5 5',
    '자연': 'M12 22V8M8 22c0-6 4-8 4-14M16 22c0-6-4-8-4-14M6 14c2-1 4 0 6 0s4-1 6 0',
    '대지': 'M3 20h18M6 20v-4l3-5 3 3 3-6 3 8v4M2 20l4-8 4 4 4-8 4 6 4-4',
    '빛': 'M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2M12 8a4 4 0 100 8 4 4 0 000-8Z',
    '어둠': 'M12 3a7 7 0 00-1 14 5 5 0 010-10 7 7 0 011-4ZM16 6l2-2M19 9h2M18 14l2 1',
    // 버프/디버프
    'buff': 'M12 2l3 6h6l-5 4 2 6-6-4-6 4 2-6-5-4h6l3-6Z',
    'debuff': 'M12 2v4M4 12h4M16 12h4M6 6l3 3M15 15l3 3M6 18l3-3M15 9l3-3M12 8a4 4 0 100 8 4 4 0 000-8ZM10 10l4 4M14 10l-4 4',
    // 번개 (빛 파생)
    '번개': 'M13 2l-5 10h6l-5 10 10-12h-6L17 2h-4Z',
};

const TYPE_COLORS = {
    '물리': '#e2e8f0',
    '화염': '#f97316',
    '냉기': '#22d3ee',
    '자연': '#22c55e',
    '대지': '#b45309',
    '빛': '#facc15',
    '어둠': '#a855f7',
    '번개': '#fbbf24',
    'buff': '#34d399',
    'debuff': '#f87171',
};

/**
 * SkillTypeIcon — 스킬 속성 아이콘
 * @param {{ type: string, size?: number, className?: string }} props
 */
const SkillTypeIcon = ({ type, size = 14, className = '' }) => {
    const path = TYPE_PATHS[type];
    if (!path) return null;
    const color = TYPE_COLORS[type] || '#e2e8f0';

    return (
        <svg
            className={`inline-block shrink-0 ${className}`}
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke={color}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d={path} />
        </svg>
    );
};

export { TYPE_COLORS };
export default SkillTypeIcon;
