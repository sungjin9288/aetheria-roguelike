import test from 'node:test';
import assert from 'node:assert/strict';

import { getCombatSkillReadiness } from '../src/utils/combatSkillReadiness.js';

const playerWithEnergy = (mp) => ({ mp });

test('기력 비용이 없는 기술 정의는 engine 기본 비용 10을 그대로 보여준다', () => {
    const readiness = getCombatSkillReadiness({
        player: playerWithEnergy(10),
        selectedSkill: { name: '기본 기술' },
    });

    assert.equal(readiness.cost, 10);
    assert.equal(readiness.state, 'ready');
    assert.equal(readiness.detailLabel, '기력 10 · 사용 가능');
});

test('현재 기력이 비용과 같으면 기술을 사용할 수 있다', () => {
    const readiness = getCombatSkillReadiness({
        player: playerWithEnergy(20),
        selectedSkill: { name: '화염구', mp: 20 },
    });

    assert.equal(readiness.canUse, true);
    assert.equal(readiness.buttonLabel, '기술');
});

test('현재 기력이 부족하면 필요한 비용과 현재 값을 함께 보여주고 입력을 막는다', () => {
    const readiness = getCombatSkillReadiness({
        player: playerWithEnergy(2),
        selectedSkill: { name: '강타', mp: 10 },
    });

    assert.equal(readiness.canUse, false);
    assert.equal(readiness.state, 'energy');
    assert.equal(readiness.detailLabel, '필요 기력 10 · 현재 2');
    assert.equal(readiness.buttonLabel, '기력 부족');
});

test('재사용 대기 중이면 충분한 기력보다 cooldown 상태를 먼저 설명한다', () => {
    const readiness = getCombatSkillReadiness({
        player: playerWithEnergy(50),
        selectedSkill: { name: '강타', mp: 10 },
        skillCooldown: 2,
    });

    assert.equal(readiness.canUse, false);
    assert.equal(readiness.state, 'cooldown');
    assert.equal(readiness.detailLabel, '기력 10 · 2턴 후');
    assert.equal(readiness.buttonLabel, '재사용 대기');
});
