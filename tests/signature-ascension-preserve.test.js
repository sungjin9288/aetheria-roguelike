import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';

import AscensionScreen from '../src/components/AscensionScreen.tsx';
import { getSignatureDiscoveryProgress } from '../src/data/signatureItems.ts';
import { renderStatic, makePlayerFixture } from './helpers/render.ts';

/**
 * AscensionScreen — signature codex 보존을 명시적으로 노출.
 *
 * progressionHandlers.ASCEND는 codex를 보존하지만, AscensionScreen은
 * "런 진행도는 초기화 / 누적 통계는 유지"라는 generic 문구만 보여줘 플레이어가
 * "내가 모은 전설 각인이 사라지나?"라는 trust 안락사 모먼트를 겪는다.
 *
 * 계약(렌더 검증):
 *   1. discoveredCount > 0일 때만 signature 보존 라인 렌더 (silence over noise)
 *   2. data-testid="ascension-signature-preserve" 노출 + 발견 수치 반영
 *   3. "전설 각인" + "보존|유지" 키워드
 *   4. ✦ 마커 + gold 팔레트 (chain 일관성)
 */

const renderAscension = (player) => renderStatic(createElement(AscensionScreen, { player }));

const withDiscoveredSignature = () => {
    const base = makePlayerFixture();
    return makePlayerFixture({
        stats: {
            ...base.stats,
            codex: { ...base.stats.codex, weapons: { ...base.stats.codex.weapons, '성검 에테르니아': true } },
        },
    });
};

test('발견한 전설 각인이 없으면 보존 배너를 렌더링하지 않는다 (discoveredCount === 0 게이트)', () => {
    const player = makePlayerFixture();
    assert.equal(getSignatureDiscoveryProgress(player).discovered, 0);

    const html = renderAscension(player);
    assert.ok(html.includes('data-testid="ascension-screen"'), 'AscensionScreen 자체는 정상 렌더링');
    assert.ok(!html.includes('data-testid="ascension-signature-preserve"'), '발견 0개면 보존 배너 미노출');
});

test('전설 각인을 발견했으면 보존 배너를 실제로 렌더링하고 발견 수치를 반영한다', () => {
    const player = withDiscoveredSignature();
    const progress = getSignatureDiscoveryProgress(player);
    assert.equal(progress.discovered, 1);

    const html = renderAscension(player);
    assert.ok(html.includes('data-testid="ascension-signature-preserve"'), '보존 배너 노드가 렌더링됨');
    assert.ok(html.includes('전설 각인'), '"전설 각인" 문구 포함');
    assert.ok(/보존|유지/.test(html), '보존/유지 키워드로 안전함을 전달');
    assert.ok(html.includes(`${progress.discovered}/${progress.total} 보존`), '실제 발견 수치가 렌더된 문구에 반영됨');
});

test('보존 배너는 ✦ 마커 + gold 팔레트(#f6e7a2)를 사용한다 (chain 일관성)', () => {
    const html = renderAscension(withDiscoveredSignature());
    const bannerStart = html.indexOf('data-testid="ascension-signature-preserve"');
    assert.notEqual(bannerStart, -1);
    const bannerBlock = html.slice(Math.max(0, bannerStart - 400), bannerStart + 400);
    assert.ok(bannerBlock.includes('✦'), '✦ 글리프 포함');
    assert.ok(bannerBlock.includes('f6e7a2'), 'gold 팔레트(#f6e7a2) 사용');
});
