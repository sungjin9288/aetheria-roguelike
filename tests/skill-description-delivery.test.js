import test from 'node:test';
import assert from 'node:assert/strict';

import { CLASSES } from '../src/data/classes.js';
import { DB } from '../src/data/db.js';
import { MSG } from '../src/data/messages.js';
import { CombatEngine } from '../src/systems/CombatEngine.js';
import { calculateFullStats } from '../src/utils/statsCalculator.js';
import { getSkillMetrics } from '../src/utils/skillPresentation.js';

/**
 * 2026-10 Wave 54 — 소유자 결정 "전부 설명대로 구현"(기술 설명 전수 감사, 원장 §54).
 *
 * 설명이 약속한 효과가 엔진에 없던 기술 12개를 설명대로 동작하게 했다. 이 파일은 각 기술의 약속을
 * 실제 엔진 호출로 확인한다 — 지속 턴 · 분기 효과 · 연속 타격 · 반격 · 방어 감소 · 방어 자세 무시 ·
 * 은신 중 치명 · 기력 지속 회복 · 복합 원소.
 */

const playerOf = (job, overrides = {}) => ({
    name: 'tester', job, level: 40, hp: 5_000, maxHp: 5_000, mp: 9_999, maxMp: 9_999, atk: 400, def: 50,
    inv: [], equip: { weapon: DB.ITEMS.weapons[0], armor: DB.ITEMS.armors[0], offhand: null },
    relics: [], skillChoices: {}, titles: [], activeTitle: null, killStreak: 0, combatFlags: {}, status: [],
    stats: { kills: 0, codex: { weapons: {}, armors: {}, shields: {}, monsters: {}, recipes: {}, materials: {} } },
    skillLoadout: { selected: 0, cooldowns: {} }, ...overrides,
});
const enemyOf = (overrides = {}) => ({
    name: '슬라임', baseName: '슬라임', hp: 1e7, maxHp: 1e7, atk: 1_000, def: 0, level: 30,
    pattern: { guardChance: 0, heavyChance: 0 }, ...overrides,
});
const skillOf = (job, name) => {
    const skill = CLASSES[job].skills.find((s) => s.name === name);
    assert.ok(skill, `${job} ${name}`);
    return skill;
};
const cast = (job, name, { player = {}, enemy = {}, rng = () => 0.5, stats } = {}) => {
    const p = playerOf(job, player);
    return CombatEngine.performSkill(p, enemyOf(enemy), stats ?? calculateFullStats(p), skillOf(job, name), rng);
};
const dealt = (r) => 1e7 - r.updatedEnemy.hp;

test('기절 · 빙결 기술의 "N턴"은 적 행동 N번을 막는다 — turn을 가진 기술 전수 (시간 왜곡 2 · 시간 정지 3 · 시간 결빙 2)', () => {
    const timed = Object.entries(CLASSES).flatMap(([job, def]) => (def.skills || [])
        .filter((s) => (s.effect === 'stun' || s.effect === 'freeze') && s.turn && !s.stunTurn)
        .map((s) => [job, s]));
    assert.deepEqual(timed.map(([, s]) => s.name).sort(), ['시간 결빙', '시간 왜곡', '시간 정지']);
    for (const [job, skill] of timed) {
        const result = cast(job, skill.name);
        assert.equal(result.updatedEnemy.stunnedTurns, skill.turn, `${skill.name}: 남은 기절 턴`);
        assert.ok(skill.desc.includes(`${skill.turn}턴`), `${skill.name}: 설명의 턴`);
        // 실제 적 행동: N번 멈추고 그다음에 친다.
        let enemy = result.updatedEnemy;
        const acted = [];
        for (let i = 0; i <= skill.turn; i += 1) {
            const turn = CombatEngine.enemyAttack(playerOf(job), enemy, calculateFullStats(playerOf(job)), () => 0.5);
            acted.push(turn.damage > 0);
            enemy = turn.updatedEnemy;
        }
        assert.deepEqual(acted, [...Array(skill.turn).fill(false), true], `${skill.name}: 적 행동`);
    }
});

test('분기 효과는 설명대로 둘 다 걸린다 — 혼란 찌르기(기절 + 출혈, 확률 없음) · 저주 일섬(저주 + 출혈)', () => {
    const confuse = cast('도적', '등 찌르기', { player: { skillChoices: { '등 찌르기': 'B' } }, rng: () => 0.99 });
    assert.ok((confuse.updatedEnemy.stunnedTurns ?? 0) >= 1, '혼란 찌르기: 기절');
    assert.ok((confuse.updatedEnemy.dots ?? []).includes('bleed'), '혼란 찌르기: 출혈');
    const cursed = cast('어쌔신', '그림자 일섬', { player: { skillChoices: { '그림자 일섬': 'B' } } });
    assert.ok((cursed.updatedEnemy.cursedTurns ?? 0) > 0, '저주 일섬: 저주');
    assert.ok((cursed.updatedEnemy.dots ?? []).includes('bleed'), '저주 일섬: 출혈');
});

