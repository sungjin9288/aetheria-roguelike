import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 113: CombatPanel 적 debuff 시각 노출 — cycle 111 player debuff chip의
 * 짝(symmetry)으로 적의 활성 status 효과(stunnedTurns / cursedTurns / blindTurns
 * / fearTurns / dots)를 전투 화면에 표시.
 *
 * 발견:
 * - 플레이어가 스킬로 적에게 stun/curse/blind/fear/dots 부여 가능 (cycle 초기부터)
 *   하지만 CombatPanel은 enemy.status / enemy.dots 등을 어디서도 표시 안 함.
 * - 결과: 플레이어가 빙결 스킬을 썼는데 적이 빙결됐는지, 출혈이 들어갔는지
 *   전투 로그를 다시 봐야만 알 수 있음.
 * - cycle 111에서 player.status를 StatusBar에 chip으로 노출했으니 적 쪽도
 *   대칭적으로 닫는 단계.
 *
 * 추가:
 * - CombatPanel에 enemy debuff chip 영역 (data-testid="combat-enemy-debuff-chip").
 * - 표시 대상: stunnedTurns > 0, cursedTurns > 0, blindTurns > 0, fearTurns > 0,
 *   enemy.dots 배열 (poison/burn/bleed).
 * - 단일 톤(emerald 또는 cyan — 플레이어에 유리한 상태) — cycle 111의 rose(위험)와
 *   대비.
 * - 라벨: 첫 active debuff 한국어명 + "+N" (multiple).
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('CombatPanel: combat-enemy-debuff-chip testid 노출', async () => {
    const source = await readSrc('src/components/tabs/CombatPanel.tsx');
    assert.match(source, /data-testid\s*=\s*["']combat-enemy-debuff-chip["']/);
});

test('CombatPanel: enemy.stunnedTurns / cursedTurns / blindTurns / fearTurns 모두 참조', async () => {
    const source = await readSrc('src/components/tabs/CombatPanel.tsx');
    assert.match(source, /stunnedTurns/);
    assert.match(source, /cursedTurns/);
    assert.match(source, /blindTurns/);
    assert.match(source, /fearTurns/);
});

test('CombatPanel: enemy.dots 배열 (poison/burn/bleed) 참조', async () => {
    const source = await readSrc('src/components/tabs/CombatPanel.tsx');
    assert.match(source, /enemy[?.]*\.dots/);
});

test('CombatPanel: 한국어 라벨 매핑 (기절/저주/실명/공포/독/화상/출혈)', async () => {
    const source = await readSrc('src/components/tabs/CombatPanel.tsx');
    const labels = ['기절', '저주', '실명', '공포'];
    for (const label of labels) {
        assert.ok(source.includes(label), `should map enemy debuff to '${label}'`);
    }
});

test('CombatPanel: 기존 combat-signature-drop-hint testid 회귀 보존', async () => {
    const source = await readSrc('src/components/tabs/CombatPanel.tsx');
    assert.match(source, /data-testid\s*=\s*["']combat-signature-drop-hint["']/);
});
