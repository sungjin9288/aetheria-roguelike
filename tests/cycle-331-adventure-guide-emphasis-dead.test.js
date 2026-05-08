import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 331: getAdventureGuidance emphasis 필드 11회 dead 제거 (cycle 310 cascade)
 *   (cycle 222-330 silent dead config 시리즈 100번째 — cleanup lens 연속, 한 자리수 도달).
 *
 * 발견 (dead emphasis field):
 * - src/utils/adventureGuide.ts: getAdventureGuidance 11 return statement에서
 *   각각 `emphasis: '...'` 정의 (11개 한국어 라벨).
 * - cycle 23 시점 FocusPanel `'확률 증폭'` 등 emphasis surface 표시용으로 도입.
 * - cycle 310 FocusPanel 제거 후 src/, tests/ 어디에서도 `guidance.emphasis` read 0건.
 * - 다른 emphasis 필드 (questOperations entry.meta.emphasis) 와 별개.
 *
 * 패턴 (cycle 222-330 silent dead config 시리즈 100번째):
 * - cycle 330: SignalBadge 'signature' tone cascade dead.
 * - cycle 331: getAdventureGuidance emphasis 11회 dead 일괄 정리.
 *
 * 수정 (src/utils/adventureGuide.ts):
 * - 11 emphasis 필드 제거 (sed `/emphasis:.*,$/d`).
 *
 * 회귀 가드:
 * - title / detail / primaryAction / secondaryAction 필드 보존.
 * - 기존 test (cycle-115-guide-debuff-hint, quest-operations.test, adventure-guide.test)
 *   는 title/detail만 검증 → 영향 없음.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 331: getAdventureGuidance emphasis 필드 0개 (11개 모두 제거)', async () => {
    const source = await readSrc('src/utils/adventureGuide.ts');
    const matches = source.match(/^\s+emphasis:/gm) || [];
    assert.equal(matches.length, 0,
        `getAdventureGuidance에서 emphasis 필드 0개여야 함, ${matches.length}개 발견`);
});

test('cycle 331: getAdventureGuidance 다른 필드 보존 (회귀 가드)', async () => {
    const source = await readSrc('src/utils/adventureGuide.ts');
    // primaryAction, secondaryAction, title, detail 필드는 그대로.
    const primaryCount = (source.match(/^\s+primaryAction:/gm) || []).length;
    const titleCount = (source.match(/^\s+title:/gm) || []).length;
    assert.ok(primaryCount >= 11, `primaryAction 필드 11+ 보존 (실제: ${primaryCount})`);
    assert.ok(titleCount >= 11, `title 필드 11+ 보존 (실제: ${titleCount})`);
});

test('cycle 331: getAdventureGuidance 동작 보존 (primaryAction 흐름)', async () => {
    const { getAdventureGuidance } = await import('../src/utils/adventureGuide.js');
    const player = { hp: 100, maxHp: 100, mp: 50, maxMp: 50, level: 5, job: '검사', loc: '시작의 마을', inv: [], stats: {} };
    const stats = { maxHp: 100, maxMp: 50 };
    const guidance = getAdventureGuidance(player, stats, { type: 'safe' }, 'idle');
    assert.ok(guidance, 'guidance 객체 반환');
    // emphasis 필드 없어야 함.
    assert.equal(guidance.emphasis, undefined, 'emphasis 필드 undefined');
    // 다른 필드 존재.
    assert.ok(guidance.primaryAction !== undefined, 'primaryAction 존재');
});

test('cycle 330 회귀 가드: SignalBadge signature tone 제거 보존', async () => {
    const source = await readSrc('src/components/SignalBadge.tsx');
    assert.ok(!/^\s+signature:\s*'border/m.test(source),
        'cycle 330 signature tone 제거 보존');
});
