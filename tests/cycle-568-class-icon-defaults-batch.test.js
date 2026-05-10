import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 568: ClassIcon `size = 28` + `tier = 0` defaults batch unreachable
 *   (cycle 222-567 silent dead config 시리즈 308번째 — redundant default annotation
 *   청소 메가 시리즈 61번째). component prop default cleanup.
 *
 * 발견 (2 defaults batch):
 * - src/components/icons/ClassIcon.tsx (line 48):
 *     const ClassIcon = ({ className: jobName, size = 28, tier = 0 }: any) => {...};
 * - 호출 사이트 (4 callers, 모두 명시 전달):
 *     · SkillTreePreview.tsx:145 — <ClassIcon size={28} tier={...} />
 *     · ClassTree.tsx:58 — <ClassIcon size={24} tier={tier} />
 *     · ClassCard.tsx:54 — <ClassIcon size={28} tier={tier} />
 *     · JobChangePanel.tsx:43 — <ClassIcon size={30} tier={...} />
 * - 결과: size / tier 항상 명시 전달. 두 default 모두 도달 불가.
 *   body의 TIER_COLORS[tier] ?? TIER_COLORS[0] nullish fallback은 별개 보존.
 *
 * 패턴 (cycle 222-567 시리즈 308번째):
 * - cycle 502-567: default 청소 메가 시리즈 66사이클.
 * - cycle 568: components/icons/ — cycle 463/464에 이은 동일 모듈 cleanup.
 *
 * 수정 (src/components/icons/ClassIcon.tsx):
 * - signature에서 size = 28 → size.
 * - signature에서 tier = 0 → tier.
 * - body의 TIER_COLORS[tier] ?? TIER_COLORS[0] nullish fallback 보존.
 *
 * 회귀 가드:
 * - 4 production callsite 동작 그대로.
 * - body CLASS_PATHS / TIER_COLORS 처리 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 568: ClassIcon signature에서 2 defaults 0건', async () => {
    const source = await readSrc('src/components/icons/ClassIcon.tsx');
    const fnIdx = source.indexOf('const ClassIcon = ');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/size\s*=\s*28/.test(sig),
        'ClassIcon size default 28 제거');
    assert.ok(!/tier\s*=\s*0/.test(sig),
        'ClassIcon tier default 0 제거');
});

test('cycle 568: 정합성 가드 — 4 production callsite 보존', async () => {
    const stp = await readSrc('src/components/SkillTreePreview.tsx');
    assert.ok(/<ClassIcon className=\{player\.job\} size=\{28\} tier=\{currentClass\?\.tier \|\| 0\}/.test(stp),
        'SkillTreePreview <ClassIcon> callsite 보존');

    const ct = await readSrc('src/components/ClassTree.tsx');
    assert.ok(/<ClassIcon className=\{node\.name\} size=\{24\} tier=\{tier\}/.test(ct),
        'ClassTree <ClassIcon> callsite 보존');

    const cc = await readSrc('src/components/ClassCard.tsx');
    assert.ok(/<ClassIcon className=\{jobName\} size=\{28\} tier=\{tier\}/.test(cc),
        'ClassCard <ClassIcon> callsite 보존');

    const jcp = await readSrc('src/components/tabs/JobChangePanel.tsx');
    assert.ok(/<ClassIcon className=\{player\.job\} size=\{30\} tier=\{current\?\.tier \|\| 0\}/.test(jcp),
        'JobChangePanel <ClassIcon> callsite 보존');
});

test('cycle 568: body TIER_COLORS nullish fallback 보존', async () => {
    const source = await readSrc('src/components/icons/ClassIcon.tsx');
    assert.ok(/TIER_COLORS\[tier\] \?\? TIER_COLORS\[0\]/.test(source),
        'TIER_COLORS[tier] ?? TIER_COLORS[0] nullish fallback 보존');
    assert.ok(/CLASS_PATHS\[jobName\] \|\| CLASS_PATHS\['모험가'\]/.test(source),
        "CLASS_PATHS jobName fallback 보존");
});

test('cycle 568: cycle 502-567 회귀 가드 — default 청소 시리즈 보존', async () => {
    const sb = await readSrc('src/components/icons/SignatureBadge.tsx');
    assert.ok(!/const SignatureBadge = \({ item, size\s*=\s*10/.test(sb),
        'cycle 567 SignatureBadge size default 0건');

    const ca = await readSrc('src/hooks/gameActions/characterActions.ts');
    assert.ok(!/start: \(name: any, gender:\s*any\s*=\s*'male'/.test(ca),
        'cycle 566 start gender default 0건');
});
