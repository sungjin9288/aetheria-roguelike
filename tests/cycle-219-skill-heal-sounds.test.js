import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

/**
 * cycle 219: 'skill' + 'heal' sound dispatch 누락 fix (cycle 217/218 sensory cue 시리즈 확장).
 *
 * 발견 (silent skill / rest moments):
 * - cycle 217 / 218에서 levelUp / death / victory 3종 fix.
 * - 남은 dead sound dispatch: hover / heal / skill / explore (4종).
 * - 본 cycle은 가장 영향 큰 2종 fix:
 *   · skill: 스킬 발동 모먼트 — sweep tone (600→1800→900Hz arc) 정의 있으나 dispatch 0건.
 *     CombatEngine.performSkill 호출 후 sound 미트리거 → 스킬 사용이 일반 공격과 청각적
 *     구분 안 됨.
 *   · heal: HP 회복 모먼트 — ascending arpeggio (C5→E5→G5) 정의 있으나 dispatch 0건.
 *     rest 액션(characterActions.ts:90) 후 음향 피드백 누락.
 *
 * 결과 (UX 회귀):
 * - 스킬 발동 시 'attack' 사운드만 (combat 로그 type='combat'). 스킬 고유 사운드 없음.
 * - 안전지대 휴식 후 success 로그만. 회복 음향 0건.
 *
 * 패턴:
 * - cycle 117/118: 사운드 디자인.
 * - cycle 122/123/217/218: sensory cue dispatch.
 * - cycle 219: skill / heal cue 누락 보강.
 *
 * 수정:
 * 1. src/hooks/combatActions/combatAttack.ts: type==='skill' && result.success 후
 *    soundManager.play('skill').
 * 2. src/hooks/gameActions/characterActions.ts: rest 성공 후 soundManager.play('heal').
 *
 * 회귀 가드: 스킬 실패(MP 부족 등)는 sound 안 울림. rest gold 부족 시도 사운드 없음.
 */

test('cycle 219: combatAttack에 skill sound dispatch 추가 (성공 시)', () => {
    const file = path.join(ROOT, 'src/hooks/combatActions/combatAttack.ts');
    const content = fs.readFileSync(file, 'utf-8');
    assert.match(
        content,
        /soundManager\.play\(\s*['"]skill['"]/,
        'combatAttack.ts에 스킬 사용 성공 시 soundManager.play(skill) 호출 필요',
    );
});

test('cycle 219: characterActions에 heal sound dispatch 추가 (rest 성공 시)', () => {
    const file = path.join(ROOT, 'src/hooks/gameActions/characterActions.ts');
    const content = fs.readFileSync(file, 'utf-8');
    assert.match(
        content,
        /soundManager\.play\(\s*['"]heal['"]/,
        'characterActions.ts rest 액션에 soundManager.play(heal) 호출 필요',
    );
});

test('cycle 219: SoundManager의 skill / heal case 보존 (회귀 가드)', () => {
    const file = path.join(ROOT, 'src/systems/SoundManager.ts');
    const content = fs.readFileSync(file, 'utf-8');
    assert.match(content, /case\s+['"]skill['"]/, "SoundManager의 case 'skill' branch 보존");
    assert.match(content, /case\s+['"]heal['"]/, "SoundManager의 case 'heal' branch 보존");
});

test('cycle 219: skill sound는 result.success 후 dispatch (실패 시 false-positive 방지)', () => {
    const file = path.join(ROOT, 'src/hooks/combatActions/combatAttack.ts');
    const content = fs.readFileSync(file, 'utf-8');
    // performSkill 호출 후 result.success 체크 다음에 sound dispatch
    assert.match(
        content,
        /performSkill[\s\S]{0,500}?result\.success[\s\S]{0,500}?soundManager\.play\(\s*['"]skill['"]/,
        'skill sound는 performSkill + result.success 컨텍스트에서 dispatch',
    );
});

test('cycle 219: heal sound는 rest 성공 (gold 차감 후) 컨텍스트에서 dispatch', () => {
    const file = path.join(ROOT, 'src/hooks/gameActions/characterActions.ts');
    const content = fs.readFileSync(file, 'utf-8');
    // rest 함수 + REST_DONE 또는 dispatch SET_PLAYER 이후 sound dispatch
    assert.match(
        content,
        /rest:\s*\(\)[\s\S]+?REST_DONE_FULL[\s\S]{0,200}?soundManager\.play\(\s*['"]heal['"]/,
        'heal sound는 rest 성공 메시지 emit 컨텍스트에서 dispatch',
    );
});

test('cycle 217 / 218 회귀 가드: 기존 sensory cue 유지', () => {
    const useGameEngine = fs.readFileSync(path.join(ROOT, 'src/hooks/useGameEngine.ts'), 'utf-8');
    assert.match(useGameEngine, /visualEffect\s*===\s*['"]levelUp['"]/);
    const combatVictory = fs.readFileSync(path.join(ROOT, 'src/hooks/combatActions/combatVictory.ts'), 'utf-8');
    assert.match(combatVictory, /soundManager\.play\(\s*['"]victory['"]/);
});
