import { useRef, useEffect, useMemo, useState } from 'react';
import { BookOpen, ChevronUp, Filter, ScrollText } from 'lucide-react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import QuickSlot from './QuickSlot';
import type { Item, Player } from '../types/index.js';
import type { LogEntry } from '../types/session.js';
import { GS } from '../reducers/gameStates';
import type { GameMode } from '../reducers/gameStates';
import { getVisibleLocationName, getVisibleLocationVisual } from '../utils/challengeRules';
import { canBossAppearInMap } from '../utils/bossPresence';
import Chip from './ui/Chip';
import { FIRST_STORY_QUEST_ID } from '../data/quests';
import { MSG } from '../data/messages';
import { ENEMY_ACTION_LOG_TYPE, ENEMY_HEAVY_LOG_TYPE, getLogBadgeKind, type LogBadgeKind } from '../data/logBadge';
import { DB } from '../data/db';
import { isModalFocusScopeOpen } from '../platform/modalFocus';
import { resolveGlobalShortcut } from '../utils/keyboardShortcuts';
import { isKeyboardShortcutsEnabled } from '../utils/playerSettings';
import {
    getAmbientLogTexts,
    getInitialCombatFloorId,
    selectCombatLogSummary,
    selectLatestCombatTurn,
} from '../utils/combatLogSummary';

// 2026-10 에테르 유리 — 기록은 연대기다: 줄마다 머리말(종류) 한 칸 + 본문, 줄 사이는 머리카락 선 하나.
//   색은 토큰만 쓴다(감사 VD-06 · VD-09 · UX-13). 전설은 희귀도 색 한 곳(`ae-rarity-legendary`)을 읽고 위협 색을 쓰지 않는다.
const LOG_STYLES: Record<string, { text: string; tone: string }> = {
    combat: { text: 'text-ae-ink', tone: 'is-combat' },
    critical: { text: 'text-ae-ink font-semibold', tone: 'is-critical' },
    story: { text: 'text-ae-ink-2', tone: 'is-story' },
    system: { text: 'text-ae-ink-2', tone: 'is-system' },
    error: { text: 'text-ae-ink font-semibold', tone: 'is-error' },
    success: { text: 'text-ae-ink', tone: 'is-success' },
    event: { text: 'text-ae-ink', tone: 'is-event' },
    loading: { text: 'text-ae-ink-3', tone: 'is-loading' },
    warning: { text: 'text-ae-ink', tone: 'is-warning' },
    legendary: { text: 'text-ae-rarity-legendary font-semibold', tone: 'is-legendary' },
    // 소유자 결정 D25: 적의 행동 — 내 행동(전투 · 치명타)과 다른 자기 줄이다.
    [ENEMY_ACTION_LOG_TYPE]: { text: 'text-ae-ink', tone: 'is-enemy' },
    [ENEMY_HEAVY_LOG_TYPE]: { text: 'text-ae-ink font-semibold', tone: 'is-enemy' },
};

const DEFAULT_STYLE = { text: 'text-ae-ink-2', tone: 'is-default' };
// 배지는 기록 종류가 아니라 배지 종류(`getLogBadgeKind`)로 고른다 — 소유자 결정 D26: 'success'는 실제로 얻은 줄만 '획득'이고
//   나머지는 '안내'(system 배지)다. D25: 적의 행동은 '적 행동'이다(강타가 '치명타', 일반 타격이 '주의'로 붙던 것을 가른다).
const MOBILE_LOG_BADGES: Record<LogBadgeKind, { label: string; className: string }> = {
    combat: { label: '전투', className: 'text-ae-life' },
    critical: { label: '치명타', className: 'text-ae-threat' },
    enemy: { label: MSG.LOG_BADGE_ENEMY_ACTION, className: 'text-ae-threat' },
    story: { label: '이야기', className: 'text-ae-ether' },
    system: { label: '안내', className: 'text-ae-ether-hi' },
    success: { label: '획득', className: 'text-ae-good' },
    event: { label: '이벤트', className: 'text-ae-gold-text' },
    warning: { label: '주의', className: 'text-ae-gold' },
    error: { label: '오류', className: 'text-ae-threat' },
    legendary: { label: '전설', className: 'text-ae-rarity-legendary' },
};

