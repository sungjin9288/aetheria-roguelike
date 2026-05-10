import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 595: claimSeasonReward `rewardLabel = null` default unreachable
 *   (cycle 222-594 silent dead config 시리즈 332번째 — redundant default annotation
 *   default cleanup 메가 시리즈 추가).
 *
 * 발견 (1 default unreachable):
 * - src/hooks/useInventoryActions.ts (line 532):
 *     claimSeasonReward: (tier: any, rewardLabel: string | null = null) => {
 *         dispatch({ type: AT.CLAIM_SEASON_REWARD, payload: { tier } });
 *         const label = rewardLabel ? `${rewardLabel}` : `티어 ${tier}`;
 *         ...
 *     }
 * - 호출 사이트:
 *     · SeasonPassPanel.tsx:32 — onClaimSeasonReward(rewardTier, label) — 2 args
 *       명시.
 *     · 다른 caller 0건.
 * - 결과: rewardLabel 항상 명시 전달. default null 도달 불가.
 *   body의 `rewardLabel ? ... : 티어 ${tier}` ternary는 별개 보존 (caller가
 *   null/empty string 넘기는 path 활성).
 *
 * 패턴 (cycle 222-594 시리즈 332번째):
 * - cycle 502-594 default 청소 메가 시리즈 + cycle 593-594 dead exposure
 *   2-cycle pivot 후 다시 default cleanup 복귀.
 *
 * 수정 (src/hooks/useInventoryActions.ts):
 * - rewardLabel: string | null = null → rewardLabel: string | null.
 * - body의 rewardLabel ternary 보존.
 *
 * 회귀 가드:
 * - 1 production callsite (SeasonPassPanel) 동작 그대로.
 * - body dispatch / addLog / soundManager 처리 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 595: claimSeasonReward signature에서 rewardLabel default 0건', async () => {
    const source = await readSrc('src/hooks/useInventoryActions.ts');
    assert.ok(!/claimSeasonReward:\s*\(tier:\s*any,\s*rewardLabel:\s*string \| null\s*=\s*null\)/.test(source),
        'claimSeasonReward rewardLabel default null 제거');
    assert.ok(/claimSeasonReward:\s*\(tier:\s*any,\s*rewardLabel:\s*string \| null\)/.test(source),
        'claimSeasonReward rewardLabel 파라미터 자체는 보존');
});

test('cycle 595: 정합성 가드 — SeasonPassPanel callsite 보존', async () => {
    const source = await readSrc('src/components/tabs/SeasonPassPanel.tsx');
    assert.ok(/onClaimSeasonReward\(rewardTier, label\)/.test(source),
        'SeasonPassPanel onClaimSeasonReward(rewardTier, label) callsite 보존');
});

test('cycle 595: body rewardLabel ternary + dispatch 처리 보존', async () => {
    const source = await readSrc('src/hooks/useInventoryActions.ts');
    assert.ok(/const label = rewardLabel \? `\$\{rewardLabel\}` : `티어 \$\{tier\}`/.test(source),
        'rewardLabel ? ... : 티어 ternary 보존');
    assert.ok(/addLog\('success', `시즌 패스 보상 수령: \$\{label\}`\)/.test(source),
        'addLog success 보존');
});

test('cycle 595: cycle 502-594 회귀 가드 — default/dead 청소 시리즈 보존', async () => {
    const env = await readSrc('src/vite-env.d.ts');
    assert.ok(!/advanceTime\?:\s*any/.test(env),
        'cycle 594 vite-env Window.advanceTime 0건');

    const ut = await readSrc('src/hooks/useGameTestApi.ts');
    assert.ok(!/window\.advanceTime\s*=/.test(ut),
        'cycle 593 window.advanceTime 정의 0건');
});
