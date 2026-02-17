import React from 'react';
import { soundManager } from '../systems/SoundManager';

const MainLayout = ({ children, visualEffect }) => (
  <div
    className={`flex flex-col min-h-[100dvh] w-full bg-slate-950 text-slate-200 font-mono p-2 md:p-4 pb-[max(0.5rem,env(safe-area-inset-bottom))] overflow-x-hidden overflow-y-auto relative ${visualEffect === 'shake' ? 'animate-shake' : ''}`}
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