const COMBAT_LOG_TYPES = new Set(['combat', 'critical', ENEMY_ACTION_LOG_TYPE, ENEMY_HEAVY_LOG_TYPE, 'success', 'warning', 'heal', 'event', 'info', 'system', 'legendary']);
// 아직 이번 전투의 차례가 없을 때 보일 최근 줄 수 — 차례가 있으면 그 차례를 통째로 보인다(감사 GF-07).
const SUMMARY_LOG_COUNT = 3;
const TERMINAL_HEADING_ID = 'terminal-log-heading';
// 앞선 새 줄과 이 간격 안에 들어온 기록 줄은 한 행동의 묶음이다(한 행동의 렌더는 4 ~ 7ms 간격, 사람의 다음 누름은 그보다 훨씬 뒤)
//   — 기록 창은 그 묶음의 첫 줄부터 보인다.
const LOG_BATCH_WINDOW_MS = 50;
// 한 묶음이 기록 창에 다 들어가지 않을 때 처음부터 읽혀야 하는 줄.
const READ_FIRST_LOG_TYPES = new Set(['story', 'event']);

// slice 20: 로그 핵심 숫자 강조 — 데미지/HP/보상 수치(+21, 16, 73/89, 35%)를
//   본문보다 한 단계 밝고 굵게 렌더. "라벨보다 숫자가 먼저 읽혀야 한다"는
//   readability 리서치 원칙의 로그 스트림 적용.
const NUMBER_TOKEN_RE = /([+-]?\d[\d,.]*(?:\/\d[\d,.]*)?%?)/g;
const renderLogText = (text: string) => {
    const parts = String(text ?? '').split(NUMBER_TOKEN_RE);
    if (parts.length === 1) return text;
    return parts.map((part: string, idx: number) => (
        idx % 2 === 1
            ? <strong key={idx} className="font-bold tabular-nums text-ae-ink">{part}</strong>
            : part
    ));
};

// cycle 404: `stats` 옵셔널 열린 타입 필드 제거 — 본체 destructure 미사용 + read 0건.
//   MobileGameLayout이 prop pass했으나 silent dropped (paired remove).
// cycle 496: 외부 보조 클래스 / 좌측 도구 모음 props 제거 — 1 callsite 전달 0건
//   이라 보간/렌더 결과 dead. cycle 463/465/466/493/495 lens 회귀.
// cycle 497: 자동 포커스 + 입력 표시 props 제거 — 1 callsite가 두 prop 모두 false
//   로 명시 전달, default true 도달 불가. cascade로 '/' 단축키 / 입력 푸터 /
//   푸터 표시 플래그 / autoFocus attr 모두 dead.
interface TerminalViewProps {
    logs: LogEntry[];
    gameState?: GameMode;
    onCommand?: (cmd: string) => void;
    player?: Player | null;
    quickSlots?: Array<Item | null>;
    onQuickSlotUse?: (item: Item, idx: number) => void;
    /** 상태 표시줄과 같은 최대 생명(실효 최대치) — 화면 낭독기 차례 알림이 읽는다. */
    maxHp?: number;
}