test('이중 자상: 두 번 연속 공격 — 타격마다 피해 · 치명을 따로 굴리고, 카드는 위력 × 2를 보여 준다', () => {
    const skill = skillOf('어쌔신', '이중 자상');
    assert.equal(skill.hits, 2);
    const player = playerOf('어쌔신');
    const stats = calculateFullStats(player);
    const twice = CombatEngine.performSkill(player, enemyOf(), stats, skill, () => 0.5);
    const once = CombatEngine.performSkill(player, enemyOf(), stats, { ...skill, hits: 1 }, () => 0.5);
    assert.equal(dealt(twice), 2 * dealt(once), `두 번 ${dealt(twice)} = 한 번 ${dealt(once)} × 2`);
    assert.ok(twice.logs[0].text.includes(MSG.COMBAT_TAG_HITS(2)), '연타 태그');
    // 치명은 타격마다: calculateDamage는 분산 → 치명 순으로 난수를 쓴다. 첫 타격만 치명(0 < 70%), 둘째는 아님(0.99).
    const seq = [0.5, 0, 0.5, 0.99];
    let i = 0;
    const mixed = CombatEngine.performSkill(player, enemyOf(), stats, skill, () => seq[(i++) % seq.length]);
    const j = [0.5, 0.99];
    let k = 0;
    const normalOnce = CombatEngine.performSkill(player, enemyOf(), stats, { ...skill, hits: 1 }, () => j[(k++) % j.length]);
    assert.equal(dealt(mixed), 3 * dealt(normalOnce), `치명 1회(×2) + 일반 1회 = 일반 × 3 (${dealt(mixed)} vs ${dealt(normalOnce)})`);
    assert.equal(mixed.isCrit, true);
    assert.deepEqual(getSkillMetrics(skill).filter((m) => m.startsWith('위력')), ['위력 100% × 2']);
});

test('철벽 방어: DEF 80% 2턴과 함께 반격 자세(피격 시 40%) — 적에게 맞으면 반격한다', () => {
    const wall = cast('전사', '철벽 방어');
    assert.ok(Math.abs(wall.updatedPlayer.tempBuff.def - 0.8) < 1e-9);
    assert.equal(wall.updatedPlayer.tempBuff.counterChance, 0.4);
    const stats = calculateFullStats(wall.updatedPlayer);
    const hit = CombatEngine.enemyAttack(wall.updatedPlayer, enemyOf(), stats, () => 0.1);
    assert.ok(hit.updatedEnemy.hp < 1e7, `반격 피해 (적 생명 ${hit.updatedEnemy.hp})`);
    const miss = CombatEngine.enemyAttack(wall.updatedPlayer, enemyOf(), stats, () => 0.9);
    assert.equal(miss.updatedEnemy.hp, 1e7, '확률 밖이면 반격 없음');
});

test('분노의 포효: ATK 100% 상승 2턴과 함께 DEF −30% — 실제 방어력이 내려간다', () => {
    const roar = cast('버서커', '분노의 포효');
    assert.equal(roar.updatedPlayer.tempBuff.atk, 1);
    assert.ok(Math.abs(roar.updatedPlayer.tempBuff.def + 0.3) < 1e-9);
    const before = calculateFullStats(playerOf('버서커')).def;
    const after = calculateFullStats(roar.updatedPlayer).def;
    assert.ok(after < before, `방어력 ${before} → ${after}`);
});

test('파워배시: 적의 방어 자세를 무시한다 — 방어 자세 적에게도 같은 피해, 다른 기술은 줄어든다', () => {
    const open = cast('전사', '파워배시');
    const guarded = cast('전사', '파워배시', { enemy: { guarding: true } });
    assert.equal(dealt(guarded), dealt(open));
    assert.ok(guarded.logs[0].text.includes(MSG.COMBAT_TAG_GUARD_BREAK));
    const other = cast('전사', '출혈베기');
    const otherGuarded = cast('전사', '출혈베기', { enemy: { guarding: true } });
    assert.ok(dealt(otherGuarded) < dealt(other), '방어 자세는 다른 기술 피해를 줄인다');
});

test('등 찌르기: 은신 중에만 60% 치명 — 같은 난수에서 은신이면 치명, 아니면 아니다', () => {
    const stealthed = cast('도적', '등 찌르기', { player: { combatFlags: { stealthHits: 1 } }, rng: () => 0.55 });
    const plain = cast('도적', '등 찌르기', { rng: () => 0.55 });
    assert.equal(stealthed.isCrit, true, '은신 중 0.55 < 60%');
    assert.equal(plain.isCrit, false, '은신이 아니면 기본 치명 확률');
});

test('마나 가속: MP 20 즉시 + 3턴간 턴마다 7 — 틱 세 번, 상한을 넘지 않는다', () => {
    const accel = cast('마법사', '마나 가속', { player: { mp: 10, maxMp: 500 } });
    assert.equal(accel.updatedPlayer.mp, 30);
    assert.deepEqual(accel.updatedPlayer.skillMpRegen, { amount: 7, turns: 3, name: '마나 가속' });
    let player = accel.updatedPlayer;
    const mps = [];
    for (let i = 0; i < 4; i += 1) {
        const tick = CombatEngine.tickCombatState(player);
        player = tick.updatedPlayer;
        mps.push(player.mp);
    }
    assert.deepEqual(mps, [37, 44, 51, 51]);
    const nearCap = CombatEngine.tickCombatState({ ...accel.updatedPlayer, mp: 495 }).updatedPlayer;
    assert.equal(nearCap.mp, 500, '상한');
    assert.ok(skillOf('마법사', '마나 가속').desc.includes('MP 7'));
});

test('원소 폭풍: 화염 + 냉기 — 화상과 빙결을 함께 건다', () => {
    const storm = cast('아크메이지', '원소 폭풍');
    assert.ok((storm.updatedEnemy.dots ?? []).includes('burn'), '화상');
    assert.ok((storm.updatedEnemy.stunnedTurns ?? 0) >= 1, '빙결');
});
