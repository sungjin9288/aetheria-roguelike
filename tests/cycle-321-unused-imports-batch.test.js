import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 321: 8 unused imports 일괄 cleanup (8 files)
 *   (cycle 222-320 silent dead config 시리즈 90번째 — cleanup lens 연속).
 *
 * 발견 (8 unused imports across 8 files):
 * 1. src/utils/equipmentUtils.ts: `import type { Player }` — 사용 0건.
 * 2. src/components/Codex.tsx: BALANCE import — 사용 0건.
 * 3. src/components/Codex.tsx: MSG import — 사용 0건.
 * 4. src/systems/CombatEngine.ts: LOOT_TABLE import — 사용 0건 (CombatEngine.loot.ts에서만 사용).
 * 5. src/systems/CombatEngine.ts: DROP_TABLES import — 동일.
 * 6. src/data/messages.ts: DB import — messages는 정적 메시지 정의, DB 사용 0건.
 * 7. src/components/codex/MonsterCodex.tsx: Lock icon import — JSX <Lock> 0건.
 * 8. src/components/codex/CodexDiscoveryOverlay.tsx: MSG import — 사용 0건.
 * 9. src/components/codex/EquipmentCodexCard.tsx: BALANCE import — 사용 0건.
 * 10. src/components/codex/WeaponCodex.tsx: BALANCE import — 사용 0건.
 *
 * 패턴 (cycle 222-320 silent dead config 시리즈 90번째):
 * - cycle 320: CHANGELOG batch (cycles 301-319).
 * - cycle 321: import 표면 batch cleanup — 8 files 10 unused imports 정리.
 *
 * 회귀 가드:
 * - 각 파일의 active import는 그대로 유지.
 * - 컴파일 / 린트 / 테스트 / 빌드 모두 통과.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 321: equipmentUtils.ts Player type import 제거', async () => {
    const source = await readSrc('src/utils/equipmentUtils.ts');
    assert.ok(!/import type \{ Player \}/.test(source),
        'Player import 제거됨');
});

test('cycle 321: Codex.tsx BALANCE / MSG imports 제거', async () => {
    const source = await readSrc('src/components/Codex.tsx');
    assert.ok(!/^import \{ BALANCE \} from/m.test(source),
        'BALANCE import 제거됨');
    assert.ok(!/^import \{ MSG \} from/m.test(source),
        'MSG import 제거됨');
});

test('cycle 321: CombatEngine.ts LOOT_TABLE / DROP_TABLES imports 제거', async () => {
    const source = await readSrc('src/systems/CombatEngine.ts');
    assert.ok(!/^import \{ LOOT_TABLE \} from/m.test(source),
        'LOOT_TABLE import 제거됨');
    assert.ok(!/^import \{ DROP_TABLES \} from/m.test(source),
        'DROP_TABLES import 제거됨');
});

test('cycle 321: messages.ts DB import 제거', async () => {
    const source = await readSrc('src/data/messages.ts');
    assert.ok(!/^import \{ DB \} from/m.test(source),
        'DB import 제거됨');
});

test('cycle 321: codex 파일들의 unused imports 제거', async () => {
    const monsterSrc = await readSrc('src/components/codex/MonsterCodex.tsx');
    const overlaySrc = await readSrc('src/components/codex/CodexDiscoveryOverlay.tsx');
    const cardSrc = await readSrc('src/components/codex/EquipmentCodexCard.tsx');
    const weaponSrc = await readSrc('src/components/codex/WeaponCodex.tsx');
    assert.ok(!/^import \{ Lock \} from 'lucide-react'/m.test(monsterSrc),
        'MonsterCodex Lock import 제거됨');
    assert.ok(!/^import \{ MSG \} from/m.test(overlaySrc),
        'CodexDiscoveryOverlay MSG import 제거됨');
    assert.ok(!/^import \{ BALANCE \} from/m.test(cardSrc),
        'EquipmentCodexCard BALANCE import 제거됨');
    assert.ok(!/^import \{ BALANCE \} from/m.test(weaponSrc),
        'WeaponCodex BALANCE import 제거됨');
});

test('cycle 320 회귀 가드: CHANGELOG batch 보존', async () => {
    const source = await readSrc('CHANGELOG.md');
    assert.ok(/Cycle 320 🎯/.test(source),
        'cycle 320 batch entry 보존');
});
