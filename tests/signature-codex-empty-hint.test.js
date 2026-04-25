import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * LegendaryCodex — discoveredCount === 0일 때 educational empty-state.
 *
 * 새 플레이어가 codex를 처음 열면 ??? Lock 아이콘 그리드 + pity 0/THRESHOLD
 * status만 본다. 어디서 나오는지, 어떻게 시작하는지 한 줄도 안내하지 않아
 * 전체 chain의 entry-point에 discovery gap이 있다.
 *
 * 계약:
 *   1. discoveredCount === 0 케이스용 hint banner 렌더 분기 존재
 *   2. data-testid="legendary-codex-empty-hint" 노출
 *   3. "보스" + "전설 각인" 단어 모두 포함 (어디서/뭐가)
 *   4. ✦ 마커 사용 (chain 일관성)
 *   5. gold #f6e7a2 / rgba(246,231,162) 팔레트
 *   6. 발견된 게 1개 이상이면 hint 미표시 (silence over noise) — 조건부 렌더
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('LegendaryCodex defines an empty-state hint banner', async () => {
    const source = await readSrc('src/components/codex/LegendaryCodex.jsx');
    assert.ok(
        /legendary-codex-empty-hint/.test(source),
        'should expose data-testid="legendary-codex-empty-hint"'
    );
});

test('empty-state hint references both 보스 and 전설 각인', async () => {
    const source = await readSrc('src/components/codex/LegendaryCodex.jsx');
    // hint banner 영역 텍스트 검증 — 두 키워드가 source 어디든 등장
    assert.ok(/보스/.test(source), '"보스" 단어가 있어야 어디서 떨어지는지 안내됨');
    assert.ok(/전설 각인/.test(source), '"전설 각인" 단어가 있어야 무엇을 찾는지 명확');
});

test('empty-state hint uses ✦ marker for chain consistency', async () => {
    const source = await readSrc('src/components/codex/LegendaryCodex.jsx');
    // ✦ 마커가 hint 분기 근처에 있어야 함
    const hintBlockMatch = source.match(/legendary-codex-empty-hint[\s\S]{0,900}/);
    assert.ok(hintBlockMatch, 'empty-hint block not found');
    assert.ok(
        /✦/.test(hintBlockMatch[0]),
        'empty-hint banner should include ✦ glyph'
    );
});

test('empty-state hint uses gold palette', async () => {
    const source = await readSrc('src/components/codex/LegendaryCodex.jsx');
    const hintBlockMatch = source.match(/legendary-codex-empty-hint[\s\S]{0,900}/);
    assert.ok(hintBlockMatch);
    assert.ok(
        /#f6e7a2|246,\s*231,\s*162/.test(hintBlockMatch[0]),
        'empty-hint banner should reuse #f6e7a2 / rgba(246,231,162) gold palette'
    );
});

test('empty-state hint render is gated on discoveredCount === 0', async () => {
    const source = await readSrc('src/components/codex/LegendaryCodex.jsx');
    // 조건 표현은 다양할 수 있음 — discoveredCount === 0 또는 !discoveredCount, 둘 중 하나가
    // legendary-codex-empty-hint 블록 직전에 등장해야 한다.
    const gateMatch = source.match(
        /(discoveredCount\s*===\s*0|!discoveredCount|discoveredCount\s*<\s*1)[\s\S]{0,300}legendary-codex-empty-hint/
    );
    assert.ok(
        gateMatch,
        'empty-hint should be conditionally rendered behind discoveredCount === 0 gate'
    );
});
