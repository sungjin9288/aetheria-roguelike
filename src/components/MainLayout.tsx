import type { CSSProperties, ReactNode, UIEvent } from 'react';
import type { RegionTheme } from '../utils/regionTheme.js';

interface MainLayoutProps {
  children: ReactNode;
  visualEffect?: string | null;
  readabilityMode?: string;
  regionTheme?: RegionTheme | null;
  immersive?: boolean;
}

/** React `CSSProperties`에 없는 커스텀 프로퍼티(지역 ambient 팔레트 변수) 2개만 더한 style 타입. */
type RegionAmbientStyle = CSSProperties & {
  '--region-accent': string;
  '--region-soft': string;
};

// slice 21: regionTheme — 위치 기반 ambient 팔레트. accent/soft를 CSS 변수로
//   내려보내고, 상단 radial wash 1개 레이어로 지역 분위기를 표현한다.
//   시맨틱 컬러(행동/위험/보상)는 불변 — ambient 전용.
// 2026-10 에테르 유리(VD-14): 바탕은 세 겹 — 앱 바탕(금 · 에테르 원광) · 지역 빛 · 비네트. 격자 · 빛 덩어리 셋 · 고리는 지웠다.
//   셸의 고정폭 글꼴(font-mono)도 지웠다(VD-05) — 숫자만 `font-fira`가 Fira Code로 그린다.
const MainLayout = ({ children, visualEffect, readabilityMode, regionTheme, immersive = false }: MainLayoutProps) => {
  const normalizedReadabilityMode = readabilityMode === 'high' ? 'high' : 'standard';
  const shellSpacing = immersive
    ? ''
    : 'p-2 pt-[calc(var(--aether-safe-area-top)+0.1rem)] pb-[calc(var(--aether-safe-area-bottom)+0.5rem)]';

  return (
    <div
      data-app-shell
      data-layout-mode={immersive ? 'immersive' : 'standard'}
      data-readability-mode={normalizedReadabilityMode}
      data-region-theme={regionTheme?.key || 'haven'}
      style={{
        '--region-accent': regionTheme?.accent || 'var(--aether-gold)',
        '--region-soft': regionTheme?.soft || 'rgb(var(--aether-gold-rgb) / 0.1)',
      } as RegionAmbientStyle}
      className={`relative flex h-[100dvh] w-full flex-col overflow-x-hidden overflow-y-auto bg-ae-void text-ae-ink ${shellSpacing} ${visualEffect === 'shake' ? 'animate-shake' : ''}`}
      onScroll={(event: UIEvent<HTMLDivElement>) => {
        if (event.currentTarget.scrollLeft !== 0) {
          event.currentTarget.scrollLeft = 0;
        }
      }}
    >
      {!immersive && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 ae-app-backdrop" />
          <div className="absolute inset-0 aether-region-ambient" />
          <div className="ae-shell-vignette absolute inset-0" />
        </div>
      )}
      <div className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col">
        {children}
      </div>
    </div>
  );
};

export default MainLayout;
