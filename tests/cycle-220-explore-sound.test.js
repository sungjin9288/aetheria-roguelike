import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

/**
 * cycle 220: 'explore' sound dispatch 누락 fix (cycle 217-219 sensory cue 시리즈 마지막 합류).
 *
 * 발견 (silent explore tick):
 * - cycle 217-219에서 levelUp / death / victory / skill / heal 5종 fix.
 * - 남은 dead sound dispatch: hover / explore (2종).
 * - 본 cycle은 explore fix:
 *   · explore: 탐험 tick 모먼트 — sine wave 800→1200→800Hz arc, 0.16s 짧은 cue (gain 0.04).
 *     subtle 디자인 — 의도적으로 'tick' 느낌. 정의 있으나 dispatch 0건.
 * - 'hover'는 button hover 빈도가 너무 높아 UX noise 위험 → 보류.
 *
 * 결과 (UX 회귀):
 * - 탐험 액션 후 narrative event / 적 spawn / 발견 이벤트 등 결과 도착 전까지 무음.
 * - 사용자가 탐험을 트리거했는지 청각적 피드백 없음.
 *
 * 패턴:
 * - cycle 117/118: 사운드 디자인.
 * - cycle 122/123/217/218/219: sensory cue dispatch 보강.
 * - cycle 220: explore tick cue 마지막 합류.
 *
 * 수정 (src/hooks/gameActions/exploreActions.ts):
 * - explore 액션 진입 검증 통과 후 (gameState idle + 시작 마을 아님 + mapData 존재) sound dispatch.
 * - 결과 (event/combat/nothing) 분기 전 trigger feedback.
 *
 * 회귀 가드: validation 실패(town/blocked map)는 sound 안 울림. explore 트리거 시점에만.
 */

test('cycle 220: exploreActions에 explore sound dispatch 추가', () => {
    const file = path.join(ROOT, 'src/hooks/gameActions/exploreActions.ts');
    const content = fs.readFileSync(file, 'utf-8');
    assert.match(
        content,
        /soundManager\.play\(\s*['"]explore['"]/,
        'exploreActions.ts에 explore 액션 시 soundManager.play(explore) 호출 필요',
    );
});

test('cycle 220: SoundManager의 explore case 보존 (회귀 가드)', () => {
    const file = path.join(ROOT, 'src/systems/SoundManager.ts');
    const content = fs.readFileSync(file, 'utf-8');
    assert.match(content, /case\s+['"]explore['"]/, "SoundManager의 case 'explore' branch 보존");
});

test('cycle 220: explore sound는 validation 통과 후 dispatch (실패 시 false-positive 방지)', () => {
    const file = path.join(ROOT, 'src/hooks/gameActions/exploreActions.ts');
    const content = fs.readFileSync(file, 'utf-8');
    // EXPLORE_BLOCKED / TOWN_PEACEFUL / MAP_UNKNOWN 검증 분기 이후 sound dispatch
    // 검증 분기는 early return이므로 분기 후 위치한 sound는 자연스럽게 가드됨.
    assert.match(
        content,
        /if\s*\(\s*!mapData\s*\)[\s\S]{0,500}?soundManager\.play\(\s*['"]explore['"]/,
        'explore sound는 mapData 검증 통과 후 dispatch (early return 가드 활용)',
    );
});

test('cycle 217-219 회귀 가드: 기존 sensory cue 5종 모두 유지', () => {
    const useGameEngine = fs.readFileSync(path.join(ROOT, 'src/hooks/useGameEngine.ts'), 'utf-8');
    assert.match(useGameEngine, /visualEffect\s*===\s*['"]levelUp['"]/, 'cycle 217 levelUp');

    const combatVictory = fs.readFileSync(path.join(ROOT, 'src/hooks/combatActions/combatVictory.ts'), 'utf-8');
    assert.match(combatVictory, /soundManager\.play\(\s*['"]victory['"]/, 'cycle 218 victory');

    const combatAttack = fs.readFileSync(path.join(ROOT, 'src/hooks/combatActions/combatAttack.ts'), 'utf-8');
    assert.match(combatAttack, /soundManager\.play\(\s*['"]death['"]/, 'cycle 218 death');
    assert.match(combatAttack, /soundManager\.play\(\s*['"]skill['"]/, 'cycle 219 skill');

    const characterActions = fs.readFileSync(path.join(ROOT, 'src/hooks/gameActions/characterActions.ts'), 'utf-8');
    assert.match(characterActions, /soundManager\.play\(\s*['"]heal['"]/, 'cycle 219 heal');
});

test('cycle 220: SoundManager의 모든 등록 case는 dispatch path 존재 또는 hover만 잔존', () => {
    // 정합성 가드 — 본 cycle 이후 SoundManager 케이스가 hover 하나만 dead로 남았는지 검증.
    const SRC_DIR = path.join(ROOT, 'src');
    const files = [];
    const walk = (dir) => {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            const p = path.join(dir, e.name);
            if (e.isDirectory()) walk(p);
            else if (/\.(ts|tsx|js|jsx)$/.test(e.name)) files.push(p);
        }
    };
    walk(SRC_DIR);

    const dispatched = new Set();
    for (const f of files) {
        const c = fs.readFileSync(f, 'utf-8');
        for (const m of c.matchAll(/soundManager\.play\??\(\s*['"]([a-z_]+)['"]/g)) {
            dispatched.add(m[1]);
        }
    }
    // 등록된 sound (정의된 case)
    const soundDef = fs.readFileSync(path.join(ROOT, 'src/systems/SoundManager.ts'), 'utf-8');
    const defined = new Set(
        [...soundDef.matchAll(/case\s+['"]([a-z_]+)['"]/g)].map((m) => m[1]),
    );
    const undispatched = [...defined].filter((s) => !dispatched.has(s));
    assert.deepEqual(undispatched, ['hover'],
        `cycle 220 시점 dead sound는 'hover' 1건만 — 그 외 발견 시 회귀: ${JSON.stringify(undispatched)}`);
});
