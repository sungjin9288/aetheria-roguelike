import { useEffect, useRef, useState } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Backpack, ChevronsUp, Crown, Package, Sparkles, Sword, X } from 'lucide-react';
import {
    getPostCombatAnalysis,
    getPostCombatDecisionStrip,
    getPostCombatRecommendation,
} from '../utils/outcomeAnalysis';
import { isSignatureItem } from '../data/signatureItems.js';
import { MSG } from '../data/messages';
import { formatLootStacks, summarizeLoot } from '../utils/lootSummary';
import {
    POST_COMBAT_INPUT_GUARD_MS,
    POST_COMBAT_REVEAL_DONE,
    POST_COMBAT_REVEAL_TIMING,
    getCountUpValue,
    getLootRevealDelayMs,
    getRevealProgress,
    getRevealStage,
} from '../utils/postCombatReveal';
import type { PostCombatResult } from '../types';
import ActionButton from './ui/ActionButton';
import Chip from './ui/Chip';
import MomentCloseButton from './moments/MomentCloseButton';
import { MOMENT_EASE } from './moments/momentMotion';
import { usePlatformBackHandler } from '../platform/platformBackRegistry';

/** 보상 신호 1건 — 보스 보상 / 장비 갱신 / 성향 공명 세 종류가 같은 모양을 쓴다. */
interface RewardSignal {
    title: string;
    name: string | undefined;
    summary: string;
    tone: 'success' | 'amber' | 'purple';
}

interface PostCombatCardProps {
    /**
     * 승리 정산 스냅샷 — 생산자(hooks/combatActions/combatVictory.ts)의 dispatch
     * 리터럴에서 도출한 타입(2026-09 Wave 8 Z1). `null`은 카드를 닫은 상태다.
     */
    result?: PostCombatResult | null;
    onClose?: () => void;
    onOpenInventory?: () => void;
    /**
     * 2026-10 (감사 UX-10): '계속 탐험'이 카드를 닫고 탐험을 바로 부른다 — 탐험할 수 있는 곳(대기 · 안전지대 밖)에서만
     * GameRoot가 넘긴다(`getPostCombatExploreAction`). 없으면 그 단추는 '닫기'다.
     */
    onExplore?: (() => void) | null;
}

/** 닫기 단추를 누른 뒤 퇴장 애니메이션을 기다리는 시간(이전과 같은 값). */
const POST_COMBAT_EXIT_MS = 280;

/** 브라우저이고 모션 감소 설정이 아니면 순서 공개를 한다 — 서버 렌더 · 모션 감소는 처음부터 끝값이다. */
const shouldAnimateReveal = (): boolean => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

