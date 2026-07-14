import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('local playtest runs e2e against the preview URL it started', async () => {
    const script = await readFile(new URL('../scripts/local-playtest.sh', import.meta.url), 'utf8');
    const e2eBlock = script.slice(script.indexOf('if [[ "${AETHERIA_RUN_E2E:-0}" == "1" ]]'));

    assert.match(e2eBlock, /PLAYWRIGHT_BASE_URL="\$\{URL\}" npm run test:e2e/);
    assert.doesNotMatch(e2eBlock, /PORT.*REQUESTED_PORT/);
});
