import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ACHIEVEMENTS } from '../src/data/quests.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

/**
 * cycle 215: claimAchievement에 premiumCurrency 보상 핸들러 추가
 *   (cycle 209 quest reward.title 패턴 follow-up — silent dead reward fix).
 *
 * 발견 (5 achievements premium 보상 silent 손실):
 * - claimAchievement(useInventoryActions.ts:337-352)는 reward.gold + reward.item만 처리.
 * - 그러나 ACHIEVEMENTS의 reward 객체는 gold / item / premiumCurrency 3종 사용.
 * - 5건의 영구 업적이 premiumCurrency 보상을 silently drop:
 *   · ach_abyss_200 '심연의 전설': premiumCurrency 50
 *   · ach_abyss_300 '공허의 군림자': premiumCurrency 100
 *   · ach_sig_20 '모든 전설의 증인': premiumCurrency 30
 *   · ach_sig_set_all '전설의 집대성': premiumCurrency 100
 *   · ach_chain_all '세계의 비밀 수호자': premiumCurrency 20
 * - 합계 300 💎 가 영원히 청구 불가 (claimedAchievements는 한 번만 청구 허용).
 *
 * 패턴:
 * - cycle 209 quest reward.title 누락 처리와 동일 lens — 보상 데이터는 있으나
 *   handler가 처리 안 해 silent dead.
 * - cycle 178 'info' reward type 추가, cycle 139 'legendary_item' 추가와 같은 결.
 *
 * 수정 (src/hooks/useInventoryActions.ts claimAchievement):
 * - achData.reward?.premiumCurrency 처리 추가.
 * - PREMIUM_GAIN 류 로그 emit (이미 PURCHASE 로그가 비슷한 형식 — 참조).
 */

test('cycle 215: claimAchievement에 premiumCurrency 처리 코드 존재', () => {
    const file = path.join(ROOT, 'src/hooks/useInventoryActions.ts');
    const content = fs.readFileSync(file, 'utf-8');
    // claimAchievement 함수 내에서 premiumCurrency 보상 처리 패턴
    assert.match(
        content,
        /achData\.reward[?\.]+premiumCurrency/,
        'claimAchievement에 achData.reward?.premiumCurrency 처리 코드 필요',
    );
});

test('cycle 215: premiumCurrency 5개 업적이 reward에 정의되어 있음 (정합성 baseline)', () => {
    const expected = [
        { id: 'ach_abyss_200', amount: 50 },
        { id: 'ach_abyss_300', amount: 100 },
        { id: 'ach_sig_20', amount: 30 },
        { id: 'ach_sig_set_all', amount: 100 },
        { id: 'ach_chain_all', amount: 20 },
    ];
    for (const expect of expected) {
        const ach = ACHIEVEMENTS.find((a) => a.id === expect.id);
        assert.ok(ach, `${expect.id} achievement should exist`);
        assert.equal(ach.reward.premiumCurrency, expect.amount,
            `${expect.id} premiumCurrency reward = ${expect.amount}`);
    }
});

test('cycle 215: 합계 300 💎 가 청구 가능 (silent loss 방지)', () => {
    const total = ACHIEVEMENTS
        .filter((a) => a.reward?.premiumCurrency)
        .reduce((sum, a) => sum + (a.reward.premiumCurrency || 0), 0);
    assert.equal(total, 300, '5 업적의 premiumCurrency 합 = 300 (regression baseline)');
});

test('cycle 215: 기존 reward.gold / reward.item 처리는 유지 (회귀 가드)', () => {
    const file = path.join(ROOT, 'src/hooks/useInventoryActions.ts');
    const content = fs.readFileSync(file, 'utf-8');
    assert.match(
        content,
        /achData\.reward\.gold/,
        'claimAchievement의 reward.gold 처리 유지',
    );
    assert.match(
        content,
        /achData\.reward\.item/,
        'claimAchievement의 reward.item 처리 유지',
    );
});

test('cycle 209 회귀 가드: claimQuestReward의 reward.title 처리 유지', () => {
    const file = path.join(ROOT, 'src/hooks/useInventoryActions.ts');
    const content = fs.readFileSync(file, 'utf-8');
    assert.match(
        content,
        /qData\.reward[?\.]+title/,
        'claimQuestReward의 reward.title 처리 유지 (cycle 209)',
    );
});
