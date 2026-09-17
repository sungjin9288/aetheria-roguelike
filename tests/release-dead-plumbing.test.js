import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

/**
 * Wave 5 W3-B — release-dead-plumbing.test.js 원본 계약(소스 텍스트 grep):
 *
 *   1. 이미 제거된 "always-null inventory spotlight" 기능의 잔재
 *      (inventorySpotlight / onClearInventorySpotlight / onClearSpotlight /
 *      spotlight prop 등)가 프로덕션 UI(App/GameRoot/MobileGameLayout/
 *      Dashboard/SmartInventory)와 test API cascade(useGameTestApi)에
 *      단 한 곳도 남아있지 않다.
 *   2. 옛 "legacy archived history" 기능의 잔재(archivedHistory)가 reducer
 *      상태, player 타입, 마이그레이션, Firebase 동기화, 설정 화면 어디에도
 *      남아있지 않다.
 *
 * ─── 구조 불변식(소스 텍스트)으로 전량 유지 ───
 *
 * 이 파일은 그 자체로 "죽은 배선이 되살아나지 않았는가"를 검증하는 dead-code
 * 회귀 가드다. `inventorySpotlight`/`archivedHistory`는 애초에 기능이 완전히
 * 제거된 상태이므로, 대응하는 렌더 결과나 호출 가능한 함수가 존재하지 않는다 —
 * "무엇이 렌더되는가"로 바꿔 쓸 행동(behavior)이 없고, 있다면 그건 오히려
 * 회귀(잔재가 되살아났다는 뜻)다. 따라서 이 계약은 행동 테스트로 전환할
 * 대상이 없고, 지정된 파일들에 해당 식별자가 0건이라는 사실 자체가 계약의
 * 전부다 — release-dead-plumbing이라는 파일명 자체가 그 뜻이다.
 */

test('구조 불변식: always-null inventory spotlight 잔재는 프로덕션 UI와 test API cascade에 없다', async () => {
    const paths = [
        'src/App.tsx',
        'src/components/app/GameRoot.tsx',
        'src/components/app/MobileGameLayout.tsx',
        'src/components/Dashboard.tsx',
        'src/components/SmartInventory.tsx',
        'src/hooks/useGameTestApi.ts',
    ];
    for (const path of paths) {
        assert.doesNotMatch(
            await read(path),
            /inventorySpotlight|onClearInventorySpotlight|onClearSpotlight|spotlight\s*\?:|spotlight\s*[},=]|\bspotlight\?\./,
            path,
        );
    }
});

test('구조 불변식: legacy archived history 잔재는 state/타입/마이그레이션/동기화/설정 화면 어디에도 없다', async () => {
    const paths = [
        'src/reducers/gameReducer.ts',
        'src/types/player.ts',
        'src/utils/dataMigration.ts',
        'src/hooks/useFirebaseSync.ts',
        'src/components/tabs/SystemTab.tsx',
    ];
    for (const path of paths) {
        assert.doesNotMatch(await read(path), /archivedHistory/, path);
    }
});
