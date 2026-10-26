import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * Slice 29: 전투·보상 피드백(juice) — 성장/타격 순간의 시각 보상.
 *
 * 진단: levelUpGlow/criticalHit 키프레임은 정의돼 있으나 미사용(dead),
 * DamageNumber가 참조하는 floatUp 키프레임은 아예 미정의라 float 숫자
 * 애니메이션이 죽어 있었음. slice 23이 레벨업을 의미있게 만들었지만 화면
 * 연출은 0(사운드+로그뿐).
 *
 * 수정:
 * - floatUp 키프레임 정의(DamageNumber 버그 fix) + 위치/가독성 개선.
 * - LevelUpBanner 신설 — GameRoot가 player.level 증가 감지 → 배너 1.8s 노출.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('slice 29: floatUp 키프레임 정의 (DamageNumber 애니메이션 fix)', async () => {
    const css = await readSrc('src/index.css');
    assert.ok(/@keyframes\s+floatUp\s*\{/.test(css), 'floatUp 키프레임 정의됨');
});

test('slice 29: DamageNumber가 floatUp 사용 + testid 노출', async () => {
    const src = await readSrc('src/components/DamageNumber.tsx');
    assert.ok(/animation:\s*'floatUp/.test(src), 'floatUp 애니메이션 적용');
    assert.ok(/data-testid="damage-number"/.test(src), 'damage-number testid');
    assert.ok(/data-heal/.test(src), 'heal/damage 구분 노출');
});

test('slice 29: LevelUpBanner — level null이면 미렌더, 값이면 표시 계약', async () => {
    const src = await readSrc('src/components/LevelUpBanner.tsx');
    assert.ok(/level\s*!=\s*null/.test(src), 'level null 가드');
    assert.ok(/data-testid="level-up-banner"/.test(src), 'level-up-banner testid');
    // 2026-10 화면 디자인 3차: 1.5초 × 3회 반복하던 levelUpGlow(animate-levelup)를 단발 금빛 광채로 바꿨다(감사 VD-14).
    assert.ok(/ae-moment-glow-once/.test(src), '레벨 상승 알약은 단발 광채(ae-moment-glow-once)');
    assert.ok(!/animate-levelup/.test(src), '반복 광채로 되돌아가지 않는다');
    assert.ok(/레벨 상승/.test(src), '레벨 상승 안내');
    assert.ok(/레벨 \{level\}/.test(src), '새 레벨 표시');
});

// 게임 필 감사 GF-13: 레벨 증가 감지는 useLevelUpCelebration 훅으로 옮겼다(복원 기준 presentationEpoch 포함).
//   "증가만 · 1.8초 뒤 해제 · 복원 레벨은 축하하지 않음"은 실제 훅을 Chromium에서 돌려 확인한다 —
//   tests/combat-feedback-presentation.test.js 'GF-13: 레벨 상승 배너…'. 여기서는 배선만 본다.
test('slice 29: GameRoot — 레벨 상승 훅의 값을 배너에 그린다', async () => {
    const src = await readSrc('src/components/app/GameRoot.tsx');
    assert.ok(/import LevelUpBanner/.test(src), 'LevelUpBanner import');
    assert.ok(/<LevelUpBanner level=\{levelUpBanner\}/.test(src), '배너 렌더');
    assert.ok(/const levelUpBanner = useLevelUpCelebration\(engine\.player\?\.level, engine\.presentationEpoch\)/.test(src),
        '레벨 · 복원 기준을 훅에 넘긴다');
});
