import React, { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { soundManager } from '../../systems/SoundManager';
import { MotionConfig } from 'framer-motion';
import { GS } from '../../reducers/gameStates';
import { useLegendaryDropDetector } from '../../hooks/useLegendaryDropDetector';
import MainLayout from '../MainLayout';
import StatusBar from '../StatusBar';
import DamageNumber from '../DamageNumber';
import LegendaryDropOverlay from '../LegendaryDropOverlay';
import MobileGameLayout from './MobileGameLayout';

const RelicChoicePanel = lazy(() => import('../RelicChoicePanel'));
const AscensionScreen  = lazy(() => import('../AscensionScreen'));
const TrueEndingScreen = lazy(() => import('../TrueEndingScreen'));
const PostCombatCard   = lazy(() => import('../PostCombatCard'));
const PremiumShop      = lazy(() => import('../PremiumShop'));

const GameRoot = ({
    engine, fullStats,
    isPanelFocusState, mobileArchiveDockVisible,
    inventorySpotlight,
    premiumShopOpen, setPremiumShopOpen,
    isMuted, setIsMuted,
    handleQuickSlotUse,
    damageFlash, healFlash, damageAmount,
}: any) => {
    const [mobileConsoleMode, setMobileConsoleMode] = useState('log');
    const { currentDrop: legendaryDrop, dismissDrop: dismissLegendaryDrop } = useLegendaryDropDetector(engine.player?.inv, engine.dispatch);
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
    const handleToggleMute = useCallback(() => setIsMuted(soundManager.toggleMute()), [setIsMuted]);
    const handleOpenEquipment = useCallback(() => {
        engine.actions.setSideTab?.('equipment');
        engine.actions.setGameState?.(GS.IDLE);
        setMobileConsoleMode('archive');
    }, [engine.actions]);

    return (
    <MotionConfig reducedMotion="user">
        <MainLayout visualEffect={engine.visualEffect}>
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
                    onCrystalClick={(engine.player?.premiumCurrency || 0) > 0 ? () => setPremiumShopOpen(true) : null}
                    isMuted={isMuted}
                    onToggleMute={handleToggleMute}
                    onOpenEquipment={engine.gameState === GS.COMBAT ? null : handleOpenEquipment}
                />

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
                />
            </div>

            {/* Floating overlays */}
            {damageAmount && <DamageNumber amount={damageAmount} />}

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
                        mobile={true}
                    />
                </Suspense>
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
