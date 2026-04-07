import React, { useRef, useEffect, useMemo, useState } from 'react';
import { Bot, AlertTriangle, CheckCircle, Terminal, ChevronDown, ChevronUp, Filter, Volume2, VolumeX } from 'lucide-react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import CommandAutocomplete from './CommandAutocomplete';
import QuickSlot from './QuickSlot';
import { GS } from '../reducers/gameStates';

const LOG_STYLES = {
    combat: {
        text: 'text-rose-100 font-semibold',
        bg: 'bg-[linear-gradient(90deg,rgba(148,73,103,0.20)_0%,rgba(38,16,26,0.08)_100%)] border-l-2 border-rose-300/45 pl-2.5',
        icon: AlertTriangle,
    },
    critical: {
        text: 'text-red-200 font-bold',
        bg: 'bg-red-950/28 border-l-2 border-red-300/55 pl-2.5',
        icon: null,
    },
    story: {
        text: 'text-slate-200/88 italic',
        bg: 'bg-white/[0.025] border-l-2 border-white/10 pl-2.5',
        icon: Bot,
    },
    system: {
        text: 'text-[#dff7f5] font-semibold',
        bg: 'bg-[linear-gradient(90deg,rgba(125,212,216,0.16)_0%,rgba(16,25,29,0.06)_100%)] border-l-2 border-[#7dd4d8]/34 pl-2.5',
        icon: Terminal,
    },
    error: {
        text: 'text-rose-200 font-bold',
        bg: 'bg-red-950/24 border border-rose-300/22',
        icon: null,
    },
    success: {
        text: 'text-[#f6e7c8]',
        bg: 'bg-[linear-gradient(90deg,rgba(213,177,128,0.16)_0%,rgba(30,20,10,0.08)_100%)] border-l-2 border-[#d5b180]/34 pl-2.5',
        icon: CheckCircle,
    },
    event: {
        text: 'text-[#ece5ff] font-rajdhani text-lg font-bold',
        bg: 'bg-[linear-gradient(90deg,rgba(154,138,192,0.18)_0%,rgba(30,20,42,0.08)_100%)] border-l-2 border-[#9a8ac0]/34 pl-2.5',
        icon: null,
    },
    loading: {
        text: 'text-slate-500',
        bg: 'transparent',
        icon: null,
    },
    warning: {
        text: 'text-amber-100',
        bg: 'bg-[linear-gradient(90deg,rgba(213,177,128,0.12)_0%,rgba(32,20,8,0.08)_100%)] border-l-2 border-amber-300/34 pl-2.5',
        icon: null,
    },
};

const DEFAULT_STYLE = { text: 'text-slate-300', bg: 'transparent', icon: null };
const MOBILE_LOG_BADGES = {
    combat: { label: 'COMBAT', className: 'border-rose-300/24 bg-rose-400/10 text-rose-100/84' },
    critical: { label: 'CRIT', className: 'border-red-300/28 bg-red-500/12 text-red-100/88' },
    story: { label: 'AI', className: 'border-[#7dd4d8]/22 bg-[#7dd4d8]/10 text-[#dff7f5]/84' },
    system: { label: 'SYS', className: 'border-[#7dd4d8]/20 bg-[#7dd4d8]/8 text-[#dff7f5]/76' },
    success: { label: 'GAIN', className: 'border-[#d5b180]/24 bg-[#d5b180]/10 text-[#f6e7c8]/84' },
    event: { label: 'EVENT', className: 'border-[#9a8ac0]/24 bg-[#9a8ac0]/12 text-[#ece5ff]/84' },
    warning: { label: 'WARN', className: 'border-amber-300/24 bg-amber-400/10 text-amber-100/84' },
    error: { label: 'ERROR', className: 'border-red-300/24 bg-red-500/10 text-red-100/84' },
};

const COMBAT_LOG_TYPES = new Set(['combat', 'critical', 'success', 'warning', 'heal', 'event', 'info', 'system']);
const SUMMARY_LOG_COUNT = 8; // 요약 모드에서 표시할 최근 로그 수

