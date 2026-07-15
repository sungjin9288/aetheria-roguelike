import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('equipment slots reuse the same item art component as shop and inventory', async () => {
    const source = await readFile(new URL('../src/components/EquipmentPanel.tsx', import.meta.url), 'utf8');

    assert.match(source, /import ItemIcon from '.\/icons\/ItemIcon'/);
    assert.match(source, /<ItemIcon[\s\S]*?item=\{item\}[\s\S]*?size=\{42\}[\s\S]*?showBorder/);
});
