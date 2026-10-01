import test from 'node:test';
import assert from 'node:assert/strict';

import { BALANCE } from '../src/data/constants.js';
import { MSG } from '../src/data/messages.js';
import { BOSS_BRIEFS, MONSTERS } from '../src/data/monsters.js';
import { MAPS } from '../src/data/maps.js';
import { DROP_TABLES } from '../src/data/dropTables.js';
import { ARCHETYPE_LABELS } from '../src/data/traits.js';
import { DB } from '../src/data/db.js';
import { SIGNATURE_ITEM_REGISTRY } from '../src/data/signatureItems.js';
import { AT } from '../src/reducers/actionTypes.js';
import { CombatEngine } from '../src/systems/CombatEngine.js';
import { getBossThemedLootPool, processLoot } from '../src/systems/CombatEngine.loot.js';
import { resolveCombatActionTurn } from '../src/systems/combatActionTurn.js';
import { getPhaseStatuses } from '../src/systems/bossMechanics.js';
import { calculateFullStats } from '../src/utils/statsCalculator.js';
import { getCombatForecast } from '../src/utils/combatForecast.js';
import { spawnEnemy } from '../src/utils/exploreUtils.js';
import { pickBossRewardRelics } from '../src/utils/bossRelicReward.js';
import { applyBossRelicReward } from '../src/hooks/combatActions/_helpers.js';

/**
 * 2026-10 Wave 59 — 보스 기믹 · 보상(소유자 결정 "보스 기믹 전부 설명대로 구현" · "보스 보상 설명대로 구현 + 측정" ·
 * 약해지는 쪽 "전부 설명대로"). 감사 3회차에서 보스 브리핑이 약속한 행동 25건이 엔진에 없거나 달랐다 — 누적 · 연속 기절 ·
 * 반격 · 소환 · 회복 · 브레스 · 장기전이 없었고, 2페이즈 문턱은 40~60% 무작위였으며, 유물 · 계열 장비 · 대량 초회 보상은
 * 약속만 있었다. 이 파일은 (1) 브리핑 문구 ↔ 데이터 선언, (2) 데이터 선언 ↔ 실제 엔진 동작을 함께 지킨다.
 */

const BRIEFED = Object.keys(BOSS_BRIEFS);
const briefText = (name) => {
    const brief = BOSS_BRIEFS[name];
    return [brief.signature, brief.entryHint, brief.counterHint, brief.phaseHint, brief.rewardHint, ...brief.warningChips].join(' ');
};
const phaseStatuses = (name) => [
    ...getPhaseStatuses(MONSTERS[name].phase2),
    ...getPhaseStatuses(MONSTERS[name].phase3),
];

const makePlayer = (extra = {}) => ({
    name: '시험자', job: '전사', level: 40, hp: 40_000, maxHp: 40_000, mp: 200, maxMp: 200, atk: 200, def: 60, gold: 0,
    inv: [], equip: {}, relics: [], status: [], titles: [], stats: { kills: 0 }, meta: {},
    skillLoadout: { selected: 0, cooldowns: {} }, combatFlags: {}, ...extra,
});
/** 보스 템플릿을 고정 수치 인스턴스로 — 스폰이 복사하는 필드(pattern · phase · mechanics)를 그대로 싣는다. */
const makeBoss = (name, extra = {}) => {
    const profile = MONSTERS[name];
    return {
        name, baseName: name, level: 40, hp: 5_000, maxHp: 5_000, atk: 300, def: 50, exp: 500, gold: 300, isBoss: true,
        pattern: { guardChance: 0.2, heavyChance: 0.3, ...(profile.pattern || {}) },
        phase2: profile.phase2, phase3: profile.phase3, mechanics: profile.mechanics,
        weakness: profile.weakness, resistance: profile.resistance,
        ...extra,
    };
};
const stats = (player) => calculateFullStats(player);
const act = (player, enemy, rng) => CombatEngine.enemyAttack(player, enemy, stats(player), rng);
const texts = (result) => result.logs.map((log) => log.text);
const spawnBoss = (name, mapName) => {
    const map = { ...MAPS[mapName], monsters: [name], bossMonsters: [name] };
    const { mStats } = spawnEnemy(map, makePlayer({ level: 1, loc: mapName }), [], { addLog: () => {} }, { rng: () => 0.99 });
    return mStats;
};

