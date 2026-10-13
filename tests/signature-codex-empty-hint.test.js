import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';

import LegendaryCodex from '../src/components/codex/LegendaryCodex.tsx';
import { renderStatic, makePlayerFixture } from './helpers/render.ts';

/**
 * LegendaryCodex — 발견 0개 화면.
 *
 * 2026-10 Wave 103 (소유자 결정 §107.6 "전설 각인 획득처는 얻은 뒤에만 공개"): 첫 각인 전에는 어디서 나오는지
 * (보스 · 공명 임계)를 안내하지 않는다. 잠긴 ??? 칸과 0/N 수집 수만 보인다. 이전 계약(빈 화면 안내 배너 ·
 * 보스 키워드)은 의도적으로 뒤집었다.
 */

const renderCodex = (player) => renderStatic(createElement(LegendaryCodex, { player }));

test('발견 0개일 때 획득처 안내 배너도 공명 카드도 렌더링하지 않는다', () => {
    const html = renderCodex(makePlayerFixture());
    assert.ok(html.includes('data-testid="codex-legendary"'), 'LegendaryCodex 자체는 정상 렌더링');
    assert.ok(!html.includes('data-testid="legendary-codex-empty-hint"'), '획득처 안내 배너 없음');
    assert.ok(!html.includes('data-testid="legendary-codex-pity-status"'), '보스 연속 무획득 공명 카드 없음(획득처를 말한다)');
    assert.ok(!html.includes('보스'), '발견 전 화면은 보스를 말하지 않는다');
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
