import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { MIRROR_NODES } from '../src/data/mirror.js';
import {
    getMirrorCompletion,
    getMirrorEffectLabel,
    getMirrorInvestmentPreview,
    MIRROR_PATHS,
} from '../src/utils/mirrorJourney.js';

test('거울의 모든 성장은 네 경로에 한 번씩만 배치된다', () => {
    assert.deepEqual(MIRROR_PATHS.map((path) => path.label), ['새 여정', '탐험', '생존', '순환']);

    const assignedNodeIds = MIRROR_PATHS.flatMap((path) => path.nodeIds);
    assert.equal(new Set(assignedNodeIds).size, assignedNodeIds.length);
    assert.deepEqual(
        [...assignedNodeIds].sort(),
        MIRROR_NODES.map((node) => node.id).sort(),
    );
});

test('투자 미리보기는 실제 거울 효과와 비용을 현재와 다음 단계로 비교한다', () => {
    const preview = getMirrorInvestmentPreview('start_gold', { start_gold: 1 }, 220);

    assert.ok(preview);
    assert.equal(preview.currentEffect, '시작 골드 +100');
    assert.equal(preview.nextEffect, '시작 골드 +200');
    assert.equal(preview.nextCost, 120);
    assert.equal(preview.remainingEssence, 100);
    assert.equal(preview.shortage, 0);
    assert.equal(preview.canAfford, true);
});

test('부족한 정수와 완료된 성장은 투자 불가 상태를 분명하게 계산한다', () => {
    const shortage = getMirrorInvestmentPreview('revive', {}, 180);
    const maxed = getMirrorInvestmentPreview('start_boot_extra', { start_boot_extra: 1 }, 999);

    assert.equal(shortage?.shortage, 320);
    assert.equal(shortage?.canAfford, false);
    assert.equal(maxed?.maxed, true);
    assert.equal(maxed?.nextCost, null);
    assert.equal(maxed?.nextEffect, null);
});

test('효과 문구와 전체 진행도는 플레이어가 읽는 표현으로 계산된다', () => {
    assert.equal(getMirrorEffectLabel('relic_pity', 2), '유물 발견 누적 보정 +50%');
    assert.equal(getMirrorEffectLabel('rest_discount', 2), '휴식 비용 -40%');
    assert.equal(getMirrorEffectLabel('revive', 1), '치명상 1회 방어 · 생명 30% 회복');
    assert.deepEqual(getMirrorCompletion({ start_gold: 2, revive: 1 }), { completed: 3, total: 13 });
});

test('거울 화면은 작은 글자와 즉시 구매를 제거하고 고정 결정 영역을 사용한다', async () => {
    const source = await readFile(new URL('../src/components/MirrorPanel.tsx', import.meta.url), 'utf8');

    assert.doesNotMatch(source, /text-\[9px\]|Lv\.|pity/);
    assert.match(source, /data-testid="mirror-scroll-region"/);
    assert.match(source, /data-testid="mirror-action-footer"/);
    assert.match(source, /data-testid="mirror-confirm"/);
    assert.equal((source.match(/onPurchase\?\./g) || []).length, 1, '구매 콜백은 고정 결정 버튼에서만 호출');
});
