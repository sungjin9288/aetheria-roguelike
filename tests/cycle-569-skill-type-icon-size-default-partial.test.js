import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 569: SkillTypeIcon `size = 14` default unreachable (partial cleanup)
 *   (cycle 222-568 silent dead config 시리즈 309번째 — redundant default annotation
 *   청소 메가 시리즈 62번째). partial cleanup pattern (cycle 542 재적용).
 *
 * 발견 (1 default unreachable, 1 default reachable 보존):
 * - src/components/icons/SkillTypeIcon.tsx (line 39):
 *     const SkillTypeIcon = ({ type, size = 14, className = '' }: any) => {...};
 * - 호출 사이트 (4 callers):
 *     · SkillTreePreview:83 — <SkillTypeIcon type={skill.type} size={10} className="..." />
 *     · MonsterCodex:104 — <SkillTypeIcon type={m.weakness} size={12} className="..." />
 *     · MonsterCodex:155 — <SkillTypeIcon type={m.weakness} size={11} /> (className 미전달)
 *     · MonsterCodex:161 — <SkillTypeIcon type={m.resistance} size={11} /> (className 미전달)
 * - 결과:
 *     · size 4 callers 모두 명시 → default 14 도달 불가.
 *     · className 2/4 callers 미전달 → default '' REACHABLE 보존 필수.
 *
 * 패턴 (cycle 222-568 시리즈 309번째):
 * - cycle 502-568: default 청소 메가 시리즈 67사이클.
 * - cycle 569: components/icons/ partial cleanup — cycle 542/553 partial pattern
 *   재적용. component prop별 reachability 분리.
 *
 * 수정 (src/components/icons/SkillTypeIcon.tsx):
 * - signature에서 size = 14 → size.
 * - signature에서 className = '' 보존 (2 callers reachable).
 * - body 동작 보존.
 *
 * 회귀 가드:
 * - 4 production callsite 동작 그대로.
 * - body TYPE_PATHS / TYPE_COLORS 처리 보존.
 * - className default 보존 (reachable).
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 569: SkillTypeIcon signature에서 size default 0건', async () => {
    const source = await readSrc('src/components/icons/SkillTypeIcon.tsx');
    const fnIdx = source.indexOf('const SkillTypeIcon = ');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/size\s*=\s*14/.test(sig),
        'SkillTypeIcon size default 14 제거');
});

test("cycle 569: className default 보존 (reachable, partial cleanup)", async () => {
    const source = await readSrc('src/components/icons/SkillTypeIcon.tsx');
    const fnIdx = source.indexOf('const SkillTypeIcon = ');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(/className\s*=\s*''/.test(sig),
        "className default '' 보존 (MonsterCodex:155/161 미전달이라 reachable)");
});

test('cycle 569: 정합성 가드 — 4 production callsite 보존', async () => {
    const stp = await readSrc('src/components/SkillTreePreview.tsx');
    assert.ok(/<SkillTypeIcon type=\{skill\.type\} size=\{10\} className="mr-0\.5 -mt-px"/.test(stp),
        'SkillTreePreview <SkillTypeIcon> callsite 보존');

    const mc = await readSrc('src/components/codex/MonsterCodex.tsx');
    assert.ok(/<SkillTypeIcon type=\{m\.weakness\} size=\{12\} className="ml-auto shrink-0"/.test(mc),
        'MonsterCodex:104 <SkillTypeIcon> callsite 보존');
    assert.ok(/<SkillTypeIcon type=\{m\.weakness\} size=\{11\} \/>/.test(mc),
        'MonsterCodex:155 <SkillTypeIcon> callsite 보존 (className 미전달)');
    assert.ok(/<SkillTypeIcon type=\{m\.resistance\} size=\{11\} \/>/.test(mc),
        'MonsterCodex:161 <SkillTypeIcon> callsite 보존 (className 미전달)');
});

test('cycle 569: cycle 502-568 회귀 가드 — default 청소 시리즈 보존', async () => {
    const ci = await readSrc('src/components/icons/ClassIcon.tsx');
    assert.ok(!/const ClassIcon = \({ className: jobName, size\s*=\s*28/.test(ci),
        'cycle 568 ClassIcon size default 0건');

    const sb = await readSrc('src/components/icons/SignatureBadge.tsx');
    assert.ok(!/const SignatureBadge = \({ item, size\s*=\s*10/.test(sb),
        'cycle 567 SignatureBadge size default 0건');
});
