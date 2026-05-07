import test from 'node:test';
import assert from 'node:assert/strict';

import { CombatEngine } from '../src/systems/CombatEngine.js';

/**
 * cycle 251: monster weakness '불꽃' → '화염' typo dead config
 *   (cycle 222-250 silent dead config 시리즈 23번째 — element typo audit, cycle 223 paired).
 *
 * 발견 (element 표준 불일치):
 * - src/data/items.ts elem 값: 냉기 / 대지 / 바람 / 빛 / 어둠 / 에테르 / 자연 / 화염 (8종).
 * - src/data/classes.ts skill type: 냉기 / 대지 / 물리 / 빛 / 어둠 / 자연 / 화염 (7종).
 * - src/data/monsters.ts weakness 값에 '불꽃' 6 monsters (구름 정령 / 익사한 기사 /
 *   살아있는 마법서 / 잉크 슬라임 / 책의 정령 / 독 지네).
 * - 그러나 어떤 item / skill도 elem='불꽃' 정의하지 않음 → 화염 attack 시
 *   getElementMultiplier가 enemy.weakness === elem 매칭 실패 → ELEMENT_WEAK_MULT 영원히
 *   미적용. 이 6 monsters은 화염 아이템 / 화염 스킬에 약점 광고하지만 실제로 1.0배.
 *
 * 패턴 (cycle 222-250 silent dead config 시리즈 23번째):
 * - cycle 223: 3 items elem '얼음' → '냉기' typo fix (paired와 동일 pattern).
 * - cycle 251: 6 monsters weakness '불꽃' → '화염' typo fix.
 *
 * 수정 (src/data/monsters.ts):
 * - 6 monsters의 weakness '불꽃' → '화염' 표준 통일.
 *
 * 회귀 가드:
 * - 다른 weakness 값 변화 없음 (냉기/자연/어둠/빛 등).
 * - resistance 값 그대로 (바람 등 미적용 resistance는 별도 cycle).
 * - getElementMultiplier 시그니처 변화 없음.
 *
 * 별도 cycle 후보 (보너스 발견):
 * - 3 monsters weakness '번개' (돌 거인/황금 왕국 수호자/왕국 기사) — items에 elem '번개' 없음.
 * - 1 monster weakness '마법' (용병 전사) — items에 elem '마법' 없음.
 *   이 둘은 design 의도 모호 — '번개' → '빛' 또는 신규 element 추가 결정 필요. cycle 251 범위 외.
 */

test('cycle 251: monsters.ts에서 weakness "불꽃" 0건 (모두 "화염"으로 통일)', async () => {
    const { readFile } = await import('node:fs/promises');
    const { fileURLToPath } = await import('node:url');
    const path = await import('node:path');
    const here = path.dirname(fileURLToPath(import.meta.url));
    const source = await readFile(path.join(here, '..', 'src/data/monsters.ts'), 'utf8');
    const matches = source.match(/weakness:\s*'불꽃'/g);
    assert.equal(matches, null, `monsters.ts에 weakness '불꽃' 0건 (실제: ${matches?.length || 0}건)`);
});

test('cycle 251: 6 ex-불꽃 monsters 모두 weakness "화염"으로 변경', async () => {
    const { MONSTERS } = await import('../src/data/monsters.js');
    const targets = ['구름 정령', '익사한 기사', '살아있는 마법서', '잉크 슬라임', '책의 정령', '독 지네'];
    targets.forEach((name) => {
        assert.ok(MONSTERS[name], `'${name}' monster 정의 존재`);
        assert.equal(MONSTERS[name].weakness, '화염',
            `'${name}' weakness '화염' (실제: ${MONSTERS[name].weakness})`);
    });
});

test('cycle 251: 화염 element 공격이 ex-불꽃 monster에 ELEMENT_WEAK_MULT 적용', () => {
    const enemy = { name: '구름 정령', hp: 1000, maxHp: 1000, atk: 50, def: 5, weakness: '화염' };
    const mult = CombatEngine.getElementMultiplier('화염', enemy, []);
    // BALANCE.ELEMENT_WEAK_MULT = 1.5 (기본값).
    assert.ok(mult > 1.0, `'화염' attack vs '구름 정령' (weakness '화염') → 약점 배율 적용 (실제: ${mult})`);
});

test('cycle 251: 다른 weakness 값 변화 없음 (회귀 가드)', async () => {
    const { MONSTERS } = await import('../src/data/monsters.js');
    // 냉기 weakness 가진 monster sample 회귀 가드.
    const flameDragon = Object.entries(MONSTERS).find(([, m]) => m.weakness === '냉기');
    assert.ok(flameDragon, '냉기 weakness 가진 monster 1개 이상 존재 (회귀 가드)');
});

test('cycle 251: resistance 값 변화 없음 (회귀 가드)', async () => {
    const { MONSTERS } = await import('../src/data/monsters.js');
    // 구름 정령 resistance: '바람' 그대로 (이 cycle 범위 외).
    assert.equal(MONSTERS['구름 정령'].resistance, '바람',
        '구름 정령 resistance 보존 (cycle 251 범위 외)');
});

test('cycle 223 회귀 가드: items.ts elem "얼음" 0건 유지', async () => {
    const { readFile } = await import('node:fs/promises');
    const { fileURLToPath } = await import('node:url');
    const path = await import('node:path');
    const here = path.dirname(fileURLToPath(import.meta.url));
    const source = await readFile(path.join(here, '..', 'src/data/items.ts'), 'utf8');
    const matches = source.match(/elem:\s*'얼음'/g);
    assert.equal(matches, null, 'cycle 223 items.ts elem 얼음 0 회귀 가드');
});