// ── 1. 브리핑 문구 ↔ 데이터 선언 ───────────────────────────────────────────

test('브리핑이 "누적" · "중첩"을 말하는 보스는 그 상태를 강타로 쌓는다(maxStacks)', () => {
    const STACK_WORDS = { '화상 누적': 'burn', '독 누적': 'poison', '빙결 누적': 'freeze', '저주가 중첩': 'curse' };
    let checked = 0;
    for (const name of BRIEFED) {
        for (const [word, status] of Object.entries(STACK_WORDS)) {
            if (!briefText(name).includes(word)) continue;
            const heavy = MONSTERS[name].mechanics?.heavyStatus;
            assert.equal(heavy?.status, status, `${name}: "${word}" → heavyStatus ${status}`);
            assert.ok((heavy?.maxStacks ?? 0) > 1, `${name}: "${word}" → 쌓인다`);
            checked += 1;
        }
    }
    assert.equal(checked, 6, '화염의 군주 · 이프리트(화상) · 스핑크스(독) · 아이스 드래곤 · 호수 수호신(빙결) · 네크론(저주)');
});

test('"연속 기절" · "기절 연속" · "강타와 제어"를 말하는 보스는 2페이즈 강타가 기절을 건다', () => {
    for (const name of ['시간의 파수꾼', '천둥새 제피로스', '영겁의 수문장']) {
        const text = briefText(name);
        assert.match(text, /연속 기절|기절 연속|강타와 제어/, name);
        assert.equal(MONSTERS[name].mechanics?.heavyStatus?.status, 'stun', name);
    }
    // 영겁의 수문장 "모든 시간이 멈춥니다!" — 전환 때도 기절이다(이전 독).
    assert.deepEqual(getPhaseStatuses(MONSTERS['영겁의 수문장'].phase2), ['stun']);
});

test('칩 · 문구가 약속한 행동은 데이터가 선언한다 — 카운터 · 회복 · 브레스 · 소환 · 장기전 · 저항 무력화', () => {
    const declared = (name, key) => Boolean(MONSTERS[name].mechanics?.[key]);
    for (const name of BRIEFED) {
        const text = briefText(name);
        assert.equal(declared(name, 'guardCounter'), /카운터/.test(text), `${name} 카운터`);
        assert.equal(declared(name, 'guardHeal'), /회복 압박/.test(text), `${name} 회복 압박`);
        assert.equal(declared(name, 'breath'), /브레스/.test(text), `${name} 브레스`);
        assert.equal(declared(name, 'summon'), /소환/.test(text), `${name} 소환`);
        assert.equal(declared(name, 'longFightEnrage'), /장기전 운영은 피하|긴 교전은 .*손해/.test(text), `${name} 장기전 손해`);
        assert.equal(declared(name, 'longFightReward'), /장기전 보상/.test(text), `${name} 장기전 보상`);
        const pierceLog = [MONSTERS[name].phase2?.log, MONSTERS[name].phase3?.log].some((log) => /저항이 무력화/.test(log || ''));
        const pierceDeclared = Boolean(MONSTERS[name].phase2?.pierceResist || MONSTERS[name].phase3?.pierceResist);
        assert.equal(pierceDeclared, pierceLog, `${name} 저항 무력화`);
    }
});

