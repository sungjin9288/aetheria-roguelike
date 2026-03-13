import React, { useRef, useEffect, useState } from 'react';
import { Bot, AlertTriangle, CheckCircle, Terminal, ChevronDown, ChevronUp, Filter } from 'lucide-react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import CommandAutocomplete from './CommandAutocomplete';
import QuickSlot from './QuickSlot';
import { GS } from '../reducers/gameStates';

const LOG_STYLES = {
    combat: {
        text: 'text-cyber-pink shadow-[0_0_10px_rgba(255,0,255,0.4)]',
        bg: 'bg-cyber-pink/5 border-l-2 border-cyber-pink pl-2',
        icon: AlertTriangle,
    },
    critical: {
        text: 'text-red-500 font-bold text-lg drop-shadow-[0_0_10px_rgba(239,68,68,0.8)]',
        bg: 'bg-red-950/40 border-l-4 border-red-500 pl-2',
        icon: null,
    },
    story: {
        text: 'text-cyber-blue italic',
        bg: 'bg-cyber-blue/5 border-l-2 border-cyber-blue pl-2',
        icon: Bot,
    },
    system: {
        text: 'text-cyber-green font-bold',
        bg: 'bg-cyber-green/5',
        icon: Terminal,
    },
    error: {
        text: 'text-red-400 font-bold',
        bg: 'bg-red-950/30 border border-red-500/30',
        icon: null,
    },
    success: {
        text: 'text-yellow-300 drop-shadow-[0_0_8px_rgba(253,224,71,0.5)]',
        bg: 'transparent',
        icon: CheckCircle,
    },
    event: {
        text: 'text-cyber-purple font-rajdhani text-lg drop-shadow-[0_0_5px_rgba(188,19,254,0.5)]',
        bg: 'transparent',
        icon: null,
    },
    loading: {
        text: 'text-cyber-blue/50',
        bg: 'transparent',
        icon: null,
    },
    warning: {
        text: 'text-orange-400 drop-shadow-[0_0_5px_rgba(251,146,60,0.5)]',
        bg: 'transparent',
        icon: null,
    },
};

const DEFAULT_STYLE = { text: 'text-slate-300', bg: 'transparent', icon: null };

const COMBAT_LOG_TYPES = new Set(['combat', 'critical', 'success', 'warning', 'heal', 'event', 'info', 'system']);
const SUMMARY_LOG_COUNT = 6; // 요약 모드에서 표시할 최근 로그 수

