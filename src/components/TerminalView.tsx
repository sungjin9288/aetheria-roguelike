import { useRef, useEffect, useMemo, useState } from 'react';
import { Bot, AlertTriangle, CheckCircle, Sparkles, Terminal, ChevronUp, Filter } from 'lucide-react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import QuickSlot from './QuickSlot';
import type { Player } from '../types/index.js';
import { GS } from '../reducers/gameStates';

const LOG_STYLES: any = {
    combat: {
        text: 'text-rose-100 font-semibold',
        bg: 'border-l-2 border-rose-300/50 bg-rose-500/8',
        icon: AlertTriangle,
    },
    critical: {
        text: 'text-red-200 font-bold',
        bg: 'border-l-2 border-red-300/60 bg-red-500/10',
        icon: null,
    },
    story: {
        text: 'text-slate-100/88',
        bg: 'border-l-2 border-white/12 bg-white/[0.025]',
        icon: Bot,
    },
    system: {
        text: 'text-[#dff7f5] font-semibold',
        bg: 'border-l-2 border-[#7dd4d8]/40 bg-[#7dd4d8]/8',
        icon: Terminal,
    },
    error: {
        text: 'text-rose-200 font-bold',
        bg: 'border-l-2 border-rose-300/60 bg-red-500/10',
        icon: null,
    },
    success: {
        text: 'text-[#f6e7c8]',
        bg: 'border-l-2 border-[#d5b180]/42 bg-[#d5b180]/8',
        icon: CheckCircle,
    },
    event: {
        text: 'text-[#ece5ff] font-semibold',
        bg: 'border-l-2 border-[#9a8ac0]/42 bg-[#9a8ac0]/10',
        icon: null,
    },
    loading: {
        text: 'text-slate-500',
        bg: 'transparent',
        icon: null,
    },
    warning: {
        text: 'text-amber-100',
        bg: 'border-l-2 border-amber-300/42 bg-amber-400/8',
        icon: null,
    },
    legendary: {
        text: 'text-[#f6e7a2] font-semibold',
        bg: 'border-l-2 border-[#f6e7a2]/65 bg-[#f6e7a2]/10',
        icon: Sparkles,
    },
};

const DEFAULT_STYLE: any = { text: 'text-slate-300', bg: 'transparent', icon: null };
const MOBILE_LOG_BADGES: any = {
    combat: { label: 'COMBAT', className: 'border-rose-300/24 bg-rose-400/10 text-rose-100/84' },
    critical: { label: 'CRIT', className: 'border-red-300/28 bg-red-500/12 text-red-100/88' },
    story: { label: 'AI', className: 'border-[#7dd4d8]/22 bg-[#7dd4d8]/10 text-[#dff7f5]/84' },
    system: { label: 'SYS', className: 'border-[#7dd4d8]/20 bg-[#7dd4d8]/8 text-[#dff7f5]/76' },
    success: { label: 'GAIN', className: 'border-[#d5b180]/24 bg-[#d5b180]/10 text-[#f6e7c8]/84' },
    event: { label: 'EVENT', className: 'border-[#9a8ac0]/24 bg-[#9a8ac0]/12 text-[#ece5ff]/84' },
    warning: { label: 'WARN', className: 'border-amber-300/24 bg-amber-400/10 text-amber-100/84' },
    error: { label: 'ERROR', className: 'border-red-300/24 bg-red-500/10 text-red-100/84' },
    legendary: { label: 'LEGEND', className: 'border-[#f6e7a2]/40 bg-[#f6e7a2]/15 text-[#f6e7a2]' },
};

const COMBAT_LOG_TYPES = new Set(['combat', 'critical', 'success', 'warning', 'heal', 'event', 'info', 'system', 'legendary']);
const SUMMARY_LOG_COUNT = 8; // 요약 모드에서 표시할 최근 로그 수

// slice 20: 로그 핵심 숫자 강조 — 데미지/HP/보상 수치(+21, 16, 73/89, 35%)를
//   본문보다 한 단계 밝고 굵게 렌더. "라벨보다 숫자가 먼저 읽혀야 한다"는
//   readability 리서치 원칙의 로그 스트림 적용.
const NUMBER_TOKEN_RE = /([+-]?\d[\d,.]*(?:\/\d[\d,.]*)?%?)/g;
const renderLogText = (text: any) => {
    const parts = String(text ?? '').split(NUMBER_TOKEN_RE);
    if (parts.length === 1) return text;
    return parts.map((part: string, idx: number) => (
        idx % 2 === 1
            ? <strong key={idx} className="font-bold text-white/95">{part}</strong>
            : part
    ));
};

