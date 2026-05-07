import test from 'node:test';
import assert from 'node:assert/strict';

import { CombatEngine } from '../src/systems/CombatEngine.js';

/**
 * cycle 254: monster resistance '물' → '냉기' (cycle 251-253 element typo 시리즈)
 *   (cycle 222-253 silent dead config 시리즈 26번째).
 *
 * 발견 (잔존 dead resistance — '물'):
 * - '강의 요괴' (line 314) / '저주받은 어부' (line 317) 2 monsters resistance '물' 정의.
 * - 그러나 어떤 item / skill도 elem='물' 정의 안 함 → ELEMENT_RESIST_MULT 영원히 미적용.
 * - water-themed 몬스터의 저항 광고가 fake.
 * - 매핑 결정: '물' → '냉기' (items.ts 냉기 계열 weapons이 가장 유사한 element —
 *   ice/cold ↔ water 친화성. items 냉기 계열: 서리칼날/빙결의 왕관검/얼음 지팡이 등).
 *
 * 패턴 (cycle 222-253 silent dead config 시리즈 26번째):
 * - cycle 251: weakness '불꽃' → '화염' 6건.
 * - cycle 252: resistance '불꽃' → '화염' 2건.
 * - cycle 253: resistance '독' → '자연', '비전' → '에테르' 2건.
 * - cycle 254: resistance '물' → '냉기' 2건.
 *
 * 수정 (src/data/monsters.ts):
 * - '강의 요괴' resistance '물' → '냉기'.
 * - '저주받은 어부' resistance '물' → '냉기'.
 *
 * 회귀 가드:
 * - cycle 251-253 동작 유지.
 * - 다른 resistance 변화 없음.
 *
 * 별도 cycle 후보 (잔존 마지막 dead):
 * - 4 monsters weakness '번개' (3 + 왕국 기사) — 신규 element 추가 vs '빛' 매핑.
 * - 1 monster weakness '마법' (용병 전사) — generic, 별도 design 결정.
 */

test('cycle 254: 강의 요괴 resistance "냉기"로 변경', async () => {
    const { MONSTERS } = await import('../src/data/monsters.js');
    assert.ok(MONSTERS['강의 요괴'], "'강의 요괴' monster 정의 존재");
    assert.equal(MONSTERS['강의 요괴'].resistance, '냉기',
        `'강의 요괴' resistance '냉기' (실제: ${MONSTERS['강의 요괴'].resistance})`);
});

test('cycle 254: 저주받은 어부 resistance "냉기"로 변경', async () => {
    const { MONSTERS } = await import('../src/data/monsters.js');
    assert.ok(MONSTERS['저주받은 어부'], "'저주받은 어부' monster 정의 존재");
    assert.equal(MONSTERS['저주받은 어부'].resistance, '냉기',
        `'저주받은 어부' resistance '냉기' (실제: ${MONSTERS['저주받은 어부'].resistance})`);
});

test('cycle 254: monsters.ts에서 resistance "물" 0건', async () => {
    const { readFile } = await import('node:fs/promises');
    const { fileURLToPath } = await import('node:url');
    const path = await import('node:path');
    const here = path.dirname(fileURLToPath(import.meta.url));
    const source = await readFile(path.join(here, '..', 'src/data/monsters.ts'), 'utf8');
    const matches = source.match(/resistance:\s*'물'/g);
    assert.equal(matches, null, `monsters.ts에 resistance '물' 0건 (실제: ${matches?.length || 0}건)`);
});

test('cycle 254: 냉기 attack이 강의 요괴에 ELEMENT_RESIST_MULT 적용', () => {
    const enemy = { name: '강의 요괴', hp: 1000, maxHp: 1000, atk: 50, def: 5, resistance: '냉기' };
    const mult = CombatEngine.getElementMultiplier('냉기', enemy, []);
    assert.ok(mult < 1.0,
        `'냉기' attack vs '강의 요괴' (resistance '냉기') → 저항 배율 적용 (실제: ${mult})`);
});

test('cycle 254: 기존 weakness 빛 보존 (회귀 가드)', async () => {
    const { MONSTERS } = await import('../src/data/monsters.js');
    assert.equal(MONSTERS['강의 요괴'].weakness, '빛', "'강의 요괴' weakness '빛' 보존");
    assert.equal(MONSTERS['저주받은 어부'].weakness, '빛', "'저주받은 어부' weakness '빛' 보존");
});

test('cycle 251-253 회귀 가드: element typo 시리즈 누적 0건', async () => {
    const { readFile } = await import('node:fs/promises');
    const { fileURLToPath } = await import('node:url');
    const path = await import('node:path');
    const here = path.dirname(fileURLToPath(import.meta.url));
    const source = await readFile(path.join(here, '..', 'src/data/monsters.ts'), 'utf8');
    assert.equal(source.match(/weakness:\s*'불꽃'/g), null, 'cycle 251 weakness 불꽃 회귀');
    assert.equal(source.match(/resistance:\s*'불꽃'/g), null, 'cycle 252 resistance 불꽃 회귀');
    assert.equal(source.match(/resistance:\s*'독'/g), null, 'cycle 253 resistance 독 회귀');
    assert.equal(source.match(/resistance:\s*'비전'/g), null, 'cycle 253 resistance 비전 회귀');
});
