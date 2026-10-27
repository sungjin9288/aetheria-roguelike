import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';

import TerminalView from '../src/components/TerminalView.tsx';
import { MSG } from '../src/data/messages.js';
import {
    ENEMY_ACTION_LOG_TYPE,
    ENEMY_HEAVY_LOG_TYPE,
    getLogBadgeKind,
    isAcquisitionLogText,
} from '../src/data/logBadge.js';
import { GS } from '../src/reducers/gameStates.js';
import { CombatEngine } from '../src/systems/CombatEngine.js';
import { calculateFullStats } from '../src/utils/statsCalculator.js';
import { selectCombatLogSummary } from '../src/utils/combatLogSummary.js';
import { renderStatic } from './helpers/render.ts';

/**
 * 기록 창 배지 — 소유자 결정 2026-10-26(전투 · 기록 묶음).
 *   D25(감사 GF-07): 적의 행동은 자기 배지('적 행동')다 — 적 강타가 '치명타' 배지를 받지 않는다.
 *     지난 차례는 표시 계층에서만 한 줄로 접는다(리듀서 기록 줄 수 · 문구 · 난수는 그대로).
 *   D26: '획득' 배지는 실제로 얻은 줄에만 — 나머지 성공 줄은 '안내'다.
 *   D27: 기술 줄의 머리표 뒤에는 쌍점이 없다("[강타] 숲 요정에게 …").
 */

// ── D26: 얻은 줄과 아닌 줄 ─────────────────────────────────────────────────

const ACQUISITION_LINES = [
    MSG.LOOT_GET('녹슨 검'),
    MSG.VICTORY(40, 12),
    MSG.QUEST_REWARD_ITEM('하급 체력 물약'),
    MSG.ACH_REWARD_ITEM('강철 투구'),
    MSG.SHOP_BUY_DONE('하급 체력 물약'),
    MSG.SHOP_SELL_DONE('녹슨 검', 30),
    MSG.CRAFT_DONE('강철 검'),
    MSG.BAG_CRAFTED('가죽 가방', 23),
    MSG.SYNTHESIS_SUCCESS('미스릴 검'),
    MSG.BULK_SELL_DONE(4, 80),
    MSG.CHAIN_REWARD_RELIC('상인의 인장'),
    MSG.CHAIN_REWARD_STAT_BONUS('공격력 +5'),
    MSG.TITLE_UNLOCKED('숲의 사냥꾼'),
    MSG.DIMENSION_GRAVE_VICTORY('누군가', '녹슨 검'),
    MSG.RELIC_REPLACED('낡은 부적', '흡혈의 송곳니'),
    MSG.FIRST_BOSS_GOLD(500),
];

const NOT_ACQUISITION_LINES = [
    MSG.MOVE_ARRIVED('시작의 마을'),
    MSG.CLOAK_EVADE_PROC('숲 요정'),
    MSG.ARMOR_EVADE_PROC('숲 요정'),
    MSG.STEALTH_EVADE_PROC('숲 요정'),
    MSG.ENEMY_BLIND_MISS('숲 요정'),
    MSG.ITEM_USE_SIMPLE('회복 물약'),
    MSG.ITEM_USE_BUFF('힘의 물약'),
    MSG.EQUIP_DONE('녹슨 검'),
    MSG.JOB_CHANGE_DONE('전사'),
    MSG.REST_DONE_FULL(50),
    MSG.ESCAPE_SUCCESS,
    MSG.ENHANCE_SUCCESS('녹슨 검', 3),
    MSG.SEASON_ROTATED('시즌 1', '시즌 2', 1.2),
    MSG.SKILL_SWAP('화염구', '불꽃', '화상'),
];

test('D26: 실제로 얻은 성공 줄만 "획득" 배지다', () => {
    for (const text of ACQUISITION_LINES) {
        assert.equal(isAcquisitionLogText(text), true, `얻은 줄: ${text}`);
        assert.equal(getLogBadgeKind({ type: 'success', text }), 'success', `"획득": ${text}`);
    }
});

