import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 462: JobChangePanel `<ClassCard player={player}>` silently dropped attr 정리
 *   (cycle 222-461 silent dead config 시리즈 217번째 — silent UI dropped attribute
 *   cleanup lens, cycle 405 / 461 paired completion).
 *
 * 발견 (1 silently dropped attribute):
 * - src/components/tabs/JobChangePanel.tsx (line 51-57):
 *     <ClassCard
 *         key={job}
 *         jobName={job}
 *         player={player}              ← silently dropped
 *         onSelect={...}
 *         disabled={...}
 *     />
 * - ClassCard 시그니처 (cycle 461 cleanup 후):
 *     const ClassCard = ({ jobName, onSelect, disabled = false }: any) => {...}
 * - 결과: `player` prop이 destructure에 없어 silently dropped. caller가 보내지만
 *   ClassCard 본체에서 read 0건.
 *
 * 패턴 (cycle 222-461 시리즈 217번째):
 * - cycle 405: Codex `compact?: boolean` interface dead — Dashboard pass했으나
 *   silent dropped이라 paired remove.
 * - cycle 461: ClassCard compact prop unreachable cleanup 후, JobChangePanel
 *   callsite도 점검하니 `player` prop이 silently dropped이었음을 추가 발견.
 *
 * 수정 (src/components/tabs/JobChangePanel.tsx):
 * - <ClassCard> JSX에서 player={player} 한 줄 제거.
 *
 * 회귀 가드:
 * - jobName / onSelect / disabled / key prop 보존.
 * - ClassCard 동작 변동 0 (player 본체 read 0건이라 영향 없음).
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 462: <ClassCard> 호출에서 player prop 0건', async () => {
    const source = await readSrc('src/components/tabs/JobChangePanel.tsx');
    const idx = source.indexOf('<ClassCard');
    assert.ok(idx >= 0, '<ClassCard> 호출 존재');
    const jsxEnd = source.indexOf('/>', idx);
    const jsx = source.slice(idx, jsxEnd);
    assert.ok(!/player=\{player\}/.test(jsx), 'player={player} 제거');
    // disabled={player.level < ...}의 player는 expression 내부 active read이므로 보존.
    // prop으로서의 player 전달만 제거됐는지 확인.
    assert.ok(!/^\s*player=\{player\}/m.test(jsx), 'prop player={player} 라인 0건');
});

test('cycle 462: 정합성 가드 — ClassCard destructure에 player 없음', async () => {
    const source = await readSrc('src/components/ClassCard.tsx');
    const fnIdx = source.indexOf('const ClassCard =');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/\bplayer\b/.test(sig), 'ClassCard destructure에 player 0건');
});

test('cycle 462: jobName / onSelect / disabled prop 보존', async () => {
    const source = await readSrc('src/components/tabs/JobChangePanel.tsx');
    const idx = source.indexOf('<ClassCard');
    const jsxEnd = source.indexOf('/>', idx);
    const jsx = source.slice(idx, jsxEnd);
    assert.ok(/jobName=\{job\}/.test(jsx), 'jobName 보존');
    assert.ok(/onSelect=\{/.test(jsx), 'onSelect 보존');
    assert.ok(/disabled=\{/.test(jsx), 'disabled 보존');
});
