import { lazy, Suspense } from 'react';
import { motion as Motion } from 'framer-motion';
import { GS } from '../../reducers/gameStates';
import TerminalView from '../TerminalView';
import ControlPanel from '../ControlPanel';
import EnemyStatus from '../combat/EnemyStatus';
import FieldStage from '../field/FieldStage';
import { isFieldStageMode } from '../../utils/fieldStage';
import { getVisibleLocationVisual } from '../../utils/challengeRules';
import { getEnemyIntent } from '../../utils/enemyIntent';
import { usePreloadPostCombatCard, useStageEnterClass } from './stageLayoutHooks';
import type { FullStats, Item } from '../../types/index.js';
import type { useGameEngine } from '../../hooks/useGameEngine';
import type { useDamageFlash } from '../../hooks/useDamageFlash';
import type { CombatStageView } from '../../utils/combatPresentation';
import type { InventoryFilterRequest } from '../../utils/inventoryFilters';

const Dashboard = lazy(() => import('../Dashboard'));

// 모험 기록을 받는 동안의 자리 — 데스크톱 배치(app/desktop/DesktopGameLayout)의 오른쪽 칸도 같은 자리를 쓴다.
export const DashboardFallback = () => (
    <div
        aria-hidden="true"
        className="ae-card is-quiet animate-pulse shrink-0 rounded-ae-lg px-3 py-2.5 min-h-[4.5rem]"
    />
);

/** `useGameEngine`이 반환하는 실제 모양 — type-only import라 훅 모듈이 로드되지 않는다. */
type GameEngine = ReturnType<typeof useGameEngine>;

interface MobileGameLayoutProps {
    engine: GameEngine;
    fullStats: FullStats;
    isPanelFocusState: boolean;
    mobileArchiveDockVisible: boolean;
    handleQuickSlotUse: (item: Item, idx: number) => void;
    damageFlash: boolean;
    healFlash: boolean;
    mobileConsoleMode: string;
    setMobileConsoleMode: (mode: string) => void;
    onOpenMirror: () => void;
    onOpenCrystalExchange: () => void;
    /** 싸우는 중이면 살아 있는 적, 처치 순간이면 쓰러진 적 — 있으면 기록 창 자리에 무대를 세운다(2026-11 A1). */
    combatStage?: CombatStageView;
    enemyHitCrit?: boolean;
    damageAmount?: ReturnType<typeof useDamageFlash>['damageAmount'];
    /** 가방을 이 분류로 열어 달라는 마지막 요청(결과 카드 · 원정 정리의 '회복 아이템 확인'). */
    inventoryFilterRequest?: InventoryFilterRequest | null;
}

