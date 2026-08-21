import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('expedition debrief keeps rewarded supply secondary and never disables the primary route', async () => {
    const source = await readFile(new URL('../src/components/ExpeditionDebriefCard.tsx', import.meta.url), 'utf8');
    const hook = await readFile(new URL('../src/hooks/useReturnSupplyRewardedAd.ts', import.meta.url), 'utf8');
    assert.match(source, /data-testid="return-supply-reward-action"/);
    assert.match(hook, /광고 시청 시 하급 체력 물약 1개/);
    assert.match(source, /data-testid="expedition-debrief-primary-action"[\s\S]*?onClick=\{onPrimaryAction\}/);
    assert.doesNotMatch(source, /expedition-debrief-primary-action[\s\S]{0,300}disabled=/);
    assert.match(source, /min-h-\[44px\]/);
    assert.match(source, /break-words/);
});

test('expedition debrief height subtracts both safe-area paddings from the mobile viewport', async () => {
    const source = await readFile(new URL('../src/components/ExpeditionDebriefCard.tsx', import.meta.url), 'utf8');
    assert.match(
        source,
        /maxHeight:\s*'calc\(100dvh - max\(var\(--aether-safe-area-top\), 0\.5rem\) - max\(var\(--aether-safe-area-bottom\), 0\.5rem\)\)'/,
    );
    assert.doesNotMatch(source, /initial=\{\{ opacity: 0, y: [1-9]/);
    assert.doesNotMatch(source, /initial=\{\{ opacity: 0, scale: 0\./);
});

test('rewarded ad hook is long-lived in GameRoot and dispatches only the receipt identity', async () => {
    const root = await readFile(new URL('../src/components/app/GameRoot.tsx', import.meta.url), 'utf8');
    const hook = await readFile(new URL('../src/hooks/useReturnSupplyRewardedAd.ts', import.meta.url), 'utf8');
    assert.match(root, /useReturnSupplyRewardedAd\(\{/);
    assert.match(root, /debriefOpen:\s*showExpeditionDebrief/);
    assert.match(hook, /visible\s*=\s*Boolean\(debriefOpen\s*&&\s*eligible/);
    assert.match(hook, /type: AT\.RECORD_RETURN_SUPPLY_REWARD[\s\S]*payload: \{ expeditionId: summaryId \}/);
    assert.doesNotMatch(hook, /unitType|unitAmount/);
});

test('reward transaction telemetry resolves only reducer-backed pending or delivered receipts', async () => {
    const { resolveRewardTransactionOutcome } = await import('../src/hooks/useReturnSupplyRewardedAd.ts');
    assert.equal(resolveRewardTransactionOutcome('exp-1', 'exp-1', 'pending'), 'pending');
    assert.equal(resolveRewardTransactionOutcome('exp-1', 'exp-1', 'delivered'), 'delivered');
    assert.equal(resolveRewardTransactionOutcome('exp-1', 'exp-1', 'available'), 'rejected');
    assert.equal(resolveRewardTransactionOutcome('exp-1', 'exp-2', 'delivered'), 'rejected');
});
