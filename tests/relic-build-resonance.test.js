import test from 'node:test';
import assert from 'node:assert/strict';

import { RELICS, RELIC_SYNERGIES, RELIC_EFFECTS_BY_BUILD, pickWeightedRelics } from '../src/data/relics.js';
import { RELIC_EFFECTS_BY_BUILD as RELIC_EFFECTS_BY_BUILD_UTIL } from '../src/utils/relicBuildFit.js';
import { getRelicChoiceDecisionStrip } from '../src/utils/relicChoiceDecision.js';
import { BALANCE } from '../src/data/constants.js';
import { MSG } from '../src/data/messages.js';

/**
 * Wave 4 O2 (빌드–유물 공명).
 *
 * `RELIC_EFFECTS_BY_BUILD`는 조언 UI(BuildAdvicePanel / relicChoiceDecision)에서만
 * 쓰이고 추첨 가중치는 건드리지 않았다 — 즉 게임은 "이 유물이 네 빌드에 맞다"고
 * 말하면서도 그 유물을 더 자주 보여 주지는 않았다. O2는 `pickWeightedRelics`에
 * `buildId`를 넘기면 그 빌드의 effect 5종 가중치에 BALANCE.RELIC_BUILD_FIT_WEIGHT_MULT를
 * 곱하도록 한다.
 *
 * 계약:
 *  1) buildId 미전달 경로는 완전히 불변 (기존 희귀도 분포 테스트 보호).
 *  2) buildId 전달 시 적합 유물 출현율이 대략 배율만큼 오른다.
 *  3) 시너지 pity 슬롯은 여전히 pity가 가진다 (공명이 pity를 덮지 않는다).
 */

const SAMPLES = 4000;

/** 고정 시드 LCG — 환경 무관 재현 (tests/relics.test.js와 동일 패턴). */
const makeRng = (seed) => {
    let state = seed >>> 0;
    return () => {
        state = (state * 1103515245 + 12345) % 2147483648;
        return state / 2147483648;
    };
};

const sampleFirstPick = (seed, options) => {
    const rng = makeRng(seed);
    const counts = new Map();
    for (let i = 0; i < SAMPLES; i += 1) {
        const [picked] = pickWeightedRelics(RELICS, 1, { ...options, rng });
        counts.set(picked.id, (counts.get(picked.id) || 0) + 1);
    }
    return counts;
};

const fitShare = (counts, buildId) => {
    const fitEffects = new Set(RELIC_EFFECTS_BY_BUILD[buildId]);
    const byId = new Map(RELICS.map((relic) => [relic.id, relic]));
    let fit = 0;
    let total = 0;
    for (const [id, n] of counts) {
        total += n;
        if (fitEffects.has(byId.get(id)?.effect)) fit += n;
    }
    return fit / total;
};

test('RELIC_EFFECTS_BY_BUILD는 data 계층이 단일 원천이고 utils가 그대로 re-export 한다', () => {
    assert.equal(RELIC_EFFECTS_BY_BUILD, RELIC_EFFECTS_BY_BUILD_UTIL, '같은 객체 참조여야 단일 원천');
    assert.ok(Object.isFrozen(RELIC_EFFECTS_BY_BUILD), '불변 데이터');
    for (const [buildId, effects] of Object.entries(RELIC_EFFECTS_BY_BUILD)) {
        assert.equal(effects.length, 5, `${buildId}는 effect 5종`);
    }
});

test('BALANCE.RELIC_BUILD_FIT_WEIGHT_MULT는 1보다 크고 과하지 않다', () => {
    assert.equal(typeof BALANCE.RELIC_BUILD_FIT_WEIGHT_MULT, 'number');
    assert.ok(BALANCE.RELIC_BUILD_FIT_WEIGHT_MULT > 1, '편향이 실제로 존재해야 함');
    assert.ok(BALANCE.RELIC_BUILD_FIT_WEIGHT_MULT <= 2.5, '다른 방향 유물이 사라질 만큼 세면 안 됨');
});

