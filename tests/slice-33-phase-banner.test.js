import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * Slice 33: 보스 페이즈 전환 연출.
 *
 * 진단: 로그라이크 클라이맥스인 보스 페이즈 전환(HP 50%/25%)이 enemy 이름
 * 변경 + 로그 한 줄(phase2 'warning' ⚡ / phase3 'critical' 💀)이 전부였음.
 * 레벨업 배너/크리 펄스에 이어 보스 페이즈에도 극적 announcement 추가.
 *
 * 수정:
 * - PhaseBanner 신설 — phase2/3 진입 시 "PHASE N · {이름}" 배너(phase3 강한 톤).
 * - GameRoot: enemy.phase2Triggered/phase3Triggered false→true 플립 감지.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('slice 33: PhaseBanner — phase null이면 미렌더, phase3 강조 분기', async () => {
    const src = await readSrc('src/components/PhaseBanner.tsx');
    assert.ok(/data-testid="phase-banner"/.test(src), 'phase-banner testid');
    assert.ok(/phase\?\.n\b[\s\S]{0,20}>=\s*3/.test(src), 'phase3 isFinal 분기');
    assert.ok(/\{phase\.name\}/.test(src), '보스 이름 표시');
    assert.ok(/Phase \$\{phase\.n\}/.test(src) && /Final Phase/.test(src),
        'PHASE N / FINAL 라벨');
});

test('slice 33: GameRoot — phase 플립 감지 + 배너 렌더', async () => {
    const src = await readSrc('src/components/app/GameRoot.tsx');
    assert.ok(/import PhaseBanner/.test(src), 'PhaseBanner import');
    assert.ok(/<PhaseBanner phase=\{phaseBanner\}/.test(src), '배너 렌더');
    assert.ok(/phase2Triggered/.test(src) && /phase3Triggered/.test(src), '두 페이즈 플래그 watch');
    assert.ok(/p3 && !prev\.p3/.test(src) && /p2 && !prev\.p2/.test(src),
        'false→true 플립만 트리거');
    assert.ok(/setTimeout\([\s\S]{0,80}setPhaseBanner\(null\)[\s\S]{0,12}2000\)/.test(src),
        '~2s 자동 해제');
});

test('slice 33: phase 플래그 계약 — CombatEngine이 phase2/3Triggered set + 이름 변경', async () => {
    // enemyAttack(phase 전환 로직)은 CombatEngine.enemyAI.ts로 분리됨 (mixin).
    const src = await readSrc('src/systems/CombatEngine.enemyAI.ts');
    assert.ok(/phase2Triggered:\s*true/.test(src), 'phase2Triggered set');
    assert.ok(/phase3Triggered:\s*true/.test(src), 'phase3Triggered set');
    assert.ok(/name:\s*p2\.name/.test(src) && /name:\s*p3\.name/.test(src),
        '페이즈 이름으로 enemy.name 갱신 (배너 표시 소스)');
});
