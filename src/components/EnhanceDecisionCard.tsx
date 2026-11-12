import { motion as Motion } from 'framer-motion';
import { ArrowRight, Coins, Gem, ShieldAlert, Sparkles } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useRef, useState } from 'react';
import type { EnhancePreview } from '../utils/enhancementUtils.js';
import type { EnhanceBranchStageView } from '../utils/enhanceBranchView.js';
import ItemIcon from './icons/ItemIcon';
import { usePlatformBackHandler } from '../platform/platformBackRegistry';
import { useOverlayDialog } from '../hooks/useOverlayDialog';
import { MSG } from '../data/messages';
import OverlayCloseButton from './OverlayCloseButton';
import ActionButton from './ui/ActionButton';

interface EnhanceDecisionCardProps {
    preview: EnhancePreview;
    /** 이번 강화로 골라야 하는 갈래 단계(2026-11 H6) — 없으면 빈 배열. */
    branchStages: readonly EnhanceBranchStageView[];
    /** 장착한 장비인지 — 아니면 갈래 수치 대신 "장착해야 효과가 납니다"를 보인다. */
    equipped: boolean;
    onCancel: () => void;
    onConfirm: (branches: string[]) => void;
}

const formatRate = (rate: number) => `${Math.round(rate * 100)}%`;