test('브리핑이 말하는 상태 종류가 페이즈 상태와 같다 — 아누비스 저주 · 빙결의 마녀 빙결+저주 · 아이스 드래곤 빙결 · 종말의 기사 화상+저주', () => {
    assert.deepEqual(getPhaseStatuses(MONSTERS['아누비스 수호자'].phase2), ['curse']);
    assert.doesNotMatch(briefText('아누비스 수호자'), /독성/);
    assert.deepEqual(getPhaseStatuses(MONSTERS['빙결의 마녀'].phase2), ['freeze', 'curse']);
    assert.deepEqual(getPhaseStatuses(MONSTERS['아이스 드래곤'].phase2), ['freeze']);
    assert.deepEqual(getPhaseStatuses(MONSTERS['종말의 기사'].phase3).sort(), ['burn', 'curse']);
    // 칩이 말하는 상태는 페이즈 · 강타 상태 중 하나다.
    const CHIP_STATUS = { 화상: 'burn', 독: 'poison', 빙결: 'freeze', 저주: 'curse', 기절: 'stun' };
    for (const name of BRIEFED) {
        const statuses = new Set([...phaseStatuses(name), MONSTERS[name].mechanics?.heavyStatus?.status].filter(Boolean));
        for (const chip of BOSS_BRIEFS[name].warningChips) {
            for (const [word, status] of Object.entries(CHIP_STATUS)) {
                if (chip.startsWith(word) || chip.includes(`+${word}`) || chip.endsWith(word)) {
                    assert.ok(statuses.has(status), `${name} 칩 "${chip}" → ${status}`);
                }
            }
        }
    }
});

test('"가드 빈도가 높아집니다" · "가드와 독이 섞이므로" — 2페이즈 방어 확률이 스폰된 1페이즈보다 높다', () => {
    for (const [name, mapName] of [['차원 파쇄자', '에테르 관문'], ['스핑크스', '피라미드']]) {
        const spawned = spawnBoss(name, mapName);
        assert.ok(spawned.phase2.pattern.guardChance > spawned.pattern.guardChance,
            `${name}: ${spawned.pattern.guardChance} → ${spawned.phase2.pattern.guardChance}`);
    }
});

test('"높은 가드" 보스는 방어가 가장 잦은 행동이고 예고도 방어를 말한다', () => {
    const pattern = MONSTERS['고대 호수의 수호신'].pattern;
    assert.ok(pattern.guardChance > pattern.heavyChance && pattern.guardChance > 1 - pattern.guardChance - pattern.heavyChance);
    assert.equal(CombatEngine.predictEnemyNextAction(makeBoss('고대 호수의 수호신')).type, 'guard');
});

test('추천 빌드는 실제 빌드 라벨이다(직업 이름 금지)', () => {
    const labels = new Set(Object.values(ARCHETYPE_LABELS));
    for (const name of BRIEFED) {
        for (const build of BOSS_BRIEFS[name].recommendedBuilds) assert.ok(labels.has(build), `${name}: ${build}`);
    }
});

test('보상 약속 — 유물 드랍 · 계열 장비 · 대량 초회 · 호수 무기', () => {
    for (const name of BRIEFED) {
        const reward = BOSS_BRIEFS[name].rewardHint;
        const mechanics = MONSTERS[name].mechanics || {};
        assert.equal(Boolean(mechanics.relicReward), /유물/.test(reward), `${name} 유물`);
        assert.equal((mechanics.firstClearBonusMult ?? 1) > 1, /대량|첫 토벌 보상이 커/.test(reward), `${name} 대량 초회`);
        // 계열을 약속하고 드롭 표가 없는 보스는 계열 풀을 선언한다(드롭 표가 있는 보스는 표가 계열을 담는다).
        if (!DROP_TABLES[name] && /계열 .*장비|계열 상위 장비|계열 최상위 장비|계열 희귀 장비|계열 전설 장비/.test(reward)) {
            assert.ok(mechanics.lootTheme, `${name} 계열 장비`);
        }
    }
    const lakeWeapons = DROP_TABLES['고대 호수의 수호신']
        .map((entry) => DB.ITEMS.weapons.find((weapon) => weapon.name === entry.item))
        .filter(Boolean);
    assert.ok(lakeWeapons.some((weapon) => weapon.elem === '자연'), '자연 무기');
    assert.ok(lakeWeapons.some((weapon) => weapon.elem === '냉기'), '냉기 무기');
});

