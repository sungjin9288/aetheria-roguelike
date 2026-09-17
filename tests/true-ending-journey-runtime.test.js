import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { DB } from '../src/data/db.ts';
import { buildClassVitals } from '../src/hooks/gameActions/_shared.ts';

/**
 * Wave 5 W3-B — true-ending-journey-runtime.test.js 원본 계약(소스 텍스트 grep):
 *
 *   1. `useGameTestApi.ts`의 `seedTrueEndingJourneyScenario`는 "true ending" 기기
 *      QA 시나리오를 `structuredClone(INITIAL_STATE.player)` 위에 쌓아 만들고,
 *      최종 결말에 필요한 endgame 상태(primalShards: 2, prestigeRank: 3,
 *      classJourney, readabilityMode: 'high')와 실제 최종보스 baseName('마왕')을
 *      가진 hp:1(원턴 처치 가능) 적을 dispatch(LOAD_DATA → SET_ENEMY →
 *      SET_GAME_STATE(COMBAT)) 3단계로 심는다 — production combat 경로 그대로.
 *   2. `useGameTestApi.ts`는 이 여정을 위해 상태 스냅샷(getTrueEndingJourneySnapshot),
 *      보스 약화(weakenTrueBossForJourney, `원시의 신`에게만 적용), 저장(flushLocalSave),
 *      플랫폼 뒤로가기(triggerPlatformBack)만 노출한다 — 그 이상은 없다.
 *      `App.tsx`는 이 훅을 `useRuntimeGameTestApi(engineRef, fullStatsRef,
 *      handlePlatformBack)`로 연결한다.
 *
 * 이 두 계약 모두 "window에 실제로 무엇이 등록되는가"를 검증하는데, 등록은
 * `useGameTestApi`의 `useEffect` 안에서만 일어난다. 이 프로젝트의 테스트
 * 러너는 `react-dom/server`의 `renderToStaticMarkup`(1회성 SSR, effect 미실행)만
 * 제공하고 jsdom/react-test-renderer/testing-library는 devDependency에 없어
 * `window`/`document`가 아예 없다 — 즉 `useEffect`를 한 번도 실행시킬 수 없으므로
 * "실제로 seed가 dispatch를 몇 번 어떤 순서로 보내는지"를 관찰할 방법이 없다.
 * 그래서 이 파일은 구조 불변식(소스 텍스트)으로 유지하되, 소스가 참조하는 게임
 * 데이터(몬스터/아이템 이름)가 실제로 존재하는지는 DB에서 직접 검증해
 * "존재하지 않는 몬스터/아이템 이름으로 조용히 드리프트"하는 사각지대를 줄인다.
 */

test('구조 불변식: seedTrueEndingJourneyScenario는 production combat 경로(LOAD_DATA→SET_ENEMY→SET_GAME_STATE)로만 종언 시나리오를 심는다', async () => {
    const source = await readFile(new URL('../src/hooks/useGameTestApi.ts', import.meta.url), 'utf8');

    assert.match(source, /seedTrueEndingJourneyScenario/);
    assert.match(source, /structuredClone\(INITIAL_STATE\.player\)/);
    assert.match(source, /primalShards:\s*2/);
    assert.match(source, /prestigeRank:\s*3/);
    assert.match(source, /classJourney:/);
    assert.match(source, /readabilityMode:\s*'high'/);
    assert.match(source, /baseName:\s*'마왕'/);
    assert.match(source, /hp:\s*1/);
    assert.match(source, /type:\s*AT\.LOAD_DATA/);
    assert.match(source, /type:\s*AT\.SET_ENEMY/);
    assert.match(source, /type:\s*AT\.SET_GAME_STATE,\s*payload:\s*GS\.COMBAT/);
});

test('구조 불변식: 종언 여정 test API는 상태 스냅샷/보스 약화/저장/플랫폼 뒤로가기만 노출한다', async () => {
    const source = await readFile(new URL('../src/hooks/useGameTestApi.ts', import.meta.url), 'utf8');
    const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');

    assert.match(source, /getTrueEndingJourneySnapshot/);
    assert.match(source, /armNextExploreSeed/);
    assert.match(source, /weakenTrueBossForJourney/);
    assert.match(source, /enemy\?\.baseName !== '원시의 신'/);
    assert.match(source, /triggerPlatformBack:\s*\(\)\s*=>\s*handlePlatformBack\?\.\(\) \?\? false/);
    assert.match(source, /flushLocalSave:\s*\(\)\s*=>\s*engineRef\.current\.flushLocalSave\(\)/);
    assert.match(app, /useRuntimeGameTestApi\(engineRef, fullStatsRef, handlePlatformBack\)/);
});

// ─── 소스 텍스트로는 잡히지 않는 사각지대 보완: 시나리오가 참조하는 실제 게임 데이터 ───
//
// 위 두 테스트는 useGameTestApi.ts 자신의 리터럴 문자열만 검증한다. 그 문자열이
// 가리키는 몬스터/아이템이 실제 DB에서 이름이 바뀌거나 사라지면(예: 최종보스
// 리네임) 위 정규식은 여전히 통과하지만 실제 시나리오는 조용히 깨진다 — 이 부분은
// 실제 DB 조회로 검증할 수 있다(behavior 동등물).
test('종언 여정이 참조하는 몬스터/장비 이름이 실제 게임 데이터에 존재한다', () => {
    assert.ok(DB.MONSTERS['마왕'], "DB.MONSTERS에 '마왕'(최종보스 baseName)이 존재해야 한다");
    assert.ok(DB.MONSTERS['마왕'].isBoss, "'마왕'은 실제로 보스로 정의되어 있어야 한다");
    assert.ok(DB.MONSTERS['원시의 신'], "DB.MONSTERS에 '원시의 신'(weakenTrueBossForJourney 대상)이 존재해야 한다");
    assert.ok(DB.MONSTERS['원시의 신'].isBoss, "'원시의 신'도 실제로 보스로 정의되어 있어야 한다");
    assert.ok(
        DB.ITEMS.weapons.some((item) => item.name === '성검 에테르니아'),
        "DB.ITEMS.weapons에 시그니처 무기 '성검 에테르니아'가 존재해야 한다",
    );

    // seedTrueEndingJourneyScenario는 buildClassVitals(75, '전사', meta)로 player의
    // hp/mp를 계산한다 — 이 함수 자체는 순수 함수라 실제로 호출해 유효한 값을 내는지
    // 검증할 수 있다.
    const vitals = buildClassVitals(75, '전사', { prestigeRank: 3, bonusHp: 180, bonusMp: 90 });
    assert.ok(Number.isFinite(vitals.maxHp) && vitals.maxHp > 0, 'level 75 전사 vitals.maxHp가 유효하다');
    assert.ok(Number.isFinite(vitals.maxMp) && vitals.maxMp > 0, 'level 75 전사 vitals.maxMp가 유효하다');
});
