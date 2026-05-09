import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 433: SignalBadge default `tone = 'neutral'` / `size = 'sm'` redundant 정리
 *   (cycle 222-432 silent dead config 시리즈 192번째 — redundant default annotation
 *   lens 회귀, cycle 364-368/428-429/431-432 패턴, cycle 419 paired completion).
 *
 * 발견 (2 redundant default values):
 * - src/components/SignalBadge.tsx:
 *     `({ tone = 'neutral', size = 'sm', className = '', children, ...rest }: any) => ...`
 * - 호출 사이트 분석 (73 + 0 = 73 호출):
 *     · 모든 73 호출자 size="sm" 명시 (cycle 419 정합성 검증).
 *     · 모든 73 호출자 tone="..." 명시 (tone 미지정 호출 0건 — grep 검증).
 *   → 두 default 모두 도달 불가.
 * - SIZE_CLASS / TONE_CLASS fallback (`|| SIZE_CLASS.sm` / `|| TONE_CLASS.neutral`)
 *   은 보존 (방어용).
 *
 * 패턴 (cycle 222-432 시리즈 192번째):
 * - cycle 419: SIZE_CLASS md/lg 제거 + default sm으로 갱신.
 * - cycle 432: AetherMark default size 제거 (cycle 418 paired completion).
 * - cycle 433: SignalBadge tone/size default 제거 — cycle 419 paired completion.
 *
 * 수정 (src/components/SignalBadge.tsx):
 * - destructure에서 `tone = 'neutral'` → `tone`.
 * - destructure에서 `size = 'sm'` → `size`.
 * - SIZE_CLASS / TONE_CLASS fallback은 그대로 (방어용 + cycle 419 회귀 가드).
 *
 * 회귀 가드:
 * - 73 호출자 모두 명시 전달 → 동작 그대로.
 * - SIZE_CLASS / TONE_CLASS fallback 보존.
 * - cycle 419 SIZE_CLASS md/lg 0건 회귀 가드.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 433: SignalBadge destructure에서 default tone / size 제거', async () => {
    const source = await readSrc('src/components/SignalBadge.tsx');
    const fnIdx = source.indexOf('const SignalBadge =');
    const fnEnd = source.indexOf('=>', fnIdx);
    const block = source.slice(fnIdx, fnEnd);
    assert.ok(!/tone = 'neutral'/.test(block), 'default tone 제거됨');
    assert.ok(!/size = 'sm'/.test(block), 'default size 제거됨');
    assert.ok(/\btone\b/.test(block), 'tone 파라미터 보존');
    assert.ok(/\bsize\b/.test(block), 'size 파라미터 보존');
});

test('cycle 433: 활성 default (className / children / rest) 보존', async () => {
    const source = await readSrc('src/components/SignalBadge.tsx');
    const fnIdx = source.indexOf('const SignalBadge =');
    const fnEnd = source.indexOf('=>', fnIdx);
    const block = source.slice(fnIdx, fnEnd);
    assert.ok(/className = ''/.test(block), "className default 보존");
    assert.ok(/children/.test(block), 'children 보존');
    assert.ok(/\.\.\.rest/.test(block), '...rest 보존');
});

test('cycle 433: SIZE_CLASS / TONE_CLASS fallback 방어용 보존', async () => {
    const source = await readSrc('src/components/SignalBadge.tsx');
    assert.ok(/SIZE_CLASS\[size\] \|\| SIZE_CLASS\.sm/.test(source),
        'SIZE_CLASS fallback 보존');
    assert.ok(/TONE_CLASS\[tone\] \|\| TONE_CLASS\.neutral/.test(source),
        'TONE_CLASS fallback 보존');
});

test('cycle 433: 정합성 가드 — SignalBadge 호출 수 ≤ size="..." 매칭 수', async () => {
    // multi-line JSX와 `>=` 등 expression 안의 `>` 때문에 정확한 개별 호출
    // 매칭은 까다롭다. 대신 전체 카운트로 lower-bound 검증:
    //   - 모든 호출자가 size= 명시했다면 size= 매칭 수 ≥ <SignalBadge 시작 수.
    //   - 동일 카운트 시 dead default 안전.
    const componentDir = path.join(ROOT, 'src/components');
    const files = await readdir(componentDir, { recursive: true });
    let openTagCount = 0;
    let sizeAttrCount = 0;
    for (const f of files) {
        if (!String(f).endsWith('.tsx')) continue;
        const src = await readFile(path.join(componentDir, String(f)), 'utf8').catch(() => '');
        openTagCount += (src.match(/<SignalBadge\b/g) || []).length;
        // SignalBadge 컴포넌트 내부에선 size= prop만 정의되므로 size="..." 카운트는
        // 전체 size= 매칭에서 SIZE_CLASS의 sm: 정의 + size 파라미터 등 5건 정도 빼면 됨.
        // 단순 lower-bound로: <SignalBadge 직후 같은 라인 또는 이후 ~3 라인 내 size=.
        const lines = src.split('\n');
        for (let i = 0; i < lines.length; i++) {
            if (!/<SignalBadge\b/.test(lines[i])) continue;
            // 같은 라인 또는 이어지는 라인에서 size=" 매칭 (다음 사이 닫히는 > 또는 새 JSX 전까지)
            for (let j = i; j < Math.min(lines.length, i + 5); j++) {
                if (/size="[a-z]+"/.test(lines[j])) {
                    sizeAttrCount += 1;
                    break;
                }
                // 다음 라인이 명백히 다른 컴포넌트면 중단
                if (j > i && /<[A-Z]\w/.test(lines[j])) break;
            }
        }
    }
    assert.ok(openTagCount >= 70, `SignalBadge 호출 70+ 건 (실제 ${openTagCount})`);
    assert.equal(openTagCount, sizeAttrCount,
        `모든 호출자 size 명시 (${sizeAttrCount}/${openTagCount})`);
});

test('cycle 419 회귀 가드: SIZE_CLASS md/lg 0건', async () => {
    const source = await readSrc('src/components/SignalBadge.tsx');
    const blockStart = source.indexOf('const SIZE_CLASS');
    const blockEnd = source.indexOf('};', blockStart);
    const block = source.slice(blockStart, blockEnd);
    assert.ok(!/^\s+md:/m.test(block), 'cycle 419 SIZE_CLASS.md 0건 보존');
    assert.ok(!/^\s+lg:/m.test(block), 'cycle 419 SIZE_CLASS.lg 0건 보존');
});

test('cycle 432 회귀 가드: AetherMark default size 0건', async () => {
    const source = await readSrc('src/components/AetherMark.tsx');
    const fnIdx = source.indexOf('const AetherMark =');
    const fnEnd = source.indexOf('=>', fnIdx);
    const block = source.slice(fnIdx, fnEnd);
    assert.ok(!/size = 'md'/.test(block), 'cycle 432 default size 제거 보존');
});
