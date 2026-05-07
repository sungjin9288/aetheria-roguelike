import test from 'node:test';
import assert from 'node:assert/strict';

import { CombatEngine } from '../src/systems/CombatEngine.js';

/**
 * cycle 252: monster resistance '불꽃' → '화염' typo (cycle 251 paired completion)
 *   (cycle 222-251 silent dead config 시리즈 24번째 — element typo audit).
 *
 * 발견 (cycle 251 paired):
 * - cycle 251에서 weakness '불꽃' → '화염' 6 monsters fix.
 * - 동일 typo가 resistance에도 2 monsters에 잔존: '분노한 마구스' / '사기꾼 마법사'.
 * - getElementMultiplier가 enemy.resistance === elem 매칭 실패 → ELEMENT_RESIST_MULT (0.5x)
 *   영원히 미적용 → 화염 attack 시 풀 데미지 적용. monster의 화염 저항 광고가 fake.
 *
 * 패턴 (cycle 222-251 silent dead config 시리즈 24번째):
 * - cycle 251: weakness '불꽃' → '화염' 6건.
 * - cycle 252: resistance '불꽃' → '화염' 2건 (paired completion).
 *
 * 수정 (src/data/monsters.ts):
 * - 2 monsters의 resistance '불꽃' → '화염' 표준 통일.
 *
 * 회귀 가드:
 * - 다른 resistance 값 변화 없음 (물/독/비전/번개/마법 등은 별도 design 결정 cycle).
 * - cycle 251 weakness 동작 유지.
 *
 * 별도 cycle 후보 (잔존):
 * - 2 monsters resistance '물' (강의 요괴 / 저주받은 어부) — 냉기 또는 바람 매핑 결정.
 * - 1 monster resistance '독' (독 지네) — 자연 매핑?
 * - 1 monster resistance '비전' (line 524 boss) — 에테르 매핑?
 * - 5 monsters resistance '번개' / '마법' — 신규 element 추가 vs 매핑 결정.
 */

test('cycle 252: monsters.ts에서 resistance "불꽃" 0건 (모두 "화염"으로 통일)', async () => {
    const { readFile } = await import('node:fs/promises');
    const { fileURLToPath } = await import('node:url');
    const path = await import('node:path');
    const here = path.dirname(fileURLToPath(import.meta.url));
    const source = await readFile(path.join(here, '..', 'src/data/monsters.ts'), 'utf8');
    const matches = source.match(/resistance:\s*'불꽃'/g);
    assert.equal(matches, null, `monsters.ts에 resistance '불꽃' 0건 (실제: ${matches?.length || 0}건)`);
});

test('cycle 252: 2 ex-불꽃 resistance monsters 모두 "화염"으로 변경', async () => {
    const { MONSTERS } = await import('../src/data/monsters.js');
    const targets = ['분노한 마구스', '사기꾼 마법사'];
    targets.forEach((name) => {
        assert.ok(MONSTERS[name], `'${name}' monster 정의 존재`);
        assert.equal(MONSTERS[name].resistance, '화염',
            `'${name}' resistance '화염' (실제: ${MONSTERS[name].resistance})`);
    });
});

test('cycle 252: 화염 attack이 ex-불꽃 resistance monster에 ELEMENT_RESIST_MULT 적용', () => {
    const enemy = { name: '분노한 마구스', hp: 1000, maxHp: 1000, atk: 50, def: 5, resistance: '화염' };
    const mult = CombatEngine.getElementMultiplier('화염', enemy, []);
    // BALANCE.ELEMENT_RESIST_MULT = 0.5 (보통).
    assert.ok(mult < 1.0, `'화염' attack vs '분노한 마구스' (resistance '화염') → 저항 배율 적용 (실제: ${mult})`);
});

test('cycle 251 회귀 가드: weakness "불꽃" 0건 유지', async () => {
    const { readFile } = await import('node:fs/promises');
    const { fileURLToPath } = await import('node:url');
    const path = await import('node:path');
    const here = path.dirname(fileURLToPath(import.meta.url));
    const source = await readFile(path.join(here, '..', 'src/data/monsters.ts'), 'utf8');
    const matches = source.match(/weakness:\s*'불꽃'/g);
    assert.equal(matches, null, 'cycle 251 weakness 불꽃 0 회귀 가드');
});

test('cycle 252: 다른 resistance 값 변화 없음 (회귀 가드)', async () => {
    const { MONSTERS } = await import('../src/data/monsters.js');
    // 물 resistance 가진 monster — 별도 cycle 대기.
    const waterRes = MONSTERS['강의 요괴'];
    assert.equal(waterRes?.resistance, '물', "'강의 요괴' resistance '물' 보존 (cycle 252 범위 외)");
    // 번개 weakness — 별도 cycle 대기.
    const lightningWeak = Object.values(MONSTERS).find((m) => m.weakness === '번개');
    assert.ok(lightningWeak, '번개 weakness 가진 monster 1개 이상 존재 (회귀 가드)');
    // 참고: 비전 resistance는 cycle 253에서 에테르로 매핑되어 0건 (정상).
});
