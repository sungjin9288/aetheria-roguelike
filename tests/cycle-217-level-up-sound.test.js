import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

/**
 * cycle 217: 레벨업 sound 누락 회귀 fix — visualEffect='levelUp' 시점에 sound trigger.
 *
 * 발견 (silent level-up moment):
 * - SoundManager에 'levelUp' sound 정의됨 (case 'levelUp' branch).
 * - useGameEngine.ts:49: `if (lastLog.type === 'levelUp') soundManager.play('levelUp')` — log type
 *   기반 mapping 존재.
 * - 그러나 CombatEngine.applyExpGain은 levelup 로그를 `type: 'system'`으로 기록 (line 1232).
 * - 따라서 type==='levelUp' 비교는 절대 true가 안 됨 → 'levelUp' sound 영원히 dispatch 안 됨.
 * - visualEffect='levelUp'은 dispatch되지만 MainLayout은 'shake'만 처리 → 시각 효과도 nothing.
 *
 * 결과: 플레이어가 레벨업해도 audio/visual 피드백 0건. 레벨업이 의미 있는 모먼트인데
 *   "system 로그 한 줄"만 보임 — UX 회귀 (SoundManager + visualEffect 양쪽이 dead path).
 *
 * 패턴 (sensory cue 시리즈 lens):
 * - cycle 117/118: 사운드 디자인 시리즈.
 * - cycle 122/123: quest_complete / 업적 청구 sensory cue.
 * - cycle 217: 레벨업 sensory cue 누락 보강.
 *
 * 수정 (src/hooks/useGameEngine.ts):
 * - useEffect로 state.visualEffect를 watch — 'levelUp'으로 transition 시 soundManager.play('levelUp').
 * - useGameEngine.ts:49 dead 'levelUp' log type mapping은 유지 (LOG_STYLES에 'levelUp'
 *   style이 없어 LOG TYPE 변경은 visual regression 위험 — visualEffect 기반 fix가 안전).
 *
 * 회귀 가드: 다른 visualEffect ('shake' 등)는 sound 재생 안 함. null transition 무시.
 */

test('cycle 217: useGameEngine에 visualEffect levelUp watcher 추가', () => {
    const file = path.join(ROOT, 'src/hooks/useGameEngine.ts');
    const content = fs.readFileSync(file, 'utf-8');
    // visualEffect를 watch하는 useEffect 패턴 + 'levelUp' sound 호출
    assert.match(
        content,
        /visualEffect[\s\S]*?soundManager\.play\(\s*['"]levelUp['"]/,
        'useGameEngine에 visualEffect===levelUp 시 levelUp sound 재생 코드 필요',
    );
});

test('cycle 217: applyExpGain은 visualEffect=levelUp을 set (회귀 가드)', () => {
    const file = path.join(ROOT, 'src/systems/CombatEngine.ts');
    const content = fs.readFileSync(file, 'utf-8');
    assert.match(
        content,
        /visualEffect\s*=\s*['"]levelUp['"]/,
        "CombatEngine.applyExpGain의 visualEffect='levelUp' 설정은 보존되어야 함",
    );
});

test('cycle 217: SoundManager에 levelUp case 정의 (회귀 가드)', () => {
    const file = path.join(ROOT, 'src/systems/SoundManager.ts');
    const content = fs.readFileSync(file, 'utf-8');
    assert.match(
        content,
        /case\s+['"]levelUp['"]/,
        "SoundManager의 case 'levelUp' branch 보존되어야 함",
    );
});

test('cycle 217: useGameEngine의 기존 log-type sound mapping은 유지 (회귀 가드)', () => {
    const file = path.join(ROOT, 'src/hooks/useGameEngine.ts');
    const content = fs.readFileSync(file, 'utf-8');
    // combat / error / legendary 매핑은 그대로 (단일 라인 if문 형태)
    assert.match(content, /lastLog\.type\s*===\s*['"]combat['"][^\n]*soundManager\.play\(\s*['"]attack['"]/);
    assert.match(content, /lastLog\.type\s*===\s*['"]error['"][^\n]*soundManager\.play\(\s*['"]error['"]/);
    assert.match(content, /lastLog\.type\s*===\s*['"]legendary['"][^\n]*soundManager\.play\(\s*['"]legendary['"]/);
});

test('cycle 217: levelUp transition 외 visualEffect 변화는 sound 재생 안 함 (코드 패턴 가드)', () => {
    const file = path.join(ROOT, 'src/hooks/useGameEngine.ts');
    const content = fs.readFileSync(file, 'utf-8');
    // visualEffect === 'levelUp' 비교 명시 (다른 효과 false-positive 방지)
    assert.match(
        content,
        /visualEffect\s*===?\s*['"]levelUp['"]/,
        "visualEffect === 'levelUp' 비교 가드 필요 ('shake' 등 false-positive 방지)",
    );
});
