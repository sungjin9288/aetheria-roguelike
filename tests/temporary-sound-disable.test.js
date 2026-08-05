import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relativePath) => readFile(path.join(ROOT, relativePath), 'utf8');

test('legacy synthetic sound stays silent until location soundscapes replace it', async () => {
    const manager = await readSrc('src/systems/SoundManager.ts');

    assert.match(manager, /const LEGACY_SYNTH_AUDIO_ENABLED = false/);
    assert.match(manager, /init\(\) \{\s*if \(!LEGACY_SYNTH_AUDIO_ENABLED\) return;/);
    assert.match(manager, /_ensureReady\(\) \{\s*if \(!LEGACY_SYNTH_AUDIO_ENABLED\) return false;/);
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