// 2026-10 Wave 127(소유자 결정): 승리 뒤 "밀어붙인다 / 숨을 고른다" 선택은 없다 — 회복 · 강화는 낮은 확률의 이벤트(모닥불 등)로만 나온다.
const PostCombatCard = ({ result, onClose, onOpenInventory, onExplore = null }: PostCombatCardProps) => {
    const [isClosing, setIsClosing] = useState(false);
    usePlatformBackHandler(Boolean(result && onClose), () => onClose?.(), 40);
    // 2026-10 (감사 GF-10): 순서 공개 — 경험 · 골드가 0에서 값까지 늘고(utils/postCombatReveal.ts), 그 뒤 전리품이 차례로 나온다.
    const [animateReveal] = useState(shouldAnimateReveal);
    const [revealProgress, setRevealProgress] = useState(() => (animateReveal ? 0 : 1));
    const [revealSkipped, setRevealSkipped] = useState(false);
    const [inputReady, setInputReady] = useState(false);

    useEffect(() => {
        if (!animateReveal) return undefined;
        let frame = 0;
        let startedAt: number | null = null;
        const tick = (now: number) => {
            if (startedAt === null) startedAt = now;
            const progress = getRevealProgress(now - startedAt);
            setRevealProgress((current) => (current >= 1 ? current : progress));
            if (progress < 1) frame = window.requestAnimationFrame(tick);
        };
        frame = window.requestAnimationFrame(tick);
        // rAF가 멈춘 창(숨은 탭)에서도 끝값으로 닫힌다.
        const settle = window.setTimeout(
            () => setRevealProgress(1),
            POST_COMBAT_REVEAL_TIMING.countUpMs + POST_COMBAT_REVEAL_TIMING.settleGraceMs,
        );
        return () => {
            window.cancelAnimationFrame(frame);
            window.clearTimeout(settle);
        };
    }, [animateReveal]);

    useEffect(() => {
        const timer = window.setTimeout(() => setInputReady(true), POST_COMBAT_INPUT_GUARD_MS);
        return () => window.clearTimeout(timer);
    }, []);

    // 닫기 타이머는 카드가 내려가면(탐험이 결과를 비운 경우 등) 함께 지운다 — 늦게 도착한 닫기가 다음 결과 카드를 지우지 않는다.
    const closeTimerRef = useRef<number | null>(null);
    useEffect(() => () => {
        if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    }, []);
    // 퇴장 중인 카드(AnimatePresence)는 마지막으로 그린 단추 · 처리기를 그대로 들고 있다 — 그 사이 한 번 더 누르면
    //   상태(isClosing)가 아니라 이 값이 막는다. 막지 않으면 '계속 탐험'을 두 번 눌러 탐험이 두 번 일어난다.
    const closingRef = useRef(false);

    if (!result) return null;

    // Wave 8 Z1: `result.loot` 별칭 분기 제거 — 생산자(combatVictory) · QA 시드
    //   (useGameTestApi.injectPostCombatResult) · 테스트 픽스처 어디에도 `loot`를 쏘는
    //   곳이 없어 도달 불가였다(dead read). `items`만이 전리품 이름 목록이다.
    const droppedItems = Array.isArray(result.items)
        ? result.items
        : [];
    const signatureLoot = droppedItems.filter((name) => (
        typeof name === 'string' && isSignatureItem({ name })
    ));
    const nonSignatureLoot = droppedItems.filter((name) => !(
        typeof name === 'string' && isSignatureItem({ name })
    ));
    const hasLevelUp = Boolean(result.leveledUp);
    const analysis = getPostCombatAnalysis(result);
    const enemyName = result.enemy || MSG.POST_COMBAT_ENEMY_FALLBACK;
    const compactNote = analysis.notes[0] || MSG.POST_COMBAT_NOTE_FALLBACK(enemyName);
    const upgradeHint = result.upgradeHint || null;
    const traitHint = result.traitHint || null;
    const bossRewardHint = result.bossRewardHint || null;
    const bossClearBonus = result.bossClearBonus || 0;
    const rewardSignalCandidates: Array<RewardSignal | null> = [
        bossRewardHint
            ? {
                title: MSG.POST_COMBAT_SIGNAL_BOSS,
                name: bossClearBonus > 0 ? MSG.POST_COMBAT_SIGNAL_BOSS_BONUS(bossClearBonus) : MSG.POST_COMBAT_SIGNAL_BOSS_LOOT,
                summary: bossRewardHint,
                tone: 'success',
            }
            : null,
        upgradeHint
            ? { title: MSG.POST_COMBAT_SIGNAL_UPGRADE, name: upgradeHint.name, summary: upgradeHint.summary, tone: 'amber' }
            : null,
        traitHint
            ? { title: MSG.POST_COMBAT_SIGNAL_TRAIT, name: traitHint.name, summary: traitHint.summary, tone: 'purple' }
            : null,
    ];
    const rewardSignals = rewardSignalCandidates.filter(Boolean);
    const primarySignal = rewardSignals[0] || null;
    // 2026-10 Wave 67: 같은 전리품은 "이름 x개수"로 묶는다(utils/lootSummary.ts — 전투 정리 로그와 같은 판정).
    const lootView = summarizeLoot(nonSignatureLoot);
    const lootSummary = lootView.shown.length > 0
        ? `${lootView.shown.join(' · ')}${lootView.restCount > 0 ? MSG.LOOT_SUMMARY_MORE(lootView.restCount) : ''}`
        : null;
    const decisionContext = {
        signatureLootCount: signatureLoot.length,
        nonSignatureLootCount: nonSignatureLoot.length,
    };
    const decisionStrip = getPostCombatDecisionStrip(result, decisionContext);
    const recommendation = getPostCombatRecommendation(result, decisionContext);
    const decisionState = decisionStrip.cells[0]?.value || MSG.POST_COMBAT_STATE_FALLBACK;

    const scheduleClose = () => {
        if (closeTimerRef.current !== null) return;
        closeTimerRef.current = window.setTimeout(() => {
            closeTimerRef.current = null;
            onClose?.();
        }, POST_COMBAT_EXIT_MS);
    };

    const handleClose = () => {
        if (closingRef.current) return;
        closingRef.current = true;
        setIsClosing(true);
        scheduleClose();
    };

    // 감사 UX-10: 탐험할 수 있으면 카드를 닫고 탐험을 바로 부른다(탐험 게이트는 액션이 그대로 소유한다).
    //   탐험이 결과 카드를 비우지 않은 경우(조용한 탐험 · 거부)에는 닫기 타이머가 카드를 정리한다.
    const handleContinueExplore = () => {
        if (closingRef.current || !inputReady) return;
        if (!onExplore) {
            handleClose();
            return;
        }
        closingRef.current = true;
        setIsClosing(true);
        onExplore();
        scheduleClose();
    };

    const handlePrimaryAction = () => {
        if (!inputReady || closingRef.current) return;
        if (recommendation.target === 'inventory') onOpenInventory?.();
        else if (onExplore) {
            handleContinueExplore();
            return;
        }
        handleClose();
    };

    // 카드를 누르면 순서 공개를 건너뛰고 끝값을 보인다.
    const skipReveal = () => {
        if (revealSkipped) return;
        setRevealSkipped(true);
        setRevealProgress(1);
    };
    const revealStage = getRevealStage(revealProgress);
    const revealDone = revealStage === POST_COMBAT_REVEAL_DONE;
    const playRevealMotion = animateReveal && !revealSkipped;
    const shownExp = getCountUpValue(result.exp, revealProgress);
    const shownGold = getCountUpValue(result.gold, revealProgress);
    const lootRevealClass = (base: string) => (playRevealMotion && revealDone ? base : '');
    const lootRevealStyle = (index: number) => (
        playRevealMotion && revealDone ? { animationDelay: `${getLootRevealDelayMs(index)}ms` } : undefined
    );
    const canExplore = typeof onExplore === 'function';
    const primaryIsContinue = recommendation.target !== 'inventory';
    // 감사 UX-10: 판단 칸의 '추천'도 주 행동 단추와 같은 이름이다 — 탐험할 수 없는 곳에서 '계속 탐험'을 약속하지 않는다.
    const primaryLabel = primaryIsContinue && !canExplore ? MSG.POST_COMBAT_CLOSE_LABEL : recommendation.label;
    const isBossKill = Boolean(result.isBoss);

    const primaryKind = recommendation.target === 'inventory' ? 'inventory' : canExplore ? 'explore' : 'close';
    const primaryIcon = primaryKind === 'inventory'
        ? <Backpack size={17} />
        : primaryKind === 'explore' ? <ArrowRight size={17} /> : <X size={17} />;
    const showContinue = recommendation.target === 'inventory' && canExplore;

    return (
        <AnimatePresence>
            {!isClosing && (
                <Motion.div
                    data-testid="post-combat-card"
                    data-reveal-stage={revealDone ? 'done' : 'counting'}
                    data-input-ready={inputReady ? 'true' : 'false'}
                    data-boss-kill={isBossKill ? 'true' : undefined}
                    onClick={skipReveal}
                    initial={{ opacity: 0, y: 24, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 16, scale: 0.97 }}
                    transition={{ duration: 0.2, ease: MOMENT_EASE }}
                    className={`ae-sheet ae-moment-sheet fixed inset-x-3 bottom-[calc(var(--aether-safe-area-bottom)+0.8rem)] z-40 mx-auto max-h-[calc(100dvh-var(--aether-safe-area-top)-1.6rem)] max-w-[36rem] overflow-y-auto overscroll-contain ${isBossKill ? 'aether-post-combat-boss' : ''}`}
                >
                    <div className="space-y-3 px-4 pb-4 pt-4">
                        <header className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-readable text-[11px] font-bold">
                                    {isBossKill ? (
                                        <span data-testid="post-combat-boss-label" className="inline-flex items-center gap-1.5 text-ae-gold-text">
                                            <Crown size={13} aria-hidden="true" />
                                            {MSG.POST_COMBAT_BOSS_LABEL}
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1.5 text-ae-ether-hi">
                                            <Sword size={13} aria-hidden="true" />
                                            {MSG.POST_COMBAT_EYEBROW}
                                        </span>
                                    )}
                                    <span className="text-ae-ink-3">{analysis.rewardMood}</span>
                                    {hasLevelUp && (
                                        <Chip tone="gold" icon={<ChevronsUp size={12} />}>{MSG.POST_COMBAT_LEVEL_UP}</Chip>
                                    )}
                                </div>
                                <h2 className="mt-1 break-keep font-display text-[17px] font-extrabold leading-snug text-ae-ink">
                                    {MSG.POST_COMBAT_TITLE(enemyName)}
                                </h2>
                            </div>
                            <MomentCloseButton
                                data-testid="post-combat-close"
                                aria-label={MSG.POST_COMBAT_CLOSE_ARIA}
                                onClick={handleClose}
                                className="-mr-1 -mt-1"
                            />
                        </header>

                        <section
                            data-testid="post-combat-decision-strip"
                            data-result-tone={decisionStrip.tone}
                            aria-label="전투 결과 판단 요약"
                            className="aether-result-strip ae-moment-advice grid grid-cols-2 px-1 py-2.5"
                        >
                            <div className="ae-moment-advice-cell min-w-0 px-3">
                                <div className="ae-moment-advice-label font-readable text-[11px] font-bold">{MSG.POST_COMBAT_STATE_LABEL}</div>
                                <div className="mt-0.5 break-keep font-readable text-[13px] font-extrabold text-ae-ink">
                                    {decisionState}
                                </div>
                            </div>
                            <div className="ae-moment-advice-cell min-w-0 px-3">
                                <div className="ae-moment-advice-label font-readable text-[11px] font-bold">{MSG.POST_COMBAT_RECOMMEND_LABEL}</div>
                                <div className="mt-0.5 break-keep font-readable text-[13px] font-extrabold text-ae-ink">
                                    {primaryLabel}
                                </div>
                            </div>
                        </section>

                        <section
                            data-testid="post-combat-reward-summary"
                            aria-label={MSG.POST_COMBAT_REWARDS_ARIA}
                            className="flex flex-wrap items-center gap-2"
                        >
                            <span data-testid="post-combat-reward-exp" className="ae-moment-stat is-exp inline-flex min-h-8 items-center rounded-ae-sm px-3 font-fira text-[13px] font-bold tabular-nums">{MSG.POST_COMBAT_EXP(shownExp)}</span>
                            <span data-testid="post-combat-reward-gold" className="ae-moment-stat is-gold inline-flex min-h-8 items-center rounded-ae-sm px-3 font-fira text-[13px] font-bold tabular-nums">{MSG.POST_COMBAT_GOLD(shownGold)}</span>
                            {droppedItems.length > 0 && (
                                <span className="ae-moment-stat inline-flex min-h-8 items-center gap-1.5 rounded-ae-sm px-3 font-readable text-[13px] font-bold">
                                    <Package size={13} className="text-ae-gold" aria-hidden="true" />
                                    <span className="font-fira tabular-nums">{MSG.POST_COMBAT_LOOT_COUNT(droppedItems.length)}</span>
                                </span>
                            )}
                        </section>

                        {(signatureLoot.length > 0 || lootSummary || primarySignal) && (
                            <section
                                data-testid="post-combat-loot"
                                className={`ae-well space-y-2 p-2.5 ${revealDone ? '' : 'aether-reveal-pending'}`}
                            >
                                {signatureLoot.length > 0 && (
                                    <div
                                        data-testid="post-combat-legendary"
                                        className={`ae-moment-legendary rounded-ae-sm px-3 py-2.5 ${lootRevealClass('aether-reveal-shimmer')}`}
                                        style={lootRevealStyle(0)}
                                    >
                                        <div className="flex items-center gap-1.5 font-readable text-[11px] font-bold text-ae-rarity-legendary">
                                            <Sparkles size={12} aria-hidden="true" />
                                            {MSG.SIGNATURE_DROP_LABEL}
                                        </div>
                                        <div className="mt-1 break-keep font-display text-[15px] font-extrabold leading-tight text-ae-ink">
                                            {formatLootStacks(signatureLoot).join(' · ')}
                                        </div>
                                        <div className="mt-0.5 font-readable text-[11px] text-ae-ink-2">
                                            {MSG.SIGNATURE_DROP_CODEX_NOTE}
                                        </div>
                                    </div>
                                )}

                                {lootSummary && (
                                    <div
                                        className={`flex items-start gap-2 px-1 font-readable text-[13px] text-ae-ink-2 ${lootRevealClass('aether-reveal-pop')}`}
                                        style={lootRevealStyle(signatureLoot.length > 0 ? 1 : 0)}
                                    >
                                        <Package size={14} className="mt-0.5 shrink-0 text-ae-gold" aria-hidden="true" />
                                        <span className="min-w-0 break-keep">{lootSummary}</span>
                                    </div>
                                )}

                                {primarySignal && (
                                    <div
                                        data-signal-tone={primarySignal.tone}
                                        className={`ae-moment-signal rounded-ae-sm px-3 py-2 font-readable text-[12px] ${lootRevealClass('aether-reveal-pop')}`}
                                        style={lootRevealStyle((signatureLoot.length > 0 ? 1 : 0) + (lootSummary ? 1 : 0))}
                                    >
                                        <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                                            <span className="ae-moment-signal-title text-[11px] font-bold">{primarySignal.title}</span>
                                            <strong className="min-w-0 break-keep text-[13px] font-extrabold text-ae-ink">{primarySignal.name}</strong>
                                        </div>
                                        {primarySignal.summary && (
                                            <div className="mt-1 break-keep leading-relaxed text-ae-ink-2">
                                                {primarySignal.summary}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </section>
                        )}

                        <div className="flex items-baseline gap-2 px-1 font-readable text-[12px]">
                            <span className="shrink-0 font-bold text-ae-gold-text">{analysis.grade}</span>
                            <span className="min-w-0 break-keep text-ae-ink-2">{compactNote}</span>
                        </div>

                        <div className={showContinue ? 'grid grid-cols-[1.25fr_0.75fr] gap-2' : ''}>
                            <ActionButton
                                variant="primary"
                                data-testid="post-combat-primary-action"
                                data-primary-kind={primaryKind}
                                disabled={!inputReady}
                                onClick={handlePrimaryAction}
                                icon={primaryIcon}
                                label={primaryLabel}
                                className="w-full"
                            />

                            {/* 탐험할 수 없는 곳에서는 이 단추가 닫기 아이콘과 같은 일을 하므로 그리지 않는다. */}
                            {showContinue && (
                                <ActionButton
                                    variant="glass"
                                    data-testid="post-combat-continue"
                                    disabled={!inputReady}
                                    onClick={handleContinueExplore}
                                    icon={<ArrowRight size={16} />}
                                    label={MSG.POST_COMBAT_CONTINUE}
                                    className="w-full"
                                />
                            )}
                        </div>
                    </div>
                </Motion.div>
            )}
        </AnimatePresence>
    );
};

export default PostCombatCard;
