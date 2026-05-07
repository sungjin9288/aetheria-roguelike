import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 269: CombatPanel 보스 signature/counterHint UI dispatch 누락 dead config
 *   (cycle 222-268 silent dead config 시리즈 40번째).
 *
 * 발견 (UI dispatch lens):
 * - getEnemyTacticalProfile은 BOSS_BRIEFS의 signature(보스 mechanic 광고) / counterHint(대응 전략) /
 *   role / tier / estimatedHit / estimatedHeavy / phaseTriggered 등 풍부한 fields 반환.
 * - 그러나 CombatPanel.tsx는 tacticalProfile.entryHint/hint/phaseHint 3종만 read하고
 *   나머지 14+ 필드 dispatch 0건. signature, counterHint 등 보스 전술 핵심 정보가
 *   영원히 in-combat UI invisible.
 * - Bestiary는 cycle 245에서 signature/counterHint render했지만, in-combat에선 안 보여 player가
 *   보스 mechanic 잊어버림.
 *
 * 패턴 (cycle 222-268 silent dead config 시리즈 40번째):
 * - cycle 245: BOSS_BRIEFS warningChips/recommendedBuilds Bestiary UI dispatch.
 * - cycle 250: stats.activeSet StatsPanel UI dispatch.
 * - cycle 269: tacticalProfile.signature/counterHint CombatPanel UI dispatch (in-combat lens).
 *
 * 수정 (src/components/tabs/CombatPanel.tsx):
 * - 보스 전술 박스에 signature(기믹) / counterHint(대응) 추가 (조건부 렌더링).
 * - 기존 bossBriefLine (entryHint/hint/phaseHint) 유지.
 *
 * 회귀 가드:
 * - bossBriefLine 동작 유지.
 * - non-boss enemy 시 변화 없음.
 * - signature/counterHint 미정의 보스도 안전 (조건부 렌더링).
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 269: CombatPanel이 tacticalProfile.signature read', async () => {
    const source = await readSrc('src/components/tabs/CombatPanel.tsx');
    assert.ok(/tacticalProfile\?.signature|tacticalProfile\.signature/.test(source),
        'CombatPanel은 tacticalProfile.signature 접근');
});

test('cycle 269: CombatPanel이 tacticalProfile.counterHint read', async () => {
    const source = await readSrc('src/components/tabs/CombatPanel.tsx');
    assert.ok(/tacticalProfile\?.counterHint|tacticalProfile\.counterHint/.test(source),
        'CombatPanel은 tacticalProfile.counterHint 접근');
});

test('cycle 269: 조건부 렌더링 (signature/counterHint 미정의 시 미표시)', async () => {
    const source = await readSrc('src/components/tabs/CombatPanel.tsx');
    // `{tacticalProfile?.signature && ...}` 패턴.
    assert.ok(/tacticalProfile\?\.signature\s*&&/.test(source),
        'signature 조건부 렌더링');
    assert.ok(/tacticalProfile\?\.counterHint\s*&&/.test(source),
        'counterHint 조건부 렌더링');
});

test('cycle 269: testid 노출 — 검증 hook', async () => {
    const source = await readSrc('src/components/tabs/CombatPanel.tsx');
    assert.ok(/data-testid=['"]combat-boss-signature['"]/.test(source),
        'combat-boss-signature testid');
    assert.ok(/data-testid=['"]combat-boss-counter['"]/.test(source),
        'combat-boss-counter testid');
});

test('cycle 269: 기존 bossBriefLine 동작 유지 (회귀 가드)', async () => {
    const source = await readSrc('src/components/tabs/CombatPanel.tsx');
    assert.ok(/bossBriefLine/.test(source), 'bossBriefLine 변수 유지');
    assert.ok(/보스 전술/.test(source), '보스 전술 라벨 유지');
});
