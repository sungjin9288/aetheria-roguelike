// 2026-10 원장 §142 — 자연 플레이 실제 경로의 상태 불변식.
//
// 리듀서 전이마다가 아니라 행동 하나를 마친 상태를 본다 — 한 행동 안의 중간 상태(적을 세운 뒤 전투 모드로 바꾸기 전)는
// 화면이 그리지 않는다. 감사(8경로 × 2시드 × 4회차, 행동 306,647개)에서 위반이 0이었고, 이 계약은 그 상태를 지킨다.
//
// 검사: 플레이어 숫자 필드에 NaN · Infinity가 없다, 생명 · 기력 · 골드 · 경험 ≥ 0, 골드는 정수, 레벨 범위, 전투 밖 생명 · 기력
// ≤ 실효 최대치(`calculateFullStats` — 전투 한정 보너스는 전투 안에서만), 가방 아이템 id 중복 없음 · 이름 있음, 장착 아이템이
// 가방에 겹치지 않음, 양손 무기와 보조 장비를 함께 끼지 않음, 유물 id 중복 없음 · 전투 밖 빌린 유물 없음 · 보유 수 ≤ 계승 단계 칸,
// 임무 진행도 ≤ 목표 · 진행 중인 임무가 수령 목록에 없음, 전투 모드 ↔ 적 · 이벤트 모드 ↔ 이벤트, 적 생명 ≤ 최대.
//
// 결함 주입으로 이 계약이 붉어지는 것: 회복 상한 없음 · 모닥불 이벤트 없이 이벤트 모드 · 소수 골드. 이 드라이버는 유물 칸이 찼을 때
// 추가하지 않고(교체 · 넘기기) 임무를 목표에 닿자마자 수령해서, 유물 칸 · 임무 진행도 상한을 지우는 결함은 여기서 드러나지 않는다 —
// 그 둘은 `chain-relic-capacity` · `explore-relic-full-capacity` · `level-quest-progress-cap`이 맡는다. 빠른 칸도 드라이버가 쓰지
// 않아 빠른 칸 정리 계약이 맡는다.
import test from 'node:test';
import assert from 'node:assert/strict';

import { DB } from '../src/data/db.ts';
import { CONSTANTS } from '../src/data/constants.ts';
import { calculateFullStats } from '../src/utils/statsCalculator.ts';
import { getPrestigeUnlocks } from '../src/systems/prestigeUnlocks.ts';
import { countOwnedRelics } from '../src/systems/chaosHeart.ts';
import { isTwoHandWeapon } from '../src/utils/equipmentValidation.ts';
import { JOB_PATHS, runNaturalPlay } from '../scripts/naturalPlay/driver.mjs';

const QUESTS_BY_ID = new Map(DB.QUESTS.map((quest) => [String(quest.id), quest]));

const findNonFinite = (value, path, depth, sink) => {
    if (depth > 4 || value == null) return;
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) sink.push(path);
        return;
    }
    if (typeof value !== 'object') return;
    if (Array.isArray(value)) {
        value.slice(0, 60).forEach((entry, index) => findNonFinite(entry, `${path}[${index}]`, depth + 1, sink));
        return;
    }
    for (const [key, entry] of Object.entries(value)) {
        if (key === 'killRegistry' || key === 'exploresByLocation' || key === 'codex') continue;
        findNonFinite(entry, `${path}.${key}`, depth + 1, sink);
    }
};

