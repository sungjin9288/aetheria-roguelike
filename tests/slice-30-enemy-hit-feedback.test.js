import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * Slice 30: 적 타격 임팩트 피드백.
 *
 * 진단: 데미지 float 숫자는 플레이어 HP 변화(피격)에만 떴고, 내가 적을 때릴
 * 때는 HP 바가 조용히 줄 뿐 아무 연출이 없어 "때리는 맛"이 약했음 (비대칭).
 *
 * 수정:
 * - useHitFlash 훅(useDamageFlash 일반화): 추적 값 감소 시 flash + 데미지
 *   숫자, resetKey 변경 시 baseline만 재설정(새 적 가짜 타격 방지), meta 스냅샷.
 * - EnemyStatus(Target Lock 바): 적 HP 감소 시 바 플래시 + 적 위 데미지 숫자,
 *   크리(enemyHitCrit)면 골드+크게 강조.
 * - GameRoot: 최근 로그 'critical' → enemyHitCrit 전달.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('slice 30: useHitFlash — 감소만 트리거 + resetKey baseline + meta 스냅샷', async () => {
    const src = await readSrc('src/hooks/useHitFlash.ts');
    assert.ok(/export const useHitFlash/.test(src), 'useHitFlash export');
    assert.ok(/keyRef\.current\s*!==\s*resetKey/.test(src), 'resetKey 변경 시 baseline 재설정');
    assert.ok(/const delta = prev - value/.test(src) && /delta <= 0\)\s*return/.test(src),
        '감소(피해)만 트리거');
    assert.ok(/meta/.test(src), 'meta 스냅샷 동봉');
});

test('slice 30: EnemyStatus — 적 HP flash + 적 데미지 숫자 + 크리 강조', async () => {
    const src = await readSrc('src/components/StatusBar.tsx');
    assert.ok(/useHitFlash\(enemy\?\.hp,\s*enemy\?\.name/.test(src),
        'enemy hp/name으로 useHitFlash 호출');
    assert.ok(/data-testid="enemy-damage-number"/.test(src), '적 데미지 숫자 testid');
    assert.ok(/data-hit-flash/.test(src), '바 플래시 상태 노출');
    assert.ok(/meta\?\.crit/.test(src) && /f6e7a2/.test(src), '크리 골드 강조');
    assert.ok(/floatUp/.test(src), 'floatUp 애니메이션 재사용');
});

test('slice 30: 훅이 early-return 앞에서 호출 (Rules of Hooks)', async () => {
    const src = await readSrc('src/components/StatusBar.tsx');
    const fnStart = src.indexOf('const EnemyStatus');
    const slice = src.slice(fnStart, fnStart + 400);
    const hookIdx = slice.indexOf('useHitFlash(');
    const returnNullIdx = slice.indexOf('return null');
    assert.ok(hookIdx > -1 && returnNullIdx > -1 && hookIdx < returnNullIdx,
        'useHitFlash가 if(!enemy) return null 보다 먼저 호출');
});

test('slice 30: GameRoot — 최근 critical 로그 → enemyHitCrit 전달', async () => {
    const src = await readSrc('src/components/app/GameRoot.tsx');
    assert.ok(/enemyHitCrit=\{[\s\S]{0,160}logs\?\.\[engine\.logs\.length - 1\]\?\.type === 'critical'/.test(src),
        'enemyHitCrit이 최근 로그 critical에서 파생');
});
