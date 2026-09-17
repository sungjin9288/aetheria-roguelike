import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';

import LegendaryCodex from '../src/components/codex/LegendaryCodex.tsx';
import { renderStatic, makePlayerFixture } from './helpers/render.ts';

/**
 * LegendaryCodex — discoveredCount === 0일 때 educational empty-state.
 *
 * 새 플레이어가 codex를 처음 열면 ??? Lock 아이콘 그리드 + pity 0/THRESHOLD
 * status만 본다. 어디서 나오는지, 어떻게 시작하는지 한 줄도 안내하지 않아
 * 전체 chain의 entry-point에 discovery gap이 있다.
 *
 * 계약(렌더 검증):
 *   1. discoveredCount === 0 케이스에서 data-testid="legendary-codex-empty-hint" 렌더
 *   2. "보스" + "전설 각인" 단어 모두 포함 (어디서/뭐가)
 *   3. ✦ 마커 사용 (chain 일관성)
 *   4. gold #f6e7a2 팔레트
 *   5. 발견된 게 1개 이상이면 hint 미표시 (silence over noise)
 */

const renderCodex = (player) => renderStatic(createElement(LegendaryCodex, { player }));

test('발견 0개일 때 empty-state hint를 렌더링한다', () => {
    const player = makePlayerFixture();
    const html = renderCodex(player);

    assert.ok(html.includes('data-testid="codex-legendary"'), 'LegendaryCodex 자체는 정상 렌더링');
    assert.ok(html.includes('data-testid="legendary-codex-empty-hint"'), 'empty-hint 배너가 렌더됨');
});

test('empty-state hint는 보스 + 전설 각인 두 키워드를 모두 안내한다', () => {
    const html = renderCodex(makePlayerFixture());
    const hintStart = html.indexOf('data-testid="legendary-codex-empty-hint"');
    assert.notEqual(hintStart, -1);
    const hintBlock = html.slice(hintStart, hintStart + 900);

    assert.ok(hintBlock.includes('보스'), '"보스" 단어가 있어야 어디서 떨어지는지 안내됨');
    assert.ok(hintBlock.includes('전설 각인'), '"전설 각인" 단어가 있어야 무엇을 찾는지 명확');
});

test('empty-state hint는 ✦ 마커 + gold 팔레트를 사용한다', () => {
    const html = renderCodex(makePlayerFixture());
    const hintStart = html.indexOf('data-testid="legendary-codex-empty-hint"');
    const hintBlock = html.slice(hintStart, hintStart + 900);

    assert.ok(hintBlock.includes('✦'), 'empty-hint 배너가 ✦ 글리프를 포함');
    assert.ok(hintBlock.includes('f6e7a2'), 'empty-hint 배너가 gold 팔레트(#f6e7a2)를 재사용');
});

test('발견된 전설 각인이 1개 이상이면 empty-hint가 사라진다 (silence over noise)', () => {
    const base = makePlayerFixture();
    const discoveredPlayer = makePlayerFixture({
        stats: {
            ...base.stats,
            codex: { ...base.stats.codex, weapons: { ...base.stats.codex.weapons, '성검 에테르니아': true } },
        },
    });

    const html = renderCodex(discoveredPlayer);
    assert.ok(!html.includes('data-testid="legendary-codex-empty-hint"'), '발견 1개 이상이면 empty-hint 미표시');
    assert.ok(html.includes('data-testid="codex-legendary"'), '컴포넌트 자체는 정상 렌더링 유지');
});
