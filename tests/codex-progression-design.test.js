import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { DB } from '../src/data/db.js';
import { getCodexProgress } from '../src/data/codexRewards.js';
import {
    CODEX_CATEGORY_LABELS,
    formatCodexRewardParts,
    getNextCodexGoals,
} from '../src/utils/codexPresentation.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relativePath) => readFile(path.join(ROOT, relativePath), 'utf8');

const EMPTY_CODEX = {
    weapons: {},
    armors: {},
    shields: {},
    monsters: {},
    recipes: {},
    materials: {},
};

test('도감은 599개 기록을 여섯 수집 범주로 정확히 계산한다', () => {
    const monsters = new Set();
    for (const map of Object.values(DB.MAPS)) {
        for (const name of [...(map.monsters || []), ...(map.bossMonsters || [])]) monsters.add(name);
        if (typeof map.boss === 'string') monsters.add(map.boss);
    }

    const totals = {
        weapons: DB.ITEMS.weapons.length,
        armors: DB.ITEMS.armors.filter((item) => item.type === 'armor').length,
        shields: DB.ITEMS.armors.filter((item) => item.type === 'shield').length,
        monsters: monsters.size,
        recipes: DB.ITEMS.recipes.length,
        materials: DB.ITEMS.materials.length,
    };

    assert.deepEqual(totals, {
        weapons: 117,
        armors: 91,
        shields: 21,
        monsters: 254,
        recipes: 60,
        materials: 56,
    });
    assert.equal(Object.values(totals).reduce((sum, value) => sum + value, 0), 599);
    assert.equal(Object.keys(CODEX_CATEGORY_LABELS).length, 6);
});

test('새 모험가에게 가장 가까운 서로 다른 수집 목표 세 개를 추천한다', () => {
    const progress = getCodexProgress(EMPTY_CODEX, []);
    const goals = getNextCodexGoals(progress.milestones, {}, 3);

    assert.deepEqual(goals.map((goal) => goal.category), ['shields', 'weapons', 'armors']);
    assert.deepEqual(goals.map((goal) => goal.remaining), [3, 5, 5]);
    assert.deepEqual(goals.map((goal) => goal.label), ['방패 수집가 I', '무기 수집가 I', '방어구 수집가 I']);
});

test('완료한 수집 단계는 건너뛰고 다음 마일스톤을 추천한다', () => {
    const codex = {
        ...EMPTY_CODEX,
        shields: Object.fromEntries(Array.from({ length: 4 }, (_, index) => [`shield-${index}`, { discovered: true }])),
    };
    const progress = getCodexProgress(codex, ['shields_3']);
    const goals = getNextCodexGoals(progress.milestones, { shields: 4 }, 6);
    const shieldGoal = goals.find((goal) => goal.category === 'shields');

    assert.ok(shieldGoal);
    assert.equal(shieldGoal.label, '방패 수집가 II');
    assert.equal(shieldGoal.current, 4);
    assert.equal(shieldGoal.remaining, 2);
});

test('도감 고유 능력치 보상을 빈칸 없이 플레이어 문구로 표시한다', () => {
    assert.deepEqual(formatCodexRewardParts({ atk: 2 }), ['공격력 +2']);
    assert.deepEqual(
        formatCodexRewardParts({ hp: 30, def: 3, premiumCurrency: 10 }),
        ['방어력 +3', '생명 +30', '에테르 크리스탈 10'],
    );
});

test('도감 화면은 다음 수집 목표와 펼쳐 보는 기록 구조를 사용한다', async () => {
    const [codex, weapon, monster, recipe, material, legendary] = await Promise.all([
        readSrc('src/components/Codex.tsx'),
        readSrc('src/components/codex/WeaponCodex.tsx'),
        readSrc('src/components/codex/MonsterCodex.tsx'),
        readSrc('src/components/codex/RecipeCodex.tsx'),
        readSrc('src/components/codex/MaterialCodex.tsx'),
        readSrc('src/components/codex/LegendaryCodex.tsx'),
    ]);

    assert.match(codex, /data-testid="codex-next-goals"/);
    assert.match(codex, /grid-cols-5/);
    assert.match(weapon, /<details/);
    assert.match(monster, /codex-monster-research-goals/);
    assert.match(recipe, /codex-recipe-undiscovered/);
    assert.match(material, /codex-material-undiscovered/);
    assert.match(legendary, /grid-cols-2/);

    const surface = `${codex}\n${weapon}\n${monster}\n${recipe}\n${material}\n${legendary}`;
    assert.doesNotMatch(surface, /max-h-\[45dvh\]/);
    assert.doesNotMatch(surface, /text-\[(?:8|9|10)px\]/);
});
