import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';

import CombatPanel from '../src/components/tabs/CombatPanel.tsx';
import { buildCombatView } from '../src/utils/combatView.ts';
import { getBossSignatureDrops } from '../src/utils/bossSignatureHint.ts';
import { CombatEngine } from '../src/systems/CombatEngine.ts';
import { renderStatic, makePlayerFixture } from './helpers/render.ts';

/**
 * CombatPanel — 전투 중 signature 드롭 가능성 reminder.
 *
 * exploreActions는 boss 조우 순간에 "이 놈이 전설을 떨굴 수 있다"를 legendary 로그로
 * 한 번만 emit한다. 로그가 스크롤돼 올라가 버리면, 플레이어가 실제 공격을 주고받는
 * 동안 이 맥락은 사라진다. CombatPanel의 meta 바는 bossBriefLine/telegraph를 계속
 * 노출하므로, signature 드롭 hint도 같은 layer에 상주해야 "이 보스를 굳이 도망치지
 * 말고 끝까지 버텨야 하는 이유"가 전투 내내 시야에 남는다.
 *
 * 계약(순수 함수 buildCombatView 직접 호출 + CombatPanel 렌더 검증):
 *   1. buildCombatView가 CombatEngine.resolveEnemyBaseName으로 prefix-stripped
 *      baseName을 구해 getBossSignatureDrops에 질의하고, 실제 DROP_TABLES와
 *      SIGNATURE_ITEM_REGISTRY 교집합을 primarySignatureDrop으로 반환한다
 *   2. enemy.isBoss + signatureDrops.length > 0일 때만 CombatPanel이
 *      data-testid="combat-signature-drop-hint"를 렌더
 *   3. "전설 각인" 라벨 포함
 *   4. #f6e7a2 gold 팔레트 (기존 signature tone과 일관)
 */

const BOSS_NAME = '마왕'; // src/data/dropTables.ts: '마왕' → '마왕의 대낫'(0.15) / '성검 에테르니아'(0.1)
const BOSS_STATS = { atk: 10, def: 5, maxHp: 100, maxMp: 50 };
const ACTIONS = { getSelectedSkill: () => null };

test('buildCombatView는 resolveEnemyBaseName으로 정규화한 이름을 getBossSignatureDrops에 질의한다', () => {
    const player = makePlayerFixture();
    const enemy = { name: `강화된 ${BOSS_NAME}`, isBoss: true, hp: 500, maxHp: 500 };

    const expectedBaseName = CombatEngine.resolveEnemyBaseName(enemy);
    assert.equal(expectedBaseName, BOSS_NAME, '전제: prefix가 제거된 baseName이 마왕이어야 함');
    const expectedDrops = getBossSignatureDrops(expectedBaseName);
    assert.ok(expectedDrops.length > 0, '전제: 마왕 drop table에 signature 아이템이 있어야 함');

    const view = buildCombatView({ player, enemy, stats: BOSS_STATS, selectedSkill: null, skillCooldown: 0, mobile: false });
    assert.deepEqual(view.signatureDropCandidates, expectedDrops, '실제 drop table 교집합과 동일한 후보 목록');
    assert.deepEqual(view.primarySignatureDrop, expectedDrops[0], '최고 확률 signature가 primary로 선택됨');
});

test('buildCombatView는 보스가 아니면 signature 후보를 비워둔다', () => {
    const player = makePlayerFixture();
    const enemy = { name: BOSS_NAME, isBoss: false, hp: 20, maxHp: 20 };

    const view = buildCombatView({ player, enemy, stats: BOSS_STATS, selectedSkill: null, skillCooldown: 0, mobile: false });
    assert.deepEqual(view.signatureDropCandidates, []);
    assert.equal(view.primarySignatureDrop, null);
});

test('CombatPanel은 보스가 signature를 떨굴 수 있을 때 combat-signature-drop-hint를 실제로 렌더링한다', () => {
    const player = makePlayerFixture();
    const enemy = { name: BOSS_NAME, isBoss: true, hp: 500, maxHp: 500 };
    const expectedTopDrop = getBossSignatureDrops(BOSS_NAME)[0];

    const html = renderStatic(createElement(CombatPanel, {
        player, actions: ACTIONS, enemy, stats: BOSS_STATS, isAiThinking: false, mobile: false,
    }));

    assert.ok(html.includes('data-testid="combat-signature-drop-hint"'), 'signature 드롭 힌트 노드가 렌더링됨');
    assert.ok(html.includes('전설 각인'), '"전설 각인" 라벨 포함');
    assert.ok(html.includes('f6e7a2'), 'gold 팔레트(#f6e7a2) 사용');
    assert.ok(html.includes(expectedTopDrop.name), '실제 최고 확률 signature 이름이 힌트에 노출됨');
});

test('CombatPanel은 signature를 떨구지 않는 적/보스가 아닌 적에게는 힌트를 렌더링하지 않는다', () => {
    const player = makePlayerFixture();
    const nonBoss = { name: '하수도 쥐', isBoss: false, hp: 20, maxHp: 20 };
    const htmlNonBoss = renderStatic(createElement(CombatPanel, {
        player, actions: ACTIONS, enemy: nonBoss, stats: BOSS_STATS, isAiThinking: false, mobile: false,
    }));
    assert.ok(!htmlNonBoss.includes('combat-signature-drop-hint'));

    const htmlNoEnemy = renderStatic(createElement(CombatPanel, {
        player, actions: ACTIONS, enemy: null, stats: BOSS_STATS, isAiThinking: false, mobile: false,
    }));
    assert.ok(!htmlNoEnemy.includes('combat-signature-drop-hint'), '적이 없을 때도 힌트 미노출');
});