const TerminalView = ({
    logs,
    gameState,
    onCommand,
    autoFocusInput = true,
    player,
    quickSlots,
    onQuickSlotUse,
    showInput = true,
    syncStatus = 'offline',
    isMuted = false,
    onToggleMute,
}) => {
    const endRef = useRef(null);
    const inputRef = useRef(null);
    const [inputValue, setInputValue] = useState('');
    const [logExpanded, setLogExpanded] = useState(false); // #10: 전투 로그 요약/전체 토글

    // 전투 모드 전환 시 요약 모드로 초기화
    useEffect(() => {
        if (gameState !== GS.COMBAT) return undefined;
        const resetTimer = window.setTimeout(() => setLogExpanded(false), 0);
        return () => window.clearTimeout(resetTimer);
    }, [gameState]);

    useEffect(() => {
        if (endRef.current) {
            endRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
    }, [logs]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Skip if typing in input
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            // Combat shortcuts: 1=Attack, 2=Skill, 3=Escape
            if (gameState === GS.COMBAT) {
                if (e.key === '1') { e.preventDefault(); onCommand('attack'); }
                if (e.key === '2') { e.preventDefault(); onCommand('skill'); }
                if (e.key === '3') { e.preventDefault(); onCommand('escape'); }
            }

            // Quick slot shortcuts: Q, W, E
            if (quickSlots && onQuickSlotUse) {
                if (e.key === 'q' || e.key === 'Q') { e.preventDefault(); if (quickSlots[0]) onQuickSlotUse(quickSlots[0], 0); }
                if (e.key === 'w' || e.key === 'W') { e.preventDefault(); if (quickSlots[1]) onQuickSlotUse(quickSlots[1], 1); }
                if (e.key === 'e' || e.key === 'E') { e.preventDefault(); if (quickSlots[2]) onQuickSlotUse(quickSlots[2], 2); }
            }

            // Focus terminal input: /
            if (showInput && e.key === '/') {
                e.preventDefault();
                inputRef.current?.focus();
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [gameState, quickSlots, onQuickSlotUse, onCommand, showInput]);

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
        ? logs.filter(l => COMBAT_LOG_TYPES.has(l.type)).slice(-SUMMARY_LOG_COUNT)
        : shouldCompactMobileLogs
            ? logs.slice(-compactMobileLogCount)
            : logs;
    const hiddenCount = isCombat && !logExpanded
        ? Math.max(0, logs.length - displayLogs.length)
        : shouldCompactMobileLogs
            ? Math.max(0, logs.length - displayLogs.length)
            : 0;
    const stateLabel = isCombat ? 'Combat' : gameState === GS.EVENT ? 'Event' : 'Field';
    const syncDotClass = syncStatus === 'synced'
        ? 'bg-cyber-green shadow-[0_0_8px_#00ff9d]'
        : syncStatus === 'syncing'
            ? 'bg-yellow-400 animate-pulse'
            : 'bg-red-500 shadow-[0_0_8px_#ff00ff]';
    const syncLabel = syncStatus === 'synced' ? 'ONLINE' : syncStatus === 'syncing' ? 'SYNCING' : 'OFFLINE';
    const showQuickSlots = Boolean(player && quickSlots && hasAnyQuickSlot);
    const showFooter = Boolean(showInput || (player && quickSlots && hasAnyQuickSlot));
    const showExpandToggle = isCombat || logs.length > compactMobileLogCount;
    const visibleLogCountLabel = hiddenCount > 0 ? `${displayLogs.length}/${logs.length}` : `${displayLogs.length}`;
    const footerInput = showInput ? (
        <div className="relative flex min-w-0 items-center gap-2 rounded-[1rem] border border-white/8 bg-black/14 transition-colors focus-within:border-[#7dd4d8]/24 px-3 py-2">
            {player && (
                <CommandAutocomplete
                    input={inputValue}
                    gameState={gameState}
                    player={player}
                    onSelect={(cmd) => {
                        setInputValue(cmd);
                        onCommand?.(cmd);
                        setInputValue('');
                    }}
                />
            )}
            <span className="font-bold text-[#7dd4d8] text-base">{'>'}</span>
            <input
                data-terminal-input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                className="w-full border-none bg-transparent font-fira text-[#eff6f7] text-sm outline-none transition-all placeholder:text-slate-500"
                placeholder="ENTER COMMAND..."
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        if (inputValue.trim()) {
                            onCommand?.(inputValue);
                            setInputValue('');
                        }
                    }
                }}
                autoFocus={autoFocusInput}
            />
        </div>
    ) : null;

    return (
        <div
            data-testid="terminal-panel"
            className={`panel-noise min-w-0 min-h-[5rem] max-h-[clamp(10rem,26dvh,18rem)] md:h-full ${bgClass} rounded-[1.85rem] p-3 relative overflow-hidden font-fira transition-all duration-1000 flex flex-col`}
        >
            {/* Scanline overlay */}
            <div
                className="absolute inset-0 z-0 pointer-events-none opacity-10"
                style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.1) 0.6px, transparent 0.6px)', backgroundSize: '3px 3px' }}
            ></div>
            <div className="pointer-events-none absolute -right-10 top-4 h-24 w-24 rounded-full bg-[#7dd4d8]/10 blur-3xl" />
            <div className="pointer-events-none absolute -left-8 bottom-6 h-28 w-28 rounded-full bg-[#d5b180]/10 blur-3xl" />

            <div className="flex items-center justify-between gap-2 shrink-0 z-10 mb-2.5 rounded-[1.2rem] aether-panel-core px-3 py-2.5 font-fira uppercase tracking-[0.14em] text-slate-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
                <div className="min-w-0">
                    <div className="flex items-center gap-1 text-slate-300/80">
                        <span className="flex items-center gap-1">
                            <Terminal size={10} />
                            <span>Field Feed</span>
                        </span>
                        <span className={`rounded-full border px-1.5 py-0.5 text-[9px] ${isCombat ? 'border-rose-300/18 text-rose-100/80 bg-rose-400/[0.06]' : gameState === GS.EVENT ? 'border-[#9a8ac0]/20 text-[#ece5ff]/78 bg-[#9a8ac0]/10' : 'border-[#7dd4d8]/18 text-[#dff7f5]/76 bg-[#7dd4d8]/10'}`}>
                            {stateLabel}
                        </span>
                        <span className="rounded-full border border-white/8 bg-black/18 px-1.5 py-0.5 text-[9px] text-slate-300/72">
                            {visibleLogCountLabel}
                        </span>
                    </div>
                    <div className="mt-1 text-[11px] font-fira normal-case tracking-normal text-slate-300/62">
                        {latestStory && !isCombat ? 'AI narrative pulse is pinned above the feed.' : 'Recent actions and rewards are streamed here in sequence.'}
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    {showExpandToggle && (
                        <button
                            onClick={() => setLogExpanded((open) => !open)}
                            className="rounded-full border border-white/8 bg-black/20 px-1.5 py-0.5 text-[9px] font-fira uppercase tracking-[0.14em] text-slate-300/72"
                        >
                            {isCombat
                                ? (logExpanded
                                    ? <span className="inline-flex items-center gap-1"><ChevronUp size={10} /> 요약</span>
                                    : <span className="inline-flex items-center gap-1"><Filter size={10} /> 전체 {hiddenCount > 0 ? `+${hiddenCount}` : ''}</span>)
                                : (logExpanded ? '접기' : `전체 +${hiddenCount}`)}
                        </button>
                    )}
                    <button
                        onClick={onToggleMute}
                        disabled={!onToggleMute}
                        className="rounded-full border border-white/8 bg-black/20 p-0.5 text-slate-300/70 transition-colors hover:text-white disabled:opacity-50"
                        aria-label="Toggle Sound"
                        title="Toggle Sound"
                    >
                        {isMuted ? <VolumeX size={11} data-mute-icon /> : <Volume2 size={11} data-mute-icon />}
                    </button>
                    <div className="flex items-center gap-1 rounded-full border border-white/8 bg-black/20 px-1.5 py-0.5 text-[9px] text-slate-300/70">
                        <span className={`h-1.5 w-1.5 rounded-full ${syncDotClass}`}></span>
                        <span className="sr-only">{syncLabel}</span>
                    </div>
                </div>
            </div>

            {/* Pinned AI Narrative */}
            {latestStory && gameState !== GS.COMBAT && (
                <div className="relative z-10 mb-2.5 overflow-hidden rounded-[1.2rem] aether-panel-core px-3 py-3 shrink-0">
                    <div className="pointer-events-none absolute inset-0 opacity-70" style={{ backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.04), transparent 38%)' }} />
                    <div className="relative flex items-start gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[1rem] border border-[#7dd4d8]/18 bg-black/18 text-[#dff7f5] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                            <Bot size={14} className="shrink-0" />
                        </div>
                        <div>
                            <div className="mb-0.5 text-[11px] font-fira uppercase tracking-[0.18em] text-[#dff7f5]/62">Narrative Pulse</div>
                            <p className="text-[11px] font-fira text-slate-100/84 italic leading-relaxed">{latestStory.text}</p>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex-1 relative z-10 w-full overflow-y-auto overflow-x-hidden custom-scrollbar pr-1 min-h-0 space-y-1.5">
                {logs.length === 0 && (
                    <Motion.div
                        className="text-slate-400/72 text-center mt-6 text-xs font-rajdhani tracking-[0.16em] flex flex-col items-center"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: [0.3, 0.8, 0.3] }}
                        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                    >
                        <Terminal size={24} className="mx-auto mb-3 opacity-45 text-[#7dd4d8]" />
                        field feed online
                        <br />
                        아래 tactical tile로 원정을 시작하세요
                    </Motion.div>
                )}

                <AnimatePresence initial={false}>
                    {displayLogs.map((log) => {
                        const style = LOG_STYLES[log.type] || DEFAULT_STYLE;
                        const badge = MOBILE_LOG_BADGES[log.type];
                        const IconComp = style.icon;

                        return (
                            <Motion.div
                                key={log.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className={`text-xs py-2 px-2.5 aether-panel-muted rounded-[0.95rem] ${style.text} ${style.bg} transition-all break-words whitespace-pre-wrap`}
                            >
                                {badge && (
                                    <span className={`mr-1.5 inline-flex rounded-full border px-1.5 py-[1px] align-[1px] text-[8px] font-fira uppercase tracking-[0.12em] ${badge.className}`}>
                                        {badge.label}
                                    </span>
                                )}
                                {IconComp && <IconComp size={14} className="inline mr-1.5 -mt-0.5 opacity-80" />}
                                {log.text}
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
                <div ref={endRef} />
            </div>

            {/* CLI INPUT AREA */}
            {showFooter && (
                <div className="mt-2 pt-2 border-t border-white/8 bg-transparent shrink-0 z-20">
                    <div className="flex flex-col gap-2">
                        {showQuickSlots && (
                            <QuickSlot
                                slots={quickSlots}
                                onUse={(item, idx) => onQuickSlotUse?.(item, idx)}
                                gameState={gameState}
                            />
                        )}
                        {footerInput}
                    </div>
                </div>
            )}
        </div>
    );
};

export default TerminalView;
