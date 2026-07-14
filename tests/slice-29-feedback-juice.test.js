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
    assert.ok(/animate-levelup/.test(src), 'levelUpGlow(animate-levelup) 적용 — dead 키프레임 활성화');
    assert.ok(/레벨 상승/.test(src), '레벨 상승 안내');
    assert.ok(/레벨 \{level\}/.test(src), '새 레벨 표시');
});

test('slice 29: GameRoot — player.level 증가 감지 + 배너 렌더', async () => {
    const src = await readSrc('src/components/app/GameRoot.tsx');
    assert.ok(/import LevelUpBanner/.test(src), 'LevelUpBanner import');
    assert.ok(/<LevelUpBanner level=\{levelUpBanner\}/.test(src), '배너 렌더');
    assert.ok(/prevLevelRef/.test(src) && /lv <= prev/.test(src),
        'level 증가만 트리거 (감소/동일 무시)');
    assert.ok(/setTimeout\([\s\S]{0,80}setLevelUpBanner\(null\)[\s\S]{0,20}1800\)/.test(src),
        '1.8s 후 자동 해제');
});
