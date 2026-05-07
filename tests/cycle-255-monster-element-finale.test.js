import test from 'node:test';
import assert from 'node:assert/strict';

import { CombatEngine } from '../src/systems/CombatEngine.js';

/**
 * cycle 255: monster element typo audit 마무리 — '번개' → '빛' / '마법' → '에테르'
 *   (cycle 222-254 silent dead config 시리즈 27번째 — element typo 시리즈 5사이클 마무리).
 *
 * 발견 (잔존 마지막 dead elements):
 * - weakness '번개' 3 monsters (돌 거인 / 황금 왕국 수호자 / 왕국 기사) — physical-resistant
 *   metal/armored 적 의도하나 어떤 item / skill도 elem='번개' 정의 안 함.
 * - resistance '번개' 2 monsters (폭풍 수호자 / 번개 골렘) — 번개 친화 적의 자기 저항.
 * - weakness '마법' 1 monster (용병 전사) + resistance '마법' 1 monster (살아있는 마법서).
 * - 결과: 모두 elem 매칭 실패 → ELEMENT_WEAK_MULT / ELEMENT_RESIST_MULT 영원히 미적용.
 *
 * 매핑 결정:
 * - '번개' → '빛': lightning ⚡ ↔ light ✨ thematic 친화. game 내 일부 skills (e.g. 썬더볼트)도
 *   type='빛' 사용. items에는 elem='번개' 없음.
 * - '마법' → '에테르': '에테르' (ether/arcane)가 가장 magical element. cycle 253 '비전'도
 *   동일 매핑. items.ts 차원/공허 weapons elem='에테르'.
 *
 * 패턴 (cycle 222-254 silent dead config 시리즈 27번째):
 * - cycle 251: weakness '불꽃' → '화염' 6건.
 * - cycle 252: resistance '불꽃' → '화염' 2건.
 * - cycle 253: resistance '독' → '자연', '비전' → '에테르' 2건.
 * - cycle 254: resistance '물' → '냉기' 2건.
 * - cycle 255: '번개' → '빛' 5건 + '마법' → '에테르' 2건 (시리즈 마무리).
 *
 * 수정 (src/data/monsters.ts):
 * - 3 weakness '번개' → '빛'.
 * - 2 resistance '번개' → '빛'.
 * - 1 weakness '마법' → '에테르'.
 * - 1 resistance '마법' → '에테르'.
 *
 * 회귀 가드:
 * - cycle 251-254 element typo 시리즈 0건 유지.
 * - 이후 monsters.ts에 dead element 잔존 0 — element typo audit 완전 마무리.
 */

test('cycle 255: 3 ex-번개 weakness monsters 모두 "빛"으로 변경', async () => {
    const { MONSTERS } = await import('../src/data/monsters.js');
    const targets = ['돌 거인', '황금 왕국 수호자', '왕국 기사'];
    targets.forEach((name) => {
        assert.ok(MONSTERS[name], `'${name}' monster 정의 존재`);
        assert.equal(MONSTERS[name].weakness, '빛',
            `'${name}' weakness '빛' (실제: ${MONSTERS[name].weakness})`);
    });
});

test('cycle 255: 2 ex-번개 resistance monsters 모두 "빛"으로 변경', async () => {
    const { MONSTERS } = await import('../src/data/monsters.js');
    const targets = ['폭풍 수호자', '번개 골렘'];
    targets.forEach((name) => {
        assert.ok(MONSTERS[name], `'${name}' monster 정의 존재`);
        assert.equal(MONSTERS[name].resistance, '빛',
            `'${name}' resistance '빛' (실제: ${MONSTERS[name].resistance})`);
    });
});

test('cycle 255: 용병 전사 weakness "에테르" + 살아있는 마법서 resistance "에테르"', async () => {
    const { MONSTERS } = await import('../src/data/monsters.js');
    assert.equal(MONSTERS['용병 전사'].weakness, '에테르',
        `'용병 전사' weakness '에테르' (실제: ${MONSTERS['용병 전사'].weakness})`);
    assert.equal(MONSTERS['살아있는 마법서'].resistance, '에테르',
        `'살아있는 마법서' resistance '에테르' (실제: ${MONSTERS['살아있는 마법서'].resistance})`);
});

test('cycle 255: monsters.ts에서 dead element 모두 0건 (element typo audit 마무리)', async () => {
    const { readFile } = await import('node:fs/promises');
    const { fileURLToPath } = await import('node:url');
    const path = await import('node:path');
    const here = path.dirname(fileURLToPath(import.meta.url));
    const source = await readFile(path.join(here, '..', 'src/data/monsters.ts'), 'utf8');
    const deadPatterns = [
        /weakness:\s*'불꽃'/g,
        /resistance:\s*'불꽃'/g,
        /weakness:\s*'번개'/g,
        /resistance:\s*'번개'/g,
        /weakness:\s*'마법'/g,
        /resistance:\s*'마법'/g,
        /weakness:\s*'독'/g,
        /resistance:\s*'독'/g,
        /weakness:\s*'비전'/g,
        /resistance:\s*'비전'/g,
        /weakness:\s*'물'/g,
        /resistance:\s*'물'/g,
    ];
    deadPatterns.forEach((pattern) => {
        const matches = source.match(pattern);
        assert.equal(matches, null, `dead element pattern ${pattern} 0건 (실제: ${matches?.length || 0}건)`);
    });
});

test('cycle 255: 빛 attack이 ex-번개 monster에 ELEMENT_WEAK_MULT 적용', () => {
    const enemy = { name: '돌 거인', hp: 1000, maxHp: 1000, atk: 50, def: 5, weakness: '빛' };
    const mult = CombatEngine.getElementMultiplier('빛', enemy, []);
    assert.ok(mult > 1.0, `'빛' attack vs '돌 거인' (weakness '빛') → 약점 배율 (실제: ${mult})`);
});

test('cycle 255: 에테르 attack이 살아있는 마법서에 ELEMENT_RESIST_MULT 적용', () => {
    const enemy = { name: '살아있는 마법서', hp: 1000, maxHp: 1000, atk: 50, def: 5, resistance: '에테르' };
    const mult = CombatEngine.getElementMultiplier('에테르', enemy, []);
    assert.ok(mult < 1.0, `'에테르' attack vs '살아있는 마법서' (resistance '에테르') → 저항 배율 (실제: ${mult})`);
});

test('cycle 251-254 회귀 가드: element typo 시리즈 누적 동작 유지', async () => {
    const { MONSTERS } = await import('../src/data/monsters.js');
    // cycle 251 — '구름 정령' weakness '화염'
    assert.equal(MONSTERS['구름 정령'].weakness, '화염', 'cycle 251 회귀 가드');
    // cycle 252 — '분노한 마구스' resistance '화염'
    assert.equal(MONSTERS['분노한 마구스'].resistance, '화염', 'cycle 252 회귀 가드');
    // cycle 253 — '독 지네' resistance '자연' / '차원 분열자' resistance '에테르'
    assert.equal(MONSTERS['독 지네'].resistance, '자연', 'cycle 253 독 회귀 가드');
    assert.equal(MONSTERS['차원 분열자'].resistance, '에테르', 'cycle 253 비전 회귀 가드');
    // cycle 254 — '강의 요괴' resistance '냉기'
    assert.equal(MONSTERS['강의 요괴'].resistance, '냉기', 'cycle 254 회귀 가드');
});
