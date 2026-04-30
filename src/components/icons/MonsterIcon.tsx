import React from 'react';

/**
 * 몬스터 실루엣 SVG 아이콘
 * 발견: 컬러 표시, 미발견: 검은 실루엣 + 물음표
 */

const SILHOUETTE_PATHS = {
    // 기본 (슬라임류)
    slime: 'M6 16c0 2 2.7 4 6 4s6-2 6-4c0-3-1-6-2-8s-2-4-4-4-3 2-4 4-2 5-2 8Z',
    // 짐승형
    beast: 'M4 14c0-3 2-6 4-7 1-1 2-3 4-3s3 2 4 3c2 1 4 4 4 7 0 2-1 3-2 4H6c-1-1-2-2-2-4ZM8 7l-2-3M16 7l2-3',
    // 인간형
    humanoid: 'M12 4a2 2 0 100 4 2 2 0 000-4ZM9 10h6c1.5 0 3 1 3 3v4H6v-4c0-2 1.5-3 3-3ZM8 20h8',
    // 드래곤형
    dragon: 'M4 12c0-4 3-8 8-8 3 0 5 2 6 4l2-2v4h-4l2-1c-1-2-3-3-6-3-4 0-6 3-6 6s3 6 6 6h2v2h-2c-5 0-8-4-8-8Z',
    // 언데드형
    undead: 'M8 6a4 4 0 018 0c0 3-2 5-4 6v3h-4v-3H7c-2-1-3-3-3-6ZM9 10h1M14 10h1M10 14h4',
    // 정령형
    spirit: 'M12 3c-4 0-7 4-7 8 0 3 1 5 3 7h8c2-2 3-4 3-7 0-4-3-8-7-8ZM10 11h1M13 11h1M9 15c1.5 1 4.5 1 6 0',
    // 골렘형
    golem: 'M7 6h10v4h2v6h-2v4H7v-4H5v-6h2V6ZM9 10h2v2H9v-2ZM13 10h2v2h-2v-2ZM10 16h4',
    // 곤충형
    insect: 'M12 4c-2 0-3 2-3 4v4c0 2 1 4 3 4s3-2 3-4V8c0-2-1-4-3-4ZM7 10l-3-2M17 10l3-2M7 14l-3 2M17 14l3 2',
    // 보스형
    boss: 'M12 2l3 4h4l-2 4 2 4h-4l-3 4-3-4H5l2-4-2-4h4l3-4Z',
};

/**
 * 몬스터 이름에서 실루엣 타입 추론
 */
const getMonsterType = (name) => {
    if (!name) return 'humanoid';
    if (name.includes('슬라임')) return 'slime';
    if (name.includes('드래곤') || name.includes('와이번')) return 'dragon';
    if (name.includes('골렘') || name.includes('골렘') || name.includes('자동인형')) return 'golem';
    if (name.includes('정령') || name.includes('파편체') || name.includes('수정체') || name.includes('님프')) return 'spirit';
    if (name.includes('해골') || name.includes('리치') || name.includes('구울') || name.includes('미라') || name.includes('데스나이트') || name.includes('뱀파이어')) return 'undead';
    if (name.includes('늑대') || name.includes('멧돼지') || name.includes('거북') || name.includes('도마뱀') || name.includes('크라켄') || name.includes('리바이어던')) return 'beast';
    if (name.includes('거미') || name.includes('박쥐') || name.includes('지네') || name.includes('벌레') || name.includes('지렁이')) return 'insect';
    if (name.includes('버섯')) return 'slime';
    // 보스 판별은 아이콘 렌더에서 isBoss 체크
    return 'humanoid';
};

/**
 * MonsterIcon — 몬스터 아이콘 컴포넌트
 * @param {{ name: string, discovered?: boolean, isBoss?: boolean, size?: number, className?: string }} props
 */
const MonsterIcon = ({ name, discovered = false, isBoss = false, size = 32, className = '' }) => {
    const type = isBoss ? 'boss' : getMonsterType(name);
    const path = SILHOUETTE_PATHS[type] || SILHOUETTE_PATHS.humanoid;

    return (
        <div
            className={`inline-flex items-center justify-center shrink-0 ${className}`}
            style={{ width: size, height: size }}
        >
            <svg
                width={size * 0.85}
                height={size * 0.85}
                viewBox="0 0 24 24"
                fill={discovered ? 'none' : '#1e293b'}
                stroke={discovered ? '#e2e8f0' : '#334155'}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path d={path} />
                {!discovered && (
                    <text
                        x="12"
                        y="14"
                        textAnchor="middle"
                        fill="#64748b"
                        fontSize="10"
                        fontWeight="bold"
                        stroke="none"
                    >
                        ?
                    </text>
                )}
            </svg>
        </div>
    );
};

export default MonsterIcon;
