import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { MAPS } from '../src/data/maps.js';
import { getMonsterVisual, getRegionVisual } from '../src/utils/monsterVisuals.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');

const readPngHeader = async (assetPath) => {
    const buffer = await readFile(path.join(ROOT, 'public', assetPath));
    return {
        signature: buffer.subarray(1, 4).toString('ascii'),
        width: buffer.readUInt32BE(16),
        height: buffer.readUInt32BE(20),
        colorType: buffer.readUInt8(25),
    };
};

test('first forest and plains routes never fall back to a generic monster silhouette', async () => {
    for (const regionName of ['고요한 숲', '서쪽 평원']) {
        const region = getRegionVisual(regionName);
        assert.ok(region, `${regionName} region art`);

        for (const monsterName of MAPS[regionName].monsters) {
            const visual = getMonsterVisual(monsterName);
            assert.ok(visual, `${regionName}/${monsterName} exact art`);
            assert.equal(visual.regionKey, region.key, `${monsterName} shares the map visual family`);

            const header = await readPngHeader(visual.src);
            assert.deepEqual(
                header,
                { signature: 'PNG', width: 160, height: 160, colorType: 6 },
                `${monsterName} uses a 160px RGBA PNG`,
            );
        }
    }
});

test('ruins and fire visual families cover their planned encounter set', async () => {
    for (const regionName of ['잊혀진 폐허', '화염의 협곡']) {
        const region = getRegionVisual(regionName);
        assert.ok(region, `${regionName} region art`);

        for (const monsterName of MAPS[regionName].monsters) {
            const visual = getMonsterVisual(monsterName);
            assert.ok(visual, `${regionName}/${monsterName} exact art`);
            assert.equal(visual.regionKey, region.key);
        }
    }

    assert.equal(getMonsterVisual('분노한 화염의 군주')?.key, 'fire-lord');
    assert.equal(getMonsterVisual('격노한 레드 드래곤')?.key, 'red-dragon');
    assert.equal(getMonsterVisual('정예 숲의 정령')?.key, 'forest-spirit');
    assert.equal(getMonsterVisual('고대 호수의 수호신'), null);
});

test('region markers are fixed 96px RGBA assets', async () => {
    for (const regionName of ['고요한 숲', '서쪽 평원', '잊혀진 폐허', '화염의 협곡']) {
        const visual = getRegionVisual(regionName);
        assert.ok(visual);
        assert.deepEqual(
            await readPngHeader(visual.src),
            { signature: 'PNG', width: 96, height: 96, colorType: 6 },
        );
    }
});

test('runtime components expose exact and fallback art states without revealing blind routes', async () => {
    const [monsterIcon, routeTopology] = await Promise.all([
        readFile(path.join(ROOT, 'src/components/icons/MonsterIcon.tsx'), 'utf8'),
        readFile(path.join(ROOT, 'src/components/RouteTopology.tsx'), 'utf8'),
    ]);

    assert.match(monsterIcon, /data-monster-art=/);
    assert.match(monsterIcon, /'family-fallback'/);
    assert.match(monsterIcon, /data-region-family=\{visual\?\.regionKey\}/);
    assert.match(routeTopology, /blindMap \? null : getRegionVisual/);
    assert.match(routeTopology, /data-region-family=\{regionVisual\?\.key\}/);
});

test('source sheets and explicit crop coordinates remain reproducible', async () => {
    const script = await readFile(path.join(ROOT, 'scripts/process_monster_region_art.py'), 'utf8');
    for (const source of ['forest.png', 'plains.png', 'ruins.png', 'fire.png', 'regions.png']) {
        await readFile(path.join(ROOT, 'scripts/art_sources/monster-region', source));
        assert.match(script, new RegExp(source.replace('.', '\\.')));
    }
    assert.match(script, /MONSTER_CROPS = \(/);
    assert.match(script, /REGION_CROPS = \(/);
    assert.match(script, /remove_connected_checkerboard/);
});