/** 한 정착 상태의 위반 목록과, 검사가 실제로 무엇을 봤는지(공허참 방지)의 표본. */
const inspectSettledState = (state, seen) => {
    const violations = [];
    const mode = state.gameState;
    const player = state.player;
    seen.modes.add(mode);
    if (mode === 'combat' && !state.enemy) violations.push('전투 모드인데 적이 없다');
    if (mode === 'event' && !state.currentEvent) violations.push('이벤트 모드인데 이벤트가 없다');
    if (state.enemy) {
        const enemy = state.enemy;
        if (![enemy.hp, enemy.maxHp, enemy.atk].every(Number.isFinite)) violations.push(`적 수치가 숫자가 아니다: ${enemy.name}`);
        else if (enemy.hp > enemy.maxHp) violations.push(`적 생명 > 최대: ${enemy.name} ${enemy.hp}/${enemy.maxHp}`);
    }
    if (!player) return violations;
    const nonFinite = [];
    findNonFinite(player, 'player', 0, nonFinite);
    if (nonFinite.length) violations.push(`NaN · Infinity: ${nonFinite.slice(0, 3).join(', ')}`);
    for (const key of ['hp', 'mp', 'gold', 'exp']) if (!(Number(player[key]) >= 0)) violations.push(`${key} < 0: ${player[key]}`);
    if (!Number.isInteger(player.gold)) violations.push(`골드가 정수가 아니다: ${player.gold}`);
    if (!(Number.isInteger(player.level) && player.level >= 1 && player.level <= CONSTANTS.MAX_LEVEL)) violations.push(`레벨 범위 밖: ${player.level}`);
    if (mode !== 'combat') {
        const full = calculateFullStats(player);
        seen.vitalsChecks += 1;
        if (player.hp > full.maxHp + 0.5) violations.push(`생명 > 실효 최대: ${player.hp}/${full.maxHp}`);
        if (player.mp > full.maxMp + 0.5) violations.push(`기력 > 실효 최대: ${player.mp}/${full.maxMp}`);
        const relics = player.relics || [];
        if (relics.some((relic) => relic?.borrowed)) violations.push('전투 밖에 빌린 유물이 남았다');
        const owned = countOwnedRelics(relics);
        const cap = getPrestigeUnlocks(player.meta?.prestigeRank).maxRelics;
        seen.maxRelicFill = Math.max(seen.maxRelicFill, owned / cap);
        if (owned > cap) violations.push(`유물 ${owned} > 칸 ${cap}`);
    }
    const bagIds = new Set();
    for (const item of player.inv || []) {
        if (!item?.name) violations.push('이름 없는 가방 아이템');
        if (bagIds.has(item?.id)) violations.push(`가방 id 중복: ${item?.name}`);
        bagIds.add(item?.id);
    }
    seen.maxBag = Math.max(seen.maxBag, bagIds.size);
    for (const [slot, item] of Object.entries(player.equip || {})) {
        if (item && bagIds.has(item.id)) violations.push(`장착 아이템이 가방에도 있다: ${slot} ${item.name}`);
    }
    if (isTwoHandWeapon(player.equip?.weapon) && player.equip?.offhand) violations.push('양손 무기와 보조 장비를 함께 꼈다');
    const relicIds = (player.relics || []).map((relic) => relic?.id);
    if (new Set(relicIds).size !== relicIds.length) violations.push('유물 id 중복');
    const claimed = new Set((player.stats?.claimedQuestIds || []).map(String));
    for (const quest of player.quests || []) {
        const key = String(quest?.id);
        const goal = Number((quest?.isBounty ? quest : QUESTS_BY_ID.get(key))?.goal);
        seen.questChecks += 1;
        if (Number.isFinite(goal) && quest.progress > goal) violations.push(`임무 ${key} 진행도 ${quest.progress} > 목표 ${goal}`);
        if (claimed.has(key)) violations.push(`임무 ${key}가 진행 중이면서 수령 목록에 있다`);
    }
    return violations;
};

test('[실제 경로] 자연 플레이의 정착 상태는 불변식을 지킨다 — 생명 · 기력 상한 · 유물 칸 · 임무 진행도 · 모드 짝 · 숫자', async () => {
    const seen = { modes: new Set(), vitalsChecks: 0, questChecks: 0, maxRelicFill: 0, maxBag: 0, settled: 0 };
    const violations = new Map();
    const settle = (state) => {
        seen.settled += 1;
        for (const message of inspectSettledState(state, seen)) violations.set(message.replace(/\d+/gu, '#'), message);
    };
    // 행동 경계마다 검사한다 — 드라이버의 가짜 시계는 행동마다 한 칸 가므로, 시계가 바뀐 첫 dispatch의 prev가 직전 행동이
    //   끝난 상태다. (마이크로태스크 · setImmediate로 미루면 드라이버의 await이 양보하지 않아 회차 끝에 몇 번만 돈다.)
    let lastNow = null;
    let latest = null;
    const onDispatch = (prev, _action, next) => {
        const now = Date.now();
        if (lastNow !== null && now !== lastNow) settle(prev);
        lastNow = now;
        latest = next;
    };
    for (const path of ['cleric', 'assassin']) {
        lastNow = null;
        latest = null;
        await runNaturalPlay({ seed: 3, jobPath: JOB_PATHS[path], runs: 1, maxSteps: 3000, onDispatch });
        if (latest) settle(latest);
    }
    assert.deepEqual([...violations.values()].slice(0, 12), []);
    // 검사가 공허하지 않다: 여러 모드를 지나고, 유물 칸이 차고, 임무를 들고 다녔다.
    assert.ok(seen.settled >= 5998, `정착 상태 ${seen.settled}`);
    for (const mode of ['idle', 'combat', 'event']) assert.ok(seen.modes.has(mode), `${mode} 모드를 지난다`);
    assert.ok(seen.vitalsChecks > 1000, `생명 · 기력 상한 검사 ${seen.vitalsChecks}`);
    assert.ok(seen.questChecks > 100, `임무 진행도 검사 ${seen.questChecks}`);
    assert.equal(seen.maxRelicFill, 1, '유물 칸이 가득 찬 상태까지 본다');
});
