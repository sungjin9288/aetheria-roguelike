import { lazy, Suspense, useEffect, useRef, type ReactNode } from 'react';
import { Lock } from 'lucide-react';
import { GS } from '../../../reducers/gameStates';
import { MSG } from '../../../data/messages';
import TerminalView from '../../TerminalView';
import ControlPanel from '../../ControlPanel';
import { DashboardFallback } from '../MobileGameLayout';
import { usePreloadPostCombatCard, useStageEnterClass } from '../stageLayoutHooks';
import DesktopCharacterSheet from './DesktopCharacterSheet';
import type { FullStats, Item } from '../../../types/index.js';
import type { useGameEngine } from '../../../hooks/useGameEngine';

const Dashboard = lazy(() => import('../../Dashboard'));

/** `useGameEngine`이 반환하는 실제 모양 — type-only import라 훅 모듈이 로드되지 않는다. */
type GameEngine = ReturnType<typeof useGameEngine>;

interface DesktopGameLayoutProps {
    engine: GameEngine;
    fullStats: FullStats;
    isPanelFocusState: boolean;
    mobileArchiveDockVisible: boolean;
    handleQuickSlotUse: (item: Item, idx: number) => void;
    damageFlash: boolean;
    healFlash: boolean;
    /** GameRoot가 한 번 만든 상태 카드(`StatusBar` placement="column") — 왼쪽 열 맨 위에 그린다. */
    statusBar: ReactNode;
    /** 운영 공지 · 시즌 이벤트 띠 — 가운데 무대 맨 위에 그린다. */
    banners: ReactNode;
    /** 모험 기록을 열어 달라는 요청(모바일의 'archive' 콘솔 모드) — 데스크톱은 오른쪽 열이 늘 열려 있으니 그 열로 초점을 옮긴다. */
    mobileConsoleMode: string;
    setMobileConsoleMode: (mode: string) => void;
    onOpenMirror: () => void;
    onOpenCrystalExchange: () => void;
}

const DesktopArchiveLocked = () => (
    <div data-testid="desktop-archive-locked" className="ae-card is-quiet flex flex-col items-center justify-center gap-2 rounded-ae-lg px-5 py-10 text-center">
        <Lock size={18} aria-hidden="true" className="text-ae-ink-3" />
        <h2 className="font-display text-[15px] font-bold text-ae-ink">{MSG.SHELL_DESKTOP_ARCHIVE_LOCKED_TITLE}</h2>
        <p className="max-w-[16rem] text-[12px] leading-relaxed text-ae-ink-2">{MSG.SHELL_DESKTOP_ARCHIVE_LOCKED_BODY}</p>
    </div>
);

/**
 * 2026-10 데스크톱 배치(VD-04 · UX-12, 화면 폭 1024px 이상): 세 칸 — 왼쪽 캐릭터(상태 카드 · 능력치 · 장비),
 * 가운데 무대(기록 + 조작판, 모드 화면은 가운데를 채운다), 오른쪽 모험 기록(모든 탭). 모바일 배치(MobileGameLayout)와
 * 같은 부품 · 같은 액션을 쓰고, 한 번에 한 배치만 그린다(같은 data-testid가 두 번 생기지 않는다).
 * 모험 기록은 모바일과 같은 조건(대기 · 이동 중, 고를 것 · 결과 카드 없음)에서만 열린다 — 그 밖에서는 잠긴 칸이다.
 */
