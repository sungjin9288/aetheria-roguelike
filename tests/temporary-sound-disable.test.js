import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import { constants } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relativePath) => readFile(path.join(ROOT, relativePath), 'utf8');

const collectSourceFiles = async (directory) => {
    const entries = await readdir(directory, { withFileTypes: true });
    const nested = await Promise.all(entries.map(async (entry) => {
        const target = path.join(directory, entry.name);
        if (entry.isDirectory()) return collectSourceFiles(target);
        return /\.(?:ts|tsx|js|jsx)$/.test(entry.name) ? [target] : [];
    }));
    return nested.flat();
};

test('legacy synthetic sound engine is removed until location soundscapes are designed', async () => {
    await assert.rejects(
        access(path.join(ROOT, 'src/systems/SoundManager.ts'), constants.F_OK),
        { code: 'ENOENT' },
    );

    const sourceFiles = await collectSourceFiles(path.join(ROOT, 'src'));
    const sources = await Promise.all(sourceFiles.map((file) => readFile(file, 'utf8')));
    const productionSource = sources.join('\n');

    assert.doesNotMatch(productionSource, /SoundManager|soundManager/);
    assert.doesNotMatch(productionSource, /AudioContext|webkitAudioContext/);
});

test('the app shell and persistent status expose no temporary sound control', async () => {
    const [layout, status, app, gameRoot] = await Promise.all([
        readSrc('src/components/MainLayout.tsx'),
        readSrc('src/components/StatusBar.tsx'),
        readSrc('src/App.tsx'),
        readSrc('src/components/app/GameRoot.tsx'),
    ]);

    assert.doesNotMatch(layout, /soundManager|AudioContext/);
    assert.doesNotMatch(status, /Volume2|VolumeX|소리 켜기|소리 끄기|onToggleMute|isMuted/);
    assert.doesNotMatch(app, /isMuted|setIsMuted/);
    assert.doesNotMatch(gameRoot, /handleToggleMute|onToggleMute|setIsMuted|isMuted/);
});
