import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * Slice 32: 전투 사운드 패스 — 크리티컬 전용 사운드.
 *
 * 진단: SoundManager에 'crit' 사운드가 없어 크리도 일반 'attack'(100→800 saw)
 * 으로 재생 → 강화된 타격이 평타와 똑같이 들림. slice 30/31이 크리 시각 연출
 * (골드 숫자 + 스크린 펄스)을 추가했으므로 짝이 되는 오디오가 빠진 상태.
 *
 * 수정:
 * - SoundManager 'crit' 케이스 신설 (square 320→1600 + E6 ching 액센트).
 * - useGameEngine: 'critical' 로그 → 'crit' 사운드 (기존 'attack'에서 격상).
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('slice 32: SoundManager에 crit 케이스 정의 (attack과 구분)', async () => {
    const src = await readSrc('src/systems/SoundManager.ts');
    assert.ok(/case 'crit':/.test(src), "'crit' 사운드 케이스 정의");
    // attack(sawtooth)과 다른 음색(square) — 구분되는 임팩트
    const critBlock = src.slice(src.indexOf("case 'crit':"), src.indexOf("case 'crit':") + 700);
    assert.ok(/square/.test(critBlock), 'crit은 square 음색 (attack sawtooth와 구분)');
    assert.ok(/_playTone/.test(critBlock), 'ching 액센트 레이어');
});

test('slice 32: critical 로그 → crit 사운드 (attack에서 격상)', async () => {
    const src = await readSrc('src/hooks/useGameEngine.ts');
    assert.ok(/lastLog\.type === 'critical'[\s\S]{0,120}soundManager\.play\('crit'\)/.test(src),
        "'critical' 로그 → play('crit')");
    // 일반 combat 타격은 여전히 attack
    assert.ok(/lastLog\.type === 'combat'[\s\S]{0,60}soundManager\.play\('attack'\)/.test(src),
        "'combat' 로그는 attack 유지");
});

test('slice 32: 기존 사운드 케이스 보존 (회귀 가드)', async () => {
    const src = await readSrc('src/systems/SoundManager.ts');
    for (const key of ['attack', 'levelUp', 'victory', 'heal', 'death', 'skill', 'item', 'legendary']) {
        assert.ok(new RegExp(`case '${key}'`).test(src), `${key} 사운드 보존`);
    }
});
