import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 571: MonsterIcon 3 defaults batch unreachable
 *   (cycle 222-570 silent dead config 시리즈 310번째 — redundant default annotation
 *   청소 메가 시리즈 63번째). single-cycle 3-default batch.
 *
 * 발견 (3 defaults batch):
 * - src/components/icons/MonsterIcon.tsx (line 54):
 *     const MonsterIcon = ({ name, discovered = false, isBoss = false,
 *         size = 32 }: any) => {...};
 * - 호출 사이트 (2 callers):
 *     · MonsterCodex:98 — <MonsterIcon name={m.name} discovered={m.encountered}
 *       isBoss={m.isBoss} size={24} />
 *     · MonsterCodex:121 — <MonsterIcon name={m.name} discovered
 *       isBoss={m.isBoss} size={28} />
 * - 결과: discovered / isBoss / size 항상 명시 전달. 3 defaults 모두 도달 불가.
 *
 * 패턴 (cycle 222-570 시리즈 310번째):
 * - cycle 502-570: default 청소 메가 시리즈 69사이클.
 * - cycle 571: components/icons/ 시리즈 4번째 (cycle 567/568/569에 이은).
 *   single-cycle 3-default batch.
 *
 * 수정 (src/components/icons/MonsterIcon.tsx):
 * - signature에서 discovered = false → discovered.
 * - signature에서 isBoss = false → isBoss.
 * - signature에서 size = 32 → size.
 * - body 동작 보존.
 *
 * 회귀 가드:
 * - 2 production callsite 동작 그대로.
 * - body SILHOUETTE_PATHS / boss/humanoid 분기 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 571: MonsterIcon signature에서 3 defaults 0건', async () => {
    const source = await readSrc('src/components/icons/MonsterIcon.tsx');
    const fnIdx = source.indexOf('const MonsterIcon = ');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/discovered\s*=\s*false/.test(sig),
        'MonsterIcon discovered default false 제거');
    assert.ok(!/isBoss\s*=\s*false/.test(sig),
        'MonsterIcon isBoss default false 제거');
    assert.ok(!/size\s*=\s*32/.test(sig),
        'MonsterIcon size default 32 제거');
});

test('cycle 571: 정합성 가드 — 2 production callsite 보존', async () => {
    const source = await readSrc('src/components/codex/MonsterCodex.tsx');
    assert.ok(/<MonsterIcon name=\{m\.name\} discovered=\{m\.encountered\} isBoss=\{m\.isBoss\} size=\{24\}/.test(source),
        'MonsterCodex:98 <MonsterIcon> callsite 보존');
    assert.ok(/<MonsterIcon name=\{m\.name\} discovered isBoss=\{m\.isBoss\} size=\{28\}/.test(source),
        'MonsterCodex:121 <MonsterIcon> callsite 보존');
});

test('cycle 571: body SILHOUETTE_PATHS 분기 보존', async () => {
    const source = await readSrc('src/components/icons/MonsterIcon.tsx');
    assert.ok(/const type = isBoss \? 'boss' : getMonsterType\(name\)/.test(source),
        "isBoss ? 'boss' : getMonsterType ternary 보존");
    assert.ok(/SILHOUETTE_PATHS\[type\] \|\| SILHOUETTE_PATHS\.humanoid/.test(source),
        'SILHOUETTE_PATHS humanoid fallback 보존');
});

test('cycle 571: cycle 502-570 회귀 가드 — default 청소 시리즈 보존', async () => {
    const sti = await readSrc('src/components/icons/SkillTypeIcon.tsx');
    assert.ok(!/const SkillTypeIcon = \({ type, size\s*=\s*14/.test(sti),
        'cycle 569 SkillTypeIcon size default 0건');

    const ci = await readSrc('src/components/icons/ClassIcon.tsx');
    assert.ok(!/const ClassIcon = \({ className: jobName, size\s*=\s*28/.test(ci),
        'cycle 568 ClassIcon size default 0건');
});
