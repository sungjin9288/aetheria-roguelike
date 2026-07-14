import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('first-play surfaces use player-facing Korean labels', async () => {
    const [controlPanel, dashboard, mapNavigator, mobileSummary, returnBriefing, messages] = await Promise.all([
        readSrc('src/components/ControlPanel.tsx'),
        readSrc('src/components/Dashboard.tsx'),
        readSrc('src/components/MapNavigator.tsx'),
        readSrc('src/components/DashboardMobileSummary.tsx'),
        readSrc('src/components/ReturnBriefingCard.tsx'),
        readSrc('src/data/messages.ts'),
    ]);

    assert.match(controlPanel, /현재 임무/);
    assert.match(controlPanel, /다음 행동/);
    assert.match(controlPanel, /이동 경로/);
    assert.doesNotMatch(controlPanel, />\s*(Mission|Route Map|Recommended|CANCEL|NEXT)\s*</);

    assert.match(dashboard, /id: 'rest', label: '휴식'/);
    assert.match(dashboard, /id: 'class', label: '전직'/);
    assert.match(dashboard, /id: 'quest', label: '임무'/);
    assert.match(dashboard, /id: 'craft', label: '제작'/);
    assert.match(dashboard, /<span>초기화<\/span>/);
    assert.match(dashboard, /<span>취소<\/span>/);

    assert.match(mapNavigator, /세계 지도/);
    assert.match(mapNavigator, /전체 경로/);
    assert.match(mapNavigator, /지역 이야기/);
    assert.match(mapNavigator, /data-testid="map-navigator"/);
    assert.match(mapNavigator, /레벨 1~10/);
    assert.doesNotMatch(mapNavigator, />\s*(Atlas Map|Current Position|World Routes|Area Lore)\s*</);
    assert.doesNotMatch(mapNavigator, /`Lv\.\$\{|\}G<\/span>/);

    assert.match(mobileSummary, /label: '주무기'/);
    assert.match(mobileSummary, /fallback: '비어 있음'/);
    assert.match(mobileSummary, /mobile-summary-signature-\$\{entry\.slot\}/);
    assert.doesNotMatch(mobileSummary, /label: '(LEFT|RIGHT|ARMOR)'/);

    assert.match(returnBriefing, /다시 만난 모험가에게/);
    assert.match(messages, /RETURN_BRIEFING_STATUS_LABEL: '현재 상태'/);
    assert.match(messages, /RETURN_BRIEFING_MISSIONS_LABEL: '남은 오늘의 임무'/);
});

test('menu, settings, and device playtest use one natural Korean vocabulary', async () => {
    const [intro, constants, messages, dashboard, mobileLayout, systemTab, checklist] = await Promise.all([
        readSrc('src/components/IntroScreen.tsx'),
        readSrc('src/data/constants.ts'),
        readSrc('src/data/messages.ts'),
        readSrc('src/components/Dashboard.tsx'),
        readSrc('src/components/app/MobileGameLayout.tsx'),
        readSrc('src/components/tabs/SystemTab.tsx'),
        readSrc('docs/PLAYTEST_CHECKLIST.md'),
    ]);

    for (const label of ['달빛 아래 펼쳐지는 모험', '도전 설정', '처음이라면 선택하지 않아도 됩니다.', '모험 시작']) {
        assert.match(intro, new RegExp(label));
    }
    assert.match(intro, /<details[\s\S]*data-testid="intro-challenge-settings"/);
    assert.doesNotMatch(intro, /MOONLIT FIELD LEDGER|Challenge Modifiers|Up to|기록 개시/);
    assert.match(constants, /label: '약한 생명력'/);
    assert.match(constants, /label: '빈손의 시작'/);
    assert.match(constants, /label: '강적의 길'/);
    assert.doesNotMatch(constants, /label: '(반피 런|엘리트 런|금욕)'|Elite 판정/);
    assert.match(messages, /CHALLENGE_NO_CONSUMABLE: '물약 없이:/);
    assert.match(messages, /COMBAT_CHAOS_SKILL: \(name: string\) => `뒤섞인 기술:/);

    for (const label of ['장비', '가방', '임무', '업적', '기술', '지도', '상태', '도감', '시즌', '무덤', '설정']) {
        assert.match(dashboard, new RegExp(`label: '${label}'`));
    }
    assert.match(dashboard, /모험 기록/);
    assert.match(dashboard, /마을에서 할 일/);
    assert.match(dashboard, /안전지대/);
    assert.doesNotMatch(dashboard, /label: '(Equipment|Inventory|Quest|Achievements|Skills|Map|Stats|Codex|Pass|Graves|System)'/);
    assert.doesNotMatch(dashboard, />\s*(RESET|Menu Console|Town Ops|SAFE ZONE|Archive Dock|Archive|Open)\s*</);

    assert.match(mobileLayout, />\s*메뉴\s*</);
    assert.doesNotMatch(mobileLayout, />\s*Menu\s*</);

    for (const label of ['화면 가독성', '기기 점검 기록', '파일 저장', '유물', '칭호', '오늘의 임무', '명예의 전당', '플레이 기록 저장', '의견 보내기']) {
        assert.match(systemTab, new RegExp(label));
    }
    assert.match(systemTab, /offline: '연결 안 됨'/);
    assert.match(systemTab, /synced: '저장됨'/);
    assert.match(systemTab, /<details[\s\S]*자세한 기기 정보/);
    assert.doesNotMatch(systemTab, />\s*(READABILITY|QA READOUT|COPY|EXPORT|Relics|Titles|Daily Protocol|HALL OF FAME|DOWNLOAD LOGS|ADMIN CONTROLS|TRANSMIT)\s*</);

    assert.match(checklist, /처음 보는 사람도 3초 안에 다음 행동 하나를 고를 수 있다/);
    assert.match(checklist, /첫 일반 전투가 대략 4~6턴 안에 끝나는지/);
    assert.match(checklist, /캐릭터와 아이템 디자인 통일성/);
    assert.doesNotMatch(checklist, /Field Log|Status Strip|Field Actions|Archive Dock|QA READOUT|EXPORT|`RESET`/);
});
