import { useSyncExternalStore } from 'react';

/**
 * 2026-10 데스크톱 배치(VD-04 · UX-12): 이 폭 이상이면 세 칸(캐릭터 · 무대 · 모험 기록)으로 그린다.
 * 그 아래(휴대폰 · 작은 태블릿)는 지금의 한 칸 배치 그대로다. 같은 값을 index.css의 데스크톱 격자가 쓴다.
 */
export const DESKTOP_LAYOUT_MIN_WIDTH = 1024;

const DESKTOP_QUERY = `(min-width: ${DESKTOP_LAYOUT_MIN_WIDTH}px)`;

const getMediaQueryList = (): MediaQueryList | null => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null;
    return window.matchMedia(DESKTOP_QUERY);
};

const subscribe = (onChange: () => void): (() => void) => {
    const query = getMediaQueryList();
    if (!query) return () => undefined;
    if (typeof query.addEventListener === 'function') {
        query.addEventListener('change', onChange);
        return () => query.removeEventListener('change', onChange);
    }
    // 오래된 Safari(14 미만)는 addListener만 안다.
    query.addListener(onChange);
    return () => query.removeListener(onChange);
};

const getSnapshot = (): boolean => getMediaQueryList()?.matches ?? false;

// 서버 렌더 · 정적 렌더(테스트)는 모바일 배치다 — 첫 화면이 휴대폰이라는 출시 기준과 같다.
const getServerSnapshot = (): boolean => false;

/** 화면 폭이 데스크톱 배치 기준(1024px) 이상인지 — 폭이 바뀌면 다시 그린다. */
export const useDesktopLayout = (): boolean => useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
