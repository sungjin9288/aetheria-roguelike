import test from 'node:test';
import assert from 'node:assert/strict';

import { gameReducer, INITIAL_STATE } from '../src/reducers/gameReducer.ts';
import { AT } from '../src/reducers/actionTypes.ts';
import { QUESTS } from '../src/data/quests.ts';
import { MONSTERS } from '../src/data/monsters.ts';
import { MAPS } from '../src/data/maps.ts';
import { CONSTANTS } from '../src/data/constants.ts';
import { syncQuestProgress, getClaimableQuestEntries } from '../src/utils/questProgress.ts';
import { matchesQuestTarget, stripEnemyDecoration, EARLY_ELITE_PREFIX_NAME } from '../src/utils/enemyIdentity.ts';
import { spawnEnemy } from '../src/utils/exploreUtils.ts';

/**
 * 종장 임무 87 목표 오인식 (원장 §26.10 말미 → §26.11).
 *
 * `syncQuestProgress`가 목표를 `enemyName.includes(target)`으로 판정해, 87(target '마왕',
 * location '마왕성')을 수락한 채 마왕성의 '마왕의 사도'를 처치하면 progress 1이 됐다 —
 * 실제 마왕 승리 전에 종장 임무가 완료·수령 가능해진다. 같은 클래스: 99 '마왕 토벌'(location
 * 없음)은 '사슬 마왕'/'차원 마왕'/'미궁의 마왕'에, 1 '슬라임 소탕'은 '초록슬라임'에 반응했다.
 *
 * 계약: 목표 판정은 종(baseName) **정확 일치**다. 장식(접두어 · `[N층]`)만 벗기고, 가족 이름은
 * 다른 종이다. 아래는 (1) 실제 리듀서 재현 (2) 데이터 전수 (3) 장식 크레딧 보존 (4) 접두어
 * 어휘의 단일 원천(spawnEnemy ↔ enemyIdentity) (5) 인접 스토리 임무 85·86 회귀다.
 */

const apply = (state, type, payload) => gameReducer(state, { type, payload });

const monsterUniverse = () => {
    const names = new Set(Object.keys(MONSTERS));
    for (const map of Object.values(MAPS)) {
        for (const name of map.monsters || []) if (typeof name === 'string') names.add(name);
        if (typeof map.boss === 'string') names.add(map.boss);
        for (const name of map.bossMonsters || []) if (typeof name === 'string') names.add(name);
    }
    return names;
};

const questPlayer = (quest, loc) => ({
    level: 60,
    loc: loc ?? quest.location ?? '시작의 마을',
    quests: [{ id: quest.id, progress: 0 }],
    stats: {},
});

const progressAfterKill = (quest, enemyName, loc) => syncQuestProgress(questPlayer(quest, loc), enemyName, QUESTS)
    .updatedQuests.find((entry) => entry.id === quest.id).progress;

const decorationPrefixes = [...CONSTANTS.MONSTER_PREFIXES.map((prefix) => prefix.name), EARLY_ELITE_PREFIX_NAME];

// ─── (1) 실제 리듀서 재현 — Codex probe(seed 11 / now 1000 / 적 HP 1) 그대로 ─────────────
const winAgainst = (enemy, loc = '마왕성') => {
    const initial = structuredClone(INITIAL_STATE);
    initial.gameState = 'idle';
    initial.player = {
        ...initial.player, name: '종장 검증', level: 68, atk: 100000, loc: '시작의 마을', quests: [],
        stats: { ...initial.player.stats, claimedQuestIds: [80, 81, 82, 84, 83, 85, 86] },
        meta: { ...initial.player.meta, prestigeRank: 0 },
    };
    const accepted = apply(initial, AT.ACCEPT_QUEST, { questId: 87 });
    assert.deepEqual(accepted.player.quests, [{ id: 87, progress: 0 }], '87 수락 상태에서 시작');
    const combat = {
        ...accepted, gameState: 'combat', combatTurn: 0,
        enemy: { level: 70, hp: 1, maxHp: 1, atk: 1, def: 0, exp: 0, gold: 0, pattern: { guardChance: 0, heavyChance: 0 }, ...enemy },
        player: { ...accepted.player, loc },
    };
    const won = apply(combat, AT.RESOLVE_COMBAT_ACTION, { kind: 'attack', expectedTurn: 0, seed: 11, now: 1000 });
    return {
        progress: won.player.quests.find((quest) => quest.id === 87)?.progress,
        gameState: won.gameState,
        claimable: getClaimableQuestEntries(won.player).map((entry) => entry.id),
    };
};

