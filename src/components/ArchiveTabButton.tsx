import { motion as Motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';

/**
 * ArchiveTabButton — Dashboard 탭 선택 버튼 (모바일 레일 · 데스크톱 타일 공용)
 *
 * cycle 483: 4 callsite 모두 전달 0건이던 2 props 제거 — frameClass / heightClass /
 *   Icon size / span tracking 분기 cascade 일괄 정리. cycle 458/459/461/463/464
 *   unreachable prop 패턴 회귀.
 * 2026-10 에테르 유리: 색은 `.ae-archive-tab`(index.css w3:archive-a)이 소유한다 — 선택된 탭은 에테르 물빛 + 림,
 *   나머지는 바탕 없이 ink-3. 레일의 배지는 줄 안에(레일은 세로로 잘리므로), 타일의 배지는 모서리에 둔다.
 */
interface ArchiveTabButtonProps {
    icon: LucideIcon;
    label: string;
    active?: boolean;
    onClick?: () => void;
    compact?: boolean;
    rail?: boolean;
    testId?: string | null;
    badge?: string | number | null;
    badgeTitle?: string | null;
}

const ArchiveTabButton = ({ icon, label, active = false, onClick, compact = false, rail = false, testId = null, badge = null, badgeTitle = null }: ArchiveTabButtonProps) => {
    const Icon = icon;
    const frameClass = rail
        ? 'flex min-h-[44px] shrink-0 scroll-mx-3 items-center justify-center gap-1.5 rounded-full px-3'
        : 'is-tile flex flex-col items-center justify-center gap-1 rounded-ae-sm px-2 py-1.5';
    const heightClass = rail ? '' : compact ? 'min-h-[44px]' : 'min-h-[56px]';

    return (
        <Motion.button
            type="button"
            whileTap={{ scale: 0.96 }}
            transition={{ duration: 0.11, ease: [0.2, 0.8, 0.2, 1] }}
            onClick={onClick}
            data-testid={testId}
            data-active={active ? 'true' : 'false'}
            aria-current={active ? 'page' : undefined}
            aria-pressed={active}
            title={label}
            className={`ae-archive-tab ${frameClass} ${heightClass}`}
        >
            <Icon size={rail ? 15 : 18} aria-hidden="true" />
            <span className={`whitespace-nowrap font-readable ${rail ? 'text-[12px] font-semibold' : 'text-[11px] font-semibold'}`}>
                {label}
            </span>
            {badge != null && (
                <span
                    title={badgeTitle || undefined}
                    data-testid={testId ? `${testId}-badge` : undefined}
                    className={`ae-archive-badge pointer-events-none font-fira tabular-nums ${rail ? 'ml-0.5' : 'absolute right-1 top-1'}`}
                >
                    {badge}
                </span>
            )}
        </Motion.button>
    );
};

export default ArchiveTabButton;
