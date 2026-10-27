import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { MotionConfig } from 'framer-motion';
import { CalendarClock, Megaphone, Sparkles } from 'lucide-react';
import { GS } from '../../reducers/gameStates';
import { useLegendaryDropDetector } from '../../hooks/useLegendaryDropDetector';
import { useCombatFeedbackBeats } from '../../hooks/useCombatFeedbackBeats';
import { useLevelUpCelebration } from '../../hooks/useLevelUpCelebration';
import { usePresentationHaptic } from '../../hooks/useHapticFeedback';
import { isHapticsEnabled } from '../../utils/playerSettings';
import { getCombatStageView, getPresentedVisualEffect } from '../../utils/combatPresentation';
import { checkTitles, getTitleLabel } from '../../utils/gameUtils';
import { getVisibleExpeditionSummary, getVisibleRegionTheme } from '../../utils/challengeRules';
import { buildReturnBriefing } from '../../utils/returnBriefing';
import { getExpeditionReturnAction } from '../../utils/expeditionReturnFlow';
import { getPendingMilestoneStoryBeat, type MilestoneStoryBeat } from '../../utils/milestoneStory';
import { DB } from '../../data/db';
import { AT } from '../../reducers/actionTypes';
import { MSG } from '../../data/messages';
import type { ExpeditionSummary, FullStats, Item, Player } from '../../types/index.js';
import type { useGameEngine } from '../../hooks/useGameEngine';
import type { useDamageFlash } from '../../hooks/useDamageFlash';
import MainLayout from '../MainLayout';
import StatusBar from '../StatusBar';
import DamageNumber from '../DamageNumber';
import LevelUpBanner from '../LevelUpBanner';
import CritPulse from '../CritPulse';
import PhaseBanner from '../PhaseBanner';
import MomentBanners from '../MomentBanners';
import { useClassChangeReadyLevel } from '../../hooks/useClassChangeReadyLevel';
import { isLevelUpClassChangeReady } from '../../utils/classChangeReadiness';
import { getPostCombatExploreAction } from '../../utils/postCombatContinue';
import LegendaryDropOverlay from '../LegendaryDropOverlay';
import MobileGameLayout from './MobileGameLayout';
import DesktopGameLayout from './desktop/DesktopGameLayout';
import { useDesktopLayout } from '../../hooks/useDesktopLayout';
import ActionButton from '../ui/ActionButton';
import ExpeditionDebriefCard from '../ExpeditionDebriefCard';
import { usePlatformBackHandler } from '../../platform/platformBackRegistry';
import { MAIN_CONTENT_ID } from '../../platform/modalFocus';
import { useReturnSupplyRewardedAd } from '../../hooks/useReturnSupplyRewardedAd';

const RelicChoicePanel = lazy(() => import('../RelicChoicePanel'));
const AscensionScreen  = lazy(() => import('../AscensionScreen'));
const TrueEndingScreen = lazy(() => import('../TrueEndingScreen'));
const PostCombatCard   = lazy(() => import('../PostCombatCard'));
const PremiumShop      = lazy(() => import('../PremiumShop'));
const MirrorPanel      = lazy(() => import('../MirrorPanel'));
const ReturnBriefingCard = lazy(() => import('../ReturnBriefingCard'));
const MilestoneStoryCard = lazy(() => import('../MilestoneStoryCard'));

/**
 * liveConfig.seasonEvent.endsAt(`types/session.ts`)는 Firestore Timestamp | 문자열 | 숫자가
 * 섞여 온다(`unknown`) — 표시 시점에만 Date로 정규화한다. 파싱 실패 시 null(호출부가
 * "지금"으로 fallback해 이전의 `new Date(weirdValue)` → NaN → "D-NaN" 표시보다 안전하다).
 */
const toSeasonEventEndDate = (value: unknown): Date | null => {
    if (value instanceof Date) return value;
    if (typeof value === 'string' || typeof value === 'number') return new Date(value);
    if (value && typeof value === 'object' && 'toDate' in value) {
        const toDate = (value as { toDate?: () => Date }).toDate;
        if (typeof toDate === 'function') return toDate();
    }
    return null;
};