// cycle 576: logs default [] 제거 — 1 production caller (MobileGameLayout:85
//   <TerminalView logs={engine.logs} />) 명시 전달이라 default 도달 불가.
//   청소 메가 시리즈 68번째.
const TerminalView = ({
    logs,
    gameState,
    onCommand,
    player,
    quickSlots,
    onQuickSlotUse,
    maxHp,
}: TerminalViewProps) => {
    const logViewportRef = useRef<HTMLDivElement>(null);
    const lastSeenLogIdRef = useRef<string | null>(null);
    // 지금 묶음의 첫 줄과 마지막으로 새 줄이 들어온 시각.
    const logBatchRef = useRef<{ firstId: string | null; at: number }>({ firstId: null, at: -Infinity });
    const [logExpanded, setLogExpanded] = useState(false); // #10: 전투 로그 요약/전체 토글
    const isCombat = gameState === GS.COMBAT;
    // 감사 GF-07: 이번 전투의 차례는 전투에 들어선 순간의 마지막 기록 뒤에서만 찾는다 —
    //   지난 전투의 마지막 차례가 새 전투의 요약에 남지 않는다. 전투가 끝나도 경계는 그대로라
    //   마지막 차례(승리 · 도주)가 화면 낭독기 알림 칸에 남는다.
    const lastLogId = logs.length > 0 ? logs[logs.length - 1].id : null;
    const [combatScope, setCombatScope] = useState(() => ({ inCombat: isCombat, floorId: getInitialCombatFloorId(logs) }));
    if (combatScope.inCombat !== isCombat) {
        setCombatScope({ inCombat: isCombat, floorId: isCombat ? lastLogId : combatScope.floorId });
    }

    // 전투 모드 전환 시 요약 모드로 초기화
    useEffect(() => {
        if (gameState !== GS.COMBAT) return undefined;
        const resetTimer = window.setTimeout(() => setLogExpanded(false), 0);
        return () => window.clearTimeout(resetTimer);
    }, [gameState]);

    // Keyboard shortcuts: 전투 1=공격 · 2=기술 · 3=도주, 빠른 칸 Q · W · E.
    //   감사 A11Y-02: 대화상자 · 수정키 · 한글 조합 · 입력 칸에서는 멈추고, 키 자리(code)로 읽는다.
    //   2026-10-26 소유자 결정 D23: 기록 탭 설정에서 끄면 어떤 단축키도 동작하지 않는다.
    const shortcutsEnabled = isKeyboardShortcutsEnabled(player);
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target instanceof HTMLElement ? e.target : null;
            const shortcut = resolveGlobalShortcut({
                key: e.key,
                code: e.code,
                ctrlKey: e.ctrlKey,
                metaKey: e.metaKey,
                altKey: e.altKey,
                shiftKey: e.shiftKey,
                isComposing: e.isComposing,
                targetTagName: target?.tagName ?? null,
                targetIsContentEditable: target?.isContentEditable ?? false,
            }, { inCombat: gameState === GS.COMBAT, modalOpen: isModalFocusScopeOpen(), shortcutsEnabled });
            if (!shortcut) return;
            if (shortcut.kind === 'combat') {
                e.preventDefault();
                onCommand?.(shortcut.command);
                return;
            }
            if (!quickSlots || !onQuickSlotUse) return;
            e.preventDefault();
            const slotItem = quickSlots[shortcut.index];
            if (slotItem) onQuickSlotUse(slotItem, shortcut.index);
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [gameState, quickSlots, onQuickSlotUse, onCommand, shortcutsEnabled]);

    // Most recent AI story narrative (pinned display)
    const latestStory = useMemo(() => {
        for (let i = logs.length - 1; i >= 0; i--) {
            if (logs[i].type === 'story') return logs[i];
        }
        return null;
    }, [logs]);

    // #10: 전투 중 로그 필터링 — 요약 모드에서는 최근 한 차례(없으면 전투 관련 최근 N개)만 표시.
    //   감사 GF-07: 지역 분위기 문장(지역 설명 · 처음 방문 이야기)은 요약에서 뺀다(전체 보기에는 남는다).
    const compactMobileLogCount = 12;
    const hasAnyQuickSlot = Array.isArray(quickSlots) && quickSlots.some(Boolean);
    const shouldCompactMobileLogs = !logExpanded && !isCombat;
    const playerLoc = player?.loc;
    const ambientTexts = useMemo(
        () => getAmbientLogTexts(playerLoc ? DB.MAPS[playerLoc] : null, [MSG.MOVE_AREA_DESC_BLIND]),
        [playerLoc],
    );
    const combatSummary = isCombat && !logExpanded
        ? selectCombatLogSummary(logs, {
            types: COMBAT_LOG_TYPES,
            fallbackCount: SUMMARY_LOG_COUNT,
            floorId: combatScope.floorId,
            ambientTexts,
        })
        : null;
    const summaryTurnKey = combatSummary?.turnKey ?? null;
    const displayLogs = combatSummary
        ? combatSummary.entries
        : shouldCompactMobileLogs
            ? logs.slice(-compactMobileLogCount)
            : logs;
    const hiddenCount = combatSummary || shouldCompactMobileLogs
        ? Math.max(0, logs.length - displayLogs.length)
        : 0;
    // 감사 A11Y-03: 화면 낭독기 알림 칸 — 이번 전투의 마지막 차례 줄 + 생명. 기록 줄을 더하지 않는다.
    const liveTurn = useMemo(() => selectLatestCombatTurn(logs, combatScope.floorId), [logs, combatScope.floorId]);
    // 생명 줄은 그 차례가 들어온 순간의 값으로 고정한다 — 차례 뒤의 생명 변화(휴식 · 물약 · 레벨 업)가
    //   같은 줄을 고쳐 쓰면 일부 화면 낭독기가 전투 밖에서도 그 줄을 다시 읽는다.
    const liveTurnTailId = liveTurn.entries.length > 0 ? liveTurn.entries[liveTurn.entries.length - 1].id : null;
    const liveHpText = liveTurnTailId && player
        ? MSG.A11Y_COMBAT_HP(Math.max(0, player.hp || 0), Math.max(1, maxHp || player.maxHp || 1))
        : null;
    const [liveHp, setLiveHp] = useState(() => ({ tailId: liveTurnTailId, text: liveHpText }));
    if (liveHp.tailId !== liveTurnTailId) {
        setLiveHp({ tailId: liveTurnTailId, text: liveHpText });
    }
    const showQuickSlots = Boolean(player && quickSlots && hasAnyQuickSlot);
    const showExpandToggle = isCombat || logs.length > compactMobileLogCount;
    const showNarrativePulse = Boolean(latestStory) && gameState !== GS.COMBAT && (logExpanded || logs.length > compactMobileLogCount);
    // 2026-10 Wave 62 (원장 §61.2 A10): 길 잃은 여행이면 지역 그림을 그리지 않는다(판정은 utils/challengeRules.ts).
    const locationVisual = getVisibleLocationVisual(player);
    const showLocationVisual = Boolean(gameState === GS.IDLE && locationVisual);
    const showFirstJourney = gameState === GS.IDLE && player?.loc === '시작의 마을'
        && !(player.meta?.prestigeRank || 0)
        && !player.stats?.claimedQuestIds?.includes(FIRST_STORY_QUEST_ID)
        && player.quests?.some((quest) => quest.id === FIRST_STORY_QUEST_ID && quest.progress === 0);

    // 화면 모드가 바뀌면(전투 · 펼침 · 요약 차례) 처음부터 맞춘다.
    //   감사 GF-07: 요약이 한 차례를 통째로 보일 때는 그 차례의 첫 줄('내 행동')부터 보인다. 그 밖에는 맨 아래다.
    useEffect(() => {
        const viewport = logViewportRef.current;
        if (!viewport) return;
        viewport.scrollTo({ top: summaryTurnKey ? 0 : viewport.scrollHeight, behavior: 'auto' });
    }, [isCombat, logExpanded, summaryTurnKey]);

    // 2026-10-26: 새 줄이 들어오면 그 묶음의 첫 줄부터 보이고, 다 들어가면 맨 아래다. 맨 아래만 붙이던 동안 한 번에 여러 줄이 들어오면
    //   (임무 수령 = 완료 · 단서 · 장의 본문) 첫 줄이 위로 잘렸다 — 글꼴이 넓은 기기(Linux CI)에서 단서 줄이 27% 잘렸다.
    //   한 행동의 줄은 렌더 두세 번에 나뉘어 들어오므로(수령 = 4ms 간격 두 번) 짧은 간격 안의 줄은 한 묶음이다.
    //   새 줄이 없는 다시 그리기는 위치를 건드리지 않는다(뒤늦은 맨 아래 붙이기가 묶음의 첫 줄을 다시 밀어냈다).
    useEffect(() => {
        const viewport = logViewportRef.current;
        const previousLastId = lastSeenLogIdRef.current;
        const lastId = logs.length > 0 ? logs[logs.length - 1].id : null;
        lastSeenLogIdRef.current = lastId;
        if (!viewport || summaryTurnKey || lastId === previousLastId) return;

        const findRow = (id: string | null) => (id === null
            ? null
            : viewport.querySelector<HTMLElement>(`[data-log-id="${CSS.escape(id)}"]`));
        const next = findRow(previousLastId)?.nextElementSibling;
        const firstNewId = next instanceof HTMLElement ? next.dataset.logId ?? null : null;
        const now = performance.now();
        const batch = logBatchRef.current;
        const sameBatch = now - batch.at <= LOG_BATCH_WINDOW_MS;
        logBatchRef.current = { firstId: sameBatch ? batch.firstId : firstNewId, at: now };
        const batchStartRow = firstNewId ? findRow(logBatchRef.current.firstId) : null;
        const bottom = viewport.scrollHeight - viewport.clientHeight;
        // 묶음이 다 들어가지 않으면 확인 줄(방금 누른 단추의 메아리 — '획득' · '안내')은 위로 밀리고 이야기 · 사건 줄부터 보인다.
        let anchorRow = batchStartRow;
        if (anchorRow && anchorRow.offsetTop < bottom) {
            for (let row: Element | null = anchorRow; row instanceof HTMLElement && row.dataset.logId; row = row.nextElementSibling) {
                if (READ_FIRST_LOG_TYPES.has(row.dataset.logType ?? '')) {
                    anchorRow = row;
                    break;
                }
            }
        }
        viewport.scrollTo({
            top: anchorRow ? Math.min(bottom, anchorRow.offsetTop) : viewport.scrollHeight,
            behavior: 'auto',
        });
    }, [logs, summaryTurnKey]);

    const showToolbar = showExpandToggle;

    // 2026-10 에테르 유리(시안 mock-expedition): 대기 중의 기록 창은 장면 카드다 — 머리에 지금 지역의 그림 · 이름 · 종류,
    //   그 아래 연대기. 첫 출발 안내가 그림을 들고 있을 때는 머리를 그리지 않는다(그림은 화면에 하나).
    const showSceneHeader = Boolean(player) && gameState === GS.IDLE && !showFirstJourney;
    const sceneMap = playerLoc ? DB.MAPS[playerLoc] : null;
    const sceneKind = sceneMap?.type === 'safe'
        ? 'safe'
        // Wave 61 (원장 §61.3): 보스 표시는 이 플레이어가 실제로 보스를 만날 수 있을 때만(`canBossAppearInMap`).
        : (player && canBossAppearInMap(playerLoc, sceneMap, player) ? 'boss' : 'field');
    const sceneKindTone = sceneKind === 'boss' ? 'threat' : sceneKind === 'safe' ? 'good' : 'ether';

    return (
        <div
            data-testid="terminal-panel"
            role="region"
            aria-labelledby={TERMINAL_HEADING_ID}
            data-combat-mode={isCombat ? 'true' : undefined}
            data-log-expanded={logExpanded ? 'true' : 'false'}
            className={`aether-log-panel ae-card ae-chronicle relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-3 py-2.5 ${isCombat ? 'aether-combat-log' : ''}`}
        >
            {!isCombat && <h2 id={TERMINAL_HEADING_ID} className="sr-only">{MSG.A11Y_LOG_HEADING}</h2>}

            {showSceneHeader && player && (
                // 2026-10-26: 머리는 한 줄이다(그림 44px · 이름 · 종류 칩). 세 줄(그림 64px · '현재 지역' · 이름 · 칩)이던 동안 약 80px를
                //   차지해 390×844에서 임무 수령의 단서와 장의 본문이 기록 창에 함께 들어가지 않았다(Linux 글꼴 — 본문 마지막 줄이 밀렸다).
                <header data-testid="terminal-scene" className="ae-scene-header flex shrink-0 items-center gap-2.5 px-0.5 pb-2 pt-0.5">
                    {showLocationVisual && locationVisual && (
                        <div
                            data-testid="terminal-location-visual"
                            data-location-visual={locationVisual.key}
                            aria-hidden="true"
                            className="ae-scene-art flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden"
                        >
                            <img src={locationVisual.src} alt="" className="h-9 w-9 object-contain [image-rendering:pixelated]" />
                        </div>
                    )}
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="sr-only">{MSG.FIELD_REGION_EYEBROW}</span>
                        <span className="min-w-0 break-words font-display text-[18px] font-bold leading-tight text-ae-ink">
                            {getVisibleLocationName(player, playerLoc)}
                        </span>
                        <Chip tone={sceneKindTone}>{MSG.FIELD_REGION_KIND[sceneKind]}</Chip>
                    </div>
                </header>
            )}

            <div ref={logViewportRef} className="custom-scrollbar relative z-10 flex min-h-0 w-full flex-1 flex-col overflow-y-auto overflow-x-hidden pr-0.5">
                {showToolbar && (
                    <div className="mb-1.5 flex min-h-8 shrink-0 items-center justify-between gap-2 px-1">
                        {isCombat && (
                            <h2 id={TERMINAL_HEADING_ID} className="font-readable text-[12px] font-semibold text-ae-ink-2">{MSG.COMBAT_LOG_SUMMARY_LABEL}</h2>
                        )}
                        {showExpandToggle && (
                            <button
                                type="button"
                                data-testid="combat-log-toggle"
                                aria-expanded={logExpanded}
                                onClick={() => setLogExpanded((open) => !open)}
                                className="ae-btn ae-btn-ghost ae-log-toggle ml-auto"
                            >
                                {isCombat
                                    ? (logExpanded
                                        ? <span className="inline-flex items-center gap-1"><ChevronUp size={14} aria-hidden="true" /> 요약</span>
                                        : <span className="inline-flex items-center gap-1"><Filter size={14} aria-hidden="true" /> 전체 <span className="font-fira tabular-nums">{hiddenCount > 0 ? `+${hiddenCount}` : ''}</span></span>)
                                    : (logExpanded ? '접기' : <span>전체 <span className="font-fira tabular-nums">+{hiddenCount}</span></span>)}
                            </button>
                        )}
                    </div>
                )}

                {showNarrativePulse && (
                    <div className="ae-well mb-2 flex shrink-0 items-start gap-2.5 px-3 py-2.5">
                        <BookOpen size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-ae-ether" />
                        <div className="min-w-0">
                            <div className="ae-eyebrow mb-0.5">이야기 흐름</div>
                            <p className="font-readable text-[13px] leading-relaxed text-ae-ink-2">{latestStory?.text}</p>
                        </div>
                    </div>
                )}

                {/* 아래 4px 여백: 맨 아래로 붙인 스크롤이 소수점 높이에서 마지막 줄을 1px 자르지 않게 한다. */}
                <div className="shrink-0 pb-1">
                    {logs.length === 0 && (
                        <div className="flex flex-col items-center py-4 text-center font-readable text-[13px] text-ae-ink-2">
                            <ScrollText size={24} aria-hidden="true" className="mx-auto mb-3 text-ae-ether" />
                            모험 기록을 준비하고 있습니다.
                        </div>
                    )}

                    {/* 2026-10-26: 줄은 나타날 때만 움직이고 사라질 때는 곧바로 빠진다 — 나가는 줄이 한 프레임 남아 있던 동안
                        새 묶음의 첫 줄에 맞춘 위치가 그 줄이 빠지면서 82px씩 들쭉날쭉했다. */}
                    {/* 소유자 결정 D25(감사 GF-07): 전투 요약에서 지난 차례는 흐린 한 줄로 접는다 — 첫 줄('내 행동')과 접힌 줄 수.
                        표시만이다(기록 줄 · 줄 수는 그대로, '전체'를 누르면 모든 줄이 보인다). */}
                    {combatSummary?.previousTurn && (
                        <div
                            data-testid="combat-log-previous-turn"
                            data-previous-turn-key={combatSummary.previousTurn.turnKey}
                            className="aether-log-row ae-log-row is-previous-turn font-readable text-[13px] leading-[1.55] text-ae-ink-3"
                        >
                            <span aria-hidden="true" className="ae-log-badge" />
                            <span className="min-w-0 whitespace-pre-wrap break-words">
                                {MSG.COMBAT_LOG_PREVIOUS_TURN(combatSummary.previousTurn.first.text, combatSummary.previousTurn.moreCount)}
                            </span>
                        </div>
                    )}

                    {displayLogs.map((log) => {
                        const style = LOG_STYLES[log.type] || DEFAULT_STYLE;
                        const badgeKind = getLogBadgeKind(log);
                        const badge = badgeKind ? MOBILE_LOG_BADGES[badgeKind] : undefined;

                        return (
                            <Motion.div
                                key={log.id}
                                initial={{ opacity: 0, y: 4 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
                                data-log-id={log.id}
                                data-log-type={log.type || 'default'}
                                data-log-badge={badgeKind ?? undefined}
                                className={`aether-log-row ae-log-row ${style.tone} font-readable text-[14px] leading-[1.55] ${style.text}`}
                            >
                                {badge ? (
                                    <span data-testid="log-type-badge" className={`aether-log-badge ae-log-badge ${badge.className}`}>
                                        {badge.label}
                                    </span>
                                ) : <span aria-hidden="true" className="ae-log-badge" />}
                                <span className="min-w-0 whitespace-pre-wrap break-words">{renderLogText(log.text)}</span>
                            </Motion.div>
                        );
                    })}

                    {showFirstJourney && (
                        <section data-testid="first-journey-context" className="ae-first-journey px-1 pb-1 pt-3 font-readable">
                            <div className="flex items-center gap-3">
                                {locationVisual && <div data-testid="terminal-location-visual" data-location-visual={locationVisual.key} aria-hidden="true" className="ae-scene-art flex h-12 w-12 shrink-0 items-center justify-center"><img src={locationVisual.src} alt="" className="h-10 w-10 object-contain [image-rendering:pixelated]" /></div>}
                                <h2 className="font-display text-[15px] font-bold text-ae-gold-text">{MSG.FIRST_JOURNEY_TITLE}</h2>
                            </div>
                            <p className="mt-1.5 text-[14px] leading-[1.55] text-ae-ink-2">{MSG.FIRST_JOURNEY_REASON}</p>
                        </section>
                    )}
                    <AnimatePresence>
                        {logs.length > 0 && logs[logs.length - 1].type === 'loading' && (
                            <Motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="mt-3 flex items-center gap-2 pl-3 font-readable text-[12px] text-ae-ink-3"
                            >
                                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ae-ether motion-reduce:animate-none" style={{ animationDelay: '0ms' }}></span>
                                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ae-ether motion-reduce:animate-none" style={{ animationDelay: '150ms' }}></span>
                                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ae-ether motion-reduce:animate-none" style={{ animationDelay: '300ms' }}></span>
                                <span className="ml-2">이야기를 이어가는 중...</span>
                            </Motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* QuickSlot footer */}
            {showQuickSlots && (
                <div className="ae-chronicle-footer z-20 mt-2 shrink-0 pt-2">
                    <QuickSlot
                        slots={quickSlots || []}
                        onUse={(item, idx) => onQuickSlotUse?.(item, idx)}
                        gameState={gameState}
                    />
                </div>
            )}

            <div
                data-testid="combat-live-region"
                role="log"
                aria-live="polite"
                aria-relevant="additions"
                aria-label={MSG.A11Y_COMBAT_LIVE_LABEL}
                className="sr-only"
            >
                {liveTurn.entries.map((log) => <p key={log.id}>{log.text}</p>)}
                {liveHp.tailId !== null && liveHp.tailId === liveTurnTailId && liveHp.text && (
                    <p key={`hp-${liveHp.tailId}`}>{liveHp.text}</p>
                )}
            </div>
        </div>
    );
};

export default TerminalView;
