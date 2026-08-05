import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { RELICS } from '../src/data/relics.ts';
import {
    getRelicVisual,
    getRelicVisualCategory,
    hasRelicVisualCategory,
} from '../src/utils/relicVisuals.ts';

const CATEGORIES = ['attack', 'survival', 'energy', 'exploration', 'treasure', 'cursed', 'legendary'];
const readSource = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const readPng = async (category) => {
    const file = await readFile(new URL(`../public/assets/relics/${category}.png`, import.meta.url));
    return {
        signature: file.subarray(1, 4).toString('ascii'),
        width: file.readUInt32BE(16),
        height: file.readUInt32BE(20),
        colorType: file[25],
        digest: createHash('sha256').update(file).digest('hex'),
    };
};

test('현재 유물 효과는 모두 명시적인 시각 계열을 가진다', () => {
    const missing = RELICS.filter((relic) => !hasRelicVisualCategory(relic.effect));
    assert.deepEqual(missing, []);

    assert.equal(getRelicVisualCategory({ effect: 'double_strike' }), 'attack');
    assert.equal(getRelicVisualCategory({ effect: 'fortress' }), 'survival');
    assert.equal(getRelicVisualCategory({ effect: 'mp_regen_turn' }), 'energy');
    assert.equal(getRelicVisualCategory({ effect: 'event_chance' }), 'exploration');
    assert.equal(getRelicVisualCategory({ effect: 'gold_mult' }), 'treasure');
    assert.equal(getRelicVisualCategory({ effect: 'cursed_power' }), 'cursed');
    assert.equal(getRelicVisualCategory({ effect: 'double_strike' }, true), 'legendary');
});

test('유물 계열 asset은 서로 다른 100px RGBA PNG다', async () => {
    const assets = await Promise.all(CATEGORIES.map(readPng));

    for (const asset of assets) {
        assert.deepEqual(
            { signature: asset.signature, width: asset.width, height: asset.height, colorType: asset.colorType },
            { signature: 'PNG', width: 100, height: 100, colorType: 6 },
        );
    }
    assert.equal(new Set(assets.map((asset) => asset.digest)).size, CATEGORIES.length);
});

test('시각 helper와 실제 asset 경로가 일치한다', () => {
    for (const category of CATEGORIES) {
        const relic = category === 'legendary'
            ? { effect: 'genesis' }
            : RELICS.find((candidate) => getRelicVisualCategory(candidate) === category);
        const visual = getRelicVisual(relic);
        assert.equal(visual.category, category);
        assert.equal(visual.src, `/assets/relics/${category}.png`);
    }
});

test('선택·성장 조언·보유 목록은 같은 유물 아이콘을 사용한다', async () => {
    const [choice, advice, system, icon] = await Promise.all([
        readSource('src/components/RelicChoicePanel.tsx'),
        readSource('src/components/BuildAdvicePanel.tsx'),
        readSource('src/components/tabs/SystemTab.tsx'),
        readSource('src/components/icons/RelicIcon.tsx'),
    ]);

    assert.match(choice, /<RelicIcon relic=\{relic\}/);
    assert.match(advice, /<RelicIcon relic=\{relic\}/);
    assert.match(system, /<RelicIcon relic=\{relic\}/);
    assert.match(system, /getPrestigeUnlocks\(player\.meta\?\.prestigeRank\)\.maxRelics/);
    assert.doesNotMatch(system, /보유 유물 \$\{relics\.length\}\/5/);
    assert.match(icon, /data-relic-visual-category=\{visual\.category\}/);
});