test('계열 장비 풀은 비지 않고, 전설 각인이 아니며, 계열(원소 · 이름 · 직업)과 최소 등급을 지킨다', () => {
    const themed = Object.keys(MONSTERS).filter((name) => MONSTERS[name].mechanics?.lootTheme);
    assert.equal(themed.length, 8);
    for (const name of themed) {
        const theme = MONSTERS[name].mechanics.lootTheme;
        const pool = getBossThemedLootPool(makeBoss(name));
        assert.ok(pool.length > 0, name);
        for (const item of pool) {
            assert.ok(!SIGNATURE_ITEM_REGISTRY[item.name], `${name}: ${item.name}는 전설 각인`);
            assert.ok((item.tier || 1) >= (theme.minTier ?? 1), `${name}: ${item.name} 등급`);
            const matches = (theme.elems || []).includes(item.elem)
                || (theme.nameIncludes || []).some((keyword) => item.name.includes(keyword))
                || (theme.jobs || []).some((job) => (item.jobs || []).includes(job));
            assert.ok(matches, `${name}: ${item.name}`);
        }
    }
    // 바람 계열 — 이전 6등급 무작위 풀에는 바람 장비가 0종이었다.
    assert.ok(getBossThemedLootPool(makeBoss('천둥새 제피로스')).every((item) => item.elem === '바람' || /바람|폭풍/.test(item.name)));
});

test('스폰은 보스 기믹을 인스턴스로 복사한다', () => {
    const spawned = spawnBoss('고대 호수의 수호신', '신성한 호수');
    assert.deepEqual(spawned.mechanics, MONSTERS['고대 호수의 수호신'].mechanics);
});

// ── 2. 데이터 선언 ↔ 엔진 동작 ────────────────────────────────────────────

test('2페이즈 문턱은 데이터 값 그대로다 — 51%에서는 어떤 난수로도 넘어가지 않고 50%에서는 항상 넘어간다', () => {
    for (const roll of [0, 0.5, 0.9999]) {
        assert.ok(!act(makePlayer(), makeBoss('화염의 군주', { hp: 2_550 }), () => roll).updatedEnemy.phase2Triggered, `51% · ${roll}`);
        assert.ok(act(makePlayer(), makeBoss('화염의 군주', { hp: 2_500 }), () => roll).updatedEnemy.phase2Triggered, `50% · ${roll}`);
    }
});

test('한 행동에 두 문턱을 함께 넘으면 3페이즈의 이름 · 패턴이 남고 두 페이즈의 상태가 모두 걸린다', () => {
    for (const name of ['마왕', '공허의 군주', '원시의 신', '에테르 심판자', '공허의 대행자', '종말의 기사']) {
        const result = act(makePlayer(), makeBoss(name, { hp: 500 }), () => 0.99);
        assert.equal(result.updatedEnemy.name, MONSTERS[name].phase3.name, name);
        assert.equal(result.updatedEnemy.pattern.heavyChance, MONSTERS[name].phase3.pattern.heavyChance, name);
        for (const status of phaseStatuses(name)) assert.ok(result.updatedPlayer.status.includes(status), `${name}: ${status}`);
    }
});

test('페이즈 상태 로그는 한국어 라벨이다(기절 · 출혈 포함)', () => {
    const result = act(makePlayer(), makeBoss('시간의 파수꾼', { hp: 2_000 }), () => 0.99);
    assert.ok(texts(result).includes(MSG.ENEMY_PHASE_STATUS_APPLIED(2, MSG.DOT_LABELS.stun)));
    assert.ok(!texts(result).some((text) => /\[stun\]|\[bleed\]/.test(text)));
});

