import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 583: StatusMetric `variant = 'hp'` default unreachable
 *   (cycle 222-582 silent dead config 시리즈 321번째 — redundant default annotation
 *   청소 메가 시리즈 74번째).
 *
 * 발견 (1 default unreachable):
 * - src/components/StatusBar.tsx (line 30):
 *     const StatusMetric = ({ label, value, max, variant = 'hp' }: any) => {...};
 * - 호출 사이트 (3 internal callers):
 *     · StatusBar.tsx:236 — <StatusMetric label="HP" ... variant="hp" />
 *     · StatusBar.tsx:237 — <StatusMetric label="NRG" ... variant="mp" />
 *     · StatusBar.tsx:238 — <StatusMetric label="EXP" ... variant="exp" />
 * - 결과: variant 항상 명시 전달. default 'hp' 도달 불가.
 *
 * 패턴 (cycle 222-582 시리즈 321번째):
 * - cycle 502-582: default 청소 메가 시리즈 81사이클.
 * - cycle 583: components/StatusBar.tsx — cycle 491-495 시리즈에 이은 동일
 *   모듈 추가 cleanup.
 *
 * 수정 (src/components/StatusBar.tsx):
 * - signature에서 variant = 'hp' → variant.
 * - body의 METER_THEME[variant] || METER_THEME.hp nullish fallback 보존.
 *
 * 회귀 가드:
 * - 3 internal callsite 동작 그대로.
 * - body METER_THEME hp fallback + Math.max/Math.min 처리 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 583: StatusMetric signature에서 variant default 0건', async () => {
    const source = await readSrc('src/components/StatusBar.tsx');
    const fnIdx = source.indexOf('const StatusMetric = ');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/variant\s*=\s*'hp'/.test(sig),
        "StatusMetric variant default 'hp' 제거");
});

test('cycle 583: 정합성 가드 — 3 internal callsite 보존', async () => {
    const source = await readSrc('src/components/StatusBar.tsx');
    assert.ok(/<StatusMetric label="HP"[\s\S]*?variant="hp"/.test(source),
        'HP callsite 보존');
    assert.ok(/<StatusMetric label="NRG"[\s\S]*?variant="mp"/.test(source),
        'NRG callsite 보존');
    assert.ok(/<StatusMetric label="EXP"[\s\S]*?variant="exp"/.test(source),
        'EXP callsite 보존');
});

test('cycle 583: body METER_THEME nullish fallback 보존', async () => {
    const source = await readSrc('src/components/StatusBar.tsx');
    assert.ok(/METER_THEME\[variant\] \|\| METER_THEME\.hp/.test(source),
        'METER_THEME[variant] || METER_THEME.hp nullish fallback 보존');
});

test('cycle 583: cycle 502-582 회귀 가드 — default 청소 시리즈 보존', async () => {
    const cc = await readSrc('src/components/ClassCard.tsx');
    assert.ok(!/const ClassCard = \({ jobName, onSelect, disabled\s*=\s*false/.test(cc),
        'cycle 582 ClassCard disabled default 0건');

    const qs = await readSrc('src/components/QuickSlot.tsx');
    assert.ok(!/slots\s*=\s*\[null, null, null\]/.test(qs),
        'cycle 581 QuickSlot slots default 0건');
});
