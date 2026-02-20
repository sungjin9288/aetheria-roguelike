import React, { useRef, useEffect } from 'react';
import { Bot, AlertTriangle, CheckCircle, Terminal } from 'lucide-react';
import { motion as Motion, AnimatePresence } from 'framer-motion';

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

const TerminalView = ({ logs, gameState, onCommand, autoFocusInput = true, mobile = false }) => {
    const endRef = useRef(null);
    useEffect(() => {
        if (endRef.current) {
            endRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
    }, [logs]);

    const bgClass = gameState === 'event'
        ? "bg-cyber-purple/10 border-cyber-purple/50 shadow-[0_0_20px_rgba(188,19,254,0.15)]"
        : "bg-cyber-black/90 border-cyber-green/30 shadow-[0_0_15px_rgba(0,255,157,0.1)]";

    return (
        <div className={`min-w-0 ${mobile ? 'h-[clamp(16rem,42dvh,30rem)] min-h-[16rem]' : 'flex-1 min-h-0'} md:h-full ${bgClass} border rounded-lg p-3 md:p-4 md:px-5 relative overflow-hidden font-fira transition-all duration-1000 flex flex-col backdrop-blur-md`}>
            {/* Scanline overlay */}
            <div className="absolute inset-0 z-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-5 pointer-events-none"></div>

            <div className="flex-1 space-y-1.5 relative z-10 w-full overflow-y-auto overflow-x-hidden custom-scrollbar pr-1">
                {logs.length === 0 && (
                    <Motion.div
                        className="text-cyber-blue/50 text-center mt-20 font-rajdhani tracking-widest flex flex-col items-center"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: [0.3, 0.8, 0.3] }}
                        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                    >
                        <Terminal size={48} className="mx-auto mb-4 opacity-50 text-cyber-blue" />
                        SYSTEM INITIALIZED<br />
                        WAITING FOR INPUT...
                    </Motion.div>
                )}

                <AnimatePresence initial={false}>
                    {logs.map((log) => {
                        const style = LOG_STYLES[log.type] || DEFAULT_STYLE;
                        const IconComp = style.icon;

                        return (
                            <Motion.div
                                key={log.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className={`text-sm py-1.5 px-3 rounded-sm ${style.text} ${style.bg} transition-all break-words whitespace-pre-wrap`}
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
            <div className="mt-4 border-t border-cyber-blue/20 pt-3 md:pb-1 flex gap-2 items-center bg-transparent shrink-0 z-20 focus-within:border-cyber-blue/50 transition-colors">
                <span className="text-cyber-green font-bold animate-pulse">{'>'}</span>
                <input
                    type="text"
                    className="bg-transparent border-none outline-none text-cyber-green font-fira w-full placeholder:text-cyber-blue/30 focus:placeholder:text-cyber-blue/10 transition-all text-sm md:text-base"
                    placeholder="ENTER COMMAND..."
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            const val = e.target.value;
                            if (val.trim()) {
                                if (onCommand) onCommand(val);
                                e.target.value = '';
                            }
                        }
                    }}
                    autoFocus={autoFocusInput}
                />
            </div>
        </div>
    );
};

export default TerminalView;