const DesktopGameLayout = ({
    engine, fullStats,
    isPanelFocusState, mobileArchiveDockVisible,
    handleQuickSlotUse,
    damageFlash, healFlash,
    statusBar, banners,
    mobileConsoleMode, setMobileConsoleMode,
    onOpenMirror, onOpenCrystalExchange,
}: DesktopGameLayoutProps) => {
    const isCombat = engine.gameState === GS.COMBAT;
    const archiveAvailable = !isPanelFocusState && mobileArchiveDockVisible;
    const modeEnterClass = useStageEnterClass(engine.gameState);
    usePreloadPostCombatCard(isCombat);
    const archiveRef = useRef<HTMLElement | null>(null);
    const stageRef = useRef<HTMLDivElement | null>(null);

    // 모험 기록 열기 요청(상태 초상 · 결과 카드의 가방 · 귀환 보고의 임무)은 오른쪽 열이 받는다 — 초점을 옮기고 요청을 끝낸다.
    useEffect(() => {
        if (mobileConsoleMode !== 'archive') return;
        archiveRef.current?.focus({ preventScroll: true });
        setMobileConsoleMode('log');
    }, [mobileConsoleMode, setMobileConsoleMode]);

    const dashboardRuntime = {
        syncStatus: engine.syncStatus,
        gameState: engine.gameState,
        isAiThinking: engine.isAiThinking,
        viewport: 'desktop',
        mobileArchiveDockVisible,
        onOpenMirror,
        onOpenCrystalExchange,
    };
    // Wave 19 K2: 게이트는 `openArchive` 액션이 소유한다(모바일 배치와 같은 경로).
    const openArchiveConsole = (tab?: string) => {
        const target = typeof tab === 'string' ? tab : 'inventory';
        if (engine.actions.openArchive(target)) setMobileConsoleMode('archive');
    };
    const flashClass = damageFlash ? 'ring-2 ring-ae-threat/30' : healFlash ? 'ring-2 ring-ae-good/30' : '';

    return (
        <div data-testid="desktop-game-layout" className="ae-desktop-grid">
            <section
                data-testid="desktop-character-column"
                aria-label={MSG.SHELL_DESKTOP_CHARACTER_REGION}
                className="ae-desktop-column custom-scrollbar"
            >
                {statusBar}
                {engine.player && <DesktopCharacterSheet player={engine.player} stats={fullStats} />}
            </section>

            <div
                ref={stageRef}
                data-testid="desktop-stage-column"
                tabIndex={-1}
                className={`ae-desktop-column ae-desktop-stage rounded-ae-lg focus-visible:outline-none ${flashClass}`}
            >
                {banners}
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
                ) : (
                    <>
                        <div className="flex min-h-[200px] min-w-0 flex-1">
                            <TerminalView
                                logs={engine.logs}
                                gameState={engine.gameState}
                                onCommand={engine.handleCommand}
                                player={engine.player}
                                quickSlots={engine.quickSlots}
                                onQuickSlotUse={handleQuickSlotUse}
                                maxHp={fullStats?.maxHp}
                            />
                        </div>
                        <div key="field-panel" className={`shrink-0 ${modeEnterClass}`}>
                            <ControlPanel
                                gameState={engine.gameState}
                                player={engine.player}
                                enemy={engine.enemy}
                                actions={engine.actions}
                                setGameState={engine.actions.setGameState}
                                onOpenMirror={onOpenMirror}
                                shopItems={engine.shopItems}
                                grave={engine.grave}
                                isAiThinking={engine.isAiThinking}
                                currentEvent={engine.currentEvent}
                                stats={fullStats}
                                onOpenArchiveConsole={openArchiveConsole}
                                damageFlash={damageFlash}
                                healFlash={healFlash}
                            />
                        </div>
                    </>
                )}
            </div>

            <section
                ref={archiveRef}
                data-testid="desktop-archive-column"
                data-desktop-archive=""
                data-archive-available={archiveAvailable ? 'true' : 'false'}
                aria-label={MSG.SHELL_DESKTOP_ARCHIVE_REGION}
                tabIndex={-1}
                className="ae-desktop-column ae-desktop-archive focus-visible:outline-none"
            >
                {archiveAvailable ? (
                    <Suspense fallback={<DashboardFallback />}>
                        {/* 모험 기록을 늘 열린 칸으로 그린다(타일 격자 · 닫기 단추 없음). */}
                        <Dashboard
                            layout="column"
                            onReturnToLog={() => stageRef.current?.focus({ preventScroll: true })}
                            player={engine.player}
                            grave={engine.grave}
                            sideTab={engine.sideTab}
                            setSideTab={engine.actions.setSideTab}
                            actions={engine.actions}
                            stats={fullStats}
                            quickSlots={engine.quickSlots}
                            runtime={dashboardRuntime}
                        />
                    </Suspense>
                ) : (
                    <DesktopArchiveLocked />
                )}
            </section>
        </div>
    );
};

export default DesktopGameLayout;