test('누적 — 2페이즈 강타가 화상을 3중첩까지 쌓고, 중첩마다 틱 피해가 커진다(3중첩 = 2배)', () => {
    let player = makePlayer();
    let enemy = makeBoss('화염의 군주', { hp: 2_400 });
    // 강타(0.1 < 0 + 0.55) · 누적 확률 통과(0.1 < 0.5)
    const stackLogs = [];
    for (let i = 0; i < 5; i += 1) {
        const result = act(player, enemy, () => 0.1);
        stackLogs.push(...texts(result).filter((text) => text.startsWith(`[${MSG.DOT_LABELS.burn}] `) && text.includes('중첩')));
        player = result.updatedPlayer;
        enemy = result.updatedEnemy;
    }
    assert.equal(player.statusStacks.burn, 3);
    // 오를 때만 알린다(최대 중첩에서는 지속 턴만 갱신).
    assert.deepEqual(stackLogs, [MSG.PLAYER_STATUS_STACKED(MSG.DOT_LABELS.burn, 2), MSG.PLAYER_STATUS_STACKED(MSG.DOT_LABELS.burn, 3)]);
    assert.equal(player.statusTurns.burn, BALANCE.PLAYER_STATUS_DURATION_TURNS);
    const tickAt = (stacks) => {
        const base = { ...makePlayer({ hp: 10_000, maxHp: 10_000 }), status: ['burn'], statusTurns: { burn: 3 }, statusStacks: { burn: stacks } };
        return 10_000 - CombatEngine.tickCombatState(base).updatedPlayer.hp;
    };
    assert.equal(tickAt(1), Math.floor(10_000 * BALANCE.STATUS_DOT_RATIO));
    assert.equal(tickAt(3), Math.floor(10_000 * BALANCE.STATUS_DOT_RATIO * 2));
    // 2페이즈 전에는 강타여도 걸지 않는다(0.3 = 방어 0.2 위 · 강타 0.5 아래 · 누적 확률 0.5 아래).
    const early = act(makePlayer(), makeBoss('화염의 군주'), () => 0.3);
    assert.ok(early.isCrit, '강타');
    assert.equal(early.updatedPlayer.status.includes('burn'), false);
});

test('저주 중첩 — 받는 피해 증폭이 중첩마다 커진다(1중첩 +30% · 3중첩 +60%)', () => {
    const enemy = { name: '시험 적', baseName: '시험 적', level: 40, hp: 5_000, maxHp: 5_000, atk: 300, def: 0, pattern: { guardChance: 0, heavyChance: 0 } };
    const damageWith = (stacks) => act(makePlayer({ status: ['curse'], statusStacks: { curse: stacks } }), enemy, () => 0.5).damage;
    const base = act(makePlayer(), enemy, () => 0.5).damage;
    assert.equal(damageWith(1), Math.floor(base * 1.3));
    assert.equal(damageWith(3), Math.floor(base * 1.6));
});

test('빙결 누적 — 2페이즈 강타가 냉기를 쌓고 세 번째에 얼어붙는다', () => {
    let player = makePlayer({ status: ['freeze'] }); // 전환 빙결은 이미 걸린 상태로 시작(누적만 본다)
    let enemy = makeBoss('아이스 드래곤', { phase2Triggered: true, pattern: { guardChance: 0.05, heavyChance: 0.55 } });
    player = { ...player, status: [] };
    const seen = [];
    for (let i = 0; i < 3; i += 1) {
        const result = act(player, enemy, () => 0.3);
        player = result.updatedPlayer;
        enemy = result.updatedEnemy;
        seen.push(player.combatFlags.frostStacks);
    }
    assert.deepEqual(seen, [1, 2, 0]);
    assert.ok(player.status.includes('freeze'));
});

test('연속 기절 — 2페이즈 강타마다 확률로 기절을 다시 건다(전환 1번이 아니다)', () => {
    let player = makePlayer();
    let enemy = makeBoss('시간의 파수꾼', { phase2Triggered: true, pattern: { guardChance: 0, heavyChance: 0.65 } });
    let stuns = 0;
    for (let i = 0; i < 5; i += 1) {
        const result = act(player, enemy, () => 0.2);
        if (result.updatedPlayer.status.includes('stun')) stuns += 1;
        // 플레이어 행동이 기절에 막혀 상태가 빠진 것과 같다.
        player = { ...result.updatedPlayer, status: result.updatedPlayer.status.filter((status) => status !== 'stun') };
        enemy = result.updatedEnemy;
    }
    assert.equal(stuns, 5);
});

