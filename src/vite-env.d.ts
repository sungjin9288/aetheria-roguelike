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
    __AETHERIA_TEST_API__?: any;
    render_game_to_text?: any;
    advanceTime?: any;
}
