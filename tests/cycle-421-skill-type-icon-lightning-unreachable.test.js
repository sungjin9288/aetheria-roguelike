import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 421: SkillTypeIcon TYPE_PATHS / TYPE_COLORS '번개' unreachable 정리
 *   (cycle 222-420 silent dead config 시리즈 181번째 — 호출 사이트 분석 lens 회귀).
 *
 * 발견 (2 dead lookup entries):
 * - src/components/icons/SkillTypeIcon.tsx
 *   TYPE_PATHS['번개'] + TYPE_COLORS['번개'] 정의.
 *   호출 사이트:
 *     1) SkillTreePreview.tsx — `<SkillTypeIcon type={skill.type} ...>`
 *     2) MonsterCodex.tsx — `<SkillTypeIcon type={m.weakness | m.resistance} ...>`
 * - 데이터 분석:
 *     classes.ts skill.type 값: 물리/화염/냉기/자연/대지/빛/어둠/buff/debuff/escape.
 *     '번개' type 0건 — '썬더볼트' 등 thunder 스킬도 type='빛'으로 정의.
 *     monsters.ts weakness/resistance 값: 화염/냉기/자연/대지/빛/어둠/물리/바람/에테르.
 *     '번개' weakness/resistance 0건.
 * - 결과: '번개' key lookup 절대 hit 안 됨.
 *
 * 패턴 (cycle 222-420 시리즈 181번째):
 * - cycle 419: SignalBadge SIZE_CLASS md/lg — 호출 사이트 explicit "sm" 명시 → md/lg unreachable.
 * - cycle 421: SkillTypeIcon TYPE_PATHS/TYPE_COLORS '번개' — type prop producer 분석 → '번개' unreachable.
 *
 * 수정 (src/components/icons/SkillTypeIcon.tsx):
 * - TYPE_PATHS에서 '번개' 라인 제거 (코멘트 "// 번개 (빛 파생)" 포함).
 * - TYPE_COLORS에서 '번개' 라인 제거.
 *
 * 회귀 가드:
 * - 활성 키 (물리/화염/냉기/자연/대지/빛/어둠/buff/debuff) 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 421: TYPE_PATHS에서 번개 0건', async () => {
    const source = await readSrc('src/components/icons/SkillTypeIcon.tsx');
    const blockStart = source.indexOf('const TYPE_PATHS');
    const blockEnd = source.indexOf('};', blockStart);
    const block = source.slice(blockStart, blockEnd);
    assert.ok(!/'번개'/.test(block), "TYPE_PATHS에서 '번개' 0건");
});

test('cycle 421: TYPE_COLORS에서 번개 0건', async () => {
    const source = await readSrc('src/components/icons/SkillTypeIcon.tsx');
    const blockStart = source.indexOf('const TYPE_COLORS');
    const blockEnd = source.indexOf('};', blockStart);
    const block = source.slice(blockStart, blockEnd);
    assert.ok(!/'번개'/.test(block), "TYPE_COLORS에서 '번개' 0건");
});

test('cycle 421: 활성 키 보존 (TYPE_PATHS / TYPE_COLORS)', async () => {
    const source = await readSrc('src/components/icons/SkillTypeIcon.tsx');
    const aliveKeys = ['물리', '화염', '냉기', '자연', '대지', '빛', '어둠', 'buff', 'debuff'];
    for (const key of aliveKeys) {
        const re = new RegExp(`'${key}'`);
        assert.ok(re.test(source), `'${key}' 활성 키 보존`);
    }
});

test('cycle 421: 정합성 가드 — classes.ts skill.type / monsters.ts weakness|resistance 0건', async () => {
    const classes = await readSrc('src/data/classes.ts');
    const monsters = await readSrc('src/data/monsters.ts');
    const typeMatches = classes.match(/type: ?'번개'/g) || [];
    const weakMatches = monsters.match(/weakness: ?'번개'/g) || [];
    const resistMatches = monsters.match(/resistance: ?'번개'/g) || [];
    assert.equal(typeMatches.length, 0, "classes.ts skill.type='번개' 0건");
    assert.equal(weakMatches.length, 0, "monsters.ts weakness='번개' 0건");
    assert.equal(resistMatches.length, 0, "monsters.ts resistance='번개' 0건");
});

test('cycle 419 회귀 가드: SignalBadge SIZE_CLASS md/lg 0건', async () => {
    const source = await readSrc('src/components/SignalBadge.tsx');
    const blockStart = source.indexOf('const SIZE_CLASS');
    const blockEnd = source.indexOf('};', blockStart);
    const block = source.slice(blockStart, blockEnd);
    assert.ok(!/^\s+md:/m.test(block), 'cycle 419 SIZE_CLASS.md 0건 보존');
    assert.ok(!/^\s+lg:/m.test(block), 'cycle 419 SIZE_CLASS.lg 0건 보존');
});
