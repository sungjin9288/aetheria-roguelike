import React from 'react';
import { soundManager } from '../systems/SoundManager';

const MainLayout = ({ children, visualEffect }) => (
  <div
    className={`flex flex-col min-h-[100dvh] w-full bg-slate-950 text-slate-200 font-mono p-2 md:p-4 overflow-hidden relative ${visualEffect === 'shake' ? 'animate-shake' : ''}`}
    onClick={() => soundManager.play('click')}
  >
    {children}
    <style>{`.custom-scrollbar::-webkit-scrollbar { width: 4px; background: #1e293b; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #475569; radius: 4px; }
      @keyframes shake {
        0%, 100% { transform: translateX(0); }
        10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
        20%, 40%, 60%, 80% { transform: translateX(5px); }
      }
      .animate-shake { animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both; }
    `}</style>
  </div>
);

export default MainLayout;
