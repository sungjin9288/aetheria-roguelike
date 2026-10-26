import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import {
    getCrystalExchangeOffers,
    getCrystalSources,
} from '../src/utils/crystalExchange.js';

const buildPlayer = (overrides = {}) => ({
    premiumCurrency: 80,
    maxInv: 25,
    reviveTokens: 1,
    stats: {
        synthProtects: 2,
        cosmeticTitles: [],
    },
    ...overrides,
});

test('교환 항목은 현재 상태와 교환 후 상태를 실제 비용으로 계산한다', () => {
    const offers = getCrystalExchangeOffers(buildPlayer());
    const bag = offers.find((offer) => offer.id === 'inv_expand');
    const protection = offers.find((offer) => offer.id === 'synth_protect');
    const revive = offers.find((offer) => offer.id === 'revive');

    assert.deepEqual(
        [bag.currentLabel, bag.nextLabel, bag.cost, bag.canExchange],
        ['25칸', '30칸', 50, true],
    );
    assert.deepEqual(
        [protection.currentLabel, protection.nextLabel, protection.cost, protection.canExchange],
        ['2개', '3개', 30, true],
    );
    assert.deepEqual(
        [revive.currentLabel, revive.nextLabel, revive.cost, revive.canExchange],
        ['1개', '2개', 20, true],
    );
});

test('잔액 부족과 보유 칭호는 교환 전에 분명히 차단된다', () => {
    const offers = getCrystalExchangeOffers(buildPlayer({
        premiumCurrency: 0,
        stats: {
            synthProtects: 2,
            cosmeticTitles: ['title_stargazer'],
        },
    }));
    const bag = offers.find((offer) => offer.id === 'inv_expand');
    const ownedTitle = offers.find((offer) => offer.id === 'title_stargazer');

    assert.equal(bag.canExchange, false);
    assert.equal(bag.shortage, 50);
    assert.equal(ownedTitle.owned, true);
    assert.equal(ownedTitle.canExchange, false);
    assert.equal(ownedTitle.currentLabel, '보유 중');
});

test('크리스탈 획득처는 실제 보상 데이터의 범위를 사용한다', () => {
    assert.deepEqual(
        getCrystalSources().map(({ id, rewardLabel }) => [id, rewardLabel]),
        [
            ['weekly', '5~10개'],
            ['codex', '5~50개'],
            ['achievements', '20~100개'],
            ['discoveries', '10~15개'],
        ],
    );
});

test('교환소는 잔액과 무관하게 마을 시설에서 열리고 확정 버튼만 소비를 실행한다', async () => {
    // 소유자 결정 2026-10-26 D2(UX-04): 진입점은 설정 탭의 '장기 성장' 칸이 아니라 마을 시설이다(안전지대에서만 그려진다).
    const { buildControlButtons } = await import('../src/components/control/controlButtons.ts');
    let opened = 0;
    const { buttonByKey } = buildControlButtons({ showGraveRecovery: false, onOpenCrystalExchange: () => { opened += 1; } });
    const crystal = buttonByKey.get('crystal');
    assert.ok(crystal, '마을 시설에 교환소 단추가 있다');
    assert.equal(crystal.disabled, false, '잔액과 무관하게 눌린다');
    crystal.onClick();
    assert.equal(opened, 1, '누르면 교환소를 연다');
    assert.equal(buildControlButtons({ showGraveRecovery: false }).buttonByKey.get('crystal').disabled, true, '여는 곳이 없으면 꺼진다');

    const systemTab = await readFile(new URL('../src/components/tabs/SystemTab.tsx', import.meta.url), 'utf8');
    const gameRoot = await readFile(new URL('../src/components/app/GameRoot.tsx', import.meta.url), 'utf8');
    const exchange = await readFile(new URL('../src/components/PremiumShop.tsx', import.meta.url), 'utf8');

    // 부재 불변식: 설정 탭의 두 번째 진입점이 되돌아오지 않는다.
    assert.doesNotMatch(systemTab, /open-crystal-exchange|onOpenCrystalExchange/);
    assert.match(gameRoot, /onOpenCrystalExchange=\{\(\) => setPremiumShopOpen\(true\)\}/);
    assert.match(exchange, /data-testid="crystal-exchange-confirm"/);
    assert.match(exchange, /onClick=\{confirmExchange\}/);
    assert.doesNotMatch(exchange, /첫 보스|프레스티지/);
});