test('87 세계의 끝 — 마왕성에서 마왕의 사도를 처치해도 종장 임무는 진행되지 않는다 (실제 RESOLVE_COMBAT_ACTION)', () => {
    const apostle = winAgainst({ name: '마왕의 사도', baseName: '마왕의 사도', isBoss: false });
    assert.equal(apostle.progress, 0, '마왕의 사도는 마왕이 아니다 — substring 크레딧 금지');
    assert.equal(apostle.gameState, 'idle');
    assert.deepEqual(apostle.claimable, [], '실제 마왕 승리 전에는 수령 가능 목록에 87이 없다');

    const decoratedApostle = winAgainst({ name: '재앙의 마왕의 사도', baseName: '마왕의 사도', isBoss: false });
    assert.equal(decoratedApostle.progress, 0, '접두어가 붙은 사도도 마왕이 아니다');

    const legacyApostle = winAgainst({ name: '재앙의 마왕의 사도', isBoss: false });
    assert.equal(legacyApostle.progress, 0, 'baseName 없는 레거시 적도 장식만 벗기고 종으로 비교한다');
});

test('87 세계의 끝 — 실제 마왕 승리는 그대로 진행·수령 가능·계승으로 간다 (비공허 가드)', () => {
    const king = winAgainst({ name: '마왕', baseName: '마왕', isBoss: true });
    assert.equal(king.progress, 1);
    assert.equal(king.gameState, 'ascension');
    assert.deepEqual(king.claimable, [87]);

    const decoratedKing = winAgainst({ name: '재앙의 마왕', baseName: '마왕', isBoss: true });
    assert.equal(decoratedKing.progress, 1, '접두어가 붙은 마왕은 마왕이다');
});

// ─── (2) 데이터 전수 — 모든 몬스터 목표 임무 × 모든 다른 몬스터 이름 ─────────────────────
test('몬스터 목표 임무는 목표와 다른 종의 처치에 반응하지 않는다 — 전수', () => {
    const universe = monsterUniverse();
    const monsterTargetQuests = QUESTS.filter((quest) => typeof quest.target === 'string' && universe.has(quest.target));
    assert.ok(monsterTargetQuests.length >= 100, `몬스터 목표 임무 표본 (실측 ${monsterTargetQuests.length})`);

    const leaks = [];
    let checked = 0;
    for (const quest of monsterTargetQuests) {
        for (const name of universe) {
            if (name === quest.target) continue;
            checked += 1;
            if (progressAfterKill(quest, name) !== 0) leaks.push(`#${quest.id} ${quest.target} ← ${name}`);
            // 목표 문자열을 품은 다른 종은 장식이 붙어도 다른 종이다 (예: '재앙의 마왕의 사도' vs '마왕').
            if (name.includes(quest.target)) {
                for (const prefix of decorationPrefixes) {
                    checked += 1;
                    if (progressAfterKill(quest, `${prefix} ${name}`) !== 0) leaks.push(`#${quest.id} ${quest.target} ← ${prefix} ${name}`);
                }
            }
        }
    }
    assert.ok(checked > 20_000, `검사 쌍이 충분해야 함 (실측 ${checked})`);
    assert.deepEqual(leaks, [], `다른 종의 처치가 진행도를 올린 임무: ${leaks.slice(0, 12).join(' · ')}`);
});

test('몬스터 목표 임무는 정확한 종의 처치에는 전부 반응한다 — 비공허 가드', () => {
    const universe = monsterUniverse();
    const monsterTargetQuests = QUESTS.filter((quest) => typeof quest.target === 'string' && universe.has(quest.target));
    const silent = monsterTargetQuests.filter((quest) => progressAfterKill(quest, quest.target) !== 1);
    assert.deepEqual(silent.map((quest) => `#${quest.id} ${quest.target}`), [], '정확한 목표 처치가 진행되지 않은 임무');
});