const MobileGameLayout = ({
    engine, fullStats,
    isPanelFocusState, mobileArchiveDockVisible,
    handleQuickSlotUse,
    damageFlash, healFlash,
    mobileConsoleMode,
    setMobileConsoleMode,
    onOpenMirror,
    onOpenCrystalExchange,
    combatStage,
    enemyHitCrit = false,
    damageAmount = null,
    inventoryFilterRequest = null,
}: MobileGameLayoutProps) => {
    const isCombat = engine.gameState === GS.COMBAT;
    // 2026-11 디자인 고도화 A1: 전투(와 처치 순간)에는 기록 창 자리의 위쪽이 적 무대이고, 기록은 아래 두세 줄 띠다.
    //   전체 기록을 펼치면 띠가 무대 쪽으로 커진다(무대는 최소 높이까지 줄어든다).
    const stageEnemy = !isPanelFocusState ? combatStage?.enemy ?? null : null;
    const stageBackdrop = stageEnemy ? getVisibleLocationVisual(engine.player)?.src ?? null : null;
    // A4: 적의 다음 행동 · 예상 피해는 무대가 보인다(조작판의 판단 요약 세 칸을 대신한다). 처치 순간에는 없다.
    const stageIntent = stageEnemy && !combatStage?.enemyDefeated ? getEnemyIntent(engine.player, stageEnemy) : null;
    // A2: 사냥 지역의 대기 화면은 기록 창 자리의 위쪽이 필드 무대(지역 · 주인공 · 방금의 발견)이고, 기록은 아래 띠다.
    const showFieldStage = !isPanelFocusState && !stageEnemy && isFieldStageMode(engine.player, engine.gameState);
    const archiveAvailable = !isPanelFocusState && mobileArchiveDockVisible;
    const modeEnterClass = useStageEnterClass(engine.gameState);
    usePreloadPostCombatCard(isCombat);
    // Dashboard.runtime(SystemTabRuntime)이 읽지 않는 mobileArchiveDockVisible도 실어 보낸다 —
    //   변수에 먼저 담아 전달해 object literal 초과 속성 검사(엄격 리터럴 체크)를 피한다.
    const dashboardRuntime = {
        syncStatus: engine.syncStatus,
        gameState: engine.gameState,
        isAiThinking: engine.isAiThinking,
        viewport: 'mobile',
        mobileArchiveDockVisible,
        onOpenMirror,
        onOpenCrystalExchange,
    };
    const showArchiveConsole = archiveAvailable && mobileConsoleMode === 'archive';
    // Wave 19 K2: 게이트는 `openArchive` 액션이 소유한다 — 여기서 직접 dispatch하면
    //   GameRoot의 같은 복제(Wave 17 I1의 "3줄이 두 곳" 모양)가 그대로 남는다.
    const openArchiveConsole = (tab?: string) => {
        // onClick 등에서 이벤트 객체를 그대로 전달하는 것을 방지 (기본값이 event 객체로 덮이면 안 됨)
        const target = typeof tab === 'string' ? tab : 'inventory';
        if (engine.actions.openArchive(target)) setMobileConsoleMode('archive');
    };

    return (
        <Motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, ease: [0.2, 0.8, 0.2, 1] }}
            className={`relative z-10 flex min-h-0 min-w-0 flex-1 w-full flex-col ${isPanelFocusState ? 'overflow-hidden gap-1.5' : 'gap-1'} ${damageFlash ? 'ring-2 ring-ae-threat/30 rounded-ae-lg' : ''} ${healFlash ? 'ring-2 ring-ae-good/30 rounded-ae-lg' : ''}`}
        >
            {!isPanelFocusState && (
                showArchiveConsole ? (
                    <Suspense fallback={archiveAvailable ? <DashboardFallback /> : null}>
                        <Dashboard
                            onReturnToLog={() => setMobileConsoleMode('log')}
                            player={engine.player}
                            grave={engine.grave}
                            sideTab={engine.sideTab}
                            setSideTab={engine.actions.setSideTab}
                            actions={engine.actions}
                            stats={fullStats}
                            quickSlots={engine.quickSlots}
                            runtime={dashboardRuntime}
                            inventoryFilterRequest={inventoryFilterRequest}
                        />
                    </Suspense>
                ) : (
                    // 2026-10-26 iPhone 수용: 마을 시설을 펼치면 조작판이 기록 창 최소 높이(240)와 함께 화면을 51px 넘쳐
                    //   마지막 줄(제작 · 에테르 거울)이 홈 표시줄 위에 걸렸다(402×874, 안전 영역 62/34) — 펼친 동안만 양보한다.
                    //   소유자 결정 2026-10-26 D2: 에테르 교환소가 일곱째 시설이 되어 세 열 격자가 셋째 줄을 얻었다 — 112px로는 375×812 mini에서
                    //   46px 넘쳐 펼친 동안의 양보를 56px로 내렸다(시설을 고르는 동안 기록 창은 두 줄 남는다).
                    //   소유자 결정 2026-10-26 D14: 필드(조작판에 필드 독이 있을 때)에서는 임무 추적 · 신호 줄 · 독 두 줄이 240 최소 높이와 함께
                    //   390×844(안전 영역 47/34)에서 독 둘째 줄(이동 · 지도 · 정찰 · 가방)을 화면 밖으로 밀었다(탐험 뒤 최대 67px 넘침) —
                    //   필드에서는 96px까지 양보한다 — 375×812 mini에서 탐험 뒤 132px로도 28px 넘쳤다(기록 창은 여전히 flex-1이라 남는 높이를 그대로 채운다).
                    // 무대(전투 A1 · 필드 A2)는 같은 칸 안에 조건부로 끼우고, 기록 창은 언제나 같은 자리에 둔다 — 갈래마다 따로 그리던 동안
                    //   전투 ↔ 필드 ↔ 마을 전환마다 TerminalView가 다시 마운트되어 화면 낭독기 차례 알림의 생명 줄 · 기록 펼침 · 스크롤이 초기화됐다
                    //   (e2e overlay-dialog-focus '전투 차례는 … 기록 줄을 더하지 않고 실린다').
                    <div
                        data-testid={stageEnemy ? 'combat-stage' : showFieldStage ? 'field-stage-column' : undefined}
                        className={stageEnemy
                            ? 'ae-combat-stage-column order-1 flex min-h-[116px] min-w-0 flex-1 flex-col gap-1.5'
                            : showFieldStage
                                ? 'ae-field-stage-column flex min-h-[96px] min-w-0 flex-1 flex-col gap-1.5'
                                : `flex min-w-0 flex-1 flex-col ${isCombat ? 'order-1 min-h-[132px]' : 'min-h-[240px] min-[740px]:min-h-[280px] [&:has(~*_.ae-town-facilities[open])]:min-h-[56px] [&:has(~*_.ae-field-dock)]:min-h-[96px]'}`}
                    >
                        {stageEnemy && (
                            <div className="ae-combat-stage-slot flex min-h-[116px] min-w-0 flex-1">
                                <EnemyStatus
                                    enemy={stageEnemy}
                                    enemyHitCrit={enemyHitCrit}
                                    defeated={Boolean(combatStage?.enemyDefeated)}
                                    layout="stage"
                                    backdropSrc={stageBackdrop}
                                    intent={stageIntent}
                                />
                            </div>
                        )}
                        {showFieldStage && (
                            <div className="ae-field-stage-slot flex min-h-0 min-w-0 flex-1">
                                <FieldStage player={engine.player} logs={engine.logs} />
                            </div>
                        )}
                        <div className={stageEnemy ? 'ae-combat-log-strip flex min-w-0' : showFieldStage ? 'ae-field-log-strip flex min-w-0' : 'flex min-h-0 min-w-0 flex-1'}>
                            <TerminalView
                                logs={engine.logs}
                                gameState={engine.gameState}
                                onCommand={engine.handleCommand}
                                player={engine.player}
                                quickSlots={engine.quickSlots}
                                onQuickSlotUse={handleQuickSlotUse}
                                maxHp={fullStats?.maxHp}
                                hideScene={showFieldStage}
                            />
                        </div>
                    </div>
                )
            )}
        {/* Focus state (SHOP/EVENT/etc.): ControlPanel fills all remaining space via flex-1
            on its returned panel (ShopPanel/EventPanel). Normal state: shrink-0 prevents
            action buttons from being pushed off-screen on small phones. */}
            {isPanelFocusState ? (
                <div key="focus-panel" className={`flex min-h-0 min-w-0 flex-1 flex-col ${modeEnterClass}`}>
                    <ControlPanel
                        gameState={engine.gameState}
                        player={engine.player}
                        enemy={engine.enemy}
                        actions={engine.actions}
                        setGameState={engine.actions.setGameState}
                        shopItems={engine.shopItems}
                        grave={engine.grave}
                        isAiThinking={engine.isAiThinking}
                        currentEvent={engine.currentEvent}
                        stats={fullStats}
                        onOpenArchiveConsole={openArchiveConsole}
                    />
                </div>
            ) : !showArchiveConsole ? (
                <div key="field-panel" className={`${isCombat ? 'order-2 shrink-0' : 'shrink-0'} ${modeEnterClass}`}>
                    <ControlPanel
                        gameState={engine.gameState}
                        player={engine.player}
                        enemy={engine.enemy}
                        actions={engine.actions}
                        setGameState={engine.actions.setGameState}
                        onOpenMirror={onOpenMirror}
                        onOpenCrystalExchange={onOpenCrystalExchange}
                        shopItems={engine.shopItems}
                        grave={engine.grave}
                        isAiThinking={engine.isAiThinking}
                        currentEvent={engine.currentEvent}
                        stats={fullStats}
                        onOpenArchiveConsole={openArchiveConsole}
                        damageFlash={damageFlash}
                        healFlash={healFlash}
                        damageAmount={isCombat ? damageAmount : null}
                    />
                </div>
            ) : null}
        </Motion.div>
    );
};

export default MobileGameLayout;
