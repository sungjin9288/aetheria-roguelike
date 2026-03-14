import test from 'node:test';
import assert from 'node:assert/strict';

import { advanceExploreState, getNarrativeEventChance, getQuietExplorationChance } from '../src/utils/explorationPacing.js';
import { getRunBuildProfile, getClassBuildCompatibility, getClassBuildBonus, getEnemyTacticalProfile, getRunDiagnostics, getTraitFeaturedItems, getTraitItemResonance, getTraitLootHint, getTraitProfile, getTraitSkill } from '../src/utils/runProfileUtils.js';

test('exploration pacing increases narrative chance after long dry streaks and reduces repeated quiet turns', () => {
    const dryStats = {
        exploreState: {
            sinceNarrativeEvent: 7,
            sinceDiscovery: 4,
            sinceRelic: 5,
            quietStreak: 3,
        }
    };

    const narrativeChance = getNarrativeEventChance(0.2, 0, dryStats);
    const quietChance = getQuietExplorationChance(dryStats);

    assert.equal(narrativeChance, 0.125);
    assert.ok(Math.abs(quietChance - 0.15) < 1e-9);
});

test('advanceExploreState resets and increments the expected exploration counters', () => {
    const afterNothing = advanceExploreState({ exploreState: { sinceNarrativeEvent: 1, sinceDiscovery: 1, sinceRelic: 1, quietStreak: 0 } }, 'nothing');
    assert.deepEqual(afterNothing, {
        sinceNarrativeEvent: 2,
        sinceDiscovery: 2,
        sinceRelic: 2,
        quietStreak: 1,
        lastOutcome: 'nothing',
    });

    const afterRelic = advanceExploreState({ exploreState: afterNothing }, 'relic_found');
    assert.deepEqual(afterRelic, {
        sinceNarrativeEvent: 3,
        sinceDiscovery: 0,
        sinceRelic: 0,
        quietStreak: 0,
        lastOutcome: 'relic_found',
    });
});

test('run build profile recognizes dual-wield combo setups', () => {
    const player = {
        hp: 120,
        maxHp: 180,
        relics: [
            { effect: 'combo_stack' },
            { effect: 'double_strike' },
            { effect: 'crit_mp_regen' },
        ],
        equip: {
            weapon: { type: 'weapon', name: '롱소드', val: 18, hands: 1, elem: '물리' },
            offhand: { type: 'weapon', name: '은단검', val: 12, hands: 1, elem: '물리' },
        }
    };

    const profile = getRunBuildProfile(player, { maxHp: 180, isMagic: false });

    assert.equal(profile.primary.name, '쌍수 연격');
    assert.ok(profile.primary.reasons.includes('쌍수 무기'));
});

test('run build profile recognizes arcane setups with focus and mana relics', () => {
    const player = {
        hp: 150,
        maxHp: 150,
        relics: [
            { effect: 'mp_mult' },
            { effect: 'free_skill' },
            { effect: 'skill_mult' },
        ],
        equip: {
            weapon: { type: 'weapon', name: '푸른 지팡이', val: 16, hands: 1, elem: '냉기' },
            offhand: { type: 'shield', subtype: 'focus', name: '견습 주문서', val: 2, mp: 10 },
        }
    };

    const profile = getRunBuildProfile(player, { maxHp: 150, isMagic: true });

    assert.equal(profile.primary.name, '비전 공명');
    assert.ok(profile.primary.reasons.includes('주문서/마도서'));
});

test('class build compatibility and bonus align warrior with crusher setups', () => {
    const player = {
        job: '전사',
        hp: 160,
        maxHp: 160,
        relics: [{ effect: 'execute_bonus' }],
        equip: {
            weapon: { type: 'weapon', name: '양손검', val: 30, hands: 2, elem: '물리' },
            offhand: null,
        }
    };

    const profile = getRunBuildProfile(player, { maxHp: 160, isMagic: false });
    const compatibility = getClassBuildCompatibility(player.job, profile);
    const bonus = getClassBuildBonus(player.job, profile);

    assert.equal(profile.primary.id, 'crusher');
    assert.equal(compatibility.label, '최적');
    assert.equal(bonus.label, '양손 숙련');
    assert.ok(bonus.atkMult > 1);
});

test('enemy tactical profile includes boss briefing and phase hint', () => {
    const profile = getEnemyTacticalProfile({
        name: '레드 드래곤',
        baseName: '레드 드래곤',
        isBoss: true,
        atk: 120,
        weakness: '냉기',
        resistance: '화염',
        pattern: { guardChance: 0.1, heavyChance: 0.6 },
        phase2: { name: '격노한 레드 드래곤' },
    }, { def: 40 });

    assert.equal(profile.tier, 'BOSS');
    assert.ok(profile.signature?.includes('브레스'));
    assert.ok(profile.counterHint?.includes('냉기'));
    assert.ok(profile.phaseHint?.includes('50%'));
});

