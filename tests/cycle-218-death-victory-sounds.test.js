import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

/**
 * cycle 218: 'death' + 'victory' sound dispatch 누락 fix (cycle 217 sensory cue 시리즈 확장).
 *
 * 발견 (silent moments):
 * - SoundManager에 6 sound 정의됐지만 dispatch 0건: hover / heal / death / skill / explore / victory.
 * - 본 cycle은 가장 영향 큰 2종 fix:
 *   · death: player 사망 모먼트 — descending tone (400→300→200→100 Hz) 정의 있으나
 *     combatAttack/combatItem의 GS.DEAD dispatch 시점에 sound 미호출.
 *   · victory: 보스 처치 모먼트 — 5-tone arpeggio (C5→E5→G5→C6→E6) 정의 있으나
 *     combatVictory의 보스 처치 분기에서 sound 미호출.
 *
 * 결과 (UX 회귀):
 * - 사망: GS.DEAD 전환 + RunSummary 모달만 보임. 음향 피드백 0건.
 * - 보스 처치: legendary 드롭 시에만 'levelUp' 사운드(GameRoot:61). 일반 보스 처치 무음.
 *
 * 패턴 (sensory cue 시리즈):
 * - cycle 117/118: 사운드 디자인 시리즈.
 * - cycle 122/123: quest_complete / 업적 청구.
 * - cycle 217: 레벨업 sensory cue.
 * - cycle 218: 사망 / 보스 승리 sensory cue.
 *
 * 수정:
 * 1. src/hooks/combatActions/combatAttack.ts: GS.DEAD dispatch 직전 soundManager.play('death').
 * 2. src/hooks/combatActions/combatItem.ts: 동일.
 * 3. src/hooks/combatActions/combatVictory.ts: isBossKill 분기에서 soundManager.play('victory').
 *
 * 회귀 가드: 일반 몹 처치는 victory 사운드 안 울림 (boss 전용 — 큰 모먼트).
 *           사망 사운드는 GS.DEAD 전환 시 1회만 (중복 dispatch 안 됨).
 */

test('cycle 218: combatAttack에 death sound dispatch 추가', () => {
    const file = path.join(ROOT, 'src/hooks/combatActions/combatAttack.ts');
    const content = fs.readFileSync(file, 'utf-8');
    assert.match(
        content,
        /soundManager\.play\(\s*['"]death['"]/,
        'combatAttack.ts에 GS.DEAD dispatch 시 soundManager.play(death) 호출 필요',
    );
});

test('cycle 218: combatItem에 death sound dispatch 추가', () => {
    const file = path.join(ROOT, 'src/hooks/combatActions/combatItem.ts');
    const content = fs.readFileSync(file, 'utf-8');
    assert.match(
        content,
        /soundManager\.play\(\s*['"]death['"]/,
        'combatItem.ts에 GS.DEAD dispatch 시 soundManager.play(death) 호출 필요',
    );
});

test('cycle 218: combatVictory에 victory sound dispatch 추가 (boss kill)', () => {
    const file = path.join(ROOT, 'src/hooks/combatActions/combatVictory.ts');
    const content = fs.readFileSync(file, 'utf-8');
    assert.match(
        content,
        /soundManager\.play\(\s*['"]victory['"]/,
        'combatVictory.ts에 isBossKill 시 soundManager.play(victory) 호출 필요',
    );
});

test('cycle 218: SoundManager의 death / victory case 보존 (회귀 가드)', () => {
    const file = path.join(ROOT, 'src/systems/SoundManager.ts');
    const content = fs.readFileSync(file, 'utf-8');
    assert.match(content, /case\s+['"]death['"]/, "SoundManager의 case 'death' branch 보존");
    assert.match(content, /case\s+['"]victory['"]/, "SoundManager의 case 'victory' branch 보존");
});

test('cycle 218: combatVictory에 isBossKill 가드 (일반 몹 처치 false-positive 방지)', () => {
    const file = path.join(ROOT, 'src/hooks/combatActions/combatVictory.ts');
    const content = fs.readFileSync(file, 'utf-8');
    // isBossKill 또는 deadEnemy?.isBoss 컨텍스트 안에서 soundManager.play('victory')
    assert.match(
        content,
        /isBossKill[\s\S]{0,800}?soundManager\.play\(\s*['"]victory['"]/,
        "victory 사운드는 isBossKill 컨텍스트에서만 dispatch (일반 몹 처치 무음 유지)",
    );
});

test('cycle 217 회귀 가드: useGameEngine의 visualEffect levelUp watcher 유지', () => {
    const file = path.join(ROOT, 'src/hooks/useGameEngine.ts');
    const content = fs.readFileSync(file, 'utf-8');
    assert.match(content, /visualEffect\s*===\s*['"]levelUp['"]/);
});
