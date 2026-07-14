import { ChevronLeft, Package } from 'lucide-react';

// cycle 441: default backLabel 값 제거 — 5 호출자 모두 명시 전달이라 default
//   '뒤로' 도달 불가.
// cycle 467: 잔존 redundant default 3건 추가 정리 — eyebrow / archiveLabel /
//   className. eyebrow는 5/5 명시 전달, archiveLabel은 4/5 'INV' 전달 + 1/5
//   archive 미렌더, className은 0/5 전달 (정적 baseline만 사용).
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
}: any) => (
  <div
    className={`sticky top-0 z-10 mb-3 border-b border-white/8 bg-[linear-gradient(180deg,rgba(14,19,28,0.99)_0%,rgba(10,13,19,0.96)_100%)] pb-2.5 pt-1 ${bleedClassName}`.trim()}
  >
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        {eyebrow && (
          <div className="text-[9px] font-readable text-slate-300/82">
            {eyebrow}
          </div>
        )}
        <div className="mt-1 flex items-start gap-2.5">
          {onBack && (
            <button
              type="button"
              data-testid={backTestId}
              onClick={onBack}
              className="flex min-h-[44px] shrink-0 items-center gap-1 rounded-full border border-white/8 bg-black/20 px-3 text-[10px] font-readable text-slate-200 transition-colors hover:bg-white/[0.06]"
            >
              <ChevronLeft size={12} />
              {backLabel}
            </button>
          )}
          <div className="min-w-0 flex-1">
            <div className={`font-readable font-bold text-[#f6e7c8] ${titleClassName}`.trim()}>
              {title}
            </div>
            {meta && (
              <div className="mt-0.5 text-[10px] font-readable leading-snug text-slate-300/86">
                {meta}
              </div>
            )}
          </div>
        </div>
      </div>
      {rightSlot && (
        <div className="shrink-0">
          {rightSlot}
        </div>
      )}
      {onOpenArchive && (
        <button
          type="button"
          data-testid={archiveTestId}
          onClick={onOpenArchive}
          className="flex min-h-[44px] shrink-0 items-center gap-1 rounded-full border border-[#d5b180]/18 bg-[#d5b180]/10 px-3 text-[10px] font-readable text-[#f6e7c8] transition-colors hover:bg-[#d5b180]/16"
        >
          <Package size={11} />
          {archiveLabel}
        </button>
      )}
    </div>
  </div>
);

export default FocusPanelHeader;