const resolveExpeditionJob = (player: Player, summary: ExpeditionSummary | null) => {
    if (summary?.job) return summary.job;
    if (!summary?.id) return null;

    return Object.entries(player.classJourney?.byJob || {}).find(([, record]) => (
        record.expeditionIds.includes(summary.id)
    ))?.[0] || null;
};

const ReturnBriefingGate = ({
    player,
    maxHp,
    onOpenGoals,
}: {
    player: Player;
    maxHp?: number;
    onOpenGoals: () => void;
}) => {
    const [briefing, setBriefing] = useState(() => buildReturnBriefing(player, Date.now(), maxHp));

    if (!briefing) return null;

    return (
        <Suspense fallback={null}>
            <ReturnBriefingCard
                briefing={briefing}
                onClose={() => setBriefing(null)}
                onOpenGoals={() => {
                    setBriefing(null);
                    onOpenGoals();
                }}
            />
        </Suspense>
    );
};

/** `useGameEngine`이 반환하는 실제 모양 — type-only import라 훅 모듈이 로드되지 않는다. */
type GameEngine = ReturnType<typeof useGameEngine>;
/** `useDamageFlash`가 반환하는 데미지/회복 피드백 상태. */
type DamageFlashState = ReturnType<typeof useDamageFlash>;

interface GameRootProps {
    engine: GameEngine;
    fullStats: FullStats;
    isPanelFocusState: boolean;
    mobileArchiveDockVisible: boolean;
    premiumShopOpen: boolean;
    setPremiumShopOpen: (open: boolean) => void;
    mirrorPanelOpen: boolean;
    setMirrorPanelOpen: (open: boolean) => void;
    handleQuickSlotUse: (item: Item, idx: number) => void;
    damageFlash: DamageFlashState['damageFlash'];
    healFlash: DamageFlashState['healFlash'];
    damageAmount: DamageFlashState['damageAmount'];
}

