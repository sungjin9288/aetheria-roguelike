import { ChevronLeft, Package } from 'lucide-react';

// cycle 441: default backLabel 값 제거 — 5 호출자 모두 명시 전달이라 default
//   '뒤로' 도달 불가. 다른 default (archiveLabel/titleClassName 등)는 호출자
//   부분 누락 path 활성이라 보존.
const FocusPanelHeader = ({
  eyebrow = '',
  title,
  meta = '',
  onBack = null,
  backLabel,
  backTestId = null,
  rightSlot = null,
  onOpenArchive = null,
  archiveLabel = '인벤토리',
  archiveTestId = null,
  className = '',
  titleClassName = '',
  bleedClassName = '-mx-3 px-3',
}: any) => (
  <div
    className={`sticky top-0 z-10 mb-3 border-b border-white/8 bg-[linear-gradient(180deg,rgba(14,19,28,0.99)_0%,rgba(10,13,19,0.96)_100%)] pb-2.5 pt-1 ${bleedClassName} ${className}`.trim()}
  >
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        {eyebrow && (
          <div className="text-[9px] font-fira uppercase tracking-[0.2em] text-slate-400/66">
            {eyebrow}
          </div>
        )}
        <div className="mt-1 flex items-start gap-2.5">
          {onBack && (
            <button
              type="button"
              data-testid={backTestId}
              onClick={onBack}
              className="flex min-h-[34px] shrink-0 items-center gap-1 rounded-full border border-white/8 bg-black/20 px-2.5 text-[10px] font-fira uppercase tracking-[0.14em] text-slate-200 transition-colors hover:bg-white/[0.06]"
            >
              <ChevronLeft size={12} />
              {backLabel}
            </button>
          )}
          <div className="min-w-0 flex-1">
            <div className={`font-rajdhani font-bold tracking-[0.12em] text-[#f6e7c8] ${titleClassName}`.trim()}>
              {title}
            </div>
            {meta && (
              <div className="mt-0.5 text-[10px] font-fira text-slate-400/74">
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
          className="flex min-h-[34px] shrink-0 items-center gap-1 rounded-full border border-[#d5b180]/18 bg-[#d5b180]/10 px-2.5 text-[10px] font-fira uppercase tracking-[0.14em] text-[#f6e7c8] transition-colors hover:bg-[#d5b180]/16"
        >
          <Package size={11} />
          {archiveLabel}
        </button>
      )}
    </div>
  </div>
);

export default FocusPanelHeader;