test('강한 카운터 — 방어 자세 중인 보스를 때리면 반격당하고, 방어 자세가 아니면 반격이 없다', () => {
    const player = makePlayer();
    const guarded = resolveCombatActionTurn({ player, enemy: makeBoss('아이스 드래곤', { guarding: true }), kind: 'attack', initialPlayer: player, seed: 7, now: 0 });
    const open = resolveCombatActionTurn({ player, enemy: makeBoss('아이스 드래곤'), kind: 'attack', initialPlayer: player, seed: 7, now: 0 });
    assert.ok(guarded.logs.some((log) => log.text.startsWith('[반격] 아이스 드래곤의 반격!')));
    assert.ok(!open.logs.some((log) => log.text.startsWith('[반격]')));
    // 반격 없는 보스는 방어 자세여도 반격하지 않는다.
    const plain = resolveCombatActionTurn({ player, enemy: makeBoss('레드 드래곤', { guarding: true }), kind: 'attack', initialPlayer: player, seed: 7, now: 0 });
    assert.ok(!plain.logs.some((log) => log.text.startsWith('[반격]')));
    // 방어 자세는 반격 자세라고 알린다.
    const stance = act(player, makeBoss('아이스 드래곤', { pattern: { guardChance: 1, heavyChance: 0 } }), () => 0.1);
    assert.ok(texts(stance).includes(MSG.ENEMY_GUARD_COUNTER_STANCE('아이스 드래곤')));
});

test('회복 압박 — 방어 자세마다 최대 생명의 6%를 회복한다(최대치를 넘지 않는다)', () => {
    const healed = act(makePlayer(), makeBoss('고대 호수의 수호신', { hp: 3_000 }), () => 0.1);
    assert.equal(healed.updatedEnemy.hp, 3_000 + Math.floor(5_000 * MONSTERS['고대 호수의 수호신'].mechanics.guardHeal));
    const nearFull = act(makePlayer(), makeBoss('고대 호수의 수호신', { hp: 4_900 }), () => 0.1);
    assert.equal(nearFull.updatedEnemy.hp, 5_000);
});

test('브레스 — 세 번째 행동마다 방어 없이 브레스이고, 예고가 그 차례를 알리며, 브레스 차례에 기절시키면 넘어간다', () => {
    let player = makePlayer();
    let enemy = makeBoss('레드 드래곤', { pattern: { guardChance: 0.9, heavyChance: 0 } });
    const kinds = [];
    for (let i = 0; i < 6; i += 1) {
        const telegraph = CombatEngine.predictEnemyNextAction(enemy);
        const result = act(player, enemy, () => 0.1);
        kinds.push(`${telegraph.type}:${result.updatedEnemy.guarding ? 'guard' : texts(result).at(-1).startsWith('🔥') ? 'breath' : 'hit'}`);
        player = result.updatedPlayer;
        enemy = result.updatedEnemy;
    }
    assert.deepEqual(kinds, ['guard:guard', 'guard:guard', 'breath:breath', 'guard:guard', 'guard:guard', 'breath:breath']);
    const stunned = act(makePlayer(), makeBoss('레드 드래곤', { actionCount: 2, stunnedTurns: 1 }), () => 0.1);
    assert.ok(!texts(stunned).some((text) => text.startsWith('🔥')));
    assert.equal(stunned.updatedEnemy.actionCount, 3);
});

test('망자 소환 — 2페이즈 전환에 깨어나 다음 행동부터 함께 치고, 내 피해 행동 하나에 하나씩 쓰러진다', () => {
    const transition = act(makePlayer(), makeBoss('묘지기 네크론', { hp: 2_400 }), () => 0.9);
    assert.equal(transition.updatedEnemy.summons, 2);
    assert.ok(!texts(transition).some((text) => text.startsWith('[망자')));
    const next = act(transition.updatedPlayer, transition.updatedEnemy, () => 0.9);
    assert.ok(texts(next).some((text) => text.startsWith('[망자 2체] 함께 공격!')));
    const player = makePlayer();
    const turn = resolveCombatActionTurn({ player, enemy: next.updatedEnemy, kind: 'attack', initialPlayer: player, seed: 3, now: 0 });
    assert.ok(turn.logs.some((log) => log.text === MSG.ENEMY_SUMMON_SLAIN('망자', 1)));
    assert.ok(turn.logs.some((log) => log.text.startsWith('[망자 1체] 함께 공격!')));
});

