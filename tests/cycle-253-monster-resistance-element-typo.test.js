import test from 'node:test';
import assert from 'node:assert/strict';

import { CombatEngine } from '../src/systems/CombatEngine.js';

/**
 * cycle 253: monster resistance '독' → '자연' / '비전' → '에테르' (cycle 251-252 시리즈)
 *   (cycle 222-252 silent dead config 시리즈 25번째 — element typo audit 연속).
 *
 * 발견 (잔존 dead resistances 2건 — items elem 매칭 가능):
 *
 * 1) '독 지네' resistance '독' (line 328): items elem '자연'에 매핑 가능.
 *    - items.ts: 정령의 지팡이 / 세계수의 지팡이 / 독사의 송곳니 / 독침 단검 / 독아 채찍 등
 *      자연 계열 weapons은 모두 elem '자연' 사용.
 *    - 그러나 '독 지네' resistance '독' → 어떤 item / skill도 elem='독' 정의 안 함 →
 *      ELEMENT_RESIST_MULT 영원히 미적용. 독 저항 광고가 fake.
 *
 * 2) '차원 분열자' (boss) resistance '비전' (line 524): items elem '에테르'에 매핑 가능.
 *    - items.ts: 에테르 검 (tier 4) / 차원절단자 (tier 5) 등 차원/공허 weapons은 elem '에테르'.
 *    - resistance '비전' → 어떤 item / skill도 elem='비전' 정의 안 함 → 비전 저항 fake.
 *
 * 패턴 (cycle 222-252 silent dead config 시리즈 25번째):
 * - cycle 251: monster weakness '불꽃' → '화염' 6건.
 * - cycle 252: monster resistance '불꽃' → '화염' 2건.
 * - cycle 253: 추가 dead resistance 2건 (독 → 자연, 비전 → 에테르).
 *
 * 수정 (src/data/monsters.ts):
 * - '독 지네' resistance '독' → '자연'.
 * - '차원 분열자' resistance '비전' → '에테르'.
 *
 * 회귀 가드:
 * - cycle 251-252 동작 유지.
 * - 다른 resistance 변화 없음 (물/번개/마법은 별도 design 결정 cycle).
 *
 * 별도 cycle 후보 (잔존 dead):
 * - 2 monsters resistance '물' (강의 요괴 / 저주받은 어부) — '냉기' 또는 '바람' 매핑.
 * - 5 monsters '번개' / '마법' — 신규 element 추가 vs 매핑 결정.
 */

test('cycle 253: 독 지네 resistance "자연"으로 변경', async () => {
    const { MONSTERS } = await import('../src/data/monsters.js');
    assert.ok(MONSTERS['독 지네'], "'독 지네' monster 정의 존재");
    assert.equal(MONSTERS['독 지네'].resistance, '자연',
        `'독 지네' resistance '자연' (실제: ${MONSTERS['독 지네'].resistance})`);
});

test('cycle 253: 차원 분열자 resistance "에테르"로 변경', async () => {
    const { MONSTERS } = await import('../src/data/monsters.js');
    assert.ok(MONSTERS['차원 분열자'], "'차원 분열자' monster 정의 존재");
    assert.equal(MONSTERS['차원 분열자'].resistance, '에테르',
        `'차원 분열자' resistance '에테르' (실제: ${MONSTERS['차원 분열자'].resistance})`);
});

test('cycle 253: 자연 attack이 독 지네에 ELEMENT_RESIST_MULT 적용', () => {
    const enemy = { name: '독 지네', hp: 1000, maxHp: 1000, atk: 50, def: 5, resistance: '자연' };
    const mult = CombatEngine.getElementMultiplier('자연', enemy, []);
    assert.ok(mult < 1.0, `'자연' attack vs '독 지네' (resistance '자연') → 저항 배율 적용 (실제: ${mult})`);
});

test('cycle 253: 에테르 attack이 차원 분열자에 ELEMENT_RESIST_MULT 적용', () => {
    const enemy = { name: '차원 분열자', hp: 1000, maxHp: 1000, atk: 50, def: 5, resistance: '에테르' };
    const mult = CombatEngine.getElementMultiplier('에테르', enemy, []);
    assert.ok(mult < 1.0, `'에테르' attack vs '차원 분열자' (resistance '에테르') → 저항 배율 적용 (실제: ${mult})`);
});

test('cycle 253: monsters.ts에서 resistance "독" 0건 + resistance "비전" 0건', async () => {
    const { readFile } = await import('node:fs/promises');
    const { fileURLToPath } = await import('node:url');
    const path = await import('node:path');
    const here = path.dirname(fileURLToPath(import.meta.url));
    const source = await readFile(path.join(here, '..', 'src/data/monsters.ts'), 'utf8');
    const dokMatches = source.match(/resistance:\s*'독'/g);
    const arcaneMatches = source.match(/resistance:\s*'비전'/g);
    assert.equal(dokMatches, null, `monsters.ts에 resistance '독' 0건 (실제: ${dokMatches?.length || 0}건)`);
    assert.equal(arcaneMatches, null, `monsters.ts에 resistance '비전' 0건 (실제: ${arcaneMatches?.length || 0}건)`);
});

test('cycle 251-252 회귀 가드: weakness/resistance "불꽃" 0건 유지', async () => {
    const { readFile } = await import('node:fs/promises');
    const { fileURLToPath } = await import('node:url');
    const path = await import('node:path');
    const here = path.dirname(fileURLToPath(import.meta.url));
    const source = await readFile(path.join(here, '..', 'src/data/monsters.ts'), 'utf8');
    assert.equal(source.match(/weakness:\s*'불꽃'/g), null, 'cycle 251 weakness 불꽃 회귀 가드');
    assert.equal(source.match(/resistance:\s*'불꽃'/g), null, 'cycle 252 resistance 불꽃 회귀 가드');
});

test('cycle 253: 별도 cycle 대기 — 번개/마법 resistance 보존 (회귀 가드)', async () => {
    const { MONSTERS } = await import('../src/data/monsters.js');
    // 번개 weakness — 별도 cycle 대기 (cycle 253 시점 잔존).
    assert.equal(MONSTERS['돌 거인']?.weakness, '번개', "'돌 거인' weakness '번개' 보존");
    // 참고: 물 resistance는 cycle 254에서 냉기로 매핑되어 0건 (정상).
});
