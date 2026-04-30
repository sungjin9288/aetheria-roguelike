import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * LegendaryCodex pity status — "reflect" 계층 상시 surface.
 *
 * pity 공명은 boss 조우 시에만 legendary 로그로 노출되어 휘발적이다.
 * 플레이어가 "지금 공명 얼마나 적재돼 있지?"를 확인할 persistent surface가 없다.
 * LegendaryCodex는 플레이어가 legendary 수집 현황을 살피러 들르는 화면이라
 * 자연스러운 지점. 아래 정보를 한 카드로 노출:
 *   - 현재 pity 카운터 (N회)
 *   - 임계값 대비 진행도 또는 활성 배율 +pct%
 *   - threshold 미달일 땐 남은 횟수 안내
 *
 * 계약:
 *   1. LegendaryCodex가 getSignaturePityMultiplier + SIGNATURE_PITY import
 *   2. player.stats.signaturePity 읽기
 *   3. 전용 testid(legendary-codex-pity-status) 노출
 *   4. "공명" 라벨 포함
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('LegendaryCodex imports pity helpers', async () => {
    const source = await readSrc('src/components/codex/LegendaryCodex.tsx');
    assert.ok(
        /getSignaturePityMultiplier/.test(source),
        'should import getSignaturePityMultiplier'
    );
    assert.ok(
        /SIGNATURE_PITY/.test(source),
        'should import SIGNATURE_PITY constants (for THRESHOLD/CAP)'
    );
});

test('LegendaryCodex reads player.stats.signaturePity', async () => {
    const source = await readSrc('src/components/codex/LegendaryCodex.tsx');
    assert.ok(
        /player[^]{0,40}stats[^]{0,10}signaturePity/.test(source),
        'should read player.stats.signaturePity'
    );
});

test('LegendaryCodex renders stable pity status testid', async () => {
    const source = await readSrc('src/components/codex/LegendaryCodex.tsx');
    assert.ok(
        /legendary-codex-pity-status/.test(source),
        'pity status card should carry data-testid="legendary-codex-pity-status"'
    );
});

test('LegendaryCodex shows "공명" label in pity card', async () => {
    const source = await readSrc('src/components/codex/LegendaryCodex.tsx');
    assert.ok(
        /공명/.test(source),
        'pity card should include the 공명 (resonance) label'
    );
});

test('LegendaryCodex references SIGNATURE_PITY.THRESHOLD for progress', async () => {
    const source = await readSrc('src/components/codex/LegendaryCodex.tsx');
    assert.ok(
        /SIGNATURE_PITY\.THRESHOLD/.test(source),
        'pity progress calculation should reference SIGNATURE_PITY.THRESHOLD'
    );
});