// cycle 404: `stats?: any;` 제거 — 본체 destructure 미사용 + read 0건.
//   MobileGameLayout이 prop pass했으나 silent dropped (paired remove).
// cycle 496: 외부 보조 클래스 / 좌측 도구 모음 props 제거 — 1 callsite 전달 0건
//   이라 보간/렌더 결과 dead. cycle 463/465/466/493/495 lens 회귀.
// cycle 497: 자동 포커스 + 입력 표시 props 제거 — 1 callsite가 두 prop 모두 false
//   로 명시 전달, default true 도달 불가. cascade로 '/' 단축키 / 입력 푸터 /
//   푸터 표시 플래그 / autoFocus attr 모두 dead.
interface TerminalViewProps {
    logs: any[];
    gameState?: string;
    onCommand?: (cmd: string) => void;
    player?: Player | null;
    quickSlots?: any[];
    onQuickSlotUse?: (item: any, idx: number) => void;
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
}: TerminalViewProps) => {
    const logViewportRef = useRef<any>(null);
    const [logExpanded, setLogExpanded] = useState(false); // #10: 전투 로그 요약/전체 토글

    // 전투 모드 전환 시 요약 모드로 초기화
    useEffect(() => {
        if (gameState !== GS.COMBAT) return undefined;
        const resetTimer = window.setTimeout(() => setLogExpanded(false), 0);
        return () => window.clearTimeout(resetTimer);
    }, [gameState]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: any) => {
            // Skip if typing in input
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            // Combat shortcuts: 1=Attack, 2=Skill, 3=Escape
            if (gameState === GS.COMBAT) {
                if (e.key === '1') { e.preventDefault(); onCommand?.('attack'); }
                if (e.key === '2') { e.preventDefault(); onCommand?.('skill'); }
                if (e.key === '3') { e.preventDefault(); onCommand?.('escape'); }
            }

            // Quick slot shortcuts: Q, W, E
            if (quickSlots && onQuickSlotUse) {
                if (e.key === 'q' || e.key === 'Q') { e.preventDefault(); if (quickSlots[0]) onQuickSlotUse(quickSlots[0], 0); }
                if (e.key === 'w' || e.key === 'W') { e.preventDefault(); if (quickSlots[1]) onQuickSlotUse(quickSlots[1], 1); }
                if (e.key === 'e' || e.key === 'E') { e.preventDefault(); if (quickSlots[2]) onQuickSlotUse(quickSlots[2], 2); }
            }

        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [gameState, quickSlots, onQuickSlotUse, onCommand]);

    // Most recent AI story narrative (pinned display)
    const latestStory = useMemo(() => {
        for (let i = logs.length - 1; i >= 0; i--) {
            if (logs[i].type === 'story') return logs[i];
        }
        return null;
    }, [logs]);
    const bgClass = gameState === GS.EVENT
        ? 'aether-surface-strong border-[#9a8ac0]/18'
        : 'aether-surface border-white/10';

    // #10: 전투 중 로그 필터링 — 요약 모드에서는 전투 관련 최근 N개만 표시
    const isCombat = gameState === GS.COMBAT;
    const compactMobileLogCount = 12;
    const hasAnyQuickSlot = Array.isArray(quickSlots) && quickSlots.some(Boolean);
    const shouldCompactMobileLogs = !logExpanded && !isCombat;
    const displayLogs = isCombat && !logExpanded
        ? logs.filter((l: any) => COMBAT_LOG_TYPES.has(l.type)).slice(-SUMMARY_LOG_COUNT)
        : shouldCompactMobileLogs
            ? logs.slice(-compactMobileLogCount)
            : logs;
    const hiddenCount = isCombat && !logExpanded
        ? Math.max(0, logs.length - displayLogs.length)
        : shouldCompactMobileLogs
            ? Math.max(0, logs.length - displayLogs.length)
            : 0;
    const showQuickSlots = Boolean(player && quickSlots && hasAnyQuickSlot);
    const showExpandToggle = isCombat || logs.length > compactMobileLogCount;
    const showNarrativePulse = Boolean(latestStory) && gameState !== GS.COMBAT && (logExpanded || logs.length > compactMobileLogCount);

    useEffect(() => {
        const viewport = logViewportRef.current;
        if (!viewport) return;

        const shouldFollowTail = isCombat || logExpanded || logs.length > compactMobileLogCount;
        viewport.scrollTo({
            top: shouldFollowTail ? viewport.scrollHeight : 0,
            behavior: 'auto',
        });
    }, [compactMobileLogCount, isCombat, logExpanded, logs.length]);

    const showToolbar = showExpandToggle;

    return (
        <div
            data-testid="terminal-panel"
            className={`aether-log-panel min-w-0 min-h-0 flex-1 ${bgClass} rounded-[1.35rem] px-3 py-2 relative overflow-hidden transition-all duration-500 flex flex-col`}
        >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/16 to-transparent" />

            <div ref={logViewportRef} className="flex-1 relative z-10 w-full overflow-y-auto overflow-x-hidden custom-scrollbar pr-0.5 min-h-0">
                {showToolbar && (
                    <div className="mb-2 flex items-center justify-end px-1 gap-2">
                        {showExpandToggle && (
                            <button
                                onClick={() => setLogExpanded((open: any) => !open)}
                                className="shrink-0 rounded-full border border-white/8 bg-black/20 px-1.5 py-0.5 text-[9px] font-fira uppercase tracking-[0.14em] text-slate-300/72"
                            >
                                {isCombat
                                    ? (logExpanded
                                        ? <span className="inline-flex items-center gap-1"><ChevronUp size={10} /> 요약</span>
                                        : <span className="inline-flex items-center gap-1"><Filter size={10} /> 전체 {hiddenCount > 0 ? `+${hiddenCount}` : ''}</span>)
                                    : (logExpanded ? '접기' : `전체 +${hiddenCount}`)}
                            </button>
                        )}
                    </div>
                )}

                {showNarrativePulse && (
                    <div className="relative mb-2 overflow-hidden rounded-[1.05rem] aether-panel-core px-2.5 py-2">
                        <div className="pointer-events-none absolute inset-0 opacity-70" style={{ backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.04), transparent 38%)' }} />
                        <div className="relative flex items-start gap-2">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[0.9rem] border border-[#7dd4d8]/18 bg-black/18 text-[#dff7f5] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                                <Bot size={12} className="shrink-0" />
                            </div>
                            <div>
                                <div className="mb-0.5 text-[10px] font-fira uppercase tracking-[0.18em] text-[#dff7f5]/62">Narrative Pulse</div>
                                <p className="line-clamp-2 text-[10px] font-fira text-slate-100/82 italic leading-relaxed">{latestStory.text}</p>
                            </div>
                        </div>
                    </div>
                )}

                <div className="space-y-1.5">
                    {logs.length === 0 && (
                        <Motion.div
                            className="flex flex-col items-center py-3 text-center font-readable text-[13px] text-slate-300/78"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: [0.3, 0.8, 0.3] }}
                            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                        >
                            <Terminal size={24} className="mx-auto mb-3 opacity-45 text-[#7dd4d8]" />
                            원정 로그 대기
                        </Motion.div>
                    )}

                    <AnimatePresence initial={false}>
                        {displayLogs.map((log: any) => {
                            const style = LOG_STYLES[log.type] || DEFAULT_STYLE;
                            const badge = MOBILE_LOG_BADGES[log.type];
                            const IconComp = style.icon;

                            return (
                                <Motion.div
                                    key={log.id}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    data-log-type={log.type || 'default'}
                                    className={`aether-log-row rounded-[0.9rem] px-2.5 py-2 text-[13px] leading-[1.52] font-readable ${style.text} ${style.bg} transition-all break-words whitespace-pre-wrap`}
                                >
                                    {badge && (
                                        <span className={`aether-log-badge mr-1.5 align-[1px] ${badge.className}`}>
                                            {badge.label}
                                        </span>
                                    )}
                                    {IconComp && <IconComp size={14} className="inline mr-1.5 -mt-0.5 opacity-80" />}
                                    {renderLogText(log.text)}
                                </Motion.div>
                            );
                        })}
                    </AnimatePresence>

                    <AnimatePresence>
                        {logs.length > 0 && logs[logs.length - 1].type === 'loading' && (
                            <Motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="mt-4 gap-2 pl-3 text-xs flex items-center font-rajdhani tracking-widest text-slate-500"
                            >
                                <span className="w-1.5 h-1.5 bg-cyber-blue rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                <span className="w-1.5 h-1.5 bg-cyber-blue rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                <span className="w-1.5 h-1.5 bg-cyber-blue rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                                <span className="ml-2">PROCESSING NARRATIVE...</span>
                            </Motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* QuickSlot footer */}
            {showQuickSlots && (
                <div className="mt-2 pt-2 border-t border-white/8 bg-transparent shrink-0 z-20">
                    <QuickSlot
                        slots={quickSlots || []}
                        onUse={(item: any, idx: any) => onQuickSlotUse?.(item, idx)}
                        gameState={gameState}
                    />
                </div>
            )}
        </div>
    );
};

export default TerminalView;
