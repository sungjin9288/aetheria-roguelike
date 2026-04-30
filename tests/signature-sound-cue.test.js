import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * Signature 전용 오디오 cue — anticipate → act 체인의 sound layer.
 *
 * 현재 SoundManager는 attack/levelUp/item/victory 등만 정의돼 있고
 * useGameEngine의 로그 type 디스패처는 'legendary' 로그(boss hint, pity
 * resonance, discovery)에 대해 소리를 재생하지 않는다. 결과적으로
 * 전설 드롭 순간에도 평범한 item 효과음조차 나지 않는 경우가 있다.
 *
 * 계약:
 *   1. SoundManager가 'legendary' case를 처리
 *   2. useGameEngine이 type='legendary' 로그에 대해 soundManager.play('legendary') 호출
 *   3. legendary 사운드는 단일 톤이 아니라 여러 _playTone 호출(아르페지오)로 구성
 *      — levelUp보다 더 풍성한 느낌을 위해
 *   4. SoundManager.play('legendary') 호출이 throw하지 않고 graceful-fail
 *      (오디오 컨텍스트 없는 환경 포함)
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('SoundManager handles legendary case', async () => {
    const source = await readSrc('src/systems/SoundManager.ts');
    assert.ok(
        /case\s*['"]legendary['"]/.test(source),
        "SoundManager.play should have a 'legendary' case"
    );
});

test('legendary sound is an arpeggio (multiple _playTone calls inside the case)', async () => {
    const source = await readSrc('src/systems/SoundManager.ts');
    const match = source.match(/case\s*['"]legendary['"][\s\S]*?break;/);
    assert.ok(match, "could not locate the 'legendary' case block");
    const block = match[0];
    const toneCount = (block.match(/_playTone\(/g) || []).length;
    assert.ok(
        toneCount >= 4,
        `legendary chord should layer >=4 tones for a grand cue (got ${toneCount})`
    );
});

test('useGameEngine plays legendary sound on legendary log type', async () => {
    const source = await readSrc('src/hooks/useGameEngine.ts');
    assert.ok(
        /lastLog\.type\s*===\s*['"]legendary['"][\s\S]{0,60}soundManager\.play\(\s*['"]legendary['"]/.test(source),
        "useGameEngine should dispatch soundManager.play('legendary') on legendary log type"
    );
});

test('SoundManager.play("legendary") does not throw without audio context', async () => {
    const { soundManager } = await import('../src/systems/SoundManager.js');
    // init() will warn & leave this.ctx = null in Node; play must short-circuit via _ensureReady
    assert.doesNotThrow(() => soundManager.play('legendary'));
});
