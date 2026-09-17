import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('always-null inventory spotlight is absent from the production UI and test API cascade', async () => {
    const paths = [
        'src/App.tsx',
        'src/components/app/GameRoot.tsx',
        'src/components/app/MobileGameLayout.tsx',
        'src/components/Dashboard.tsx',
        'src/components/SmartInventory.tsx',
        'src/hooks/useGameTestApi.ts',
    ];
    for (const path of paths) {
        assert.doesNotMatch(
            await read(path),
            /inventorySpotlight|onClearInventorySpotlight|onClearSpotlight|spotlight\s*\?:|spotlight\s*[},=]|\bspotlight\?\./,
            path,
        );
    }
});

test('legacy archived history has no active state, cloud side effect, type or export surface', async () => {
    const paths = [
        'src/reducers/gameReducer.ts',
        'src/types/player.ts',
        'src/utils/dataMigration.ts',
        'src/hooks/useFirebaseSync.ts',
        'src/components/tabs/SystemTab.tsx',
    ];
    for (const path of paths) {
        assert.doesNotMatch(await read(path), /archivedHistory/, path);
    }
});
