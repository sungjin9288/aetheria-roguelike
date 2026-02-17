import React, { useRef, useEffect } from 'react';
import { Bot, AlertTriangle, CheckCircle, Terminal } from 'lucide-react';

// 로그 타입별 스타일 매핑 (연쇄 if문 제거)
const LOG_STYLES = {
    combat: {
        text: 'text-cyber-pink',
        bg: 'bg-cyber-pink/5 border-l-2 border-cyber-pink pl-2',
        icon: AlertTriangle,
    },
    critical: {
        text: 'text-red-500 font-bold text-lg drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]',
        bg: 'bg-red-950/40 border-l-4 border-red-500 pl-2',
        icon: null,
        noAnim: true,
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
        text: 'text-yellow-300',
        bg: 'transparent',
        icon: CheckCircle,
    },
    event: {
        text: 'text-cyber-purple font-rajdhani text-lg',
        bg: 'transparent',
        icon: null,
    },
    loading: {
        text: 'text-cyber-blue/50 animate-pulse',
        bg: 'transparent',
        icon: null,
    },
    warning: {
        text: 'text-orange-400',
        bg: 'transparent',
        icon: null,
    },
};

const DEFAULT_STYLE = { text: 'text-slate-300', bg: 'transparent', icon: null };

const TerminalView = ({ logs, gameState, onCommand, autoFocusInput = true, mobile = false }) => {
    const endRef = useRef(null);
    useEffect(() => {
        if (endRef.current) {
            endRef.current.scrollIntoView({ behavior: 'auto', block: 'end' });
        }
    }, [logs]);

    const bgClass = gameState === 'event'
        ? "bg-cyber-purple/10 border-cyber-purple/50 shadow-neon-purple"
        : "bg-cyber-black/90 border-cyber-green/30 shadow-neon-green";

    return (
        <div className={`min-w-0 ${mobile ? 'h-[44dvh]' : 'flex-1'} md:flex-1 md:h-auto ${bgClass} border rounded-lg p-3 md:p-4 relative overflow-y-auto custom-scrollbar font-fira transition-all duration-1000 flex flex-col`}>
            {/* Scanline overlay */}
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-5 pointer-events-none sticky top-0 h-full w-full"></div>

            <div className="flex-1 space-y-1 relative z-10">
                {logs.length === 0 && (
                    <div className="text-cyber-blue/50 text-center mt-20 font-rajdhani tracking-widest animate-pulse">
                        <Terminal size={48} className="mx-auto mb-4 opacity-50" />
                        SYSTEM INITIALIZED<br />
                        WAITING FOR INPUT...
                    </div>
                )}
                {logs.map((log) => {
                    const style = LOG_STYLES[log.type] || DEFAULT_STYLE;
                    const IconComp = style.icon;
                    const anim = style.noAnim ? '' : 'animate-fade-in';

                    return (
                        <div key={log.id} className={`text-sm py-1 px-2 rounded-sm ${style.text} ${style.bg} ${anim} transition-all break-words whitespace-pre-wrap`}>
                            {IconComp && <IconComp size={12} className="inline mr-2" />}
                            {log.text}
                        </div>
                    );
                })}
                {logs.length > 0 && logs[logs.length - 1].type === 'loading' && (
                    <div className="text-xs text-cyber-blue/40 animate-pulse mt-2 pl-2 border-l-2 border-cyber-blue/20">
                        PROCESSING NARRATIVE...
                    </div>
                )}
                <div ref={endRef} />
            </div>

            {/* CLI INPUT AREA */}
            <div className="mt-4 border-t border-cyber-green/20 pt-2 flex gap-2 items-center bg-cyber-black/90 sticky bottom-0 z-20 pb-[env(safe-area-inset-bottom)]">
                <span className="text-cyber-green font-bold animate-pulse">{'>'}</span>
                <input
                    type="text"
                    className="bg-transparent border-none outline-none text-cyber-green font-fira w-full placeholder-cyber-green/30"
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
