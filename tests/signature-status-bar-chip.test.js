import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('persistent status omits equipment affinity and signature signals', async () => {
    const source = await readSrc('src/components/StatusBar.tsx');

    assert.doesNotMatch(source, /isSignatureItem|equippedSignatureCount|status-signature-chip/);
    assert.doesNotMatch(source, /OUTFIT_SLOT_COUNT|status-outfit-affinity-chip|장비 조화/);
});

test('equipment console retains signature and set-affinity detail', async () => {
    const source = await readSrc('src/components/EquipmentPanel.tsx');

    assert.match(source, /equipment-signature-chip/);
    assert.match(source, /jobAffinity|세트 효과/);
});
