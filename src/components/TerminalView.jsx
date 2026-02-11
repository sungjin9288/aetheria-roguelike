import React, { useRef, useEffect } from 'react';
import { Bot, AlertTriangle, CheckCircle, Terminal } from 'lucide-react';

const TerminalView = ({ logs, gameState, onCommand }) => {
    const endRef = useRef(null);
    useEffect(() => {
        if (endRef.current) {
            endRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
    }, [logs]);

    // Contextual Background Transition
    const bgClass = gameState === 'event'
        ? "bg-cyber-purple/10 border-cyber-purple/50 shadow-neon-purple"
        : "bg-cyber-black/90 border-cyber-green/30 shadow-neon-green";

    return (
        <div className={`flex-1 ${bgClass} border rounded-lg p-4 relative overflow-y-auto custom-scrollbar font-fira transition-all duration-1000 flex flex-col`}>
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
                    let logStyle = "text-slate-300";
                    let bgStyle = "transparent";
                    let anim = "animate-fade-in"; // Need to define this or rely on default
                    let icon = null;

                    if (log.type === 'combat') {
                        logStyle = "text-cyber-pink";
                        bgStyle = "bg-cyber-pink/5 border-l-2 border-cyber-pink pl-2";
                        icon = <AlertTriangle size={12} className="inline mr-2" />;
                    }
                    if (log.type === 'critical') {
                        logStyle = "text-red-500 font-bold text-lg drop-shadow-md";
                        bgStyle = "bg-red-950/40 border-l-4 border-red-500 pl-2";
                        anim = "animate-ping";
                    }
                    if (log.type === 'story') {
                        logStyle = "text-cyber-blue italic";
                        bgStyle = "bg-cyber-blue/5 border-l-2 border-cyber-blue pl-2";
                        icon = <Bot size={12} className="inline mr-2" />;
                    }
                    if (log.type === 'system') {
                        logStyle = "text-cyber-green font-bold";
                        bgStyle = "bg-cyber-green/5";
                        icon = <Terminal size={12} className="inline mr-2" />;
                    }
                    if (log.type === 'error') {
                        logStyle = "text-red-400 font-bold";
                        bgStyle = "bg-red-950/30 border border-red-500/30";
                    }
                    if (log.type === 'success') {
                        logStyle = "text-yellow-300";
                        icon = <CheckCircle size={12} className="inline mr-2" />;
                    }
                    if (log.type === 'event') logStyle = "text-cyber-purple font-rajdhani text-lg";
                    if (log.type === 'loading') logStyle = "text-cyber-blue/50 animate-pulse";
                    if (log.type === 'warning') logStyle = "text-orange-400";

                    return (
                        <div key={log.id} className={`text-sm py-1 px-2 rounded-sm ${logStyle} ${bgStyle} ${anim} transition-all`}>
                            {icon}
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
            <div className="mt-4 border-t border-cyber-green/20 pt-2 flex gap-2 items-center bg-cyber-black/90 sticky bottom-0 z-20">
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
                    autoFocus
                />
            </div>
        </div>
    );
};

export default TerminalView;
