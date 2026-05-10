import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 448: ELEMENT_COLOR_MAP '물리' 엔트리 unreachable 정리
 *   (cycle 222-447 silent dead config 시리즈 206번째 — unreachable lookup entry
 *   lens 회귀, cycle 421/425/444 패턴, 호출 사이트 producer 분석).
 *
 * 발견 (1 dead lookup entry):
 * - src/utils/characterAppearance.ts ELEMENT_COLOR_MAP:
 *     `{ 화염, 냉기, 어둠, 빛, 자연, 대지, 물리 }`
 * - 호출 사이트 (consumer) 분석:
 *     · `glow: ELEMENT_COLOR_MAP[frameTone as string] || baseStyle.accentColor`
 *     · `frameTone = armor?.elem || weapon?.elem || offhand?.elem || null`
 * - producer 분석:
 *     · items.ts elem 값: 화염/냉기/대지/바람/빛/어둠/에테르/자연 (8 종).
 *     · '물리' elem 0건 (전체 items.ts).
 *   → ELEMENT_COLOR_MAP['물리'] lookup 절대 hit 안 됨.
 *
 * 패턴 (cycle 222-447 시리즈 206번째):
 * - cycle 421: SkillTypeIcon TYPE_PATHS '번개' unreachable.
 * - cycle 444: handleMenuAction 'reset' 분기 unreachable.
 * - cycle 448: ELEMENT_COLOR_MAP '물리' unreachable — 동일 lens 회귀.
 *
 * 수정 (src/utils/characterAppearance.ts):
 * - ELEMENT_COLOR_MAP에서 `'물리': ...` 라인 제거.
 *
 * 회귀 가드:
 * - 활성 6 키 (화염/냉기/어둠/빛/자연/대지) 보존.
 * - fallback `|| baseStyle.accentColor` 동작 그대로.
 * - 바람/에테르 elem은 fallback path 활성 (원래 그랬음).
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test("cycle 448: ELEMENT_COLOR_MAP에서 '물리' 엔트리 0건", async () => {
    const source = await readSrc('src/utils/characterAppearance.ts');
    const blockStart = source.indexOf('const ELEMENT_COLOR_MAP');
    const blockEnd = source.indexOf('};', blockStart);
    const block = source.slice(blockStart, blockEnd);
    assert.ok(!/^\s+물리:/m.test(block), "ELEMENT_COLOR_MAP에서 '물리' 0건");
});

test('cycle 448: 활성 6 키 보존 (화염/냉기/어둠/빛/자연/대지)', async () => {
    const source = await readSrc('src/utils/characterAppearance.ts');
    const blockStart = source.indexOf('const ELEMENT_COLOR_MAP');
    const blockEnd = source.indexOf('};', blockStart);
    const block = source.slice(blockStart, blockEnd);
    for (const key of ['화염', '냉기', '어둠', '빛', '자연', '대지']) {
        const re = new RegExp(`^\\s+${key}:`, 'm');
        assert.ok(re.test(block), `활성 키 ${key} 보존`);
    }
});

test("cycle 448: 정합성 가드 — items.ts에 elem='물리' 0건", async () => {
    const source = await readSrc('src/data/items.ts');
    const matches = source.match(/^\s+\{[^}]*elem: '물리'/mg) || [];
    // grep과 동일하게 match 수 검증 (`elem: '물리'` 단독 매칭)
    const elemPhysical = source.match(/(\s|,)elem: '물리'/g) || [];
    assert.equal(elemPhysical.length, 0, "items.ts에 elem='물리' 0건");
    void matches;
});

test('cycle 448: deriveCharacterAppearance.palette.glow runtime — fallback 활성', async () => {
    const { deriveCharacterAppearance } = await import('../src/utils/characterAppearance.ts');
    // 모든 elem이 없는 player → glow는 baseStyle.accentColor fallback.
    const player = { job: '모험가', equip: { weapon: null, armor: null, offhand: null } };
    const appearance = deriveCharacterAppearance(player);
    assert.equal(typeof appearance.palette.glow, 'string', 'glow string 반환');
    // 화염 elem player → ELEMENT_COLOR_MAP.화염 활성 path
    const firePlayer = { job: '전사', equip: { weapon: { elem: '화염' }, armor: null, offhand: null } };
    const fireAppearance = deriveCharacterAppearance(firePlayer);
    assert.equal(fireAppearance.palette.glow, '#fb923c', '화염 elem → 매핑된 색상');
});

test('cycle 447 회귀 가드: palette.skin 등 dead 필드 0건', async () => {
    const { deriveCharacterAppearance } = await import('../src/utils/characterAppearance.ts');
    const player = { job: '모험가', equip: { weapon: null, armor: null, offhand: null } };
    const appearance = deriveCharacterAppearance(player);
    assert.equal(appearance.palette.skin, undefined, 'cycle 447 skin 0건 보존');
    assert.equal(appearance.palette.eye, undefined, 'cycle 447 eye 0건 보존');
});
