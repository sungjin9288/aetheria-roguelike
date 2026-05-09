import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 426: computeSignatureSetBonus.activeSet에 atkMult/defMult/hpMult 복원
 *   (cycle 222-425 silent dead config 시리즈 186번째 — silent UI 결손 lens
 *   회귀, cycle 396/398 schema 미스매치 패턴).
 *
 * 발견 (silent UI regression — cycle 348 잘못된 cleanup):
 * - cycle 348 cleanup이 `activeSet` 내부의 atkMult/defMult/hpMult 3 필드를
 *   "dead — 부모 return에 동일 필드"라며 제거.
 * - 그러나 StatsPanel.tsx (line 220/228/236)는 `activeSignatureSet.atkMult`
 *   `.defMult` `.hpMult`를 직접 read해서 formatMultDelta로 표시.
 * - statsCalculator (line 367/408)는 `signatureSetBonus.activeSet`을
 *   `stats.activeSignatureSet`로 노출 → StatsPanel은 이 inner object만 read.
 * - 결과: 2 signature 같은 세트 착용 시 ATK/DEF/HP delta가 모두 '—'로 표시
 *   (formatMultDelta(undefined) → '—'). Silent UI 결손.
 *
 * 패턴 (cycle 222-425 시리즈 186번째):
 * - cycle 396: StatsPanel syn.name → syn.label schema 미스매치 fix.
 * - cycle 398: DashboardMobileSummary trait.label → trait.title schema 미스매치 fix.
 * - cycle 426: signatureSetBonus.activeSet 3 필드 schema 정합 복원 — 동일 lens 회귀.
 *
 * 수정 (src/utils/signatureSetBonus.ts):
 * - activeSet에 atkMult / defMult / hpMult 복원.
 * - cycle 348 코멘트 갱신.
 *
 * 회귀 가드:
 * - 부모 return의 atkMult/defMult/hpMult 그대로 (statsCalculator 사용).
 * - activeSet의 다른 필드 (key/name/tone/count/tier/desc) 그대로.
 * - StatsPanel에서 2-set 착용 시 formatMultDelta가 의미 있는 % 표시.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 426: computeSignatureSetBonus 2-set 착용 시 activeSet에 atkMult/defMult/hpMult 노출', async () => {
    const { computeSignatureSetBonus } = await import('../src/utils/signatureSetBonus.ts');
    const equip = {
        weapon: { name: '성검 에테르니아' },
        offhand: { name: '천공 성전' },
        armor: null,
    };
    const result = computeSignatureSetBonus(equip);
    assert.ok(result.activeSet, 'activeSet 객체 노출');
    assert.equal(typeof result.activeSet.atkMult, 'number', 'activeSet.atkMult number');
    assert.equal(typeof result.activeSet.defMult, 'number', 'activeSet.defMult number');
    assert.equal(typeof result.activeSet.hpMult, 'number', 'activeSet.hpMult number');
    assert.equal(result.activeSet.atkMult, result.atkMult, 'activeSet.atkMult === parent.atkMult');
    assert.equal(result.activeSet.defMult, result.defMult, 'activeSet.defMult === parent.defMult');
    assert.equal(result.activeSet.hpMult, result.hpMult, 'activeSet.hpMult === parent.hpMult');
});

test('cycle 426: activeSet 다른 필드 (key/name/tone/count/tier/desc) 보존', async () => {
    const { computeSignatureSetBonus } = await import('../src/utils/signatureSetBonus.ts');
    const equip = {
        weapon: { name: '성검 에테르니아' },
        offhand: { name: '천공 성전' },
        armor: null,
    };
    const result = computeSignatureSetBonus(equip);
    assert.ok(result.activeSet);
    assert.equal(typeof result.activeSet.key, 'string', 'key string');
    assert.equal(typeof result.activeSet.name, 'string', 'name string');
    assert.equal(typeof result.activeSet.tone, 'string', 'tone string');
    assert.equal(typeof result.activeSet.count, 'number', 'count number');
    assert.equal(typeof result.activeSet.tier, 'number', 'tier number');
    assert.equal(typeof result.activeSet.desc, 'string', 'desc string');
});

test('cycle 426: 1-set 미만 (보너스 없음) 착용 시 activeSet null 그대로', async () => {
    const { computeSignatureSetBonus } = await import('../src/utils/signatureSetBonus.ts');
    const equip = {
        weapon: { name: '성검 에테르니아' },
        offhand: null,
        armor: null,
    };
    const result = computeSignatureSetBonus(equip);
    assert.equal(result.activeSet, null, '1-set만 착용 시 activeSet null');
    assert.equal(result.atkMult, 1, 'parent.atkMult neutral');
});

test('cycle 426: StatsPanel formatMultDelta 호환 — 의미 있는 % 표시', async () => {
    const { computeSignatureSetBonus } = await import('../src/utils/signatureSetBonus.ts');
    const equip = {
        weapon: { name: '성검 에테르니아' },
        offhand: { name: '천공 성전' },
        armor: null,
    };
    const result = computeSignatureSetBonus(equip);
    // formatMultDelta(1.10) → "+10%"; formatMultDelta(1.00) → "—"
    // activeSet.atkMult > 1 이면 의미 있는 % 표시 가능.
    assert.ok(result.activeSet.atkMult > 1 || result.activeSet.defMult > 1 || result.activeSet.hpMult > 1,
        '최소 한 개 mult가 1 초과 (실제 보너스)');
});

test('cycle 425 회귀 가드: pickFallbackEvent explicit 0건', async () => {
    const source = await readSrc('src/utils/aiEventUtils.ts');
    const fnIdx = source.indexOf('export const pickFallbackEvent');
    const fnEnd = source.indexOf('};', fnIdx);
    const block = source.slice(fnIdx, fnEnd);
    assert.ok(!/\bexplicit\b/.test(block), 'cycle 425 explicit 변수 0건 보존');
});