const EnhanceDecisionCard = ({ preview, branchStages, equipped, onCancel, onConfirm }: EnhanceDecisionCardProps) => {
    usePlatformBackHandler(true, onCancel, 76);
    const dialog = useOverlayDialog({ label: MSG.A11Y_DIALOG_ENHANCE(preview.item.name ?? ''), onEscape: onCancel });
    const requirement = preview.requirement;
    // 갈래는 기본으로 골라 두지 않는다 — 추천 없이 플레이어가 고른다(Wave 88 원칙).
    const [picked, setPicked] = useState<Record<number, string>>({});
    const branchesPicked = branchStages.every((stage) => Boolean(picked[stage.level]));
    const canConfirm = preview.canEnhance && preview.affordable && Boolean(requirement) && branchesPicked;
    const submittedRef = useRef(false);
    const handleConfirm = () => {
        if (!canConfirm || submittedRef.current) return;
        submittedRef.current = true;
        onConfirm(branchStages.map((stage) => picked[stage.level]));
    };

    return createPortal(
        <Motion.div
            {...dialog}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
            data-testid="enhance-decision-overlay"
            className="fixed inset-0 z-[76] flex items-center justify-center px-3 py-[max(var(--aether-safe-area-top),0.5rem)] pb-[max(var(--aether-safe-area-bottom),0.5rem)]"
        >
            <button type="button" aria-label={MSG.ENHANCE_DECISION_CLOSE_ARIA} onClick={onCancel} className="ae-scrim" />
            {/* 2026-10 에테르 유리: 겹침 셸은 .ae-scrim + .ae-sheet 하나, 닫기는 OverlayCloseButton 하나(VD-10), 확정은 금빛 주 행동 하나. */}
            <Motion.section
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.32, ease: [0.2, 0.8, 0.2, 1] }}
                data-testid="enhance-decision-card"
                aria-label={`${preview.item.name} 강화 확인`}
                className="ae-sheet relative z-10 w-full max-w-[24rem] overflow-hidden"
            >
                <div className="px-5 pb-4 pt-4">
                    <div className="flex items-start gap-3">
                        <ItemIcon item={preview.item} size={48} showBorder className="mt-1 shrink-0" />
                        <div className="min-w-0 flex-1">
                            <div className="ae-eyebrow text-ae-ether-hi">강화 전 확인</div>
                            <h2 className="mt-0.5 break-words font-readable text-[17px] font-bold text-ae-ink">{preview.item.name}</h2>
                            <div className="mt-1 font-fira text-[15px] font-bold tabular-nums text-ae-gold-text">
                                +{preview.currentLevel} <ArrowRight size={14} aria-hidden="true" className="mx-1 inline" /> +{preview.nextLevel}
                            </div>
                        </div>
                        <OverlayCloseButton
                            data-testid="enhance-decision-close"
                            onClick={onCancel}
                            aria-label={MSG.ENHANCE_DECISION_CLOSE_ARIA}
                        />
                    </div>

                    <div className="ae-well ae-rows mt-4 px-3">
                        <div className="flex items-center justify-between gap-4 py-3">
                            <span className="flex items-center gap-2 text-[13px] font-readable text-ae-ink-2">
                                <Sparkles size={15} aria-hidden="true" className="text-ae-gold-text" />
                                {preview.statLabel}
                            </span>
                            <span data-testid="enhance-stat-change" className="text-right font-fira text-[14px] font-bold tabular-nums text-ae-ink">
                                {preview.currentStat} → {preview.nextStat}
                                <span className="ml-1.5 text-ae-good">+{preview.statDelta}</span>
                            </span>
                        </div>
                        <div className="flex items-center justify-between gap-4 py-3">
                            <span className="flex items-center gap-2 text-[13px] font-readable text-ae-ink-2">
                                <ShieldAlert size={15} aria-hidden="true" className="text-ae-gold" />
                                성공률
                            </span>
                            <span data-testid="enhance-success-rate" className="font-fira text-[14px] font-bold tabular-nums text-ae-gold-text">
                                {formatRate(preview.successRate)}
                            </span>
                        </div>
                        {requirement && (
                            <>
                                <div className="flex items-center justify-between gap-4 py-3">
                                    <span className="flex items-center gap-2 text-[13px] font-readable text-ae-ink-2">
                                        <Coins size={15} aria-hidden="true" className="text-ae-gold" />
                                        골드
                                    </span>
                                    <span className={`font-fira text-[14px] font-bold tabular-nums ${preview.missing === 'gold' ? 'text-ae-threat' : 'text-ae-ink'}`}>
                                        {requirement.gold.toLocaleString('ko-KR')}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between gap-4 py-3">
                                    <span className="flex items-center gap-2 text-[13px] font-readable text-ae-ink-2">
                                        <Gem size={15} aria-hidden="true" className="text-ae-exp" />
                                        {requirement.materialName}
                                    </span>
                                    <span className={`font-fira text-[14px] font-bold tabular-nums ${preview.missing === 'material' ? 'text-ae-threat' : 'text-ae-ink'}`}>
                                        {preview.materialCount}/{requirement.materials}
                                    </span>
                                </div>
                            </>
                        )}
                    </div>

                    {branchStages.map((stage) => (
                        <div key={stage.level} data-testid={`enhance-branch-stage-${stage.level}`} className="mt-4">
                            <div className="ae-eyebrow text-ae-gold-text">{MSG.ENHANCE_BRANCH_EYEBROW(stage.level)}</div>
                            <div role="radiogroup" aria-label={MSG.ENHANCE_BRANCH_EYEBROW(stage.level)} className="mt-2 grid grid-cols-2 gap-2">
                                {stage.options.map((option) => {
                                    const selected = picked[stage.level] === option.id;
                                    return (
                                        <button
                                            key={option.id}
                                            type="button"
                                            role="radio"
                                            aria-checked={selected}
                                            aria-label={MSG.ENHANCE_BRANCH_OPTION_ARIA(stage.level, option.name)}
                                            data-testid={`enhance-branch-option-${option.id}`}
                                            onClick={() => setPicked((prev) => ({ ...prev, [stage.level]: option.id }))}
                                            className={`ae-well min-h-11 rounded-ae-md px-3 py-2.5 text-left transition-colors ${selected ? 'ring-2 ring-ae-gold' : ''}`}
                                        >
                                            <div className="font-readable text-[14px] font-bold text-ae-ink">{option.name}</div>
                                            <div className="mt-1 font-readable text-[12px] leading-snug text-ae-ink-2">{option.effect}</div>
                                            {option.change && (
                                                <div data-testid={`enhance-branch-change-${option.id}`} className="mt-1.5 font-readable text-[12px] text-ae-ink-2">
                                                    {option.change.label}{' '}
                                                    <span className="font-fira font-bold tabular-nums text-ae-ink">{option.change.before} → {option.change.after}</span>
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                    {branchStages.length > 0 && (
                        <p data-testid="enhance-branch-note" className="mt-2 text-[12px] font-readable leading-relaxed text-ae-ink-2">
                            {equipped ? MSG.ENHANCE_BRANCH_FAIL_NOTE : `${MSG.ENHANCE_BRANCH_FAIL_NOTE} ${MSG.ENHANCE_BRANCH_UNEQUIPPED_NOTE}`}
                        </p>
                    )}

                    <p data-testid="enhance-failure-consequence" className="mt-4 text-[13px] font-readable leading-relaxed text-ae-ink-2">
                        {preview.failureText}
                    </p>
                    {!canConfirm && (
                        <p className="mt-2 text-[13px] font-readable font-semibold text-ae-gold-text">{preview.hint}</p>
                    )}
                </div>

                <div className="grid grid-cols-[0.8fr_1.2fr] gap-2 px-4 pb-4">
                    <ActionButton
                        variant="ghost"
                        data-testid="enhance-decision-cancel"
                        onClick={onCancel}
                        label="취소"
                    />
                    <ActionButton
                        variant="primary"
                        data-testid="enhance-decision-confirm"
                        disabled={!canConfirm}
                        onClick={handleConfirm}
                        label="강화 시도"
                    />
                </div>
            </Motion.section>
        </Motion.div>,
        document.body,
    );
};

export default EnhanceDecisionCard;
