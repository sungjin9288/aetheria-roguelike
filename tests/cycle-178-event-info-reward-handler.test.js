import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { EVENT_CHAINS } from '../src/data/eventChains.js';

/**
 * cycle 178: eventChains 'info' reward type 핸들러 추가 + 모든 reward type 핸들러 가드.
 *
 * 발견:
 * - eventChains.ts ancient_prophecy chain의 outcome에 reward.type='info'와
 *   reward.text 정의 — 플레이어에게 게임 메커니즘 힌트 제공 의도.
 * - 그러나 eventActions.handleEventChoice가 6 reward type(gold / item /
 *   legendary_item / relic / combat_bonus / stat_bonus)만 처리. 'info'
 *   분기 누락으로 reward.text가 silent 누락.
 * - 결과: ancient_prophecy chain 진행 중 "원시의 파편: 프레스티지 후 마왕
 *   처치 시 40% 확률로 획득" 같은 핵심 정보가 플레이어에게 도달 안 함.
 *
 * 수정:
 * 1. eventActions.ts에 rwd.type === 'info' 분기 추가 — addLog('system', ...) 출력.
 * 2. eventChains의 모든 reward.type이 eventActions에서 핸들러 보유한지 회귀 가드.
 *    cycle 134/138/141/148/164/176 baseline pattern 시리즈 합류.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');

test('eventChains의 모든 reward.type이 eventActions.ts에서 핸들러 보유', async () => {
    // Collect all reward types from EVENT_CHAINS
    const rewardTypes = new Set();
    for (const chain of EVENT_CHAINS) {
        for (const step of (chain.steps || [])) {
            for (const outcome of (step.event?.outcomes || [])) {
                if (outcome.reward?.type) rewardTypes.add(outcome.reward.type);
            }
        }
    }

    const handlerSrc = await readFile(path.join(ROOT, 'src/hooks/gameActions/eventActions.ts'), 'utf8');
    const dead = [];
    for (const t of rewardTypes) {
        const re = new RegExp(`rwd\\.type\\s*===\\s*['"]${t}['"]`);
        if (!re.test(handlerSrc)) dead.push(t);
    }
    assert.deepEqual(dead, [],
        `eventChains reward.type 핸들러 누락:\n  ${dead.join('\n  ')}`);
});

test('cycle 178: eventActions에 info 핸들러 명시', async () => {
    const handlerSrc = await readFile(path.join(ROOT, 'src/hooks/gameActions/eventActions.ts'), 'utf8');
    assert.match(handlerSrc, /rwd\.type === 'info'/);
    assert.match(handlerSrc, /rwd\.text/);
});

test('eventChains의 info reward 사용 사례 1+ (cycle 178 fix 대상 명시)', () => {
    let infoCount = 0;
    for (const chain of EVENT_CHAINS) {
        for (const step of (chain.steps || [])) {
            for (const outcome of (step.event?.outcomes || [])) {
                if (outcome.reward?.type === 'info') infoCount++;
            }
        }
    }
    assert.ok(infoCount >= 1, 'eventChains에 info reward 사용 케이스가 있어야 함');
});
