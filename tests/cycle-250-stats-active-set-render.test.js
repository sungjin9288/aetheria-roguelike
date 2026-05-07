import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 250: stats.activeSet (prefix-based items 세트) UI dispatch dead config
 *   (cycle 222-249 silent dead config 시리즈 22번째 — UI render lens 재진입).
 *
 * 발견 (UI dispatch 누락):
 * - src/data/items.ts sets[]: 7종 prefix-based 2세트 보너스 정의 ('불타는' 화염의 결속,
 *   '얼어붙은' 혹한의 방벽 등) — desc + setBonus.
 * - src/utils/statsCalculator.ts computeSetBonus가 동일 prefix 2개 이상 장착 시 activeSet 반환.
 * - finalCritChance 등과 함께 stats.activeSet (line 356, 396)에 노출.
 * - 그러나 components/ 검색 시 stats.activeSet read 0건 — 'activeSignatureSet' (signature 세트)만
 *   StatsPanel/EquipmentPanel에 render되고, 일반 prefix 세트는 영원히 UI invisible.
 * - 결과: 플레이어가 '불타는' 무기 + '불타는' 갑옷 장착해도 '화염의 결속 (2세트): ATK 10% 증가'
 *   보너스가 stats에는 적용되지만 UI 표시 0건이라 모름.
 *
 * 패턴 (cycle 222-249 silent dead config 시리즈 22번째):
 * - cycle 245: BOSS_BRIEFS warningChips/recommendedBuilds UI render (data → util → struct → UI 끊김).
 * - cycle 250: stats.activeSet UI render (data → util → struct → UI 끊김 동일 패턴).
 *
 * 수정:
 * - StatsPanel.tsx에 activeSet block 추가 — activeSignatureSet 패턴 mirror, 단순 desc 표시.
 *
 * 회귀 가드:
 * - activeSignatureSet block 동작 유지.
 * - activeSet null/undefined 시 미표시 (silence over noise).
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 250: StatsPanel가 stats.activeSet을 render', async () => {
    const source = await readSrc('src/components/StatsPanel.tsx');
    assert.ok(/activeSet[^B]|activeSet$/.test(source.replace(/activeSignatureSet/g, '__SIG__')),
        'StatsPanel은 stats.activeSet (prefix-based)를 read해야 함');
});

test('cycle 250: StatsPanel가 activeSet.desc를 표시', async () => {
    const source = await readSrc('src/components/StatsPanel.tsx');
    // signature 패턴을 마스킹한 후 prefix activeSet 패턴 매칭.
    const masked = source.replace(/activeSignatureSet/g, '__SIG__');
    assert.ok(/activeSet\?\.desc|activeSet\.desc/.test(masked),
        'activeSet.desc 표시 (예: "화염의 결속 (2세트): ATK 10% 증가")');
});

test('cycle 250: StatsPanel가 activeSet.prefix 또는 동등 식별자 표시', async () => {
    const source = await readSrc('src/components/StatsPanel.tsx');
    const masked = source.replace(/activeSignatureSet/g, '__SIG__');
    assert.ok(/activeSet\?\.prefix|activeSet\.prefix/.test(masked),
        'activeSet.prefix (세트 이름) 표시');
});

test('cycle 250: activeSet null/undefined 시 미표시 (silence over noise)', async () => {
    const source = await readSrc('src/components/StatsPanel.tsx');
    // conditional rendering 확인 — `{activeSet && ...}` 또는 `activeSet ? ... : null`.
    const masked = source.replace(/activeSignatureSet/g, '__SIG__');
    assert.ok(/\{activeSet[\s&?]/.test(masked),
        '조건부 렌더링 — activeSet falsy 시 미표시');
});

test('cycle 250: activeSignatureSet block 동작 유지 (회귀 가드)', async () => {
    const source = await readSrc('src/components/StatsPanel.tsx');
    assert.ok(/activeSignatureSet/.test(source), 'activeSignatureSet 참조 유지');
    assert.ok(/data-testid="stats-active-signature-set"/.test(source),
        'activeSignatureSet testid 유지');
});

test('cycle 250: items.ts sets 데이터 보존 (회귀 가드)', async () => {
    const source = await readSrc('src/data/items.ts');
    const sets = source.match(/prefix:\s*'[^']+',\s*setBonus:/g);
    assert.ok(sets && sets.length >= 5, `items.ts sets 정의 ${sets?.length || 0}개 (≥5 회귀 가드)`);
});