const TerminalView = ({ logs, gameState, onCommand, autoFocusInput = true, mobile = false, player, quickSlots, onQuickSlotUse, showInput = true }) => {
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

    const bgClass = gameState === GS.EVENT
        ? "bg-cyber-purple/10 border-cyber-purple/50 shadow-[0_0_20px_rgba(188,19,254,0.15)]"
        : "bg-cyber-black/90 border-cyber-green/30 shadow-[0_0_15px_rgba(0,255,157,0.1)]";

    // #10: 전투 중 로그 필터링 — 요약 모드에서는 전투 관련 최근 N개만 표시
    const isCombat = gameState === GS.COMBAT;
    const displayLogs = isCombat && !logExpanded
        ? logs.filter(l => COMBAT_LOG_TYPES.has(l.type)).slice(-SUMMARY_LOG_COUNT)
        : logs;
    const hiddenCount = isCombat && !logExpanded
        ? Math.max(0, logs.length - displayLogs.length)
        : 0;

    return (
        <div className={`min-w-0 ${mobile ? 'min-h-[10rem]' : 'flex-1 min-h-0'} md:h-full ${bgClass} border ${mobile ? 'rounded-[1.5rem]' : 'rounded-lg'} ${mobile ? 'p-2.5' : 'p-3 md:p-4 md:px-5'} relative overflow-hidden font-fira transition-all duration-1000 flex flex-col backdrop-blur-md`}>
            {/* Scanline overlay */}
            <div
                className="absolute inset-0 z-0 opacity-10 pointer-events-none"
                style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.1) 0.6px, transparent 0.6px)', backgroundSize: '3px 3px' }}
            ></div>

            {/* #10: 전투 로그 모드 토글 버튼 */}
            {isCombat && (
                <div className="flex items-center justify-between mb-1.5 shrink-0 z-10">
                    <span className="text-[10px] text-cyber-blue/40 font-fira flex items-center gap-1">
                        <Filter size={10} /> COMBAT LOG {logExpanded ? '(전체)' : `(최근 ${SUMMARY_LOG_COUNT})`}
                    </span>
                    <button
                        onClick={() => setLogExpanded(v => !v)}
                        className="text-[10px] flex items-center gap-1 text-cyber-blue/50 hover:text-cyber-blue px-2 py-0.5 rounded border border-cyber-blue/20 hover:border-cyber-blue/40 transition-all"
                    >
                        {logExpanded ? <><ChevronUp size={10} /> 요약</> : <><ChevronDown size={10} /> 전체 {hiddenCount > 0 ? `(+${hiddenCount})` : ''}</>}
                    </button>
                </div>
            )}

            <div className={`flex-1 space-y-1.5 relative z-10 w-full overflow-y-auto overflow-x-hidden custom-scrollbar pr-1 ${mobile ? 'max-h-[11rem]' : ''}`}>
                {logs.length === 0 && (
                    <Motion.div
                        className={`text-cyber-blue/50 text-center ${mobile ? 'mt-6 text-xs' : 'mt-20'} font-rajdhani tracking-widest flex flex-col items-center`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: [0.3, 0.8, 0.3] }}
                        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                    >
                        <Terminal size={mobile ? 34 : 48} className="mx-auto mb-3 md:mb-4 opacity-50 text-cyber-blue" />
                        {mobile ? (
                            <>
                                기록창 준비 완료
                                <br />
                                아래 버튼으로 탐험을 시작하세요
                            </>
                        ) : (
                            <>
                                SYSTEM INITIALIZED
                                <br />
                                WAITING FOR INPUT...
                            </>
                        )}
                    </Motion.div>
                )}

                <AnimatePresence initial={false}>
                    {displayLogs.map((log) => {
                        const style = LOG_STYLES[log.type] || DEFAULT_STYLE;
                        const IconComp = style.icon;

                        return (
                            <Motion.div
                                key={log.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className={`${mobile ? 'text-xs py-1 px-2.5' : 'text-sm py-1.5 px-3'} rounded-sm ${style.text} ${style.bg} transition-all break-words whitespace-pre-wrap`}
                            >
                                {IconComp && <IconComp size={14} className="inline mr-2 -mt-1 opacity-80" />}
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
                            className="text-xs text-cyber-blue/40 font-rajdhani tracking-widest flex items-center gap-2 mt-4 pl-3"
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
            <div className={`${mobile ? 'mt-2 pt-2' : 'mt-4 pt-3 md:pb-1'} border-t border-cyber-blue/20 flex flex-col gap-2 bg-transparent shrink-0 z-20`}>
                {/* QuickSlot row */}
                {player && quickSlots && (
                    <QuickSlot
                        slots={quickSlots}
                        onUse={(item, idx) => onQuickSlotUse?.(item, idx)}
                        gameState={gameState}
                    />
                )}
                {showInput ? (
                    <div className="relative flex gap-2 items-center focus-within:border-cyber-blue/50 transition-colors">
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
                        <span className="text-cyber-green font-bold animate-pulse">{'>'}</span>
                        <input
                            data-terminal-input
                            ref={inputRef}
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            className="bg-transparent border-none outline-none text-cyber-green font-fira w-full placeholder:text-cyber-blue/30 focus:placeholder:text-cyber-blue/10 transition-all text-sm md:text-base"
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
                ) : (
                    <div className="rounded-xl border border-cyan-400/15 bg-slate-950/75 px-3 py-2 text-[11px] font-fira text-cyan-100/60">
                        입력 없이 진행됩니다. 탐험, 이동, 전투는 버튼으로만 조작합니다.
                    </div>
                )}
            </div>
        </div>
    );
};

export default TerminalView;
