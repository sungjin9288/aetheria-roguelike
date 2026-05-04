import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 86: RunSummaryCard에 escapes/discoveries 시각 노출.
 *
 * 배경:
 * - cycle 78에서 escape 라인을 share text에 추가, cycle 84에서 discoveries
 *   라인을 share text에 추가. 그러나 RunSummaryCard 자체(시각 카드)는 둘 다
 *   노출하지 않음 — 공유 텍스트로만 자랑할 수 있고 화면에선 안 보였음.
 * - 다른 reflection surface(signaturesAcquired)는 별도의 highlight 섹션
 *   (data-testid="run-summary-signatures")으로 시각 노출되는 패턴이 정착됨
 *   (cycle 18). 동일 패턴으로 escape/discovery도 surface.
 *
 * 추가:
 * - 새 mini section: data-testid="run-summary-extras"
 * - 조건: escapes > 0 || discoveries > 0 (둘 다 0이면 silent)
 * - 각 메트릭은 자체 data-testid (run-summary-escape, run-summary-discovery)로
 *   selectable.
 *
 * 계약:
 *   1. 컴포넌트 source가 run-summary-extras testid 노출
 *   2. run-summary-escape testid 노출
 *   3. run-summary-discovery testid 노출
 *   4. signaturesAcquired highlight (cycle 18) 회귀 보존
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('RunSummaryCard: run-summary-extras testid 노출', async () => {
    const source = await readSrc('src/components/RunSummaryCard.tsx');
    assert.ok(
        /data-testid\s*=\s*["']run-summary-extras["']/.test(source),
        'should expose data-testid="run-summary-extras"'
    );
});

test('RunSummaryCard: run-summary-escape testid 노출', async () => {
    const source = await readSrc('src/components/RunSummaryCard.tsx');
    assert.ok(
        /data-testid\s*=\s*["']run-summary-escape["']/.test(source),
        'should expose data-testid="run-summary-escape"'
    );
});

test('RunSummaryCard: run-summary-discovery testid 노출', async () => {
    const source = await readSrc('src/components/RunSummaryCard.tsx');
    assert.ok(
        /data-testid\s*=\s*["']run-summary-discovery["']/.test(source),
        'should expose data-testid="run-summary-discovery"'
    );
});

test('RunSummaryCard: extras 섹션은 escapes>0 OR discoveries>0 조건부 (silence-over-noise)', async () => {
    const source = await readSrc('src/components/RunSummaryCard.tsx');
    // 조건 표현식에 escapes와 discoveries 둘 다 등장해야 함 (||로 결합)
    assert.match(
        source,
        /(s\.escapes[^&|]+\|\|[^&|]+s\.discoveries|s\.discoveries[^&|]+\|\|[^&|]+s\.escapes)/,
        'extras section should be gated on (escapes > 0 || discoveries > 0)'
    );
});

test('RunSummaryCard: signaturesAcquired highlight 회귀 보존 (cycle 18)', async () => {
    const source = await readSrc('src/components/RunSummaryCard.tsx');
    assert.ok(
        /data-testid\s*=\s*["']run-summary-signatures["']/.test(source),
        'cycle 18 signature highlight section must be preserved'
    );
});
