import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 533: getRelicSynergyScore `ownedRelics = []` default unreachable
 *   (cycle 222-532 silent dead config 시리즈 276번째 — redundant default annotation
 *   util/component/hook default 청소 메가 시리즈 29번째).
 *
 * 발견 (1 default unreachable):
 * - src/components/RelicChoicePanel.tsx (line 43):
 *     const getRelicSynergyScore = (newRelic: any,
 *         ownedRelics: any = []): any => {
 *         const ownedEffects = ownedRelics.map((r: any) => r.effect);
 *         const ownedNames = new Set(ownedRelics.map((r: any) => r.name));
 *         ...
 *     };
 * - 호출 사이트 (1 callsite, 모듈 내부 private):
 *     · RelicChoicePanel.tsx:153 — getRelicSynergyScore(relic, ownedRelics)
 *     · 다른 파일 import 0건 (private 모듈 helper).
 * - 결과: ownedRelics 항상 명시 전달. default [] 도달 불가.
 *
 * 패턴 (cycle 222-532 시리즈 276번째):
 * - cycle 502-532: util/component/hook default 청소 메가 시리즈 29사이클.
 * - cycle 533: components/ private helper — cycle 529/531에 이은 동일 lens.
 *
 * 수정 (src/components/RelicChoicePanel.tsx):
 * - signature에서 ownedRelics: any = [] → ownedRelics: any.
 * - body의 ownedRelics.map / RELIC_SYNERGIES.find 처리 보존.
 *
 * 회귀 가드:
 * - 1 internal callsite 동작 그대로.
 * - body legendarySyn / nearLegendary 분기 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 533: getRelicSynergyScore signature에서 ownedRelics default 0건', async () => {
    const source = await readSrc('src/components/RelicChoicePanel.tsx');
    const fnIdx = source.indexOf('const getRelicSynergyScore');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/ownedRelics:\s*any\s*=\s*\[\]/.test(sig),
        'getRelicSynergyScore ownedRelics default [] 제거');
    assert.ok(/\bownedRelics\b/.test(sig), 'ownedRelics 파라미터 자체는 보존');
});

test('cycle 533: 정합성 가드 — internal callsite 보존', async () => {
    const source = await readSrc('src/components/RelicChoicePanel.tsx');
    assert.ok(/getRelicSynergyScore\(relic,\s*ownedRelics\)/.test(source),
        'getRelicSynergyScore(relic, ownedRelics) callsite 보존');
});

test('cycle 533: body 분기 + ownedRelics.map 처리 보존', async () => {
    const source = await readSrc('src/components/RelicChoicePanel.tsx');
    assert.ok(/const ownedEffects = ownedRelics\.map\(\(r: any\) => r\.effect\)/.test(source),
        'ownedRelics.map(r => r.effect) 보존');
    assert.ok(/const ownedNames = new Set\(ownedRelics\.map\(\(r: any\) => r\.name\)\)/.test(source),
        'new Set(ownedRelics.map(r => r.name)) 보존');
    assert.ok(/RELIC_SYNERGIES\.find/.test(source), 'RELIC_SYNERGIES.find 분기 보존');
});

test('cycle 533: cycle 502-532 회귀 가드 — util/component/hook default 청소 시리즈 보존', async () => {
    const sh = await readSrc('src/hooks/gameActions/_shared.ts');
    assert.ok(!/buildClassVitals[^=]*meta:\s*any\s*=\s*\{\}/.test(sh),
        'cycle 532 buildClassVitals meta default 0건');

    const sp = await readSrc('src/components/ShopPanel.tsx');
    assert.ok(!/const formatPercent[^=]*value:\s*any\s*=\s*0/.test(sp),
        'cycle 531 formatPercent value default 0건');
});
