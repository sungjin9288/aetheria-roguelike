import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { soundManager } from '../../systems/SoundManager';
import { MotionConfig } from 'framer-motion';
import { GS } from '../../reducers/gameStates';
import { useLegendaryDropDetector } from '../../hooks/useLegendaryDropDetector';
import { checkTitles, getTitleLabel } from '../../utils/gameUtils';
import { getRegionTheme } from '../../utils/regionTheme';
import { buildReturnBriefing } from '../../utils/returnBriefing';
import { DB } from '../../data/db';
import { AT } from '../../reducers/actionTypes';
import { MSG } from '../../data/messages';
import type { Player } from '../../types/index.js';
import MainLayout from '../MainLayout';
import StatusBar from '../StatusBar';
import DamageNumber from '../DamageNumber';
import LevelUpBanner from '../LevelUpBanner';
import CritPulse from '../CritPulse';
import PhaseBanner from '../PhaseBanner';
import LegendaryDropOverlay from '../LegendaryDropOverlay';
import MobileGameLayout from './MobileGameLayout';

const RelicChoicePanel = lazy(() => import('../RelicChoicePanel'));
const AscensionScreen  = lazy(() => import('../AscensionScreen'));
const TrueEndingScreen = lazy(() => import('../TrueEndingScreen'));
const PostCombatCard   = lazy(() => import('../PostCombatCard'));
const PremiumShop      = lazy(() => import('../PremiumShop'));
const MirrorPanel      = lazy(() => import('../MirrorPanel'));
const ReturnBriefingCard = lazy(() => import('../ReturnBriefingCard'));
const ExpeditionDebriefCard = lazy(() => import('../ExpeditionDebriefCard'));

const ReturnBriefingGate = ({ player, maxHp }: { player: Player; maxHp?: number }) => {
    const [briefing, setBriefing] = useState(() => buildReturnBriefing(player, Date.now(), maxHp));

    if (!briefing) return null;

    return (
        <Suspense fallback={null}>
            <ReturnBriefingCard
                briefing={briefing}
                onClose={() => setBriefing(null)}
            />
        </Suspense>
    );
};

