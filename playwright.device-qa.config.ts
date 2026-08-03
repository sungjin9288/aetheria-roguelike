import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './tests/device-qa',
    fullyParallel: false,
    workers: 1,
    reporter: [['list']],
    timeout: 60_000,
    use: {
        baseURL: 'http://127.0.0.1:4183',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        ...devices['iPhone 12'],
    },
    webServer: {
        command: 'VITE_DEVICE_QA_SCENARIO=item-investment npm run build && npx vite preview --host 127.0.0.1 --port 4183 --strictPort',
        port: 4183,
        reuseExistingServer: false,
        timeout: 180_000,
    },
});