test('run diagnostics summarizes pacing and class fit', () => {
    const player = {
        job: '마법사',
        hp: 120,
        maxHp: 180,
        stats: {
            recentBattles: [
                { result: 'win', hpRatio: 0.6 },
                { result: 'win', hpRatio: 0.5 },
                { result: 'death', hpRatio: 0 },
                { result: 'win', hpRatio: 0.42 },
                { result: 'escape', hpRatio: 0.35 },
            ],
            exploreState: {
                sinceNarrativeEvent: 5,
                sinceDiscovery: 3,
                sinceRelic: 4,
                quietStreak: 2,
                lastOutcome: 'combat',
            },
        },
        relics: [{ effect: 'mp_mult' }, { effect: 'skill_mult' }],
        equip: {
            weapon: { type: 'weapon', name: '푸른 지팡이', val: 16, hands: 1, elem: '냉기' },
            offhand: { type: 'shield', subtype: 'focus', name: '견습 주문서', val: 2, mp: 10 },
        }
    };

    const diagnostics = getRunDiagnostics(player, { maxHp: 180, isMagic: true });

    assert.equal(diagnostics.classCompatibility.label, '최적');
    assert.equal(diagnostics.buildProfile.primary.id, 'arcane');
    assert.equal(diagnostics.pacingLabel, '이벤트 대기');
    assert.ok(diagnostics.recommendations.length > 0);
});

test('trait profile simplifies build identity into a readable passive + skill package', () => {
    const player = {
        job: '도적',
        hp: 150,
        maxHp: 150,
        stats: { explores: 3, rests: 0, lowHpWins: 0 },
        relics: [{ effect: 'combo_stack' }, { effect: 'double_strike' }],
        equip: {
            weapon: { type: 'weapon', name: '롱소드', val: 18, hands: 1, elem: '물리' },
            offhand: { type: 'weapon', name: '은단검', val: 12, hands: 1, elem: '물리' },
        }
    };

    const trait = getTraitProfile(player, { maxHp: 150, isMagic: false });
    const skill = getTraitSkill(player, { maxHp: 150, isMagic: false });

    assert.equal(trait.id, 'dual');
    assert.equal(trait.name, '연계');
    assert.ok(trait.passiveLabel.includes('CRIT'));
    assert.equal(skill.fromTrait, true);
    assert.equal(skill.effect, 'bleed');
});

test('trait item resonance strongly prefers arcane items for arcane trait', () => {
    const player = {
        job: '마법사',
        hp: 140,
        maxHp: 140,
        equip: {
            weapon: { type: 'weapon', name: '나무지팡이', val: 12, hands: 2, elem: '물리' },
            offhand: { type: 'shield', subtype: 'focus', name: '견습 주문서', val: 2, mp: 10 },
        },
        relics: [{ effect: 'mp_mult' }, { effect: 'skill_mult' }],
    };
    const trait = getTraitProfile(player, { maxHp: 140, isMagic: true });

    const focusResonance = getTraitItemResonance(
        { type: 'shield', subtype: 'focus', name: '룬 마도서', val: 4, mp: 20, jobs: ['마법사'] },
        trait,
        player
    );
    const bladeResonance = getTraitItemResonance(
        { type: 'weapon', name: '양손검', val: 18, hands: 2, jobs: ['전사'] },
        trait,
        player
    );

    assert.ok(focusResonance.score > bladeResonance.score);
    assert.equal(focusResonance.label, '성향 공명');
});

test('trait loot hint picks the highest resonance reward', () => {
    const player = {
        job: '도적',
        hp: 150,
        maxHp: 150,
        equip: {
            weapon: { type: 'weapon', name: '롱소드', val: 18, hands: 1, elem: '물리' },
            offhand: { type: 'weapon', name: '은단검', val: 12, hands: 1, elem: '물리' },
        },
        relics: [{ effect: 'combo_stack' }, { effect: 'double_strike' }],
        stats: {},
    };
    const trait = getTraitProfile(player, { maxHp: 150, isMagic: false });
    const loot = [
        { type: 'weapon', name: '암살자의 단검', val: 28, jobs: ['도적', '어쌔신'] },
        { type: 'weapon', name: '양손검', val: 18, hands: 2, jobs: ['전사'] },
        { type: 'hp', name: '하급 체력 물약', val: 50 },
    ];

    const hint = getTraitLootHint(loot, trait, player);
    const featured = getTraitFeaturedItems(loot, trait, player, 2);

    assert.equal(hint.name, '암살자의 단검');
    assert.equal(featured[0].item.name, '암살자의 단검');
});