test('D26: 얻은 것이 없는 성공 줄은 "안내" 배지다 — 회피 · 도착 · 사용 · 장착 · 전직 · 휴식 · 강화', () => {
    for (const text of NOT_ACQUISITION_LINES) {
        assert.equal(isAcquisitionLogText(text), false, `얻은 줄이 아니다: ${text}`);
        assert.equal(getLogBadgeKind({ type: 'success', text }), 'system', `"안내": ${text}`);
    }
    // 다른 종류의 배지는 그대로다.
    for (const type of ['combat', 'critical', 'story', 'system', 'event', 'warning', 'error', 'legendary']) {
        assert.equal(getLogBadgeKind({ type, text: '아무 줄' }), type);
    }
    assert.equal(getLogBadgeKind({ type: 'loading', text: '' }), null);
});

// ── D25: 적 행동 ───────────────────────────────────────────────────────────

const makePlayer = () => ({
    name: '시험자', job: '전사', level: 10, hp: 5_000, maxHp: 5_000, mp: 100, maxMp: 100, atk: 50, def: 10, gold: 0,
    inv: [], equip: {}, relics: [], status: [], titles: [], stats: { kills: 0 }, meta: {},
    skillLoadout: { selected: 0, cooldowns: {} }, combatFlags: {},
});
const makeEnemy = (pattern) => ({
    name: '숲 요정', baseName: '숲 요정', level: 10, hp: 500, maxHp: 500, atk: 60, def: 5, exp: 10, gold: 10, pattern,
});
const enemyTurn = (pattern, rng = () => 0.5) => {
    const player = makePlayer();
    return CombatEngine.enemyAttack(player, makeEnemy(pattern), calculateFullStats(player), rng);
};

test('D25: 실제 적 차례의 일반 타격 · 강타 · 방어 자세는 "적 행동" 배지이고 "치명타"가 아니다', () => {
    const cases = [
        { label: '일반 타격', pattern: { guardChance: 0, heavyChance: 0 }, type: ENEMY_ACTION_LOG_TYPE },
        { label: '강타', pattern: { guardChance: 0, heavyChance: 1 }, type: ENEMY_HEAVY_LOG_TYPE },
        { label: '방어 자세', pattern: { guardChance: 1, heavyChance: 0 }, type: ENEMY_ACTION_LOG_TYPE },
    ];
    for (const { label, pattern, type } of cases) {
        const result = enemyTurn(pattern);
        assert.ok(result.logs.length > 0, `${label}: 기록 줄이 있다`);
        assert.ok(result.logs.some((log) => log.type === type), `${label}: 기록 종류 ${type}`);
        for (const log of result.logs) {
            assert.notEqual(log.type, 'critical', `${label}: 적 행동 줄은 'critical'이 아니다 — ${log.text}`);
            assert.equal(getLogBadgeKind(log), 'enemy', `${label}: 배지 '적 행동' — ${log.text}`);
        }
    }
});

test('D25: 기록 종류만 바뀌었다 — 같은 난수에서 줄 수 · 문구가 강타와 일반 타격 모두 하나의 타격 줄이다', () => {
    const normal = enemyTurn({ guardChance: 0, heavyChance: 0 });
    const heavy = enemyTurn({ guardChance: 0, heavyChance: 1 });
    assert.equal(normal.logs.filter((log) => log.type === ENEMY_ACTION_LOG_TYPE).length, 1);
    assert.equal(heavy.logs.filter((log) => log.type === ENEMY_HEAVY_LOG_TYPE).length, 1);
    assert.equal(normal.logs.length, heavy.logs.length, '강타도 줄을 더하지 않는다');
});

// ── 화면: 배지 · 지난 차례 접기 · D27 ──────────────────────────────────────

const turnLines = (now, seed, entries) => entries.map(([type, text], index) => ({ id: `combat-item-${now}-${seed}-${index}`, type, text }));

const renderTerminal = (logs, gameState = GS.IDLE) => renderStatic(createElement(TerminalView, {
    logs, gameState, onCommand: () => {}, player: null, quickSlots: [], onQuickSlotUse: () => {},
}));

