import { soundManager } from '../systems/SoundManager';

// slice 21: regionTheme — 위치 기반 ambient 팔레트. accent/soft를 CSS 변수로
//   내려보내고, 상단 radial wash 1개 레이어로 지역 분위기를 표현한다.
//   시맨틱 컬러(행동/위험/보상)는 불변 — ambient 전용.
const MainLayout = ({ children, visualEffect, readabilityMode, regionTheme }: any) => {
  const normalizedReadabilityMode = readabilityMode === 'high' ? 'high' : 'standard';

  return (
    <div
      data-app-shell
      data-readability-mode={normalizedReadabilityMode}
      data-region-theme={regionTheme?.key || 'haven'}
      style={{
        '--region-accent': regionTheme?.accent || '#d5b180',
        '--region-soft': regionTheme?.soft || 'rgba(213, 177, 128, 0.10)',
      } as any}
      className={`relative flex h-[100dvh] w-full flex-col overflow-x-hidden overflow-y-auto p-2 pt-[calc(env(safe-area-inset-top)+0.1rem)] pb-[calc(env(safe-area-inset-bottom)+0.5rem)] font-mono text-slate-200 ${visualEffect === 'shake' ? 'animate-shake' : ''}`}
      onClick={(e: any) => {
        // 첫 클릭 시 AudioContext 초기화 (브라우저 정책)
        soundManager.init();
        // 버튼 클릭만 사운드 (버블링 방지)
        if ((e.target as HTMLElement).closest('button')) {
          soundManager.play('click');
        }
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(213,177,128,0.12),transparent_24%),radial-gradient(circle_at_80%_14%,rgba(125,212,216,0.10),transparent_20%),linear-gradient(180deg,rgba(8,11,16,0.9)_0%,rgba(5,7,11,0.98)_100%)]" />
      <div className="pointer-events-none absolute inset-0 aether-region-ambient" />
      <div className="pointer-events-none absolute inset-0 aether-soft-grid opacity-[0.18]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_42%,rgba(2,4,8,0.44)_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[#d5b180]/8 via-white/[0.02] to-transparent" />
      <div className="pointer-events-none absolute left-[-3rem] top-[18%] h-48 w-48 rounded-full bg-[#d5b180]/8 blur-3xl" />
      <div className="pointer-events-none absolute right-[-4rem] top-[8%] h-56 w-56 rounded-full bg-[#7dd4d8]/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[calc(env(safe-area-inset-bottom)+0.4rem)] left-1/2 h-16 w-16 -translate-x-1/2 rounded-full border border-white/8 bg-[radial-gradient(circle,rgba(125,212,216,0.08),transparent_70%)] blur-xl" />
      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        {children}
      </div>
    </div>
  );
};

export default MainLayout;
