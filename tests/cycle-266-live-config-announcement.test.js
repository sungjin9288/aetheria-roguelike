import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 266: liveConfig.announcement UI dispatch 누락 dead config
 *   (cycle 222-265 silent dead config 시리즈 37번째).
 *
 * 발견 (cycle 265 paired):
 * - liveConfig 구조: { eventMultiplier, announcement, seasonEvent }.
 * - SystemTab admin이 announcement(공지) 설정 가능 (window.prompt → updateLiveConfig).
 * - 그러나 announcement 필드는 src/ 어디에도 render 안 됨 (SystemTab admin setter만 read).
 * - 결과: admin이 공지를 설정해도 player에게 표시되지 않음 — admin 도구 dead.
 *
 * 패턴 (cycle 222-265 silent dead config 시리즈 37번째):
 * - cycle 265: liveConfig.seasonEvent / eventMultiplier 보너스 dispatch.
 * - cycle 266: liveConfig.announcement UI dispatch (paired completion).
 *
 * 수정 (src/components/app/GameRoot.tsx):
 * - 시즌 이벤트 배너 위 또는 아래에 announcement 배너 추가.
 * - announcement 비어있을 시 미표시 (silence over noise).
 *
 * 회귀 가드:
 * - cycle 265 seasonEvent 배너 동작 유지.
 * - SystemTab admin updateLiveConfig 동작 변화 없음.
 * - announcement 빈 문자열 / 미정의 시 미표시.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 266: GameRoot가 liveConfig.announcement render', async () => {
    const source = await readSrc('src/components/app/GameRoot.tsx');
    assert.ok(/liveConfig\?.announcement|liveConfig\.announcement/.test(source),
        'GameRoot는 liveConfig.announcement read');
});

test('cycle 266: 빈 announcement 시 미표시 (조건부 렌더링)', async () => {
    const source = await readSrc('src/components/app/GameRoot.tsx');
    // 조건부 렌더링 패턴: `{liveConfig.announcement && ...}` 또는 `{liveConfig?.announcement && ...}`.
    assert.ok(/\{engine\.liveConfig\?\.announcement\s*&&|\{engine\.liveConfig\.announcement\s*&&/.test(source),
        '조건부 렌더링 — announcement falsy 시 미표시');
});

test('cycle 266: announcement 배너가 testid 노출', async () => {
    const source = await readSrc('src/components/app/GameRoot.tsx');
    assert.ok(/data-testid=['"]live-config-announcement['"]/.test(source),
        'announcement 배너에 data-testid 추가 (테스트 검증 hook)');
});

test('cycle 265 회귀 가드: seasonEvent 배너 동작 유지', async () => {
    const source = await readSrc('src/components/app/GameRoot.tsx');
    assert.ok(/liveConfig\?\.seasonEvent\?\.active/.test(source),
        'cycle 265 seasonEvent 배너 조건 유지');
    assert.ok(/시즌 이벤트 배너/.test(source),
        'cycle 265 seasonEvent 배너 주석 유지');
});