test('장기전 손해 — 8번째 행동 뒤로 행동마다 공격력 +5%, 상한 +50%', () => {
    let player = makePlayer();
    let enemy = makeBoss('차원 파쇄자', { pattern: { guardChance: 0, heavyChance: 0 } });
    const damages = [];
    for (let i = 0; i < 20; i += 1) {
        const result = act(player, enemy, () => 0.9);
        damages.push(result.damage);
        player = result.updatedPlayer;
        enemy = result.updatedEnemy;
    }
    const base = damages[0];
    assert.ok(damages.slice(0, 8).every((damage) => damage === base));
    assert.ok(damages[8] > base && damages[9] > damages[8]);
    assert.equal(damages[19], damages[18], '상한');
    assert.equal(damages[19], Math.max(Math.floor(300 * 1.5 * 0.1), Math.floor(300 * 1.5 - stats(makePlayer()).def)));
});

test('장기전 보상 — 영겁의 수문장은 행동 수 × 5%만큼 처치 골드 · 경험치가 오른다(상한 +100%)', () => {
    const player = makePlayer({ level: 70 });
    const bonus = { expMult: 0, goldMult: 0 };
    const quick = CombatEngine.handleVictory(player, makeBoss('영겁의 수문장', { level: 70, actionCount: 0 }), bonus, null);
    const long = CombatEngine.handleVictory(player, makeBoss('영겁의 수문장', { level: 70, actionCount: 10 }), bonus, null);
    const capped = CombatEngine.handleVictory(player, makeBoss('영겁의 수문장', { level: 70, actionCount: 40 }), bonus, null);
    const firstGold = (result) => result.updatedPlayer.gold - (result.bossClearBonus?.goldBonus || 0);
    assert.equal(firstGold(long), Math.floor(firstGold(quick) * 1.5));
    assert.equal(firstGold(capped), Math.floor(firstGold(quick) * 2));
    assert.ok(long.logs.some((log) => log.text === MSG.LONG_FIGHT_REWARD(50)));
});

test('대량 초회 보상 — 선언한 보스는 첫 토벌 골드가 배율만큼 크다', () => {
    const player = makePlayer({ level: 40 });
    const bonus = { expMult: 0, goldMult: 0 };
    const plain = CombatEngine.handleVictory(player, makeBoss('레드 드래곤'), bonus, null).bossClearBonus.goldBonus;
    for (const name of ['아이스 드래곤', '에테르 드래곤', '공허의 대행자']) {
        const large = CombatEngine.handleVictory(player, makeBoss(name), bonus, null).bossClearBonus.goldBonus;
        assert.equal(large, plain * MONSTERS[name].mechanics.firstClearBonusMult, name);
    }
});

test('저항 무력화 — 에테르 심판자 3페이즈는 상태 저항 유물 · 원소 저항 장비가 통하지 않는다', () => {
    const seal = { id: 'seal', name: '고대의 봉인', effect: 'status_resist', val: 1, rarity: 'rare' };
    const result = act(makePlayer({ relics: [seal] }), makeBoss('에테르 심판자', { hp: 1_000, phase2Triggered: true }), () => 0.5);
    assert.ok(result.updatedPlayer.status.includes('curse'));
    assert.ok(!texts(result).includes(MSG.ANCIENT_SEAL_RESIST));
    // 2페이즈(무력화 전)는 그대로 막는다.
    const before = act(makePlayer({ relics: [seal] }), makeBoss('에테르 심판자', { hp: 2_400 }), () => 0.5);
    assert.ok(!before.updatedPlayer.status.includes('burn'));
    assert.ok(texts(before).includes(MSG.ANCIENT_SEAL_RESIST));
    // 원소 저항 장비(적 자신의 원소 = 빛)도 3페이즈에서만 뚫린다.
    const element = MONSTERS['에테르 심판자'].resistance;
    const resistStats = { ...stats(makePlayer()), elementResists: [element] };
    const hitWith = (enemy) => CombatEngine.enemyAttack(makePlayer(), { ...enemy, pattern: { guardChance: 0, heavyChance: 0 } }, resistStats, () => 0.9).damage;
    const phase2Hit = hitWith(makeBoss('에테르 심판자', { hp: 4_000, phase2Triggered: true }));
    const phase3Hit = hitWith(makeBoss('에테르 심판자', { hp: 4_000, phase2Triggered: true, phase3Triggered: true }));
    assert.equal(phase3Hit, phase2Hit * 2, `${phase2Hit} → ${phase3Hit}`);
});

