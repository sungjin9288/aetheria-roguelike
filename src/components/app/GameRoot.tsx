import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { MotionConfig } from 'framer-motion';
import { GS } from '../../reducers/gameStates';
import { useLegendaryDropDetector } from '../../hooks/useLegendaryDropDetector';
import { checkTitles, getTitleLabel } from '../../utils/gameUtils';
import { getRegionTheme } from '../../utils/regionTheme';
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
import LegendaryDropOverlay from '../LegendaryDropOverlay';
import MobileGameLayout from './MobileGameLayout';
import ExpeditionDebriefCard from '../ExpeditionDebriefCard';
import { usePlatformBackHandler } from '../../platform/platformBackRegistry';
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
    const regionTheme = getRegionTheme(engine.player?.loc, DB.MAPS?.[engine.player?.loc ?? '']);
    // cycle 208: codex prop 전달 — useLegendaryDropDetector가 SEASON_XP 중복 award 방지용
    //   alreadyInCodex 체크에 활용.
    const { currentDrop: legendaryDrop, dismissDrop: dismissLegendaryDrop } = useLegendaryDropDetector(engine.player?.inv, engine.dispatch, engine.player?.stats?.codex);

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

    // slice 29: 레벨업 셀러브레이션 — player.level 증가 감지 시 배너 노출 후
    //   ~1.8s 자동 해제. visualEffect 'levelUp'은 연속 레벨업에서 값이 안 바뀌어
    //   재트리거 못 하므로 실제 level 변화를 watch (정확한 새 레벨 표시).
    const [levelUpBanner, setLevelUpBanner] = useState<number | null>(null);
    const prevLevelRef = useRef<number | undefined>(engine.player?.level);
    useEffect(() => {
        const lv = engine.player?.level;
        if (typeof lv !== 'number') return undefined;
        const prev = prevLevelRef.current;
        prevLevelRef.current = lv;
        if (typeof prev !== 'number' || lv <= prev) return undefined;
        setLevelUpBanner(lv);
        const timer = window.setTimeout(() => setLevelUpBanner(null), 1800);
        return () => window.clearTimeout(timer);
    }, [engine.player?.level]);

    // slice 31: 치명타 스크린 펄스 — 새 'critical' 로그 id 감지 시 잠깐 활성.
    //   (플레이어 크리 본문 로그 + 보스 페이즈 reveal이 critical 타입)
    const [critPulse, setCritPulse] = useState(false);
    const lastCritLogIdRef = useRef<string | null>(null);
    useEffect(() => {
        const logs = engine.logs;
        const last = logs?.[logs.length - 1];
        if (!last || last.type !== 'critical' || lastCritLogIdRef.current === last.id) return undefined;
        lastCritLogIdRef.current = last.id;
        setCritPulse(true);
        const timer = window.setTimeout(() => setCritPulse(false), 320);
        return () => window.clearTimeout(timer);
    }, [engine.logs]);

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
    usePlatformBackHandler(mobileConsoleMode === 'archive', closeMobileArchive, 30);

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

    const seasonEvent = engine.liveConfig?.seasonEvent ?? null;
    const seasonEventEndDate = seasonEvent?.endsAt ? toSeasonEventEndDate(seasonEvent.endsAt) : null;

    return (
    <MotionConfig reducedMotion="user">
        <MainLayout visualEffect={engine.visualEffect} readabilityMode={readabilityMode} regionTheme={regionTheme}>
            {/* Background layers */}
            <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
                <div className="absolute inset-0 animate-aurora bg-[radial-gradient(circle_at_top_left,rgba(213,177,128,0.09),transparent_28%),radial-gradient(circle_at_78%_18%,rgba(125,212,216,0.1),transparent_22%),linear-gradient(180deg,rgba(7,11,17,0.42)_0%,rgba(3,5,8,0.74)_100%)]" />
                <div className="absolute inset-0 opacity-[0.18] aether-soft-grid" />
                <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/[0.03] via-transparent to-transparent" />
                <div className="absolute -left-12 top-24 rounded-full blur-3xl h-48 w-48 bg-[#d5b180]/10 animate-float-slow" />
                <div
                    className="absolute -right-12 bottom-20 rounded-full blur-3xl h-56 w-56 bg-[#7dd4d8]/10 animate-float-slow"
                    style={{ animationDelay: '-2.7s' }}
                />
            </div>

            <div className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col gap-1.5">
                <StatusBar
                    player={engine.player}
                    stats={fullStats}
                    enemy={engine.gameState === GS.COMBAT ? engine.enemy : null}
                    // slice 30: 가장 최근 로그가 'critical'이면 직전 타격이 크리 —
                    //   적 데미지 숫자를 골드+크게 강조 (enemy.hp 변화와 같은 dispatch라 정합).
                    enemyHitCrit={engine.gameState === GS.COMBAT && engine.logs?.[engine.logs.length - 1]?.type === 'critical'}
                    onCrystalClick={(engine.player?.premiumCurrency || 0) > 0 ? () => setPremiumShopOpen(true) : null}
                    onOpenEquipment={engine.gameState === GS.COMBAT ? null : handleOpenEquipment}
                />

                {/* cycle 266: liveConfig.announcement 배너 — admin이 SystemTab에서 설정한 공지를
                    플레이어에게 표시. 빈 문자열 / 미정의 시 미표시 (silence over noise). */}
                {engine.liveConfig?.announcement && (
                    <div
                        data-testid="live-config-announcement"
                        className="rounded-[0.9rem] border border-cyan-300/24 bg-cyan-300/[0.08] px-3 py-2 text-[11px] font-fira text-cyan-100"
                    >
                        📣 {engine.liveConfig.announcement}
                    </div>
                )}

                {/* 시즌 이벤트 배너 */}
                {seasonEvent?.active && (
                    <div className="flex items-center justify-between gap-2 rounded-[0.9rem] border border-[#d5b180]/28 bg-[#d5b180]/10 px-3 py-2 text-[11px] font-fira">
                        <span className="text-[#f4e6c8]">
                            ⚡ {seasonEvent.name || '시즌 이벤트'} 진행 중
                            {seasonEventEndDate ? ` — D-${Math.max(0, Math.ceil((seasonEventEndDate.getTime() - new Date().getTime()) / 86400000))}` : ''}
                            {(seasonEvent.goldMultiplier ?? 1) > 1 ? ` | 골드+${Math.round(((seasonEvent.goldMultiplier ?? 1) - 1) * 100)}%` : ''}
                            {(seasonEvent.xpMultiplier ?? 1) > 1 ? ` XP+${Math.round(((seasonEvent.xpMultiplier ?? 1) - 1) * 100)}%` : ''}
                        </span>
                        {seasonEvent.bonusMap && (
                            <button
                                type="button"
                                onClick={() => { if (seasonEvent.bonusMap) engine.actions.move(seasonEvent.bonusMap); }}
                                className="shrink-0 rounded-full border border-[#d5b180]/28 bg-[#d5b180]/16 px-2 py-0.5 text-[10px] font-fira text-[#f4e6c8] uppercase tracking-[0.14em] hover:bg-[#d5b180]/24"
                            >
                                이동
                            </button>
                        )}
                    </div>
                )}

                {premiumShopOpen && (
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
                )}

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
            </div>

            {/* Floating overlays */}
            {damageAmount && <DamageNumber amount={damageAmount} />}
            <LevelUpBanner level={levelUpBanner} />
            <CritPulse active={critPulse} />
            <PhaseBanner phase={visiblePhaseBanner} />

            {engine.pendingRelics && (
                <Suspense fallback={null}>
                    <RelicChoicePanel
                        pendingRelics={engine.pendingRelics}
                        dispatch={engine.dispatch}
                        player={engine.player}
                        stats={fullStats}
                    />
                </Suspense>
            )}

            {engine.postCombatResult && (
                <Suspense fallback={null}>
                    <PostCombatCard
                        result={engine.postCombatResult}
                        onClose={() => engine.actions.clearPostCombat?.()}
                        onOpenInventory={() => handleOpenArchiveTab('inventory')}
                        onResolveChoice={(choice) => engine.dispatch({
                            type: AT.RESOLVE_POST_COMBAT_CHOICE,
                            payload: { choice },
                        })}
                    />
                </Suspense>
            )}

            {showExpeditionDebrief && expeditionSummary && expeditionReturnAction && (
                <Suspense fallback={null}>
                    <ExpeditionDebriefCard
                        summary={expeditionSummary}
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

            {showStandaloneStory && standaloneStoryBeat && (
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
