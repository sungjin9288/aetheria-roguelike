import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 567: SignatureBadge `size = 10` default unreachable
 *   (cycle 222-566 silent dead config 시리즈 307번째 — redundant default annotation
 *   청소 메가 시리즈 60번째). component prop default cleanup.
 *
 * 발견 (1 default unreachable):
 * - src/components/icons/SignatureBadge.tsx (line 34):
 *     const SignatureBadge = ({ item, size = 10 }: any) => {...};
 * - 호출 사이트 (1 caller):
 *     · ItemIcon.tsx:129 — <SignatureBadge item={item} size={badgeSize} />
 *     · 다른 caller 0건 (test caller 0건).
 * - 결과: size 항상 명시 전달. default 10 도달 불가.
 *
 * 패턴 (cycle 222-566 시리즈 307번째):
 * - cycle 502-566: default 청소 메가 시리즈 65사이클.
 * - cycle 567: components/icons/ private helper — cycle 466 외부 보조 클래스
 *   cleanup에 이은 동일 모듈 추가 cleanup.
 *
 * 수정 (src/components/icons/SignatureBadge.tsx):
 * - signature에서 size = 10 → size.
 * - body의 size 사용처 보존.
 *
 * 회귀 가드:
 * - 1 production callsite (ItemIcon) 동작 그대로.
 * - body hasDedicatedSignatureArt / getSignatureMetadata 처리 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 567: SignatureBadge signature에서 size default 0건', async () => {
    const source = await readSrc('src/components/icons/SignatureBadge.tsx');
    const fnIdx = source.indexOf('const SignatureBadge = ');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/size\s*=\s*10/.test(sig),
        'SignatureBadge size default 10 제거');
    assert.ok(/\bsize\b/.test(sig), 'size 파라미터 자체는 보존');
});

test('cycle 567: 정합성 가드 — ItemIcon callsite 보존', async () => {
    const source = await readSrc('src/components/icons/ItemIcon.tsx');
    assert.ok(/<SignatureBadge item=\{item\} size=\{badgeSize\} \/>/.test(source),
        'ItemIcon <SignatureBadge> callsite 보존');
});

test('cycle 567: body hasDedicatedSignatureArt 처리 보존', async () => {
    const source = await readSrc('src/components/icons/SignatureBadge.tsx');
    assert.ok(/if \(!item \|\| !hasDedicatedSignatureArt\(item\)\) return null/.test(source),
        'hasDedicatedSignatureArt 가드 보존');
    assert.ok(/getSignatureMetadata\(item\)/.test(source),
        'getSignatureMetadata 호출 보존');
});

test('cycle 567: cycle 502-566 회귀 가드 — default 청소 시리즈 보존', async () => {
    const ca = await readSrc('src/hooks/gameActions/characterActions.ts');
    assert.ok(!/start: \(name: any, gender:\s*any\s*=\s*'male'/.test(ca),
        "cycle 566 start gender default 'male' 0건");

    const stp = await readSrc('src/components/SkillTreePreview.tsx');
    assert.ok(!/const SkillTreePreview = \({ player, actions\s*=\s*null/.test(stp),
        'cycle 565 SkillTreePreview actions default 0건');
});
