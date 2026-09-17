import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';

import LegendaryCodex from '../src/components/codex/LegendaryCodex.tsx';
import { getSignaturePityMultiplier, SIGNATURE_PITY } from '../src/utils/signaturePity.ts';
import { renderStatic, makePlayerFixture } from './helpers/render.ts';

/**
 * LegendaryCodex pity status — "reflect" 계층 상시 surface.
 *
 * pity 공명은 boss 조우 시에만 legendary 로그로 노출되어 휘발적이다.
 * 플레이어가 "지금 공명 얼마나 적재돼 있지?"를 확인할 persistent surface가 없다.
 * LegendaryCodex는 플레이어가 legendary 수집 현황을 살피러 들르는 화면이라
 * 자연스러운 지점. 아래 정보를 한 카드로 노출:
 *   - 현재 pity 카운터 (N회)
 *   - 임계값 대비 진행도 또는 활성 배율 +pct%
 *   - threshold 미달일 땐 남은 횟수 안내
 *
 * 계약(렌더 검증, getSignaturePityMultiplier/SIGNATURE_PITY 실제 값으로 교차 검증):
 *   1. player.stats.signaturePity를 읽어 전용 testid(legendary-codex-pity-status) 카드 렌더
 *   2. "공명" 라벨 포함
 *   3. threshold 미달: 적재 N/THRESHOLD + 남은 횟수 안내, +0%
 *   4. threshold 이상: 배율에서 파생된 +pct% 노출
 */

const renderCodexWithPity = (pity) => {
    const base = makePlayerFixture();
    const player = makePlayerFixture({ stats: { ...base.stats, signaturePity: pity } });
    return renderStatic(createElement(LegendaryCodex, { player }));
};

test('pity 미적재(0) 상태 — 공명 카드가 THRESHOLD 안내 문구와 +0%를 보여준다', () => {
    const html = renderCodexWithPity(0);
    assert.ok(html.includes('data-testid="legendary-codex-pity-status"'), 'pity 상태 카드가 렌더링됨');
    assert.ok(html.includes('공명'), '"공명" 라벨 포함');
    assert.ok(html.includes(`보스 ${SIGNATURE_PITY.THRESHOLD}회 연속 무획득 시 배율 상승`), 'THRESHOLD 기반 안내 문구');
    assert.ok(html.includes('+0%'), '미적재 상태에서는 +0% 표시');
    assert.equal(getSignaturePityMultiplier(0), 1.0, '전제: pity 0 배율은 1.0');
});

test('pity가 THRESHOLD 미만으로 적재됐을 때 진행도(N/THRESHOLD)와 남은 횟수를 보여준다', () => {
    const pity = SIGNATURE_PITY.THRESHOLD - 2;
    assert.ok(pity > 0, '테스트 전제: THRESHOLD보다 2 작은 pity는 양수');
    const html = renderCodexWithPity(pity);

    assert.equal(getSignaturePityMultiplier(pity), 1.0, '전제: THRESHOLD 미만은 배율 미적용');
    assert.ok(
        html.includes(`적재 ${pity}/${SIGNATURE_PITY.THRESHOLD} · 임계까지 2회`),
        '실제 SIGNATURE_PITY.THRESHOLD 기반 진행도 문구가 렌더됨',
    );
    assert.ok(html.includes(`data-pity="${pity}"`), 'data-pity 속성이 실제 pity 값을 반영');
});

test('pity가 THRESHOLD 이상이면 실제 배율에서 파생된 +pct%를 렌더링한다', () => {
    const pity = SIGNATURE_PITY.THRESHOLD;
    const expectedMult = getSignaturePityMultiplier(pity);
    assert.ok(expectedMult > 1, '전제: THRESHOLD 도달 시 배율 > 1.0');
    const expectedPct = Math.round((expectedMult - 1) * 100);

    const html = renderCodexWithPity(pity);
    assert.ok(html.includes(`+${expectedPct}%`), 'getSignaturePityMultiplier로 계산한 실제 배율이 렌더에 반영됨');
    assert.ok(html.includes(`보스 ${pity}회 누적`), '활성 상태에서는 누적 횟수 문구로 전환');
    assert.ok(html.includes(`data-pity-mult="${expectedMult}"`), 'data-pity-mult 속성이 실제 배율 값을 반영');
});