const GameRoot = ({
    engine, fullStats,
    isPanelFocusState, mobileArchiveDockVisible,
    inventorySpotlight,
    premiumShopOpen, setPremiumShopOpen,
    mirrorPanelOpen, setMirrorPanelOpen,
    isMuted, setIsMuted,
    handleQuickSlotUse,
    damageFlash, healFlash, damageAmount,
}: any) => {
    const [mobileConsoleMode, setMobileConsoleMode] = useState('log');
    const expeditionSummary = engine.player?.lastExpeditionSummary || null;
    const showExpeditionDebrief = Boolean(
        expeditionSummary && (engine.expeditionDebriefOpen || !expeditionSummary.reviewedAt),
    );
    const readabilityMode = engine.player?.settings?.readabilityMode === 'high' ? 'high' : 'standard';
    // slice 21: 지역별 ambient 팔레트 — 위치 기반 accent/wash CSS 변수.
    const regionTheme = getRegionTheme(engine.player?.loc, DB.MAPS?.[engine.player?.loc]);
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

    const legendarySoundPlayedRef = useRef<any>(null);
    useEffect(() => {
        if (!legendaryDrop) {
            legendarySoundPlayedRef.current = null;
            return;
        }
        if (legendarySoundPlayedRef.current === legendaryDrop.name) return;
        legendarySoundPlayedRef.current = legendaryDrop.name;
        try {
            soundManager.play?.('levelUp');
        } catch {
            // fallback: 일부 sound 이름은 지원 안 할 수 있음
        }
    }, [legendaryDrop]);
    // slice 29: 레벨업 셀러브레이션 — player.level 증가 감지 시 배너 노출 후
    //   ~1.8s 자동 해제. visualEffect 'levelUp'은 연속 레벨업에서 값이 안 바뀌어
    //   재트리거 못 하므로 실제 level 변화를 watch (정확한 새 레벨 표시).
    const [levelUpBanner, setLevelUpBanner] = useState<number | null>(null);
    const prevLevelRef = useRef<any>(engine.player?.level);
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
    const lastCritLogIdRef = useRef<any>(null);
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
        if (p3 && !prev.p3) banner = { n: 3, name: e.name };
        else if (p2 && !prev.p2) banner = { n: 2, name: e.name };
        prevPhaseRef.current = { p2, p3 };
        if (banner) setPhaseBanner(banner);
    }, [engine.enemy]);

    useEffect(() => {
        if (!phaseBanner) return undefined;
        const timer = window.setTimeout(() => setPhaseBanner(null), 2000);
        return () => window.clearTimeout(timer);
    }, [phaseBanner]);

    const handleToggleMute = useCallback(() => setIsMuted(soundManager.toggleMute()), [setIsMuted]);
    const handleOpenEquipment = useCallback(() => {
        engine.actions.setSideTab?.('equipment');
        engine.actions.setGameState?.(GS.IDLE);
        setMobileConsoleMode('archive');
    }, [engine.actions]);

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

            <div className="relative z-10 flex min-h-0 flex-1 flex-col gap-1.5">
                <StatusBar
                    player={engine.player}
                    stats={fullStats}
                    enemy={engine.gameState === GS.COMBAT ? engine.enemy : null}
                    // slice 30: 가장 최근 로그가 'critical'이면 직전 타격이 크리 —
                    //   적 데미지 숫자를 골드+크게 강조 (enemy.hp 변화와 같은 dispatch라 정합).
                    enemyHitCrit={engine.gameState === GS.COMBAT && engine.logs?.[engine.logs.length - 1]?.type === 'critical'}
                    onCrystalClick={(engine.player?.premiumCurrency || 0) > 0 ? () => setPremiumShopOpen(true) : null}
                    isMuted={isMuted}
                    onToggleMute={handleToggleMute}
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
                {engine.liveConfig?.seasonEvent?.active && (
                    <div className="flex items-center justify-between gap-2 rounded-[0.9rem] border border-[#d5b180]/28 bg-[#d5b180]/10 px-3 py-2 text-[11px] font-fira">
                        <span className="text-[#f4e6c8]">
                            ⚡ {engine.liveConfig.seasonEvent.name || '시즌 이벤트'} 진행 중
                            {engine.liveConfig.seasonEvent.endsAt ? ` — D-${Math.max(0, Math.ceil(((engine.liveConfig.seasonEvent.endsAt.toDate?.() || new Date(engine.liveConfig.seasonEvent.endsAt)) as any - (new Date() as any)) / 86400000))}` : ''}
                            {engine.liveConfig.seasonEvent.goldMultiplier > 1 ? ` | 골드+${Math.round((engine.liveConfig.seasonEvent.goldMultiplier - 1) * 100)}%` : ''}
                            {engine.liveConfig.seasonEvent.xpMultiplier > 1 ? ` XP+${Math.round((engine.liveConfig.seasonEvent.xpMultiplier - 1) * 100)}%` : ''}
                        </span>
                        {engine.liveConfig.seasonEvent.bonusMap && (
                            <button
                                type="button"
                                onClick={() => engine.actions.move(engine.liveConfig.seasonEvent.bonusMap)}
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
                            onPurchaseTitle={(id: any, name: any, cost: any) => { engine.actions.purchaseCosmeticTitle?.(id, name, cost); }}
                        />
                    </Suspense>
                )}

                {mirrorPanelOpen && (
                    <Suspense fallback={null}>
                        <MirrorPanel
                            player={engine.player}
                            onClose={() => setMirrorPanelOpen(false)}
                            onPurchase={(nodeId: any) => { engine.actions.purchaseMirrorNode?.(nodeId); }}
                        />
                    </Suspense>
                )}

                <MobileGameLayout
                    engine={engine}
                    fullStats={fullStats}
                    isPanelFocusState={isPanelFocusState}
                    mobileArchiveDockVisible={mobileArchiveDockVisible}
                    inventorySpotlight={inventorySpotlight}
                    handleQuickSlotUse={handleQuickSlotUse}
                    damageFlash={damageFlash}
                    healFlash={healFlash}
                    mobileConsoleMode={mobileConsoleMode}
                    setMobileConsoleMode={setMobileConsoleMode}
                    onOpenMirror={() => setMirrorPanelOpen(true)}
                />
            </div>

            {/* Floating overlays */}
            {damageAmount && <DamageNumber amount={damageAmount} />}
            <LevelUpBanner level={levelUpBanner} />
            <CritPulse active={critPulse} />
            <PhaseBanner phase={phaseBanner} />

            {engine.pendingRelics && (
                <Suspense fallback={null}>
                    <RelicChoicePanel
                        pendingRelics={engine.pendingRelics}
                        dispatch={engine.dispatch}
                        player={engine.player}
                    />
                </Suspense>
            )}

            {engine.postCombatResult && (
                <Suspense fallback={null}>
                    <PostCombatCard
                        result={engine.postCombatResult}
                        onClose={() => engine.actions.clearPostCombat?.()}
                        onRest={() => engine.actions.rest?.()}
                        onSell={() => engine.actions.setSideTab?.('inventory')}
                    />
                </Suspense>
            )}

            {showExpeditionDebrief && expeditionSummary && (
                <Suspense fallback={null}>
                    <ExpeditionDebriefCard
                        summary={expeditionSummary}
                        onClose={() => engine.actions.closeExpeditionDebrief?.()}
                    />
                </Suspense>
            )}

            {engine.bootStage === 'ready' && engine.player && !showExpeditionDebrief && (
                <ReturnBriefingGate player={engine.player} maxHp={fullStats?.maxHp} />
            )}

            {engine.gameState === GS.ASCENSION && (
                <Suspense fallback={null}>
                    <AscensionScreen
                        player={engine.player}
                        actions={engine.actions}
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
        </MainLayout>
    </MotionConfig>
    );
};

export default GameRoot;
