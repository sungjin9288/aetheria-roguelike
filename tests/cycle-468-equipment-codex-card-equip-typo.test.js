import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 468: EquipmentCodexCard `player.equipment` 오타 → `player.equip` 정정
 *   (silent UI 결손 fix, cycle 426/427/468 silent UI lens 시리즈)
 *
 * 발견 (오타로 인한 silent UI 결손):
 * - src/components/codex/EquipmentCodexCard.tsx (line 86-93):
 *     const equipped = item.type === 'weapon'
 *         ? player?.equipment?.weapon       ← 'equipment' 오타
 *         : item.type === 'armor'
 *             ? player?.equipment?.armor    ← 동일 오타
 *             : item.type === 'shield'
 *                 ? player?.equipment?.shield ← 동일 오타
 *                 : null;
 * - 실제 Player 도메인은 `player.equip` 사용 (gameUtils.ts:22, 669-671 등 200+
 *   참조). `player.equipment`는 어디서도 set/read되지 않는 nullable 항상 undefined.
 * - 결과:
 *     · equipped는 항상 null.
 *     · `<StatRow compareValue={equipped?.atk} />`의 compareValue 항상 undefined →
 *       diff 비교 UI 항상 미렌더.
 *     · `equipped && <span>vs {equipped.name}</span>` → 비교 텍스트 항상 미렌더.
 *
 * 패턴 (silent UI 결손 시리즈):
 * - cycle 426: signatureSetBonus.activeSet.atkMult/defMult/hpMult 잘못 제거됐던 거 복원.
 * - cycle 427: SignatureBadge rust 엔트리 missing 보강.
 * - cycle 468: EquipmentCodexCard `equipment` 오타 → `equip` 정정 — 동일 lens.
 *
 * 수정 (src/components/codex/EquipmentCodexCard.tsx):
 * - `player?.equipment?.X` 3곳 → `player?.equip?.X`.
 *
 * 회귀 가드:
 * - 비교 UI ('vs xxx', diff badge) 정상 렌더 가능해짐.
 * - StatRow 시그니처 / 본체 그대로.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 468: player.equipment 참조 0건', async () => {
    const source = await readSrc('src/components/codex/EquipmentCodexCard.tsx');
    assert.ok(!/player\?\.equipment\?\./.test(source), 'player?.equipment? 0건');
    assert.ok(!/player\.equipment\./.test(source), 'player.equipment. 0건');
});

test('cycle 468: player.equip 정상 참조 3건', async () => {
    const source = await readSrc('src/components/codex/EquipmentCodexCard.tsx');
    const matches = source.match(/player\?\.equip\?\.\w+/g) || [];
    assert.ok(matches.length >= 3, `player?.equip?.X 참조 3건 이상 (실제: ${matches.length})`);
});

test('cycle 468: 정합성 가드 — Player 도메인은 .equip 필드 사용', async () => {
    // 다른 파일들이 player.equip을 쓰는지 sanity check
    const utils = await readSrc('src/utils/gameUtils.ts');
    assert.ok(/player\?\.equip\b/.test(utils), 'gameUtils에서 player.equip 활성 사용');
});

test('cycle 468: equipped 변수 / 비교 UI 보존', async () => {
    const source = await readSrc('src/components/codex/EquipmentCodexCard.tsx');
    assert.ok(/const equipped =/.test(source), 'equipped 선언 보존');
    assert.ok(/equipped\?\.atk/.test(source), 'equipped?.atk 비교 보존');
    assert.ok(/vs \{equipped\.name\}/.test(source), 'vs {equipped.name} 비교 텍스트 보존');
});
