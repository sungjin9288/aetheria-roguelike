import React from 'react';
import { soundManager } from '../systems/SoundManager';

const MainLayout = ({ children, visualEffect }) => (
  <div
    data-app-shell
    className={`flex flex-col h-[100dvh] w-full bg-[#040813] text-slate-200 font-mono p-2 md:p-3 pt-[calc(env(safe-area-inset-top)+0.35rem)] pb-[calc(env(safe-area-inset-bottom)+6.25rem)] md:pb-[calc(env(safe-area-inset-bottom)+0.5rem)] overflow-x-hidden overflow-y-auto md:overflow-y-hidden relative ${visualEffect === 'shake' ? 'animate-shake' : ''}`}
    onClick={(e) => {
      // 첫 클릭 시 AudioContext 초기화 (브라우저 정책)
      soundManager.init();
      // 버튼 클릭만 사운드 (버블링 방지)
      if (e.target.closest('button')) {
        soundManager.play('click');
      }
    }}
  >
    <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-cyan-400/5 via-transparent to-transparent" />
    <div className="pointer-events-none absolute bottom-[calc(env(safe-area-inset-bottom)+0.4rem)] left-1/2 h-16 w-16 -translate-x-1/2 rounded-full border border-cyan-400/8 bg-[radial-gradient(circle,rgba(34,211,238,0.08),transparent_70%)] blur-xl" />
    {children}
  </div>
);

export default MainLayout;
