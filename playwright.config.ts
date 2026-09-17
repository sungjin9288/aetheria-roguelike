import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E config.
 *
 * 시나리오: 핵심 사용자 플로우 (캐릭터 생성 → 첫 전투 → 사망 → 재시작).
 * vite preview 4173 포트의 dist 결과물에 대해 실행.
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
        // local-playtest.sh는 실제로 기동한 host와 port를 항상 전달한다.
        baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:4173',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
    },
    projects: [
        {
            name: 'chromium-mobile',
            // iPhone 12 viewport/UA/DPR/touch 에뮬레이션 — 실기기와 가장 가까움.
            // 엔진은 이름 그대로 chromium 으로 고정한다. devices['iPhone 12'] 의 기본 엔진은 webkit 인데,
            // Linux headless WebKit(ubuntu-24.04 러너)은 click 이 "visible, enabled and stable" 대기에서
            // rAF 가 멈춰 무기한 hang 하는 업스트림 결함이 열려 있다(microsoft/playwright#33057 —
            // 2026-09 PR #31 첫 CI 실행에서 progression-acceptance 성장 변경 클릭이 3/3 재현).
            // 게이트는 결정적이어야 하므로 chromium 을 쓰고, WebKit 실기기 검증은 device-qa/iOS 빌드가 맡는다.
            use: { ...devices['iPhone 12'], defaultBrowserType: 'chromium' },
        },
    ],
    webServer: {
        command: 'VITE_ENABLE_TEST_API=1 npm run build && npx vite preview --port 4173',
        port: 4173,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
    },
});
