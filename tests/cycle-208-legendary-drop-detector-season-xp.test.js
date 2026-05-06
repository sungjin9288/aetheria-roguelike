import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

/**
 * cycle 208: useLegendaryDropDetector가 SEASON_XP.codexDiscover 누락 path fix
 *   (cycle 193 / cycle 196 패턴 follow-up).
 *
 * 발견 (signature codex XP 적립 누락):
 * - cycle 193: combatVictory에 SEASON_XP.codexDiscover dispatch 추가 (boss drop path).
 * - cycle 196: synthesize / questComplete / craft 3개 inventoryActions path 추가.
 * - 그러나 useLegendaryDropDetector(GameRoot.tsx에서 inv 관찰)는 dispatch(UPDATE_CODEX)만
 *   하고 SEASON_XP 미적립.
 * - 영향:
 *   · 4 quest reward (성검 에테르니아 / 세계수의 지팡이 / 성스러운 창)
 *   · 4 event chain reward (천벌의 지팡이 / 그림자 절단기 / 세계수의 지팡이 / 성스러운 창)
 *   - 위 path로 들어오는 signature는 codex만 등록되고 시즌 XP 적립 안 됨.
 * - cycle 193이 명시한 'key 정의됐으나 dispatch 0건이던 dead config' 시리즈의 잔여.
 *
 * 회귀 가드 (combatVictory 중복 award 방지):
 * - combatVictory가 먼저 registerLootToCodex로 codex 업데이트 + SEASON_XP dispatch.
 * - 이후 inv state propagate → useLegendaryDropDetector observe → 동일 signature 발견.
 * - 이 시점엔 codex에 이미 등록되어 있으므로 detector가 SEASON_XP 또 dispatch하면 double award.
 * - 해결: codex prop을 hook에 전달, 'alreadyInCodex' 체크 후 SEASON_XP gate.
 *
 * 수정:
 * - useLegendaryDropDetector(inv, dispatch, codex=null) — codex 파라미터 추가.
 * - 신규 inv signature 발견 시: codex[bucket][name] 미존재 시에만 SEASON_XP dispatch.
 * - GameRoot.tsx 호출부 codex prop 전달 추가.
 */

test('cycle 208: useLegendaryDropDetector hook signature에 codex 파라미터 추가', () => {
    const file = path.join(ROOT, 'src/hooks/useLegendaryDropDetector.ts');
    const content = fs.readFileSync(file, 'utf-8');
    assert.match(
        content,
        /useLegendaryDropDetector\s*=\s*\(\s*inv:[^)]*,\s*dispatch:[^)]*,\s*codex/,
        'hook signature는 (inv, dispatch, codex) 형태로 codex 파라미터 포함해야 함',
    );
});

test('cycle 208: codex 미존재 시에만 SEASON_XP.codexDiscover dispatch (alreadyInCodex 가드)', () => {
    const file = path.join(ROOT, 'src/hooks/useLegendaryDropDetector.ts');
    const content = fs.readFileSync(file, 'utf-8');
    assert.match(
        content,
        /alreadyInCodex|codex(?:Ref\.current)?(?:\?\.)?\[bucket\]/,
        'codex[bucket][name] 존재 여부 체크 로직 필요',
    );
    assert.ok(
        content.includes('ADD_SEASON_XP') && content.includes('SEASON_XP'),
        'SEASON_XP.codexDiscover dispatch 코드 필요',
    );
});

test('cycle 208: GameRoot.tsx 호출부에 codex prop 전달', () => {
    const file = path.join(ROOT, 'src/components/app/GameRoot.tsx');
    const content = fs.readFileSync(file, 'utf-8');
    assert.match(
        content,
        /useLegendaryDropDetector\s*\([^)]*codex/,
        'GameRoot.tsx에서 useLegendaryDropDetector 호출 시 codex prop 전달 필요',
    );
});

test('cycle 193 회귀 가드: combatVictory의 codex SEASON_XP dispatch 유지', () => {
    const file = path.join(ROOT, 'src/hooks/combatActions/combatVictory.ts');
    const content = fs.readFileSync(file, 'utf-8');
    assert.ok(
        content.includes('SEASON_XP.codexDiscover'),
        'combatVictory의 SEASON_XP.codexDiscover dispatch는 유지되어야 함 (cycle 193)',
    );
});

test('cycle 196 회귀 가드: useInventoryActions의 SEASON_XP dispatch 유지', () => {
    const file = path.join(ROOT, 'src/hooks/useInventoryActions.ts');
    const content = fs.readFileSync(file, 'utf-8');
    const matches = content.match(/SEASON_XP\.codexDiscover/g) || [];
    assert.ok(
        matches.length >= 3,
        `useInventoryActions에 SEASON_XP.codexDiscover dispatch는 3건 이상 유지되어야 함 (cycle 196). actual: ${matches.length}`,
    );
});