test('buildId 미전달 시 추첨 결과가 기존과 완전히 동일하다 (seed별 전수 비교)', () => {
    for (const seed of [987654321, 13579, 2468013579]) {
        const before = [];
        const rngA = makeRng(seed);
        for (let i = 0; i < 500; i += 1) before.push(pickWeightedRelics(RELICS, 3, { rng: rngA }).map((r) => r.id).join(','));

        const after = [];
        const rngB = makeRng(seed);
        for (let i = 0; i < 500; i += 1) {
            after.push(pickWeightedRelics(RELICS, 3, { rng: rngB, buildId: undefined }).map((r) => r.id).join(','));
        }
        assert.deepEqual(after, before, `seed ${seed}: buildId undefined는 무편향 경로와 동일해야 함`);
    }
});

test('알 수 없는 buildId는 무편향 경로와 동일하다 (방어적 fallback)', () => {
    const baseline = sampleFirstPick(987654321, {});
    const unknown = sampleFirstPick(987654321, { buildId: '존재하지_않는_빌드' });
    assert.deepEqual([...unknown.entries()].sort(), [...baseline.entries()].sort());
});

test('buildId 전달 시 적합 유물 출현율이 대략 가중치 배율만큼 오른다 (4,000회 표본)', () => {
    const mult = BALANCE.RELIC_BUILD_FIT_WEIGHT_MULT;
    const report = [];

    for (const buildId of ['fortress', 'arcane', 'explorer', 'crusher']) {
        const baseline = sampleFirstPick(987654321, {});
        const biased = sampleFirstPick(987654321, { buildId });

        const baseShare = fitShare(baseline, buildId);
        const biasShare = fitShare(biased, buildId);
        report.push(`${buildId}: ${(baseShare * 100).toFixed(2)}% → ${(biasShare * 100).toFixed(2)}%`);

        assert.ok(baseShare > 0, `${buildId}: 기준 표본에 적합 유물이 있어야 비교가 성립`);
        assert.ok(biasShare > baseShare, `${buildId}: 공명 후 적합 유물 비중이 올라야 함 (${report.at(-1)})`);

        // 기대 비율: 적합 유물 가중치가 mult배 되므로 점유율은 대략
        //   (mult * p) / (mult * p + (1 - p)) 로 이동한다. 표본 오차 ±25% 허용.
        const expected = (mult * baseShare) / (mult * baseShare + (1 - baseShare));
        const ratio = biasShare / expected;
        assert.ok(
            ratio > 0.75 && ratio < 1.25,
            `${buildId}: 실측 ${(biasShare * 100).toFixed(2)}% vs 기대 ${(expected * 100).toFixed(2)}% (비 ${ratio.toFixed(3)})`
        );
    }

    // 실측치를 로그로 남겨 밸런스 변경 시 diff에서 바로 보이게 한다.
    assert.ok(report.length === 4, report.join(' | '));
});

test('공명은 다른 방향 유물을 없애지 않는다 — 비적합 유물도 여전히 과반 가까이 뽑힌다', () => {
    const biased = sampleFirstPick(13579, { buildId: 'arcane' });
    const share = fitShare(biased, 'arcane');
    assert.ok(share < 0.5, `적합 유물 점유율 ${(share * 100).toFixed(2)}% — 빌드 고착을 만들면 안 된다`);
});

