import React, { useRef, useEffect } from 'react';
import { Bot } from 'lucide-react';

const TerminalView = ({ logs, gameState, onCommand }) => {
    const endRef = useRef(null);
    useEffect(() => {
        if (endRef.current) {
            endRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
    }, [logs]);

    // Contextual Background Transition
    const bgClass = gameState === 'event'
        ? "bg-purple-950/20 border-purple-800/50"
        : "bg-black/80 border-slate-800";

    return (
        <div className={`flex-1 ${bgClass} border rounded-lg p-4 relative shadow-2xl overflow-y-auto custom-scrollbar font-mono transition-colors duration-1000`}>
            {logs.length === 0 && (
                <div className="text-slate-500 text-center mt-10 italic">
                    시스템 초기화 중...<br />
                    (로그가 보이지 않으면 새로고침 해주세요)
                </div>
            )}
            {logs.map((log) => {
                let logStyle = "text-slate-300";
                let bgStyle = "transparent";
                let anim = "";
                if (log.type === 'combat') { logStyle = "text-red-400"; bgStyle = "bg-red-900/10"; }
                if (log.type === 'critical') { logStyle = "text-red-500 font-bold text-lg"; bgStyle = "bg-red-950/40"; anim = "animate-bounce"; }
                if (log.type === 'story') { logStyle = "text-emerald-300 italic"; bgStyle = "bg-emerald-900/10 border-l-2 border-emerald-500 pl-2"; }
                if (log.type === 'system') logStyle = "text-blue-300 font-bold";
                if (log.type === 'error') { logStyle = "text-red-500 font-bold"; bgStyle = "bg-red-950/30"; }
                if (log.type === 'success') logStyle = "text-yellow-400";
                if (log.type === 'event') logStyle = "text-purple-400";
                if (log.type === 'loading') logStyle = "text-slate-500 animate-pulse";
                if (log.type === 'warning') logStyle = "text-orange-400";

                return (
                    <div key={log.id} className={`text-sm mb-1 p-1 rounded ${logStyle} ${bgStyle} ${anim}`}>
                        {log.type === 'story' && <Bot size={14} className="inline mr-2" />}
                        {log.text}
                    </div>
                );
            })}
            {logs.length > 0 && logs[logs.length - 1].type === 'loading' && <div className="text-xs text-slate-600 animate-pulse mt-2">에테르니아의 의지가 운명을 기록 중입니다...</div>}
            <div ref={endRef} />

            {/* CLI INPUT AREA */}
            <div className="mt-2 border-t border-slate-800 pt-2 flex gap-2">
                <span className="text-emerald-500 font-bold">{'>'}</span>
                <input
                    type="text"
                    className="bg-transparent border-none outline-none text-emerald-400 font-mono w-full placeholder-slate-700"
                    placeholder="명령어를 입력하세요 (예: 이동 숲, 공격, 탐험, 도움말)"
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
