import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E config.
 *
 * 시나리오: 핵심 사용자 플로우 (캐릭터 생성 → 첫 전투 → 사망 → 재시작).
 * vite preview 5173 포트로 dist 결과물에 대해 실행.
 *
 * cycle 58: 인프라 + 핵심 플로우 2개로 시작. 실기기 회귀 방지용.
 */
export default defineConfig({
    testDir: './tests/e2e',
    fullyParallel: false,        // 게임 상태 사이드 이펙트로 직렬 권장
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: 1,
    reporter: [['list']],
    timeout: 30_000,
    use: {
        baseURL: 'http://localhost:4173',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
    },
    projects: [
        {
            name: 'chromium-mobile',
            // iPhone 12 viewport — 실기기와 가장 가까움
            use: { ...devices['iPhone 12'] },
        },
    ],
    webServer: {
        command: 'npm run build && npx vite preview --port 4173',
        port: 4173,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
    },
});
