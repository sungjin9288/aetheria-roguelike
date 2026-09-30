import test from 'node:test';
import assert from 'node:assert/strict';

import { CLASSES } from '../src/data/classes.js';
import { BALANCE } from '../src/data/constants.js';
import { CombatEngine } from '../src/systems/CombatEngine.js';

/**
 * 2026-09 Wave 42 (소유자 결정 "직업별 강점 · 약점 강조") — 직업 기술이 광고한 효과가 실제로 작동한다.
 *
 * 원장 §42: 직업의 강점이 플레이에서 드러나지 않던 이유 중 둘은 광고와 엔진의 불일치였다.
 * 1. 회복 기술('hp_regen' — 기적의 손길 · 역경의 힘 · 기적의 부활)은 "N턴 지속 회복"을 광고하지만
 *    즉시 회복만 했고, type이 'buff'라 빈 강화(공격 0 · 방어 0)가 켜져 있던 방어 강화를 지웠다.
 * 2. 공포는 기술과 무관하게 2턴 · 공격력 −30%였다('군주의 위엄' 4턴 −35%, '전투 함성' 3턴 −25%).
 */

const FIXED_RNG = () => 0.5;
const skillOf = (job, name) => {
    const skill = CLASSES[job].skills.find((entry) => entry.name === name);
    assert.ok(skill, `${job}/${name} 기술이 있어야 한다`);
    return skill;
};
const makePlayer = (job, extra = {}) => ({
    hp: 400, maxHp: 1000, mp: 400, maxMp: 400, status: [], job,
    skillLoadout: { selected: 0, cooldowns: {} },
    ...extra,
});
const makeEnemy = (extra = {}) => ({ name: '검증용 몬스터', hp: 50000, maxHp: 50000, def: 0, guarding: false, ...extra });
const STATS = { atk: 60, relics: [], activeSynergies: [], maxMp: 400 };
const cast = (job, name, playerExtra, enemyExtra) => CombatEngine.performSkill(
    makePlayer(job, playerExtra), makeEnemy(enemyExtra), STATS, skillOf(job, name), FIXED_RNG,
);

const HEAL_SKILLS = [['성직자', '기적의 손길'], ['버서커', '역경의 힘'], ['팔라딘', '기적의 부활']];

test('회복 기술은 즉시 val을 회복하고, 이후 turn턴 동안 턴마다 val / turn을 더 회복한다', () => {
    for (const [job, name] of HEAL_SKILLS) {
        const skill = skillOf(job, name);
        // 생명 100에서 시작한다 — 즉시 + 지속 합계(2 × val, 최대 80%)가 최대 생명 1000을 넘지 않아 틱마다 온전히 잰다.
        const result = cast(job, name, { hp: 100 });
        assert.equal(result.success, true, `${job}/${name} 사용 성공`);
        const immediate = Math.floor(1000 * skill.val);
        assert.equal(result.updatedPlayer.hp, 100 + immediate, `${job}/${name} 즉시 회복`);
        assert.deepEqual(result.updatedPlayer.skillRegen, { ratio: skill.val / skill.turn, turns: skill.turn, name }, `${job}/${name} 지속 회복 등록`);

        let player = result.updatedPlayer;
        for (let tick = 1; tick <= skill.turn; tick += 1) {
            const before = player.hp;
            player = CombatEngine.tickCombatState(player).updatedPlayer;
            assert.equal(player.hp - before, Math.max(1, Math.floor(1000 * (skill.val / skill.turn))), `${job}/${name} ${tick}번째 틱`);
        }
        assert.equal(player.skillRegen, undefined, `${job}/${name} 지속 회복은 ${skill.turn}틱 뒤 사라진다`);
        const after = player.hp;
        player = CombatEngine.tickCombatState(player).updatedPlayer;
        assert.equal(player.hp, after, `${job}/${name} 만료 뒤에는 더 회복하지 않는다`);
    }
});