test('시너지 pity 슬롯은 빌드 공명보다 우선한다 (보장 슬롯을 빼앗기지 않음)', () => {
    // 2피스 시너지 중 하나를 골라 "1개만 더 모으면 완성" 상태를 만든다.
    const twoPiece = RELIC_SYNERGIES.find((syn) => syn.requires.length === 2);
    assert.ok(twoPiece, '2피스 시너지 표본 존재');
    const ownedName = twoPiece.requires[0];
    const missingName = twoPiece.requires[1];
    const owned = [RELICS.find((relic) => relic.name === ownedName)];
    const missing = RELICS.find((relic) => relic.name === missingName);
    assert.ok(owned[0] && missing, '시너지 구성 유물이 카탈로그에 존재');

    const pool = RELICS.filter((relic) => relic.name !== ownedName);

    // 보유 유물 1개로 "1개만 더 모으면 완성"이 되는 시너지의 잔여 유물 전부 (pity 후보군).
    const pityCandidateIds = new Set(RELIC_SYNERGIES
        .filter((syn) => syn.requires.length === 2 && syn.requires.includes(ownedName))
        .map((syn) => syn.requires.find((name) => name !== ownedName))
        .map((name) => RELICS.find((relic) => relic.name === name)?.id)
        .filter(Boolean));
    assert.ok(pityCandidateIds.has(missing.id), 'pity 후보군에 잔여 유물이 포함');

    // 잔여 유물의 effect가 속하지 '않는' 빌드를 골라, 공명이 pity를 밀어내는지 본다.
    const offBuildId = Object.keys(RELIC_EFFECTS_BY_BUILD)
        .find((id) => [...pityCandidateIds].every((candidateId) => {
            const effect = RELICS.find((relic) => relic.id === candidateId)?.effect;
            return !RELIC_EFFECTS_BY_BUILD[id].includes(effect);
        }));
    assert.ok(offBuildId, 'pity 후보와 무관한 빌드가 존재');

    const rng = makeRng(2468013579);
    for (let i = 0; i < 300; i += 1) {
        const picked = pickWeightedRelics(pool, 3, { owned, rng, buildId: offBuildId });
        assert.ok(
            picked.some((relic) => pityCandidateIds.has(relic.id)),
            `pity 슬롯이 빌드 공명에 밀리면 안 된다 (시도 ${i})`
        );
    }
});

test('추천 사유는 빌드 적합 여부를 실제로 구분한다', () => {
    const fitDecision = getRelicChoiceDecisionStrip([
        {
            index: 0,
            relic: { id: 'fit_mid', name: '재생 코어', rarity: 'uncommon', effect: 'battle_start_heal' },
            synergy: { score: 0, synergies: [] },
        },
    ], 'fortress');
    // fortress 4순위(battle_start_heal) — matched지만 rank 2 이상이라 '보완' 문구.
    assert.equal(fitDecision.cells[1].value, '현재 성장 보완');

    const offBuildDecision = getRelicChoiceDecisionStrip([
        {
            index: 0,
            relic: { id: 'off_build', name: '피의 서약', rarity: 'common', effect: 'on_kill_heal' },
            synergy: { score: 0, synergies: [] },
        },
    ], 'fortress');
    assert.equal(offBuildDecision.cells[1].value, MSG.RELIC_REASON_NEW_DIRECTION);
    assert.notEqual(offBuildDecision.cells[1].value, fitDecision.cells[1].value);
});

test('빌드 공명을 넘기는 유물 추첨 호출부가 소스에 유지된다 (회귀 가드)', async () => {
    const { readFile } = await import('node:fs/promises');
    const { fileURLToPath } = await import('node:url');
    const path = (await import('node:path')).default;
    const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
    const read = (rel) => readFile(path.join(ROOT, rel), 'utf8');

    const helpers = await read('src/hooks/combatActions/_helpers.ts');
    assert.match(helpers, /buildId:\s*getRunBuildProfile\(updatedPlayer, null\)\.primary\.id/);

    const character = await read('src/hooks/gameActions/characterActions.ts');
    assert.match(character, /buildId:\s*fullStartStats\?\.buildProfile\?\.primary\?\.id/);

    const events = await read('src/hooks/gameActions/eventActions.ts');
    assert.match(events, /buildId:\s*fullStats\?\.buildProfile\?\.primary\?\.id/);
    assert.match(events, /pickWeightedRelics\(available, count, \{ owned: ownedRelics, rng, buildId \}\)/);
});
