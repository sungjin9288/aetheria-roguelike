import test from 'node:test';
import assert from 'node:assert/strict';

import { MSG } from '../src/data/messages.js';

/**
 * cycle 116: dead MSG key cleanup — 36개 미사용 메시지 정리.
 *
 * cycle 90-93 dead component / utils / exports cleanup의 연장.
 * 이번엔 src/data/messages.ts의 MSG 객체에 정의됐지만 코드 어디서도 호출
 * 되지 않는 키 36종을 한 번에 정리.
 *
 * 검증 방법:
 * grep -rln "MSG\.${key}\b" src/ tests/ 가 0건 (messages.ts 자기 자신 제외)인
 * 키들. SKILL_CURSE_AMPLIFY는 주석에만 등장하고 실제 호출 0건.
 *
 * 정리 대상 그룹:
 * - 마일스톤 (5): MILESTONE_BOSS_5/FIRST, MILESTONE_KILLS_10/50/100
 * - 보스 인카운터 (2): BOSS_ENCOUNTER, AREA_BOSS_ENCOUNTER
 * - GM 시스템 (3): GM_CRISIS/OVERWHELM/UNDERDOG (게임 마스터 톤 미구현)
 * - UI 라벨 (2): UI_ALL, UI_EQUIPPED (다른 곳에서 inline string 사용)
 * - 진엔딩 / 도감 (7): TRUE_BOSS_PHASE3, CODEX_DISCOVER/ED/MILESTONE/
 *   NEW_ENTRY/PROGRESS/UNDISCOVERED
 * - 발견 체인 (2): DISCOVERY_CHAIN_COMPLETE/TRIGGER (exploreUtils에서 inline)
 * - 인벤토리 (2): INVENTORY_FULL, INV_FULL_WARNING (INV_FULL이 active)
 * - 전투 / 휴식 / 안전 / 챌린지 / 이동 / 주간 / 등 (12+):
 *   COMBAT_ATTACK, REST_DONE/FULL/PARTIAL, SAFE_ZONE_ARRIVE,
 *   CHALLENGE_COMPLETE/REWARD_BONUS, MOVE_BLOCKED_COMBAT/EVENT,
 *   WEEKLY_MISSION_COMPLETE/RESET, EQUIP_EQUIPPED, BOUNTY_ACCEPTED
 * - 효과 메시지 (1): SKILL_CURSE_AMPLIFY (cycle 108에서 의도 구현했지만 키
 *   자체는 inline 메시지로 대체)
 */

const DEAD_KEYS = [
    'MILESTONE_BOSS_5', 'MILESTONE_BOSS_FIRST',
    'MILESTONE_KILLS_10', 'MILESTONE_KILLS_50', 'MILESTONE_KILLS_100',
    'BOSS_ENCOUNTER', 'AREA_BOSS_ENCOUNTER',
    'GM_CRISIS', 'GM_OVERWHELM', 'GM_UNDERDOG',
    'UI_ALL', 'UI_EQUIPPED',
    'TRUE_BOSS_PHASE3',
    'CODEX_DISCOVER', 'CODEX_DISCOVERED', 'CODEX_MILESTONE',
    'CODEX_NEW_ENTRY', 'CODEX_PROGRESS', 'CODEX_UNDISCOVERED',
    'DISCOVERY_CHAIN_COMPLETE', 'DISCOVERY_CHAIN_TRIGGER',
    'INVENTORY_FULL', 'INV_FULL_WARNING',
    'COMBAT_ATTACK',
    'REST_DONE', 'REST_FULL', 'REST_PARTIAL',
    'SAFE_ZONE_ARRIVE',
    'CHALLENGE_COMPLETE', 'CHALLENGE_REWARD_BONUS',
    'MOVE_BLOCKED_COMBAT', 'MOVE_BLOCKED_EVENT',
    'WEEKLY_MISSION_COMPLETE', 'WEEKLY_MISSION_RESET',
    'EQUIP_EQUIPPED', 'BOUNTY_ACCEPTED',
    'SKILL_CURSE_AMPLIFY',
];

test('dead MSG key 36종 정리됨 (MSG 객체에서 제거)', () => {
    const missing = DEAD_KEYS.filter((k) => MSG[k] === undefined);
    assert.equal(missing.length, DEAD_KEYS.length,
        `expected all ${DEAD_KEYS.length} keys removed, but ${DEAD_KEYS.length - missing.length} still defined`);
});

test('회귀 보존: 핵심 active MSG 키 유지', () => {
    // 정리 후에도 active MSG 키들은 유지되어야 함.
    const KEEP = [
        'COMBAT_ATTACK_DETAIL', 'COMBAT_NOT_IN_BATTLE', 'COMBAT_CRIT',
        'INV_FULL', 'INV_ITEM_NOT_FOUND',
        'REST_DONE_FULL', 'REST_GOLD_INSUFFICIENT', 'REST_SAFE_ONLY',
        'STATUS_DOT', 'PLAYER_STATUS_SKIP',
        'BUFF_EXPIRED',
        'BOUNTY_ACCEPTED_NEW', 'BOUNTY_TOWN_ONLY',
        'MOVE_BLOCKED', 'MOVE_ARRIVED',
        'ESCAPE_SUCCESS', 'ESCAPE_FAIL',
    ];
    for (const key of KEEP) {
        assert.ok(MSG[key] !== undefined, `${key} should remain active`);
    }
});
