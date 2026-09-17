import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { BALANCE, RARITY_CLASSES } from '../src/data/constants.js';
import { MSG } from '../src/data/messages.js';
import * as titles from '../src/data/titles.js';

/**
 * A3 (2026-09 감사 G6): 희귀도 표현 단일 모듈.
 *
 * 이전 상태 — 같은 개념이 5원천으로 흩어져 있었다.
 *   1. BALANCE.RARITY_COLORS       — hex (인라인 스타일/아이콘)
 *   2. RARITY_CLASSES              — Tailwind 클래스
 *   3. titles.ts가 2를 `RARITY_COLORS`라는 1과 같은 이름으로 재수출 (함정)
 *   4. MSG.RARITY_LABEL의 축자 복사본 3개 (BuildAdvicePanel / RelicChoicePanel / CraftingPanel)
 *   5. BuildAdvicePanel의 드리프트된 Tailwind 복사본 (common: text-slate-400)
 *
 * 이제 hex는 BALANCE.RARITY_COLORS, Tailwind는 RARITY_CLASSES, 한국어 라벨은
 * MSG.RARITY_LABEL 하나씩만 남는다.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

test('A3: titles.ts가 RARITY_COLORS 별칭을 재수출하지 않는다', async () => {
    assert.equal(titles.RARITY_COLORS, undefined,
        'Tailwind 맵을 hex 맵과 같은 이름으로 재수출하는 함정 제거');

    const source = await readSrc('src/data/titles.ts');
    assert.doesNotMatch(source, /export \{ RARITY_CLASSES as RARITY_COLORS \}/,
        '별칭 re-export 재도입 금지');
});

test('A3: hex 맵과 Tailwind 맵이 이름·내용 모두 구분된다', () => {
    for (const rarity of RARITIES) {
        assert.match(BALANCE.RARITY_COLORS[rarity], /^#[0-9a-f]{6}$/i,
            `BALANCE.RARITY_COLORS.${rarity}는 hex`);
        assert.match(RARITY_CLASSES[rarity], /^text-/,
            `RARITY_CLASSES.${rarity}는 Tailwind 클래스`);
    }
    // 드리프트되어 있던 값 — 공용 맵의 common은 text-slate-300 (BuildAdvicePanel 복사본은 400이었다)
    assert.equal(RARITY_CLASSES.common, 'text-slate-300');
});

test('A3: 한국어 희귀도 라벨은 MSG.RARITY_LABEL 하나뿐이다', async () => {
    for (const rarity of RARITIES) {
        assert.equal(typeof MSG.RARITY_LABEL[rarity], 'string');
    }

    const copies = [
        'src/components/BuildAdvicePanel.tsx',
        'src/components/RelicChoicePanel.tsx',
        'src/components/tabs/CraftingPanel.tsx',
    ];
    for (const relPath of copies) {
        const source = await readSrc(relPath);
        assert.doesNotMatch(source, /const RARITY_LABEL/,
            `${relPath}: 로컬 RARITY_LABEL 복사본 재도입 금지`);
        assert.match(source, /MSG\.RARITY_LABEL/,
            `${relPath}: MSG.RARITY_LABEL 사용`);
    }
});

test('A3: Tailwind 희귀도 색은 constants의 RARITY_CLASSES를 직접 import한다', async () => {
    const consumers = [
        ['src/components/BuildAdvicePanel.tsx', '../data/constants'],
        ['src/components/RelicChoicePanel.tsx', '../data/constants'],
        ['src/components/tabs/SystemTab.tsx', '../../data/constants'],
    ];
    for (const [relPath, from] of consumers) {
        const source = await readSrc(relPath);
        assert.match(source, new RegExp(`RARITY_CLASSES[^\\n]*from '${from.replace(/\./g, '\\.')}'`),
            `${relPath}: constants에서 RARITY_CLASSES 직접 import`);
        assert.doesNotMatch(source, /RARITY_COLORS/,
            `${relPath}: 별칭 이름 사용 금지 (hex 맵과 혼동)`);
    }

    const advice = await readSrc('src/components/BuildAdvicePanel.tsx');
    assert.doesNotMatch(advice, /const RARITY_COLOR\b/,
        '드리프트된 로컬 Tailwind 맵 재도입 금지');
});

test('A3: GravePanel의 tierColor는 희귀도가 아니라 tier 기반이므로 유지된다', async () => {
    // 의도적 예외 — item.tier(1~5) 사다리이고 테두리 클래스까지 함께 반환한다.
    // 희귀도 맵과 개념이 다르므로 통합 대상이 아니다.
    const source = await readSrc('src/components/GravePanel.tsx');
    assert.match(source, /const tierColor = \(item: any\) => \{/);
    assert.match(source, /item\?\.tier \|\| 1\) >= 5/);
    assert.doesNotMatch(source, /rarity/,
        'tierColor는 rarity를 참조하지 않는다 (tier 전용)');
});
