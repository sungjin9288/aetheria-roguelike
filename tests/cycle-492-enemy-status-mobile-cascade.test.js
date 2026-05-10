import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 492: EnemyStatus `mobile` prop 항상 truthy cascade unreachable 정리
 *   (cycle 222-491 silent dead config 시리즈 243번째 — unreachable code path
 *   cascade cleanup, cycle 491 paired 같은 파일 변형).
 *
 * 발견 (1 prop + 2 ternary 가지 unreachable):
 * - src/components/StatusBar.tsx (line 56):
 *     const EnemyStatus = ({ enemy, mobile = false }: any) => {...
 *         className={`... ${mobile ? 'px-2.75 py-2.5' : 'px-3 py-2.5'}`}
 *         {mobile ? 'Target Lock' : 'Combat Target'}
 * - 호출 사이트 분석:
 *     · StatusBar.tsx:240 — 1 callsite: <EnemyStatus enemy={enemy} mobile />
 *     · 다른 파일 import 0건 (internal const).
 *     · 0 callsite passes mobile=false. shorthand mobile=true만.
 * - 결과: mobile 항상 true → 2 ternary 첫 가지만 진입, 둘째 가지 (Combat Target /
 *   px-3 py-2.5) unreachable.
 *
 * 패턴 (cycle 222-491 시리즈 243번째):
 * - cycle 491: StatusMetric compact / dense cascade.
 * - cycle 492: EnemyStatus mobile cascade — 같은 파일 paired 후속.
 *
 * 수정 (src/components/StatusBar.tsx):
 * - EnemyStatus destructure에서 mobile = false 제거.
 * - className의 mobile 가지 → 'px-2.75 py-2.5' inline.
 * - "Target Lock" 텍스트 inline.
 * - 1 callsite의 mobile shorthand 제거.
 *
 * 회귀 가드:
 * - enemy prop 보존.
 * - 본체 enemy.name / enemy.isBoss / HP bar / SignalBadge / percentage 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 492: EnemyStatus destructure에서 mobile 0건', async () => {
    const source = await readSrc('src/components/StatusBar.tsx');
    const fnIdx = source.indexOf('const EnemyStatus =');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/\bmobile\b/.test(sig), 'destructure에 mobile 0건');
});

test('cycle 492: EnemyStatus 본체 mobile 참조 0건', async () => {
    const source = await readSrc('src/components/StatusBar.tsx');
    const fnIdx = source.indexOf('const EnemyStatus =');
    const fnEnd = source.indexOf('interface StatusBarProps', fnIdx);
    const block = source.slice(fnIdx, fnEnd);
    assert.ok(!/\bmobile\b/.test(block), '본체 mobile 참조 0건');
});

test('cycle 492: 정합성 가드 — 1 callsite mobile 명시 0건', async () => {
    const source = await readSrc('src/components/StatusBar.tsx');
    const matches = source.match(/<EnemyStatus[^/]*\/>/g) || [];
    assert.equal(matches.length, 1, 'EnemyStatus 호출 1건');
    assert.ok(!/\bmobile\b/.test(matches[0]), 'callsite mobile 명시 0건');
});

test('cycle 492: 본체 정적 inline (px-2.75 py-2.5 / Target Lock 텍스트)', async () => {
    const source = await readSrc('src/components/StatusBar.tsx');
    assert.ok(/px-2\.75 py-2\.5/.test(source), 'mobile 가지 padding 보존');
    assert.ok(/Target Lock/.test(source), 'Target Lock 텍스트 보존');
    assert.ok(!/Combat Target/.test(source), 'Combat Target (비-mobile 가지) 제거');
});

test('cycle 492: enemy prop / 본체 핵심 로직 보존', async () => {
    const source = await readSrc('src/components/StatusBar.tsx');
    const fnIdx = source.indexOf('const EnemyStatus =');
    const fnEnd = source.indexOf('interface StatusBarProps', fnIdx);
    const block = source.slice(fnIdx, fnEnd);
    assert.ok(/enemy/.test(block), 'enemy prop 보존');
    assert.ok(/isBoss/.test(block), 'enemy.isBoss 분기 보존');
    assert.ok(/percentage/.test(block), 'percentage HP bar 보존');
});