const GameRoot = ({
    engine, fullStats,
    isPanelFocusState, mobileArchiveDockVisible,
    premiumShopOpen, setPremiumShopOpen,
    mirrorPanelOpen, setMirrorPanelOpen,
    handleQuickSlotUse,
    damageFlash, healFlash, damageAmount,
}: GameRootProps) => {
    const [mobileConsoleMode, setMobileConsoleMode] = useState(
        import.meta.env.VITE_DEVICE_QA_SCENARIO === 'system-settings'
        || import.meta.env.VITE_DEVICE_QA_SCENARIO === 'progression-acceptance'
            ? 'archive'
            : 'log',
    );
    const expeditionSummary = engine.player?.lastExpeditionSummary || null;
    const expeditionJob = resolveExpeditionJob(engine.player, expeditionSummary);
    const showExpeditionDebrief = Boolean(
        expeditionSummary && (engine.expeditionDebriefOpen || !expeditionSummary.reviewedAt),
    );
    const expeditionReturnAction = expeditionSummary
        ? getExpeditionReturnAction(engine.player, expeditionSummary, fullStats)
        : null;
    const returnSupplyReward = useReturnSupplyRewardedAd({
        summary: expeditionSummary,
        debriefOpen: showExpeditionDebrief,
        player: engine.player,
        dispatch: engine.dispatch,
        flushLocalSave: engine.flushLocalSave,
    });
    const debriefStoryBeat = showExpeditionDebrief
        ? getPendingMilestoneStoryBeat(engine.player, ['first_safe_return', 'first_area_boss'])
        : null;
    const standaloneStoryBeat = !showExpeditionDebrief
        ? getPendingMilestoneStoryBeat(engine.player)
        : null;
    const showStandaloneStory = Boolean(
        standaloneStoryBeat
        && engine.gameState === GS.IDLE
        && !engine.pendingRelics
        && !engine.postCombatResult,
    );
    const readabilityMode = engine.player?.settings?.readabilityMode === 'high' ? 'high' : 'standard';
    // slice 21: 지역별 ambient 팔레트 — 위치 기반 accent/wash CSS 변수.
    // 2026-10 Wave 62 (원장 §61.2 A10): 길 잃은 여행이면 지역 색을 고정한다(지역 색이 곧 위치 단서다).
    const regionTheme = getVisibleRegionTheme(engine.player, DB.MAPS?.[engine.player?.loc ?? '']);
    // 2026-10-26 소유자 결정 D33: 도감 · 시즌 경험 · 기록 줄은 리듀서의 획득 전이가 남기고, 이 화면은 그 획득 목록만 읽는다.
    // GF-13: presentationEpoch — 복원 전의 대기열은 그리지 않는다.
    const { currentDrop: legendaryDrop, dismissDrop: dismissLegendaryDrop } = useLegendaryDropDetector(engine.legendaryAcquisitions, engine.presentationEpoch);
    // 2026-10-26 소유자 결정 D3: 전설 획득 화면이 새 전설로 뜨는 순간 진동한다(설정의 '진동'이 꺼져 있으면 울리지 않는다).
    usePresentationHaptic('legendary', legendaryDrop, isHapticsEnabled(engine.player));

    // cycle 62: 신규 칭호(wanderer / pathfinder / cartographer / legend_seeker /
    // legend_chronicler 등)가 추가된 이후 기존 save를 로드하면, 이미 조건을 만족
    // 했더라도 다음 인벤토리 액션이 발생할 때까지 칭호가 부여되지 않는다.
    // bootStage === 'ready' 진입 시점에 1회 확인해 retroactive 부여를 처리.
    const titleCheckedRef = useRef(false);
    useEffect(() => {
        if (titleCheckedRef.current) return;
        if (engine.bootStage !== 'ready' || !engine.player) return;
        titleCheckedRef.current = true;
        const newTitles = checkTitles(engine.player);
        if (newTitles.length > 0) {
            engine.dispatch({ type: AT.UNLOCK_TITLES, payload: newTitles });
            newTitles.forEach((id: string) => engine.addLog?.('system', MSG.TITLE_UNLOCKED(getTitleLabel(id))));
        }
    // 의도적으로 entire engine 대신 사용 path만 의존 — 다른 engine 필드 변화로
    // 재실행되면 retroactive title 부여가 매 변화마다 다시 시도되어 비효율.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [engine.bootStage, engine.player, engine.dispatch, engine.addLog]);

    // slice 29: 레벨업 셀러브레이션 — player.level 증가 감지 시 배너 노출 후 ~1.8s 자동 해제.
    //   GF-13: 복원(presentationEpoch)으로 바뀐 레벨은 축하하지 않는다(useLevelUpCelebration).
    const levelUpBanner = useLevelUpCelebration(engine.player?.level, engine.presentationEpoch);

    // 게임 필 감사 GF-01 · 02 · 06 · 11: 전투 연출은 리듀서의 차례 기록(combatFeedback)을 읽는다 — 기록 꼬리로 추측하지 않는다.
    //   내 치명타 = 금빛, 적 강타 = 붉은빛 + 흔들림(내 타격 뒤 박자), 처치 = 쓰러진 적을 잠깐 그린 뒤 결과 카드.
    const beats = useCombatFeedbackBeats(engine.combatFeedback, engine.presentationEpoch);
    const combatStage = getCombatStageView(engine.gameState === GS.COMBAT ? engine.enemy : null, beats.defeatedEnemy);
    const visualEffect = getPresentedVisualEffect(engine.visualEffect, beats.shake);

    // slice 33: 보스 페이즈 전환 배너 — enemy.phase2Triggered/phase3Triggered
    //   false→true 플립 감지 시 {n, name} 노출 후 ~2s 해제. enemy 소멸 시 baseline 리셋.
    const [phaseBanner, setPhaseBanner] = useState<{ n: number; name: string } | null>(null);
    const prevPhaseRef = useRef<{ p2: boolean; p3: boolean }>({ p2: false, p3: false });
    useEffect(() => {
        const e = engine.enemy;
        if (!e) {
            prevPhaseRef.current = { p2: false, p3: false };
            return;
        }
        const p2 = !!e.phase2Triggered;
        const p3 = !!e.phase3Triggered;
        const prev = prevPhaseRef.current;
        let banner: { n: number; name: string } | null = null;
        if (p3 && !prev.p3) banner = { n: 3, name: e.name || '' };
        else if (p2 && !prev.p2) banner = { n: 2, name: e.name || '' };
        prevPhaseRef.current = { p2, p3 };
        if (banner) setPhaseBanner(banner);
    }, [engine.enemy]);

    useEffect(() => {
        if (!phaseBanner) return undefined;
        const timer = window.setTimeout(() => setPhaseBanner(null), 2000);
        return () => window.clearTimeout(timer);
    }, [phaseBanner]);

    // Wave 19 K2: 아카이브 진입 게이트는 `openArchive` 액션이 소유한다(§8-3/Wave 17 I1과
    //   같은 모양) — 여기서 두 dispatch를 직접 부르면 UI에만 있는 가드가 되어 버린다.
    //   콘솔 모드 전환도 액션이 수락했을 때만 한다(거부됐는데 화면이 바뀌면 안 된다).
    const handleOpenArchiveTab = useCallback((tab: string) => {
        if (engine.actions.openArchive(tab)) setMobileConsoleMode('archive');
    }, [engine.actions]);
    const handleOpenEquipment = useCallback(() => {
        handleOpenArchiveTab('equipment');
    }, [handleOpenArchiveTab]);
    const closeMobileArchive = useCallback(() => setMobileConsoleMode('log'), []);
    // 2026-10 데스크톱 배치(VD-04 · UX-12): 1024px 이상은 세 칸 — 모험 기록이 늘 열린 오른쪽 열이라 '뒤로'가 닫을 콘솔이 없다.
    const isDesktopLayout = useDesktopLayout();
    usePlatformBackHandler(mobileConsoleMode === 'archive' && !isDesktopLayout, closeMobileArchive, 30);

    const acknowledgeStoryBeat = (storyBeat: MilestoneStoryBeat | null) => {
        if (storyBeat?.id) engine.actions.acknowledgeMilestoneStoryBeat?.(storyBeat.id);
    };

    const closeExpeditionDebrief = () => {
        acknowledgeStoryBeat(debriefStoryBeat);
        engine.actions.closeExpeditionDebrief?.();
    };

    const runExpeditionReturnAction = () => {
        if (!expeditionReturnAction) return;

        switch (expeditionReturnAction.kind) {
            case 'claim_quest':
                if (expeditionReturnAction.questId != null) engine.actions.completeQuest?.(expeditionReturnAction.questId);
                break;
            case 'rest':
                engine.actions.rest?.();
                break;
            case 'open_equipment':
                handleOpenArchiveTab('equipment');
                break;
            case 'open_inventory':
                handleOpenArchiveTab('inventory');
                break;
            case 'open_shop':
                // Wave 17 I1: 상점 진입은 액션이 소유한다(가드 포함) — UI와 터미널이
                //   같은 경로를 쓰게 해서 한쪽에만 가드가 있는 상태를 없앤다.
                engine.actions.openShop?.();
                break;
            case 'open_crafting':
                engine.actions.setGameState?.(GS.CRAFTING);
                break;
            case 'open_quest_board':
                engine.actions.setGameState?.(GS.QUEST_BOARD);
                break;
            default:
                return;
        }

        closeExpeditionDebrief();
    };

    const visiblePhaseBanner = engine.enemy && phaseBanner
        && engine.enemy.name === phaseBanner.name
        && ((phaseBanner.n === 2 && engine.enemy.phase2Triggered)
            || (phaseBanner.n === 3 && engine.enemy.phase3Triggered))
        ? phaseBanner
        : null;
    // 2026-10 (감사 CL-05): 레벨업으로 전직이 새로 열린 레벨 — 레벨 상승 띠가 부제 '전직할 수 있습니다'를 단다.
    const classChangeReadyLevel = useClassChangeReadyLevel(engine.player?.level, engine.player?.job, engine.presentationEpoch);

    const seasonEvent = engine.liveConfig?.seasonEvent ?? null;
    const seasonEventEndDate = seasonEvent?.endsAt ? toSeasonEventEndDate(seasonEvent.endsAt) : null;
    const seasonEventDaysLeft = seasonEventEndDate
        ? Math.max(0, Math.ceil((seasonEventEndDate.getTime() - new Date().getTime()) / 86400000))
        : null;
    const seasonGoldBonus = Math.round(((seasonEvent?.goldMultiplier ?? 1) - 1) * 100);
    const seasonExpBonus = Math.round(((seasonEvent?.xpMultiplier ?? 1) - 1) * 100);

    // 상태 카드는 한 번만 만든다 — 모바일은 화면 위 표시줄, 데스크톱은 왼쪽 열의 카드(placement)로 같은 부품을 그린다.
    const statusBar = (
        <StatusBar
            player={engine.player}
            stats={fullStats}
            enemy={combatStage.enemy}
            enemyDefeated={combatStage.enemyDefeated}
            // slice 30 → GF-01: 이번 차례 내 타격이 치명타면 적 피해 숫자를 금빛으로 강조한다
            //   (enemy.hp 변화와 같은 dispatch의 차례 기록이라 정합 — 적 강타에는 붙지 않는다).
            enemyHitCrit={beats.hitCrit}
            onCrystalClick={(engine.player?.premiumCurrency || 0) > 0 ? () => setPremiumShopOpen(true) : null}
            onOpenEquipment={engine.gameState === GS.COMBAT ? null : handleOpenEquipment}
            placement={isDesktopLayout ? 'column' : 'bar'}
        />
    );

    const liveBanners = (
        <>
            {/* cycle 266: liveConfig.announcement 배너 — admin이 SystemTab에서 설정한 공지를
                플레이어에게 표시. 빈 문자열 / 미정의 시 미표시 (silence over noise). */}
            {engine.liveConfig?.announcement && (
                <div
                    data-testid="live-config-announcement"
                    className="ae-well flex items-start gap-2 rounded-ae-md px-3 py-2 text-[12px] leading-snug text-ae-ink"
                >
                    <Megaphone size={14} aria-hidden="true" className="mt-[2px] shrink-0 text-ae-ether-hi" />
                    <span className="sr-only">{MSG.SHELL_ANNOUNCEMENT_LABEL}</span>
                    <span className="min-w-0">{engine.liveConfig.announcement}</span>
                </div>
            )}

            {/* 시즌 이벤트 배너 */}
            {seasonEvent?.active && (
                <div data-testid="season-event-banner" className="ae-well flex flex-wrap items-center justify-between gap-2 rounded-ae-md px-3 py-1.5">
                    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                        <Sparkles size={14} aria-hidden="true" className="shrink-0 text-ae-gold" />
                        <span className="min-w-0 text-[12px] font-semibold text-ae-gold-text">
                            {MSG.SHELL_SEASON_EVENT_ACTIVE(seasonEvent.name || MSG.SHELL_SEASON_EVENT_FALLBACK_NAME)}
                        </span>
                        {seasonEventDaysLeft != null && (
                            <span className="ae-chip">
                                <CalendarClock size={12} aria-hidden="true" className="ae-chip-icon" />
                                {MSG.SHELL_SEASON_EVENT_DAYS_LEFT(seasonEventDaysLeft)}
                            </span>
                        )}
                        {seasonGoldBonus > 0 && <span className="ae-chip ae-chip-gold font-fira tabular-nums">{MSG.SEASON_EVENT_GOLD_BONUS(seasonGoldBonus)}</span>}
                        {seasonExpBonus > 0 && <span className="ae-chip ae-chip-ether font-fira tabular-nums">{MSG.SEASON_EVENT_EXP_BONUS(seasonExpBonus)}</span>}
                    </div>
                    {seasonEvent.bonusMap && (
                        <ActionButton
                            variant="glass"
                            className="shrink-0"
                            label={MSG.SHELL_SEASON_EVENT_MOVE(seasonEvent.bonusMap)}
                            onClick={() => { if (seasonEvent.bonusMap) engine.actions.move(seasonEvent.bonusMap); }}
                        />
                    )}
                </div>
            )}
        </>
    );

    const premiumShop = premiumShopOpen && (
        <Suspense fallback={null}>
            <PremiumShop
                player={engine.player}
                onClose={() => setPremiumShopOpen(false)}
                onExpandInventory={() => { engine.actions.expandInventory?.(); }}
                onPurchaseSynthProtect={() => { engine.actions.purchaseSynthProtect?.(); }}
                onPurchaseRevive={() => { engine.actions.purchaseRevive?.(); }}
                onPurchaseTitle={(id) => { engine.actions.purchaseCosmeticTitle?.(id); }}
            />
        </Suspense>
    );

    return (
    <MotionConfig reducedMotion="user">
        <MainLayout visualEffect={visualEffect} readabilityMode={readabilityMode} regionTheme={regionTheme}>
            {/* VD-14: 바탕은 MainLayout 한 곳(앱 바탕 · 지역 빛 · 비네트)이 그린다 — 여기서 같은 빛 번짐을 다시 깔지 않는다. */}
            <main id={MAIN_CONTENT_ID} tabIndex={-1} className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col gap-1.5 focus-visible:outline-none">
                {isDesktopLayout ? (
                    <>
                        <DesktopGameLayout
                            engine={engine}
                            fullStats={fullStats}
                            isPanelFocusState={isPanelFocusState}
                            mobileArchiveDockVisible={mobileArchiveDockVisible}
                            handleQuickSlotUse={handleQuickSlotUse}
                            damageFlash={damageFlash}
                            healFlash={healFlash}
                            statusBar={statusBar}
                            banners={liveBanners}
                            mobileConsoleMode={mobileConsoleMode}
                            setMobileConsoleMode={setMobileConsoleMode}
                            onOpenMirror={() => setMirrorPanelOpen(true)}
                            onOpenCrystalExchange={() => setPremiumShopOpen(true)}
                        />
                        {premiumShop}
                    </>
                ) : (
                    <>
                        {statusBar}
                        {liveBanners}
                        {premiumShop}
                        <MobileGameLayout
                            engine={engine}
                            fullStats={fullStats}
                            isPanelFocusState={isPanelFocusState}
                            mobileArchiveDockVisible={mobileArchiveDockVisible}
                            handleQuickSlotUse={handleQuickSlotUse}
                            damageFlash={damageFlash}
                            healFlash={healFlash}
                            mobileConsoleMode={mobileConsoleMode}
                            setMobileConsoleMode={setMobileConsoleMode}
                            onOpenMirror={() => setMirrorPanelOpen(true)}
                            onOpenCrystalExchange={() => setPremiumShopOpen(true)}
                        />
                    </>
                )}
            </main>

            {/* Floating overlays */}
            {/* 2026-10 (감사 GF-08 · GF-09): 보스 · 우두머리 등장과 유물 획득 순간 — 레벨 상승 띠가 떠 있으면 그 아래. */}
            <MomentBanners
                enemy={engine.gameState === GS.COMBAT ? engine.enemy : null}
                relics={engine.player?.relics}
                presentationEpoch={engine.presentationEpoch}
                belowLevelUp={levelUpBanner != null}
            />
            {damageAmount && <DamageNumber amount={damageAmount} />}
            <LevelUpBanner level={levelUpBanner} classChangeReady={isLevelUpClassChangeReady(levelUpBanner, classChangeReadyLevel)} />
            <CritPulse active={beats.critPulse} />
            <CritPulse active={beats.heavyPulse} tone="heavy" />
            {/* GF-02: 처치 순간에는 손가락 아래가 이미 대기 화면(탐험 · 휴식 · 출발)이다 — 공격을 연타한 손이 그 단추를
                누르지 않게 그 짧은 박자 동안 화면 입력을 받아 낸다(결과 카드 · 유물 선택은 박자 뒤에 연다). */}
            {combatStage.holdResultCards && (
                <div data-testid="kill-beat-input-guard" aria-hidden="true" className="fixed inset-0 z-[45]" />
            )}
            {/* GF-11: 화면 낭독기에 이번 차례 요약 — 새 차례마다 바꿔 끼워 같은 문장도 다시 읽는다. */}
            <div data-testid="combat-announcer" role="status" aria-live="polite" aria-atomic="true" className="sr-only">
                {beats.announcement && <span key={beats.announcementKey ?? undefined}>{beats.announcement}</span>}
            </div>
            <PhaseBanner phase={visiblePhaseBanner} />

            {/* GF-02: 처치 순간이 끝난 뒤에 고를 것 · 결과 카드를 띄운다. */}
            {engine.pendingRelics && !combatStage.holdResultCards && (
                <Suspense fallback={null}>
                    <RelicChoicePanel
                        pendingRelics={engine.pendingRelics}
                        dispatch={engine.dispatch}
                        player={engine.player}
                        stats={fullStats}
                    />
                </Suspense>
            )}

            {engine.postCombatResult && !combatStage.holdResultCards && (
                <Suspense fallback={null}>
                    <PostCombatCard
                        result={engine.postCombatResult}
                        onClose={() => engine.actions.clearPostCombat?.()}
                        onOpenInventory={() => handleOpenArchiveTab('inventory')}
                        onExplore={getPostCombatExploreAction(engine.gameState, engine.player, engine.actions.explore)}
                    />
                </Suspense>
            )}

            {showExpeditionDebrief && expeditionSummary && expeditionReturnAction && (
                <Suspense fallback={null}>
                    <ExpeditionDebriefCard
                        summary={getVisibleExpeditionSummary(engine.player, expeditionSummary)}
                        recommendation={expeditionReturnAction}
                        journeyJob={expeditionJob}
                        journey={expeditionJob ? engine.player.classJourney?.byJob[expeditionJob] : undefined}
                        storyBeat={debriefStoryBeat}
                        onClose={closeExpeditionDebrief}
                        onPrimaryAction={runExpeditionReturnAction}
                        returnSupplyReward={returnSupplyReward}
                    />
                </Suspense>
            )}

            {showStandaloneStory && standaloneStoryBeat && !combatStage.holdResultCards && (
                <Suspense fallback={null}>
                    <MilestoneStoryCard
                        story={standaloneStoryBeat}
                        onClose={() => acknowledgeStoryBeat(standaloneStoryBeat)}
                    />
                </Suspense>
            )}

            {engine.bootStage === 'ready' && engine.player && !showExpeditionDebrief && !showStandaloneStory && (
                <ReturnBriefingGate
                    player={engine.player}
                    maxHp={fullStats?.maxHp}
                    onOpenGoals={() => handleOpenArchiveTab('quest')}
                />
            )}

            {engine.gameState === GS.ASCENSION && (
                <Suspense fallback={null}>
                    <AscensionScreen
                        player={engine.player}
                        actions={engine.actions}
                        onOpenMirror={() => setMirrorPanelOpen(true)}
                    />
                </Suspense>
            )}

            {engine.gameState === GS.TRUE_ENDING && (
                <Suspense fallback={null}>
                    <TrueEndingScreen
                        player={engine.player}
                        actions={engine.actions}
                    />
                </Suspense>
            )}

            <LegendaryDropOverlay item={legendaryDrop} onDismiss={dismissLegendaryDrop} />

            {/* 에테르 거울은 승천 화면(z-200) 위에서도 열려야 하므로 오버레이 중 가장 마지막에 그린다. */}
            {mirrorPanelOpen && (
                <Suspense fallback={null}>
                    <MirrorPanel
                        player={engine.player}
                        onClose={() => setMirrorPanelOpen(false)}
                        onPurchase={(nodeId) => { engine.actions.purchaseMirrorNode?.(nodeId); }}
                    />
                </Suspense>
            )}
        </MainLayout>
    </MotionConfig>
    );
};

export default GameRoot;
