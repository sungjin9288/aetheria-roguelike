import React from 'react';
import { soundManager } from '../systems/SoundManager';

const MainLayout = ({ children, visualEffect }) => (
  <div
    className={`flex flex-col h-[100dvh] w-full bg-slate-950 text-slate-200 font-mono p-2 md:p-4 pt-[calc(env(safe-area-inset-top)+0.5rem)] pb-[calc(env(safe-area-inset-bottom)+0.5rem)] overflow-x-hidden overflow-y-auto md:overflow-y-hidden relative ${visualEffect === 'shake' ? 'animate-shake' : ''}`}
    onClick={(e) => {
      // 첫 클릭 시 AudioContext 초기화 (브라우저 정책)
      soundManager.init();
      // 버튼 클릭만 사운드 (버블링 방지)
      if (e.target.closest('button')) {
        soundManager.play('click');
      }
    }}
  >
    {children}
  </div>
);

export default MainLayout;