test('예고 — 알릴 행동 가운데 확률이 높은 쪽 · 3페이즈 임박 · 3페이즈 문턱의 예보 칸', () => {
    const sphinx = makeBoss('스핑크스', { pattern: { guardChance: 0.32, heavyChance: 0.35 } });
    assert.equal(CombatEngine.predictEnemyNextAction(sphinx).type, 'heavy');
    const shatter = makeBoss('차원 파쇄자', { pattern: { guardChance: 0.3, heavyChance: 0.3 } });
    assert.equal(CombatEngine.predictEnemyNextAction(shatter).type, 'heavy', '같으면 맹공');
    const maou = makeBoss('마왕', { hp: 1_100, phase2Triggered: true });
    const telegraph = CombatEngine.predictEnemyNextAction(maou);
    assert.equal(telegraph.type, 'phase3_imminent');
    const forecast = getCombatForecast({ player: makePlayer(), enemy: { ...maou, hp: 1_000 }, stats: stats(makePlayer()), enemyTelegraph: telegraph });
    assert.equal(forecast.window, '전환 직전');
    // 아직 2페이즈 전인데 한 번에 3페이즈 문턱 아래로 내려왔으면 3페이즈를 알린다.
    assert.equal(CombatEngine.predictEnemyNextAction(makeBoss('마왕', { hp: 900 })).type, 'phase3_imminent');
});

test('보스 유물 보상 — 약속한 보스만 처치 때 유물 선택을 연다(가득 차도 제안), 계열 이름을 먼저 보인다', () => {
    const dispatched = [];
    const deps = { dispatch: (action) => dispatched.push(action), addLog: () => {}, rng: () => 0.3 };
    const full = makePlayer({ relics: [] });
    applyBossRelicReward(makeBoss('공허의 군주'), full, deps);
    applyBossRelicReward(makeBoss('마왕'), full, deps);
    assert.equal(dispatched.length, 1);
    assert.equal(dispatched[0].type, AT.SET_PENDING_RELICS);
    assert.ok(dispatched[0].payload.every((relic) => relic.rarity === 'legendary'));
    assert.ok(dispatched[0].payload.slice(0, 2).every((relic) => /공허|허공/.test(relic.name)));
    const keeper = pickBossRewardRelics(makePlayer(), makeBoss('시간의 파수꾼'), 3, () => 0.3);
    assert.equal(keeper.length, 3);
    assert.ok(keeper.every((relic) => ['rare', 'epic', 'legendary'].includes(relic.rarity)));
    assert.ok(/시간|시공/.test(keeper[0].name));
});

test('계열 보스의 보너스 장비는 계열 풀에서 나온다(processLoot 실경로)', () => {
    const pool = new Set(getBossThemedLootPool(makeBoss('천둥새 제피로스')).map((item) => item.name));
    const enemy = makeBoss('천둥새 제피로스', { exp: 5_000, dropMod: 1 });
    const dropped = processLoot(enemy, makePlayer(), 1, () => 0.01, () => 0).items.filter((item) => item.type === 'weapon' || item.type === 'armor' || item.type === 'shield');
    assert.ok(dropped.length > 0);
    assert.ok(dropped.every((item) => pool.has(item.baseItemName || item.name.replace(/^\S+ /, '')) || pool.has(item.name)), dropped.map((item) => item.name).join(','));
});
