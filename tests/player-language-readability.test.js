import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { MSG } from '../src/data/messages.js';
import { getFirstVisitReward } from '../src/utils/exploreUtils.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('first-play surfaces use player-facing Korean labels', async () => {
    const [controlPanel, dashboard, mapNavigator, mobileSummary, returnBriefing, jobChangePanel, classCard, messages] = await Promise.all([
        readSrc('src/components/ControlPanel.tsx'),
        readSrc('src/components/Dashboard.tsx'),
        readSrc('src/components/MapNavigator.tsx'),
        readSrc('src/components/DashboardMobileSummary.tsx'),
        readSrc('src/components/ReturnBriefingCard.tsx'),
        readSrc('src/components/tabs/JobChangePanel.tsx'),
        readSrc('src/components/ClassCard.tsx'),
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

    for (const label of ['성장 갈림길', '전직 선택', '현재 직업', '가지 선택', '가방']) {
        assert.match(jobChangePanel, new RegExp(label));
    }
    for (const label of ['전직 가능', '대표 기술', '사용 기술', '매우 높음']) {
        assert.match(classCard, new RegExp(label));
    }
    assert.doesNotMatch(jobChangePanel, /Class Circuit|Class Advancement|Current Class|MAXIMUM POTENTIAL|archiveLabel="INV"/);
    assert.doesNotMatch(classCard, /\{skillCount\} skills|>x\{value\}</);
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

test('first-session record uses natural player language from start through growth', () => {
    const messages = [
        MSG.START_JOURNEY('아리아'),
        MSG.START_SKILL('강타'),
        MSG.START_BOOT_RELIC,
        MSG.MOVE_ARRIVED('고요한 숲'),
        MSG.MOVE_NEW_AREA('고요한 숲'),
        MSG.MOVE_AREA_DANGER(1),
        MSG.VICTORY(20, 18),
        MSG.FIRST_BOSS_GOLD(120),
        MSG.BLOOD_OATH_HEAL(10),
        MSG.WORLD_DEVOUR_HEALTH(8),
        MSG.IMMORTAL_WARRIOR_HEAL(12),
        MSG.INFINITE_DEVOUR_HEAL(14),
        MSG.STAR_CORE_RESTORE,
        MSG.LEGACY_ESSENCE(2),
        MSG.LEGACY_RANK(1),
        MSG.LEVEL_UP(2, 3, 20),
        MSG.LEVEL_MILESTONE(5, 250),
        MSG.LEVEL_MAJOR_MILESTONE(10, 4, 25, 12),
        MSG.EQUIP_LEVEL_REQUIRED('강철 검', 4),
        MSG.SKILL_NO_MP,
        MSG.SKILL_ON_COOLDOWN('강타', 2),
        MSG.CAMPFIRE_REST_LOG(20, 10),
        MSG.REST_DONE_FULL(30),
        MSG.COMBAT_DIGEST_BOSS_REWARD(120, '전설 각인'),
        MSG.KILL_STACK_ATTACK('허공의 왕좌', 15),
        MSG.TITLE_UNLOCKED('첫 번째 사냥꾼'),
        MSG.DEFEAT,
        MSG.FIRST_DEATH_META(1, 10),
    ];
    const record = messages.join(' ');

    for (const phrase of ['첫 여정', '첫 기술', '첫 유물', '고요한 숲에 도착', '처음 발견한 지역', '경험 +20', '골드 +18', '계승 정수', '공격력 +3', '생명 +20', '기력이 부족', '새 칭호']) {
        assert.ok(record.includes(phrase), `첫 세션 기록에 "${phrase}"가 있어야 합니다.`);
    }
    assert.doesNotMatch(record, /EXP|Gold|Lv\.|ATK|HP|MP|레거시|빌드|콜사인|초기 스킬|🏆|🗺️|⚠️/);
});

test('first-visit rewards keep the first journey in natural player language', () => {
    const locations = [
        '고요한 숲', '서쪽 평원', '호수의 신전', '잊혀진 폐허', '버려진 광산',
        '어둠의 동굴', '화염의 협곡', '용의 둥지', '사막 오아시스', '피라미드',
        '얼음 성채', '빙하 심연', '북부 요새', '기계 폐도', '천공 정원',
        '심해 회랑', '에테르 관문', '암흑 성', '마왕성', '혼돈의 심연', '고대 보물고',
    ];

    for (const location of locations) {
        const reward = getFirstVisitReward(location, { stats: { visitedMaps: [] } });
        assert.ok(reward, `${location} 첫 방문 보상이 있어야 합니다.`);
        assert.match(reward.msg, /골드 [\d,]+ · 경험 \d+/);
        assert.doesNotMatch(reward.msg, /EXP|Gold|\+\d+G|\[첫 방문\]/);
    }
});