const badgeOf = (html, text) => {
    const index = html.indexOf(text);
    assert.ok(index >= 0, `줄이 그려진다: ${text}`);
    const rowStart = html.lastIndexOf('data-log-id=', index);
    const row = html.slice(rowStart, index);
    const match = row.match(/data-testid="log-type-badge"[^>]*>([^<]*)</u);
    return match ? match[1] : null;
};

test('D25 · D26: 기록 창은 적 행동에 "적 행동", 얻은 줄에 "획득", 회피 성공에 "안내"를 붙인다', () => {
    const evade = MSG.CLOAK_EVADE_PROC('숲 요정');
    const loot = MSG.LOOT_GET('녹슨 검');
    const heavyHit = '숲 요정의 강타!'; // 숫자는 renderLogText가 강조 태그로 감싸므로 숫자 없는 표본
    const html = renderTerminal([
        { id: 'a', type: 'success', text: evade },
        { id: 'b', type: 'success', text: loot },
        { id: 'c', type: ENEMY_HEAVY_LOG_TYPE, text: heavyHit },
        { id: 'd', type: ENEMY_ACTION_LOG_TYPE, text: '숲 요정의 공격!' },
    ]);
    assert.equal(badgeOf(html, evade), '안내');
    assert.equal(badgeOf(html, loot), '획득');
    assert.equal(badgeOf(html, heavyHit), MSG.LOG_BADGE_ENEMY_ACTION);
    assert.equal(badgeOf(html, '숲 요정의 공격!'), '적 행동');
    assert.ok(!html.includes('>치명타<'), '적 강타 줄에 "치명타" 배지가 없다');
    assert.match(html, /data-log-badge="enemy"/u);
    assert.match(html, /data-log-badge="system"[^>]*>[\s\S]*?그림자 망토/u);
});

test('D25: 전투 중 기록 요약은 지난 차례를 한 줄로 접는다 — 기록 줄은 그대로다', () => {
    const previous = turnLines(1, 1, [['combat', '[강타] 숲 요정에게 30 피해!'], [ENEMY_ACTION_LOG_TYPE, '숲 요정의 공격! 12 피해'], ['info', '출혈 피해']]);
    const latest = turnLines(2, 2, [['combat', '[강타] 숲 요정에게 31 피해!'], [ENEMY_HEAVY_LOG_TYPE, '숲 요정의 강타! 40 피해']]);
    const logs = [...previous, ...latest];

    const summary = selectCombatLogSummary(logs, { types: new Set(['combat']), fallbackCount: 3, floorId: null });
    assert.equal(summary.turnKey, '2-2');
    assert.deepEqual(summary.previousTurn, { first: previous[0], moreCount: 2, turnKey: '1-1' });
    assert.equal(logs.length, 5, '접기는 표시만 — 기록 줄 수는 그대로');

    const firstOnly = selectCombatLogSummary(latest, { types: new Set(['combat']), fallbackCount: 3, floorId: null });
    assert.equal(firstOnly.previousTurn, null, '첫 차례에는 접을 지난 차례가 없다');

    // 화면의 접힌 줄(`combat-log-previous-turn`)은 기록 창이 전투 전에 열려 있어야 그려진다(전투 경계) — e2e combat-focus가 실제 두 차례로 확인한다.
    assert.equal(MSG.COMBAT_LOG_PREVIOUS_TURN(previous[0].text, 2), `지난 차례 · ${previous[0].text} 외 2줄`);
    assert.equal(MSG.COMBAT_LOG_PREVIOUS_TURN('한 줄', 0), '지난 차례 · 한 줄');
});

test('D27: 기술 줄의 머리표 뒤에는 쌍점이 없다', () => {
    const line = MSG.SKILL_USE('강타', 30, '숲 요정', 70, 100, []);
    assert.equal(line, '[강타] 숲 요정에게 30 피해! (70/100)');
    assert.doesNotMatch(MSG.SKILL_USE('강타', 30, '숲 요정', 70, 100, ['약점']), /\]:/u);
});
