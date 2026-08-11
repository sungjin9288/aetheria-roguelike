import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { BALANCE } from '../src/data/constants.ts';
import { EVENT_CHAINS } from '../src/data/eventChains.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSource = (relativePath) => readFile(path.join(ROOT, relativePath), 'utf8');

test('manual reset copy names the current journey and distinguishes reset from preservation', async () => {
    const source = await readSource('src/components/Dashboard.tsx');

    assert.match(source, /현재 여정 다시 시작/);
    assert.match(source, /레벨[^\n]*장비[^\n]*(가방|소지품)[^\n]*(임무|퀘스트)[^\n]*현재 원정/);
    assert.match(source, /영구 성장[^\n]*직업 여정[^\n]*설정[^\n]*도감/);
    assert.doesNotMatch(source, /진행 초기화/);
    assert.doesNotMatch(source, /지금까지의 진행 상황을.*지/);
});

test('ascension copy includes permanent journey and accessibility state', async () => {
    const source = await readSource('src/components/AscensionScreen.tsx');

    assert.match(source, /영구 능력[^\n]*직업 여정[^\n]*설정[^\n]*도감/);
    assert.match(source, /레벨[^\n]*장비와 가방[^\n]*유물[^\n]*임무[^\n]*현재 원정/);
    assert.match(source, /data-testid="ascension-confirm"[\s\S]*min-h-\[48px\]/);
    assert.match(source, /data-testid="ascension-cancel"[\s\S]*min-h-\[48px\]/);
});

test('primal shard guidance derives its percentage from the live balance constant', async () => {
    const prophecy = EVENT_CHAINS.find((chain) => chain.id === 'ancient_prophecy');
    const infoReward = prophecy.steps
        .flatMap((step) => step.event.outcomes)
        .map((outcome) => outcome.reward)
        .find((reward) => reward?.type === 'info');
    const expectedPercent = Math.round(BALANCE.PRIMAL_SHARD_DROP_CHANCE * 100);
    const source = await readSource('src/data/eventChains.ts');

    assert.equal(infoReward.text, `원시의 파편: 계승 1단계부터 마왕 처치 시 ${expectedPercent}% 확률로 획득`);
    assert.match(source, /BALANCE\.PRIMAL_SHARD_DROP_CHANCE/);
    assert.doesNotMatch(source, /마왕 처치 시 40%/);
});
