import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 125: AchievementPanel testid 노출 — smoke / e2e 셀렉터 확보.
 *
 * 발견:
 * - cycle 79(테마) / 105(maxKillStreak/discoveryChains 테마) / 122-123(claim
 *   sound)에서 AchievementPanel을 여러 번 touch했지만 testid 0건.
 * - smoke-gameplay.mjs / playwright e2e가 achievement claim 흐름을 자동화
 *   하려면 stable selector 필요.
 *
 * 추가:
 * - data-testid="achievement-panel" — 패널 루트.
 * - data-testid={`achievement-card-${a.id}`} — 개별 achievement 카드.
 * - data-testid={`achievement-claim-${a.id}`} — 수령 버튼 (unlocked && !claimed).
 * - data-testid="achievement-toggle-show-all" — 요약/전체 토글 버튼.
 *
 * cycle 18+ signature surface testid 명명 패턴 일관 (kebab-case + dynamic ID).
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('AchievementPanel: achievement-panel root testid 노출', async () => {
    const source = await readSrc('src/components/AchievementPanel.tsx');
    assert.match(source, /data-testid\s*=\s*["']achievement-panel["']/);
});

test('AchievementPanel: dynamic achievement-card-{id} testid 노출', async () => {
    const source = await readSrc('src/components/AchievementPanel.tsx');
    assert.match(source, /data-testid\s*=\s*\{`achievement-card-\$\{[^}]+\}`\}/);
});

test('AchievementPanel: dynamic achievement-claim-{id} testid 노출', async () => {
    const source = await readSrc('src/components/AchievementPanel.tsx');
    assert.match(source, /data-testid\s*=\s*\{`achievement-claim-\$\{[^}]+\}`\}/);
});

test('AchievementPanel: cycle 473 paired — 요약 토글 버튼 cascade 제거 보존', async () => {
    // cycle 473이 compact prop cascade로 토글 버튼 + 요약 모드 자체 제거.
    // 이전 testid assertion → cascade cleanup 보존 가드로 약화.
    const source = await readSrc('src/components/AchievementPanel.tsx');
    assert.ok(!/achievement-toggle-show-all/.test(source),
        'cycle 473 토글 버튼 testid 제거 보존');
});
