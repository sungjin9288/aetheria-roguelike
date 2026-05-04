import test from 'node:test';
import assert from 'node:assert/strict';

import { TITLES } from '../src/data/titles.js';
import { checkTitles } from '../src/utils/gameUtils.js';

/**
 * cycle 85: 연금술사(alchemist) 칭호 — synths 카운터 기반 빈 자리 채움.
 *
 * 배경:
 * - cycle 30+에 ach_synth_5/20/50 achievement가 추가되었고,
 *   cycle 82에서 StatsPanel SYNTHESES 라인이 노출됐지만,
 *   합성 카운터 기반 칭호는 없던 상태 (crafts에는 'crafter' 칭호 존재).
 * - 합성은 cycle 30+에서 추가된 깊은 시스템(아이템 + 골드 + 보호 옵션 소비)
 *   이라 단순 craft보다 의도된 노력이 필요. 칭호로 보상하는 게 자연스러움.
 *
 * 추가:
 * - id 'alchemist' / name '연금술사' / cond synths >= 20 / amber-300
 * - checkTitles에 type === 'synths' 핸들러 (player.stats.syntheses 읽음;
 *   cycle 82에서 INITIAL_STATE에 declare된 필드)
 */

test('alchemist 칭호 등록됨 (synths 20)', () => {
    const title = TITLES.find((t) => t.id === 'alchemist');
    assert.ok(title, 'alchemist title should exist');
    assert.equal(title.name, '연금술사');
    assert.equal(title.cond.type, 'synths');
    assert.equal(title.cond.val, 20);
});

test('checkTitles: syntheses >= 20 → alchemist 활성', () => {
    const player = { titles: [], stats: { syntheses: 20 } };
    const unlocked = checkTitles(player);
    assert.ok(unlocked.includes('alchemist'), 'alchemist should be unlocked at 20 syntheses');
});

test('checkTitles: syntheses < 20 → alchemist 비활성', () => {
    const player = { titles: [], stats: { syntheses: 19 } };
    const unlocked = checkTitles(player);
    assert.ok(!unlocked.includes('alchemist'), 'alchemist should be locked below threshold');
});

test('checkTitles: syntheses 누락 → 0 취급, alchemist 비활성', () => {
    const player = { titles: [], stats: {} };
    const unlocked = checkTitles(player);
    assert.ok(!unlocked.includes('alchemist'));
});

test('checkTitles: 이미 보유한 alchemist는 재해금 안 됨', () => {
    const player = { titles: ['alchemist'], stats: { syntheses: 100 } };
    const unlocked = checkTitles(player);
    assert.ok(!unlocked.includes('alchemist'), 'should not re-unlock owned title');
});
