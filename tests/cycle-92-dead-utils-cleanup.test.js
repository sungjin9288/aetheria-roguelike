import test from 'node:test';
import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 92: dead components/services/utils 정리.
 *
 * cycle 90/91 흐름의 연장. 추가 발견:
 *   - src/components/AdminDashboard.tsx (142 lines)
 *     "v4.0: Hybrid Strategy - Analytics offloaded to AWS Lambda" 주석으로
 *     계획됐던 analytics dashboard. 어디서도 import되지 않음 (실제 admin 액션은
 *     SystemTab의 SET_MULTIPLIER / BROADCAST 버튼이 별도로 처리).
 *   - src/services/analyticsService.ts (27 lines)
 *     fetchAnalyticsData export. 유일한 consumer가 AdminDashboard였음 → 함께
 *     orphan.
 *   - src/utils/animationConfig.ts (111 lines)
 *     중앙화된 Framer Motion 프리셋(MOTION 객체) — 아무도 import 안 함.
 *     컴포넌트가 inline motion을 직접 쓰는 패턴으로 정착되어 사용처가 0건.
 *
 * 합 280 lines 정리.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');

const fileExists = async (relPath) => {
    try {
        await access(path.join(ROOT, relPath));
        return true;
    } catch {
        return false;
    }
};

test('AdminDashboard.tsx 파일 제거됨', async () => {
    assert.equal(await fileExists('src/components/AdminDashboard.tsx'), false);
});

test('analyticsService.ts 파일 제거됨', async () => {
    assert.equal(await fileExists('src/services/analyticsService.ts'), false);
});

test('animationConfig.ts 파일 제거됨', async () => {
    assert.equal(await fileExists('src/utils/animationConfig.ts'), false);
});

test('aiService.ts는 보존 (active service)', async () => {
    assert.equal(await fileExists('src/services/aiService.ts'), true);
});

test('SystemTab의 admin 액션은 별도 경로로 보존됨', async () => {
    const { readFile } = await import('node:fs/promises');
    const source = await readFile(path.join(ROOT, 'src/components/tabs/SystemTab.tsx'), 'utf8');
    assert.match(source, /actions\.isAdmin\(\)/);
    assert.match(source, /handleSetMultiplier|SET MULTIPLIER/);
});