// ─── (3) 장식 크레딧 보존 — 접두어·층 태그는 같은 종 ────────────────────────────────────
test('장식(접두어 · [N층])이 붙은 목표 종은 그대로 진행되고, 가족 이름은 진행되지 않는다', () => {
    const slimeQuest = QUESTS.find((quest) => quest.id === 1);
    assert.equal(slimeQuest.target, '슬라임');
    for (const prefix of decorationPrefixes) {
        assert.equal(progressAfterKill(slimeQuest, `${prefix} 슬라임`), 1, `${prefix} 슬라임은 슬라임이다`);
    }
    assert.equal(progressAfterKill(slimeQuest, '[12층] 슬라임'), 1, '무한 심연 층 태그는 장식이다');
    assert.equal(progressAfterKill(slimeQuest, '초록슬라임'), 0, '초록슬라임은 다른 종이다');
    assert.equal(progressAfterKill(slimeQuest, '잉크 슬라임'), 0, '잉크는 접두어 어휘가 아니다 — 다른 종');

    assert.equal(stripEnemyDecoration('마왕의 사도'), '마왕의 사도', '알려진 접두어가 아니면 첫 단어를 자르지 않는다');
    assert.equal(stripEnemyDecoration(`${EARLY_ELITE_PREFIX_NAME} 마왕의 사도`), '마왕의 사도');
    assert.equal(matchesQuestTarget('', '마왕'), false);
    assert.equal(matchesQuestTarget('마왕', undefined), false);
});

// ─── (4) 접두어 어휘의 단일 원천 — spawnEnemy가 붙이는 이름을 enemyIdentity가 벗긴다 ──────
test('spawnEnemy의 초반 정예 접두어와 층 태그는 enemyIdentity가 같은 종으로 읽는다', () => {
    const forest = MAPS['고요한 숲'];
    const player = { level: 1, loc: '고요한 숲', stats: {}, meta: {}, quests: [] };
    const spawned = spawnEnemy(forest, player, [], { addLog: () => {} }, { rng: () => 0 });
    assert.ok(spawned.mStats, '고요한 숲에서 적이 스폰된다');
    assert.equal(spawned.mStats.name, `${EARLY_ELITE_PREFIX_NAME} ${spawned.baseName}`, 'rng 0 → 초반 정예 접두어');
    assert.equal(matchesQuestTarget(spawned.mStats.name, spawned.baseName), true, '표시 이름만으로도 종을 되찾는다');
    assert.equal(matchesQuestTarget(spawned.mStats.baseName, spawned.baseName), true);

    const abyss = Object.entries(MAPS).find(([, map]) => map.level === 'infinite');
    assert.ok(abyss, '무한 심연 맵이 존재한다');
    const deep = spawnEnemy(abyss[1], { level: 60, loc: abyss[0], stats: { abyssFloor: 12 }, meta: {}, quests: [] }, [], { addLog: () => {} }, { rng: () => 0.999999 });
    assert.ok(deep.mStats, '심연에서 적이 스폰된다');
    // Wave 35: 층 태그는 지금 싸우는 층이다(돌파 12층 → 13층 전투). 예전 값 `[12층]`은 한 층 낮은 표기를 고정하고 있었다.
    assert.match(deep.mStats.name, /^\[13층\] /, 'rng≈1 → 접두어 없이 층 태그만');
    assert.equal(matchesQuestTarget(deep.mStats.name, deep.baseName), true, '층 태그를 벗기면 종이다');
});

// ─── (5) 인접 스토리 임무 85·86 회귀 — 정확한 종만 ────────────────────────────────────
test('85 어둠의 근원 · 86 에테르의 균열 — 정확한 종만 진행된다', () => {
    const q85 = QUESTS.find((quest) => quest.id === 85);
    const q86 = QUESTS.find((quest) => quest.id === 86);
    assert.equal(q85.target, '마왕의 사도');
    // Wave 28 (D6): 86은 에테르 관문의 `에테르 파편체`에서 마왕성의 `지옥의 문지기`로 옮겼다.
    assert.equal(q86.target, '지옥의 문지기');
    assert.equal(progressAfterKill(q85, '마왕의 사도'), 1);
    assert.equal(progressAfterKill(q85, `${EARLY_ELITE_PREFIX_NAME} 마왕의 사도`), 1);
    assert.equal(progressAfterKill(q85, '마왕'), 0, '마왕 처치는 사도 5명에 세지 않는다');
    assert.equal(progressAfterKill(q86, '지옥의 문지기'), 1);
    assert.equal(progressAfterKill(q86, `${EARLY_ELITE_PREFIX_NAME} 지옥의 문지기`), 1);
    assert.equal(progressAfterKill(q86, '에테르 파편체'), 0, '옛 목표는 더 이상 세지 않는다');
    assert.equal(progressAfterKill(q86, '마왕의 사도'), 0);
});
