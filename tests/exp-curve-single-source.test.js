/**
 * 경험 요구량 곡선은 한 곳(src/systems/expCurve.ts)이 소유한다 — 2026-11 H2 커밋 1.
 *
 * 같은 점화식(× EXP_SCALE_RATE, EXP_LEVEL_HARD_CAP 상한)이 엔진 · 초반 임무 보상 완화 · 원정 결산 · QA 시드
 * 네 곳에 따로 적혀 있었다. 이 파일은 (1) 두 상수를 읽는 src 파일이 정본 하나뿐이고 (2) 네 소비처가
 * 정본과 같은 값을 낸다(올바른 레벨을 넘긴다)는 것을 잡는다. 곡선 값 자체의 독립 오라클은
 * tests/progression-simulator.test.js의 누적 경험 사다리 하나다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { CONSTANTS } from '../src/data/constants.ts';
import { CombatEngine } from '../src/systems/CombatEngine.ts';
import { getLevelExpRequirement, getNextExpRequirement } from '../src/systems/expCurve.ts';
import { getPacedQuestClaimExp } from '../src/utils/progressionPacing.ts';
import { calculateExpeditionExpGain } from '../src/utils/expeditionLedger.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OWNER = 'src/systems/expCurve.ts';
const DEFINER = 'src/data/constants.ts';
const CURVE_READ = /\bBALANCE\s*\.\s*(EXP_SCALE_RATE|EXP_LEVEL_HARD_CAP)\b/;
/** 표준 곡선에 없는 요구량 — 옛 세이브 · 손으로 만든 픽스처의 모양이다. */
const NONSTANDARD_REQUIREMENT = 280000;

const walk = async (dir) => {
    const out = [];
    for (const entry of await readdir(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...await walk(full));
        else if (/\.(ts|tsx|js|mjs)$/.test(entry.name)) out.push(full);
    }
    return out;
};

const makePlayer = (level, nextExp) => ({
    level, exp: 0, nextExp, gold: 0,
    hp: 100, maxHp: 100, mp: 50, maxMp: 50, atk: 10, def: 5,
    stats: {}, meta: {},
});

test('부재 불변식: 경험 곡선 상수를 읽는 src 파일은 expCurve.ts 하나다', async () => {
    const readers = [];
    for (const file of await walk(path.join(ROOT, 'src'))) {
        const rel = path.relative(ROOT, file).split(path.sep).join('/');
        if (rel === DEFINER) continue;
        if (CURVE_READ.test(await readFile(file, 'utf8'))) readers.push(rel);
    }
    assert.deepEqual(readers, [OWNER]);
});

test('정본: 레벨 인덱스형은 점화식을 START_NEXT_EXP부터 굴린 값이다', () => {
    let requirement = CONSTANTS.START_NEXT_EXP;
    for (let level = 1; level <= CONSTANTS.MAX_LEVEL; level += 1) {
        assert.equal(getLevelExpRequirement(level), requirement, `Lv${level}`);
        requirement = getNextExpRequirement(level + 1, requirement);
    }
});

test('엔진 applyExpGain: 레벨업 뒤 요구량 = 정본(새 레벨) — 표준 곡선 Lv1-98 · 비표준 요구량', () => {
    for (let level = 1; level < CONSTANTS.MAX_LEVEL; level += 1) {
        for (const requirement of [getLevelExpRequirement(level), NONSTANDARD_REQUIREMENT]) {
            const { updatedPlayer } = CombatEngine.applyExpGain(makePlayer(level, requirement), requirement);
            assert.equal(updatedPlayer.level, level + 1, `Lv${level} (${requirement})`);
            assert.equal(updatedPlayer.nextExp, getNextExpRequirement(level + 1, requirement), `Lv${level} (${requirement})`);
        }
    }
});

test('엔진 applyExpGain: 새 캐릭터를 레벨마다 굴린 요구량 = 레벨 인덱스형', () => {
    let player = makePlayer(1, CONSTANTS.START_NEXT_EXP);
    while (player.level < CONSTANTS.MAX_LEVEL) {
        player = CombatEngine.applyExpGain(player, player.nextExp - player.exp).updatedPlayer;
        assert.equal(player.nextExp, getLevelExpRequirement(player.level), `Lv${player.level}`);
    }
});

test('초반 임무 보상 완화: 다음 레벨 요구량을 정본(레벨 + 1)으로 센다 — Lv1-9 · 비표준 요구량', () => {
    const FILL = 0.85;
    for (let level = 1; level <= 9; level += 1) {
        for (const requirement of [getLevelExpRequirement(level), NONSTANDARD_REQUIREMENT]) {
            const expected = requirement + Math.floor(getNextExpRequirement(level + 1, requirement) * FILL);
            const paced = getPacedQuestClaimExp(makePlayer(level, requirement), Number.MAX_SAFE_INTEGER);
            assert.equal(paced, expected, `Lv${level} (${requirement})`);
        }
    }
});

test('원정 결산 경험: 지나간 레벨의 요구량을 정본으로 더한다 — 표준 곡선 · 비표준 시작 요구량', () => {
    for (const startLevel of [1, 7, 30, 41, 47, 60]) {
        for (const endLevel of [startLevel + 1, startLevel + 2, startLevel + 9]) {
            const standard = { startLevel, startExp: 0, startNextExp: getLevelExpRequirement(startLevel) };
            let expected = 0;
            for (let level = startLevel; level < endLevel; level += 1) expected += getLevelExpRequirement(level);
            assert.equal(calculateExpeditionExpGain(standard, { level: endLevel, exp: 0 }), expected, `${startLevel}→${endLevel}`);

            const odd = { startLevel, startExp: 0, startNextExp: NONSTANDARD_REQUIREMENT };
            let oddExpected = 0;
            let requirement = NONSTANDARD_REQUIREMENT;
            for (let level = startLevel; level < endLevel; level += 1) {
                oddExpected += requirement;
                requirement = getNextExpRequirement(level + 1, requirement);
            }
            assert.equal(calculateExpeditionExpGain(odd, { level: endLevel, exp: 0 }), oddExpected, `${startLevel}→${endLevel} (비표준)`);
        }
    }
});
