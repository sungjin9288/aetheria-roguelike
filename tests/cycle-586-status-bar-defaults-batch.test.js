import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 586: StatusBar 5 defaults batch unreachable
 *   (cycle 222-585 silent dead config 시리즈 324번째 — redundant default annotation
 *   청소 메가 시리즈 77번째). single-cycle 5-default batch (가장 큰 unreachable
 *   batch).
 *
 * 발견 (5 defaults batch):
 * - src/components/StatusBar.tsx (line 108):
 *     const StatusBar = ({
 *         player,
 *         stats,
 *         enemy = null,
 *         onCrystalClick = null,
 *         isMuted = false,
 *         onToggleMute = null,
 *         onOpenEquipment = null,
 *     }: StatusBarProps) => {...};
 * - 호출 사이트 (1 caller):
 *     · GameRoot.tsx:89 — <StatusBar player stats enemy onCrystalClick
 *       isMuted onToggleMute onOpenEquipment /> — 7 props 모두 명시 전달.
 *     · 다른 caller 0건.
 * - 결과: 5 defaults 모두 도달 불가.
 *
 * 패턴 (cycle 222-585 시리즈 324번째):
 * - cycle 502-585: default 청소 메가 시리즈 84사이클.
 * - cycle 586: 가장 큰 unreachable 5-default batch (cycle 572 6-default partial
 *   에 비해 partial 없는 순수 5-default).
 *
 * 수정 (src/components/StatusBar.tsx):
 * - signature에서 5 defaults 모두 제거.
 * - body의 enemy 등 사용처 보존.
 *
 * 회귀 가드:
 * - 1 production callsite (GameRoot) 동작 그대로.
 * - body equippedSignatureCount / EnemyStatus / StatusMetric 처리 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 586: StatusBar signature에서 5 defaults 0건', async () => {
    const source = await readSrc('src/components/StatusBar.tsx');
    const fnIdx = source.indexOf('const StatusBar = ');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/enemy\s*=\s*null/.test(sig), 'StatusBar enemy default null 제거');
    assert.ok(!/onCrystalClick\s*=\s*null/.test(sig), 'StatusBar onCrystalClick default null 제거');
    assert.ok(!/isMuted\s*=\s*false/.test(sig), 'StatusBar isMuted default false 제거');
    assert.ok(!/onToggleMute\s*=\s*null/.test(sig), 'StatusBar onToggleMute default null 제거');
    assert.ok(!/onOpenEquipment\s*=\s*null/.test(sig), 'StatusBar onOpenEquipment default null 제거');
});

test('cycle 586: 정합성 가드 — GameRoot callsite 보존', async () => {
    const source = await readSrc('src/components/app/GameRoot.tsx');
    assert.ok(/<StatusBar[\s\S]*?enemy=\{engine\.gameState === GS\.COMBAT \? engine\.enemy : null\}/.test(source),
        'GameRoot StatusBar enemy 명시 전달 보존');
    assert.ok(/isMuted=\{isMuted\}/.test(source), 'isMuted 명시 보존');
    assert.ok(/onToggleMute=\{handleToggleMute\}/.test(source), 'onToggleMute 명시 보존');
});

test('cycle 586: cycle 502-585 회귀 가드 — default 청소 시리즈 보존', async () => {
    const ii = await readSrc('src/components/icons/ItemIcon.tsx');
    assert.ok(!/const ItemIcon = \({ item, size\s*=\s*24/.test(ii),
        'cycle 585 ItemIcon size default 0건');

    const jcp = await readSrc('src/components/tabs/JobChangePanel.tsx');
    assert.ok(!/onOpenArchiveConsole\s*=\s*null/.test(jcp),
        'cycle 584 JobChangePanel onOpenArchiveConsole default 0건');
});
