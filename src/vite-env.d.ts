/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_ADMIN_UIDS?: string;
    readonly VITE_FIREBASE_API_KEY?: string;
    readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
    readonly VITE_FIREBASE_PROJECT_ID?: string;
    readonly VITE_FIREBASE_STORAGE_BUCKET?: string;
    readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
    readonly VITE_FIREBASE_APP_ID?: string;
    readonly VITE_AI_API_KEY?: string;
    readonly VITE_USE_AI_PROXY?: string;
    readonly VITE_AI_PROXY_URL?: string;
    readonly VITE_REMOTE_CONFIG?: string;
    readonly VITE_ENABLE_TEST_API?: string;
    readonly VITE_DEVICE_QA_SCENARIO?: string;
    [key: string]: string | undefined;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}

interface PerfRegistry {
    marks: Set<string>;
    measures: Set<string>;
}

interface Window {
    __AETHERIA_PERF_REGISTRY__?: PerfRegistry;
    __firebase_config?: string;
    __initial_auth_token?: string;
    // W8-Z6: `AetheriaTestApi`(hooks/useGameTestApi.ts)가 이 global의 문서화된 계약이다 —
    //   `import(...)` 타입 참조로 값 없이(런타임 의존 0) 가져온다. tests/e2e/**가
    //   `window.__AETHERIA_TEST_API__?.멤버?.(...)` 형태로 이 타입을 통해 컴파일 검증된다.
    __AETHERIA_TEST_API__?: import('./hooks/useGameTestApi.js').AetheriaTestApi;
    render_game_to_text?: () => string;
    // cycle 594: advanceTime 타입 cascade 제거 — cycle 593에서 실제 정의/cleanup
    //   제거된 후 잔존 dead type. paired completion.
}