test('회복 기술은 켜져 있던 방어 강화를 지우지 않는다 (신성한 보호막 → 기적의 손길)', () => {
    const guarded = cast('성직자', '신성한 보호막');
    const guard = guarded.updatedPlayer.tempBuff;
    assert.ok(guard.def > 0 && guard.turn > 0, '보호막이 방어 강화를 켠다');
    const healed = CombatEngine.performSkill(
        { ...guarded.updatedPlayer, skillLoadout: { selected: 0, cooldowns: {} } },
        makeEnemy(), STATS, skillOf('성직자', '기적의 손길'), FIXED_RNG,
    );
    assert.equal(healed.success, true);
    assert.deepEqual(healed.updatedPlayer.tempBuff, guard, '방어 강화가 그대로 남는다');
    assert.equal(healed.updatedPlayer.skillRegen?.turns, 3);
});

test('지속 회복은 최대 생명을 넘지 않고, 가득 찬 턴에는 로그를 남기지 않는다', () => {
    const player = makePlayer('성직자', { hp: 1000, skillRegen: { ratio: 0.05, turns: 2, name: '기적의 손길' } });
    const tick = CombatEngine.tickCombatState(player);
    assert.equal(tick.updatedPlayer.hp, 1000);
    assert.equal(tick.updatedPlayer.skillRegen.turns, 1, '가득 차 있어도 턴은 줄어든다');
    assert.equal(tick.logs.some((log) => String(log.text).includes('지속 회복')), false);
});

test('공포 기술은 자기 지속 턴과 공격력 약화 폭을 쓴다', () => {
    const FEAR_SKILLS = [['전사', '전투 함성'], ['나이트', '군주의 위엄'], ['흑마법사', '공포'], ['성직자', '공포 유발']];
    for (const [job, name] of FEAR_SKILLS) {
        const skill = skillOf(job, name);
        const result = cast(job, name);
        assert.equal(result.updatedEnemy.fearTurns, skill.turn, `${job}/${name} 지속 ${skill.turn}턴`);
        assert.equal(result.updatedEnemy.atkMult, skill.val, `${job}/${name} 공격력 ×${skill.val}`);
    }
    // 광고 문구와 같은 값이다(−25% · −35% · −30% · −30%).
    assert.deepEqual(FEAR_SKILLS.map(([job, name]) => skillOf(job, name).val), [0.75, 0.65, 0.7, 0.7]);
});

test('더 강한 약화가 이미 걸려 있으면 공포가 약화 폭을 되돌리지 않는다 (최솟값 유지)', () => {
    const result = cast('전사', '전투 함성', {}, { atkMult: BALANCE.BLIND_ATK_MULT, blindTurns: 2 });
    assert.equal(result.updatedEnemy.atkMult, BALANCE.BLIND_ATK_MULT);
    assert.equal(result.updatedEnemy.fearTurns, 3);
});

test('실명 · 도발 기술도 자기 지속 턴을 쓴다', () => {
    assert.equal(cast('도적', '연막탄').updatedEnemy.blindTurns, skillOf('도적', '연막탄').turn);
    assert.equal(cast('나이트', '도발').updatedEnemy.tauntTurns, skillOf('나이트', '도발').turn);
    // 실데이터의 턴(2 · 3)은 엔진 기본값과 같아 위 두 줄만으로는 "기술 턴을 읽는다"를 가르지 못한다 —
    // 기본값과 다른 턴으로 읽기 경로 자체를 고정한다.
    const withTurn = (job, name, turn) => CombatEngine.performSkill(
        makePlayer(job), makeEnemy(), STATS, { ...skillOf(job, name), turn }, FIXED_RNG,
    ).updatedEnemy;
    assert.equal(withTurn('도적', '연막탄', 5).blindTurns, 5);
    assert.equal(withTurn('나이트', '도발', 5).tauntTurns, 5);
    assert.equal(withTurn('전사', '전투 함성', 5).fearTurns, 5);
});
