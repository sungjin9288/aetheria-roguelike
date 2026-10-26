import type { ReactNode } from 'react';
import { ChevronLeft, Package } from 'lucide-react';

interface FocusPanelHeaderProps {
    eyebrow?: string;
    title: string;
    meta?: string;
    onBack?: (() => void) | null;
    backLabel?: string;
    backTestId?: string | null;
    rightSlot?: ReactNode | null;
    onOpenArchive?: (() => void) | null;
    archiveLabel?: string;
    archiveTestId?: string | null;
    titleClassName?: string;
    bleedClassName?: string;
}

// cycle 441: backLabel 기본값('뒤로') 제거 — 모든 호출자가 명시 전달한다.
// cycle 467: eyebrow / archiveLabel 기본값 제거 — 호출자가 명시 전달한다.
// 2026-10: 제목 칸은 11rem 아래로 줄지 않는다 — 좁은 폭에서는 오른쪽 칸이 다음 줄로 내려간다.
// 2026-10 에테르 유리: 머리는 유리 한 장(`.ae-town-head`)이고 돌아가기 · 기록 열기는 같은 44px 알약(`.ae-town-pill`)이다.
//   돌아가기는 제목 앞 한 곳뿐이다. 속성 모양은 그대로다(이벤트 · 전직 화면도 같은 머리를 쓴다).
const FocusPanelHeader = ({
    eyebrow,
    title,
    meta = '',
    onBack = null,
    backLabel,
    backTestId = null,
    rightSlot = null,
    onOpenArchive = null,
    archiveLabel,
    archiveTestId = null,
    titleClassName = '',
    bleedClassName = '-mx-3 px-3',
}: FocusPanelHeaderProps) => (
    <div className={`ae-town-head sticky top-0 z-10 mb-3 pb-3 pt-1 ${bleedClassName}`.trim()}>
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <div className="flex min-w-[11rem] flex-1 items-center gap-2.5">
                {onBack && (
                    <button
                        type="button"
                        data-testid={backTestId}
                        onClick={onBack}
                        className="ae-town-pill min-h-[44px] shrink-0 pl-2.5 pr-3.5 font-readable"
                    >
                        <ChevronLeft size={16} aria-hidden="true" />
                        {backLabel}
                    </button>
                )}
                <div className="min-w-0 flex-1">
                    {eyebrow && (
                        <div className="ae-eyebrow font-readable">{eyebrow}</div>
                    )}
                    <h2 className={`mt-0.5 break-words font-display font-extrabold text-ae-ink ${titleClassName}`.trim()}>{title}</h2>
                    {meta && (
                        <div className="aether-type-meta mt-1 font-readable text-ae-ink-2">{meta}</div>
                    )}
                </div>
            </div>
            {rightSlot && (
                <div className="shrink-0">{rightSlot}</div>
            )}
            {onOpenArchive && (
                <button
                    type="button"
                    data-testid={archiveTestId}
                    onClick={onOpenArchive}
                    className="ae-town-pill min-h-[44px] shrink-0 font-readable"
                >
                    <Package size={15} aria-hidden="true" />
                    {archiveLabel}
                </button>
            )}
        </div>
    </div>
);

export default FocusPanelHeader;
