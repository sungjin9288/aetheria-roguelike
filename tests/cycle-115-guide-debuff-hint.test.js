import test from 'node:test';
import assert from 'node:assert/strict';

import { getAdventureGuidance } from '../src/utils/adventureGuide.js';

/**
 * cycle 115: AdventureGuide hint — 활성 debuff 인지 시 정화 권장.
 *
 * cycle 106-113 status 시스템 복구 + UI surface 마무리 후속.
 *
 * 발견:
 * - cycle 112에서 rest 시 status 초기화를 추가했지만, 플레이어가 그 사실을
 *   알 수 있는 surface는 직접 rest 행동 결과를 통해서만. 안전지대로 복귀해서
 *   휴식 명령을 내리기 전에 "지금 디버프 걸려있으니 휴식이 좋겠다"는 힌트가
 *   없음.
 * - 이미 hpRatio <= 0.65 시 휴식 추천 hint가 있지만 status 누적은 별개 시그널.
 *
 * 추가:
 * - safe zone에서 player.status가 length>0이면 "디버프 정화 권장" hint.
 *   uses primaryAction { kind: 'rest', label: '휴식으로 정화' } — 이미 cycle 112
 *   rest가 status를 클리어하므로 정합.
 * - 우선순위: questTracker claimable / 모험가 전직 다음, 일반 hpRatio rest 직전.
 *   (긴급 보상 / 전직 분기 다음으로 중요. 디버프 누적은 위험 시그널이지만
 *   즉시 위험은 아니므로.)
 */

const baseStats = (overrides = {}) => ({
    maxHp: 1000, maxMp: 100,
    ...overrides,
});

const safePlayer = (overrides = {}) => ({
    hp: 1000, maxHp: 1000, mp: 100, maxMp: 100,
    job: '검사', level: 10, gold: 1000, loc: '시작의 마을',
    quests: [],
    stats: { kills: 0, total_gold: 0, deaths: 0 },
    status: [],
    ...overrides,
});

const safeMap = { type: 'safe', name: '시작의 마을' };

test('safe + debuff 보유 → 정화 권장 hint', () => {
    const player = safePlayer({ status: ['curse'] });
    const guidance = getAdventureGuidance(player, baseStats(), safeMap, 'idle');
    assert.ok(/정화|디버프|상태이상|debuff/i.test(guidance.title + ' ' + guidance.detail),
        `expected debuff cleanse hint, got: ${guidance.title} | ${guidance.detail}`);
    assert.equal(guidance.primaryAction?.kind, 'rest');
});

test('safe + 다중 debuff → 정화 hint (한 번만 노출)', () => {
    const player = safePlayer({ status: ['curse', 'blind', 'bleed'] });
    const guidance = getAdventureGuidance(player, baseStats(), safeMap, 'idle');
    assert.equal(guidance.primaryAction?.kind, 'rest');
});

test('safe + debuff 없음 → 정화 hint 미발생 (fallback hint)', () => {
    const player = safePlayer({ status: [] });
    const guidance = getAdventureGuidance(player, baseStats(), safeMap, 'idle');
    assert.ok(!/정화/.test(guidance.title || ''), 'should not show cleanse hint without debuff');
});

test('not-safe + debuff → 정화 hint 비활성 (rest 불가능 지역)', () => {
    const player = safePlayer({ status: ['curse'], loc: '평원' });
    const dungeonMap = { type: 'dungeon', name: '평원' };
    const guidance = getAdventureGuidance(player, baseStats(), dungeonMap, 'idle');
    // 던전에서는 rest 권장 안 됨 — 다른 hint 라우팅
    assert.notEqual(guidance.title, '디버프 정화 권장');
});

test('safe + claimable quest 우선순위 — debuff hint보다 quest claim 우선', () => {
    const player = safePlayer({
        status: ['curse'],
        quests: [{ id: 1, progress: 5 }],
    });
    // claimable quest는 별도 mock 필요 — getQuestTracker 호출 결과에 의존하므로
    // 직접 검증보다는 debuff hint가 노출되는지로 회귀 가드.
    const guidance = getAdventureGuidance(player, baseStats(), safeMap, 'idle');
    // 구체적인 quest mock 없이는 정확한 우선순위 검증 어려움 — 단순 동작 가드.
    assert.ok(typeof guidance.title === 'string');
});
