import test from 'node:test';
import assert from 'node:assert/strict';

import { DB } from '../src/data/db.js';
import { MSG } from '../src/data/messages.js';
import { isSignatureItem } from '../src/data/signatureItems.js';
import { buildDimensionGraveEvent, getDimensionGraveItemLabel, toDimensionGraveCandidate } from '../src/utils/dimensionGrave.js';
import { getEventChoicePreview } from '../src/utils/eventPresentation.js';

/**
 * 전설 각인 유품이 든 묘비는 이례적인 먹잇감이다 — 위험 대비 보상을 판단할 수 있게 "전설"을 보인다.
 *
 * 공개 묘비 목록(GravePanel, 꺼져 있었다) 시절에는 카드의 "전설" 배지 · `data-has-signature`가 이 일을 했다.
 * 2026-10 Wave 70(소유자 결정)에 다른 플레이어의 묘비는 탐험 이벤트 "다른 차원의 묘비"로 옮겼다 — 같은 판단은 이제
 * 이벤트 카드의 유품 표시와 침공 선택지의 미리보기가 보인다. 판정은 `isSignatureItem` 하나다.
 */

const SIGNATURE = Object.values(DB.ITEMS).flat().find((item) => item && isSignatureItem(item));
const PLAIN = DB.ITEMS.weapons.find((item) => !isSignatureItem(item));
const refFor = (item) => ({ uid: 'other', playerName: '방랑자', level: 30, place: null, itemName: item.name });

test('전제: 카탈로그에 전설 각인 장비와 일반 장비가 있다', () => {
    assert.ok(SIGNATURE, '전설 각인');
    assert.ok(PLAIN, '일반 장비');
});

test('전설 각인 유품은 이벤트 카드와 침공 미리보기에서 "전설"로 보인다', () => {
    const event = buildDimensionGraveEvent(refFor(SIGNATURE));
    const label = MSG.DIMENSION_GRAVE_SIGNATURE_ITEM(SIGNATURE.name);
    assert.equal(getDimensionGraveItemLabel(event.dimensionGrave), label);
    assert.ok(event.desc.includes(label), event.desc);
    assert.equal(getEventChoicePreview(event, 0).text, MSG.DIMENSION_GRAVE_PREVIEW_INVADE(label));
});

test('일반 유품은 이름 그대로다 — "전설"을 붙이지 않는다', () => {
    const event = buildDimensionGraveEvent(refFor(PLAIN));
    assert.equal(getDimensionGraveItemLabel(event.dimensionGrave), PLAIN.name);
    assert.ok(!event.desc.includes(MSG.DIMENSION_GRAVE_SIGNATURE_ITEM(PLAIN.name)));
    assert.equal(getEventChoicePreview(event, 0).text, MSG.DIMENSION_GRAVE_PREVIEW_INVADE(PLAIN.name));
});

test('묘비 문서의 전설 각인 사본도 후보 유품으로 남는다 — 바탕 이름으로', () => {
    const candidate = toDimensionGraveCandidate({ uid: 'other', playerName: '방랑자', items: [{ ...SIGNATURE, id: 'copy', val: 1e9 }] });
    assert.deepEqual(candidate.itemNames, [SIGNATURE.name]);
});
