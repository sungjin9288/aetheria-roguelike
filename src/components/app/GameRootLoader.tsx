import { useEffect, useState, type ComponentProps } from 'react';

import BootScreen from './BootScreen';
import type GameRoot from './GameRoot';

// 게임 화면(GameRoot 아래 전부 — 조작판 · 모드 화면 · 상태 표시줄 · 기록 창)은 첫 화면(부팅 · 시작 화면)에
// 쓰이지 않는다. 진입 청크에 두면 첫 화면 전에 받고 파싱해야 해서(GameRoot 청크만 gzip 약 48KB) 따로 받는다(CH-03).
// 앱이 뜨자마자 받기 시작하므로 부팅이 끝나거나 시작을 누를 때는 대개 이미 받아 두었다 —
// 받아 두었으면 바로 그리고(대기 화면 깜박임이 없다), 아직이면 부팅 화면을 그대로 둔다.
type GameRootComponent = typeof GameRoot;

let loadedGameRoot: GameRootComponent | null = null;
let pendingGameRoot: Promise<GameRootComponent> | null = null;

const loadGameRoot = (): Promise<GameRootComponent> => {
    pendingGameRoot ??= import('./GameRoot').then(
        (module) => {
            loadedGameRoot = module.default;
            return module.default;
        },
        (error: unknown) => {
            pendingGameRoot = null; // 다음 시도에서 다시 받는다.
            throw error;
        },
    );
    return pendingGameRoot;
};

if (typeof window !== 'undefined') {
    // 실패는 화면이 그릴 때 다시 받으며 드러낸다(아래 effect) — 미리 받기의 실패만으로 오류를 보고하지 않는다.
    loadGameRoot().catch(() => undefined);
}

const GameRootLoader = (props: ComponentProps<GameRootComponent>) => {
    const [Root, setRoot] = useState<GameRootComponent | null>(() => loadedGameRoot);
    const [failure, setFailure] = useState<{ error: unknown } | null>(null);

    useEffect(() => {
        if (Root) return undefined;
        let active = true;
        loadGameRoot().then(
            (component) => {
                if (active) setRoot(() => component);
            },
            (error: unknown) => {
                if (active) setFailure({ error });
            },
        );
        return () => {
            active = false;
        };
    }, [Root]);

    // 받지 못하면 앱의 오류 경계(FatalErrorBoundary)가 받는다 — 부팅 화면에 영원히 머물지 않는다.
    if (failure) throw failure.error;
    if (!Root) return <BootScreen bootStage="ready" />;
    return <Root {...props} />;
};

export default GameRootLoader;
