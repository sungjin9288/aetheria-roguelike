import test from 'node:test';
import assert from 'node:assert/strict';

import { MSG } from '../src/data/messages.ts';
import { isSignatureItem } from '../src/data/signatureItems.ts';
import { AT } from '../src/reducers/actionTypes.ts';
import { GS } from '../src/reducers/gameStates.ts';
import { INITIAL_STATE, gameReducer } from '../src/reducers/gameReducer.ts';
import { getSellPrice } from '../src/utils/equipmentUtils.ts';
import { findItemByName, makeItem } from '../src/utils/gameUtils.ts';
import { getJobPath, getSignatureSaleVerdict } from '../src/utils/signatureSale.ts';
import { validateSynthesis } from '../src/utils/synthesisUtils.ts';

/**
 * 전설 각인(서명) 판매 — 쓸 수 있는 유일한 사본은 보호하고, 쓸모없는 사본은 판다 (2026-09 Wave 28, D4).
 *
 * Wave 28 이전 이 파일은 소스 정규식 가드였다("리듀서가 isSignatureItem 다음에 SIGNATURE_SELL_BLOCKED를
 * 쓴다"). 보호 판정이 공용 유틸(`getSignatureSaleVerdict`)로 옮겨 가며 행동 테스트로 바꿨다 — 실제 리듀서가
 * 무엇을 팔고 무엇을 거부하는지를 단언한다(CLAUDE.md §7 소스 가드 정책).
 *
 * 자연 플레이 감사: 드래곤 나이트 Lv48 가방의 서명 9칸 = 전직 경로 밖 6종 + 중복 3개. 도감은 획득 순간
 * `stats.codex`에 남고 가방은 승천 때 비워지므로, 이 사본들은 이번 런에서도 다음 런에서도 가치가 없었다.
 */

const signature = (name) => {
    const base = findItemByName(name);
    assert.ok(base, `${name}는 아이템 데이터에 있어야 한다`);
    const item = makeItem(base);
    assert.equal(isSignatureItem(item), true, `${name}는 서명이어야 한다(픽스처 비공허)`);
    return item;
};

const shopState = (playerOverrides) => ({
    ...structuredClone(INITIAL_STATE),
    gameState: GS.SHOP,
    logs: [],
    player: {
        ...structuredClone(INITIAL_STATE.player),
        name: '상인 시험',
        level: 60,
        gold: 1000,
        ...playerOverrides,
    },
});

const sell = (state, item) => gameReducer(state, { type: AT.SELL_INVENTORY_ITEM, payload: { itemId: item.id } });

const assertSold = (before, after, item) => {
    assert.equal(after.player.gold, before.player.gold + getSellPrice(item), `${item.name}: 일반 판매가로 팔린다`);
    assert.equal(after.player.inv.some((entry) => entry.id === item.id), false);
    assert.deepEqual(after.player.stats.codex, before.player.stats.codex, '판매는 도감 기록을 건드리지 않는다');
};

const assertProtected = (before, after, item) => {
    assert.equal(after.player.gold, before.player.gold);
    assert.deepEqual(after.player.inv, before.player.inv, `${item.name}: 가방 그대로`);
    assert.deepEqual(
        { type: after.logs.at(-1)?.type, text: after.logs.at(-1)?.text },
        { type: 'warning', text: MSG.SIGNATURE_SELL_BLOCKED(item.name) },
    );
};

test('전직 경로는 현재 직업과 그 뒤의 모든 전직이다 — 앞선 직업은 들어가지 않는다', () => {
    assert.deepEqual([...getJobPath('전사')].sort(), ['나이트', '드래곤 나이트', '버서커', '전사'].sort());
    assert.deepEqual([...getJobPath('드래곤 나이트')], ['드래곤 나이트']);
    assert.equal(getJobPath('모험가').size > 10, true, '모험가는 거의 모든 직업으로 갈 수 있다');
    assert.deepEqual([...getJobPath(undefined)], []);
    assert.deepEqual([...getJobPath('없는 직업')], []);
});

test('[off-path] 지금 직업과 앞으로의 전직 누구도 못 쓰는 서명은 판다 — 드래곤 나이트의 지팡이·대검·방패', () => {
    for (const name of ['천벌의 지팡이', '대지의 심판', '차원 방패 이지스']) {
        const item = signature(name);
        const path = getJobPath('드래곤 나이트');
        assert.equal([...path].some((job) => item.jobs.includes(job)), false, `${name}: 경로 밖이어야 한다(비공허)`);
        const before = shopState({ job: '드래곤 나이트', inv: [item] });
        assert.deepEqual(getSignatureSaleVerdict(item, before.player), { sellable: true, reason: 'off-path' });
        assertSold(before, sell(before, item), item);
    }
});

test('[protected] 앞으로 전직할 직업이 쓸 수 있으면 보호한다 — 전사가 든 나이트 방패', () => {
    const item = signature('차원 방패 이지스');
    assert.equal(item.jobs.includes('전사'), false, '지금 직업은 못 쓴다(비공허)');
    assert.equal(item.jobs.includes('나이트'), true, '전직 후에는 쓴다(비공허)');
    const before = shopState({ job: '전사', inv: [item] });
    assert.deepEqual(getSignatureSaleVerdict(item, before.player), { sellable: false, reason: 'protected' });
    assertProtected(before, sell(before, item), item);
});

test('[protected] 지금 직업이 쓸 수 있는 유일한 사본은 보호한다', () => {
    const item = signature('성검 에테르니아');
    const before = shopState({ job: '나이트', inv: [item] });
    assertProtected(before, sell(before, item), item);
});

test('[duplicate] 같은 이름의 사본이 하나 더 있으면 판다 — 마지막 한 점은 다시 보호된다', () => {
    const first = signature('성검 에테르니아');
    const second = signature('성검 에테르니아');
    const before = shopState({ job: '나이트', inv: [first, second] });
    assert.deepEqual(getSignatureSaleVerdict(first, before.player), { sellable: true, reason: 'duplicate' });
    const once = sell(before, first);
    assertSold(before, once, first);
    assertProtected(once, sell(once, second), second);
});

test('[duplicate] 장착한 사본이 있으면 가방의 사본은 판다', () => {
    const equipped = signature('성검 에테르니아');
    const spare = signature('성검 에테르니아');
    const before = shopState({
        job: '나이트',
        inv: [spare],
        equip: { ...structuredClone(INITIAL_STATE.player.equip), weapon: equipped },
    });
    assertSold(before, sell(before, spare), spare);
});

test('[fail-closed] 직업을 알 수 없으면 경로 밖 판정을 하지 않는다', () => {
    const item = signature('천벌의 지팡이');
    const before = shopState({ job: undefined, inv: [item] });
    assertProtected(before, sell(before, item), item);
});

test('합성은 판매 가능 여부와 무관하게 서명을 재료로 쓰지 않는다', () => {
    const copies = [signature('성검 에테르니아'), signature('성검 에테르니아'), signature('성검 에테르니아')];
    const validation = validateSynthesis(copies, 1_000_000);
    assert.equal(validation.valid, false);
    assert.equal(validation.reason, 'SIGNATURE_INPUT');
});

test('일반 아이템 판매는 그대로다', () => {
    const potion = makeItem(findItemByName('하급 체력 물약'));
    assert.equal(getSignatureSaleVerdict(potion, shopState({ job: '전사', inv: [potion] }).player), null);
    const before = shopState({ job: '전사', inv: [potion] });
    const after = sell(before, potion);
    assert.equal(after.player.gold, before.player.gold + getSellPrice(potion));
    assert.equal(after.player.inv.length, 0);
});
