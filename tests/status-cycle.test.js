import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { createElement } from 'react';

import StatusBar from '../src/components/StatusBar.tsx';
import { CombatEngine } from '../src/systems/CombatEngine.ts';
import { createCharacterActions } from '../src/hooks/gameActions/characterActions.ts';
import { calculateFullStats } from '../src/utils/statsCalculator.ts';
import { BALANCE } from '../src/data/constants.ts';
import { renderStatic, makePlayerFixture } from './helpers/render.ts';

/**
 * 상태이상(Status) cycle 테스트 (audit #1 통합 10개) — Wave 5 W3-B 재작성.
 *
 * 원본 계약(각 cycle 블록, 전부 소스 텍스트 grep이었다):
 *
 *   cycle 111 — StatusBar에 활성 디버프 chip. player.status가 있으면
 *     data-testid="status-debuff-chip" + data-debuff-count + 한국어 라벨
 *     (bleed→출혈, curse→저주 등)로 노출하고, killStreak 칩과 공존하되
 *     예전의 "장비 signature" 칩은 제거됐다.
 *   cycle 112 — rest 액션이 player.status를 초기화(회복 의미) + HP/MP 완전 회복 +
 *     REST_SAFE_ONLY 가드 보존.
 *   cycle 458/459/491/492/495/549/583/586 — StatusBar/StatusMetric/EnemyStatus/
 *     CombatEngine.tickEnemyStatus에서 콜사이트가 0건인 dead prop/default를
 *     제거해도 실제 콜사이트 동작·시각 출력은 그대로다("unreachable code path
 *     cleanup" 시리즈).
 *
 * 아래에서:
 *   - cycle 111/112는 실제 렌더/실제 함수 호출로 전면 재작성했다(행동 테스트).
 *   - 458/459/491/492/495/549/583/586 중 "화면에 실제로 보이는 결과"(EnemyStatus의
 *     교전 대상 라벨/패딩, StatusMetric 3종의 라벨·클래스, tickEnemyStatus의 DoT
 *     계산)는 렌더/함수 호출로 옮겼다.
 *   - "제거된 prop/default가 destructure·본문·인터페이스에 0건으로 남아있는가",
 *     "콜사이트 개수가 N건인가" 같은, 애초에 겉으로 드러나는 동작이 없는(제거해도
 *     아무것도 안 바뀌는 게 요점인) 부분은 구조 불변식(소스 텍스트)으로 유지한다 —
 *     렌더 결과는 "prop이 아예 없어서 안 보이는지"와 "prop이 있지만 항상 같은 값이라
 *     안 보이는지"를 구분할 수 없기 때문이다.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

// ═══════════════════════════════════════════════════════════════════════
// 행동 테스트로 전환
// ═══════════════════════════════════════════════════════════════════════

// ─── cycle 111: StatusBar 활성 디버프 chip ───
test('StatusBar: player.status가 있으면 디버프 chip을 실제로 렌더하고, 한국어 라벨로 매핑한다', () => {
    const allDebuffs = ['bleed', 'burn', 'poison', 'freeze', 'stun', 'curse', 'blind', 'fear'];
    const player = makePlayerFixture({ name: '테스트', status: allDebuffs });
    const html = renderStatic(createElement(StatusBar, { player, stats: { maxHp: 150, maxMp: 40 } }));

    assert.ok(html.includes('data-testid="status-debuff-chip"'), 'debuff chip이 렌더된다');
    assert.ok(html.includes(`data-debuff-count="${allDebuffs.length}"`), '실제 디버프 개수가 attribute로 노출된다');
    assert.ok(html.includes('출혈 +7'), '첫 디버프 한국어 라벨 + 나머지 개수');
    for (const label of ['출혈', '화상', '중독', '빙결', '기절', '저주', '실명', '공포']) {
        assert.ok(html.includes(label), `"${label}" 한국어 라벨이 aria-label에 노출된다`);
    }
});

test('StatusBar: player.status가 비어 있으면 디버프 chip이 렌더되지 않는다', () => {
    const player = makePlayerFixture({ name: '테스트', status: [] });
    const html = renderStatic(createElement(StatusBar, { player, stats: { maxHp: 150, maxMp: 40 } }));
    assert.ok(!html.includes('status-debuff-chip'), '상태이상이 없으면 chip이 없다');
});

test('StatusBar: 디버프 chip은 연속 처치(killStreak) 칩과 공존한다', () => {
    const player = makePlayerFixture({ name: '테스트', status: ['curse'], killStreak: 5 });
    const html = renderStatic(createElement(StatusBar, { player, stats: { maxHp: 150, maxMp: 40 } }));

    assert.ok(html.includes('status-debuff-chip'), '디버프 chip 노출');
    assert.ok(html.includes('연속 처치 5'), 'killStreak 칩도 함께 노출');
});

// 장비 signature 칩 제거는 "그런 testid가 어떤 입력으로도 나오지 않는다"는 전역적
// 부재 주장이라 렌더 조합을 다 시도해볼 수 없다 — 소스에 아예 없다는 사실로 고정한다.
test('구조 불변식: StatusBar 소스에는 옛 장비 signature 칩이 없다', async () => {
    const source = await readSrc('src/components/StatusBar.tsx');
    assert.doesNotMatch(source, /data-testid\s*=\s*["']status-signature-chip["']/);
});

// ─── cycle 112: rest 액션이 player.status를 초기화한다 ───
const makeRestPlayer = (overrides = {}) => makePlayerFixture({
    name: '테스트',
    loc: '시작의 마을',
    gold: 99_999,
    status: ['bleed', 'curse'],
    ...overrides,
});

const callRest = (player) => {
    const dispatches = [];
    const logs = [];
    const actions = createCharacterActions({
        player,
        gameState: 'idle',
        dispatch: (action) => dispatches.push(action),
        addLog: (type, text) => logs.push({ type, text }),
        addStoryLog: () => {},
        getFullStats: (candidate = player) => calculateFullStats(candidate),
    }, { emitUnlockedTitles: () => {} });
    actions.rest();
    return { dispatches, logs };
};

test('characterActions.rest: 안전지대에서 status를 비우고 HP/MP를 완전 회복시킨다', () => {
    const player = makeRestPlayer();
    const expectedStats = calculateFullStats(player);
    const { dispatches, logs } = callRest(player);

    const setPlayerDispatch = dispatches.find((action) => action.type === 'SET_PLAYER');
    assert.ok(setPlayerDispatch, 'SET_PLAYER가 dispatch된다 (UPDATE_DAILY_PROTOCOL도 함께 나가지만 별개 관심사)');
    const payload = setPlayerDispatch.payload;
    assert.deepEqual(payload.status, [], 'rest는 player.status를 초기화한다(상태이상 전부 해소)');
    assert.equal(payload.hp, expectedStats.maxHp, 'HP가 실제 계산된 maxHp까지 회복된다');
    assert.equal(payload.mp, expectedStats.maxMp, 'MP가 실제 계산된 maxMp까지 회복된다');
    assert.equal(payload.stats.rests, (player.stats.rests || 0) + 1, 'rests 카운터가 1 증가한다');
    assert.ok(logs.some((log) => log.type === 'success'), '성공 로그가 남는다');
});

test('characterActions.rest: 안전지대가 아니면 아무것도 바꾸지 않고 REST_SAFE_ONLY 에러만 남긴다', () => {
    const player = makeRestPlayer({ loc: '고요한 숲' });
    const { dispatches, logs } = callRest(player);

    assert.equal(dispatches.length, 0, '안전지대가 아니면 SET_PLAYER를 dispatch하지 않는다');
    assert.ok(logs.some((log) => log.type === 'error'), 'REST_SAFE_ONLY 에러 로그가 남는다');
});

// ─── cycle 459/492: EnemyStatus 시각 결과 (compact/mobile prop 제거 후에도 동일 출력) ───
test('StatusBar(EnemyStatus): 전투 중 적 카드는 "교전 대상" 라벨 + 컴팩트 padding으로 고정 렌더된다', () => {
    const player = makePlayerFixture({ name: '테스트' });
    const enemy = { name: '슬라임', hp: 30, maxHp: 60, isBoss: false };
    const html = renderStatic(createElement(StatusBar, { player, enemy, stats: { maxHp: 150, maxMp: 40 } }));

    assert.ok(html.includes('data-testid="enemy-status"'), '적 상태 카드가 렌더된다');
    assert.ok(html.includes('교전 대상'), '"교전 대상" 라벨(구 "Combat Target"에서 정리)');
    assert.ok(html.includes('px-2.5 py-2'), '컴팩트 인카운터 padding 고정 사용');
    assert.ok(!html.includes('Combat Target'), '영문 라벨은 남아있지 않다');
});

// ─── cycle 491/583: StatusMetric 3종(hp/mp/exp) 시각 결과 (compact/dense/variant default 제거 후에도 동일 출력) ───
test('StatusBar(StatusMetric): hp/mp/exp 3종이 각자 올바른 라벨·값·리더블 클래스로 렌더된다', () => {
    const player = makePlayerFixture({ name: '테스트', hp: 80, mp: 20, exp: 30, nextExp: 100 });
    const html = renderStatic(createElement(StatusBar, { player, stats: { maxHp: 150, maxMp: 40 } }));

    for (const [variant, label, expected] of [
        ['hp', '생명', '80/150'],
        ['mp', '기력', '20/40'],
        ['exp', '경험', '30/100'],
    ]) {
        const idx = html.indexOf(`data-testid="status-metric-${variant}"`);
        assert.ok(idx > -1, `status-metric-${variant}가 렌더된다`);
        const block = html.slice(idx, idx + 700);
        assert.ok(block.includes('aether-status-metric'), `${variant}: readability metric surface 클래스`);
        assert.ok(block.includes('px-2 py-1.5'), `${variant}: padding 클래스`);
        assert.ok(block.includes(label), `${variant}: "${label}" 라벨`);
        assert.ok(block.includes(expected), `${variant}: 값 "${expected}"`);
        assert.ok(block.includes('text-[10px]'), `${variant}: 라벨 폰트 크기`);
        assert.ok(block.includes('text-[11px]'), `${variant}: 값 폰트 크기`);
        assert.ok(block.includes('mt-1 h-[3px]'), `${variant}: 바 크기`);
    }
});

// ─── cycle 549: CombatEngine.tickEnemyStatus의 실제 DoT 계산 ───
test('CombatEngine.tickEnemyStatus: burn DoT가 STATUS_DOT_RATIO * synergyDotMult로 실제 계산된다', () => {
    const enemy = { name: '슬라임', hp: 1000, maxHp: 1000, dots: ['burn'] };
    const synergyDotMult = 2;
    const expectedDmg = Math.max(1, Math.floor(1000 * BALANCE.STATUS_DOT_RATIO * synergyDotMult));

    const result = CombatEngine.tickEnemyStatus(enemy, [], 1, synergyDotMult);

    assert.equal(result.updatedEnemy.hp, 1000 - expectedDmg, '실제 DoT 피해가 hp에 반영된다');
    assert.ok(result.logs.some((log) => log.text.includes('화상') && log.text.includes(String(expectedDmg))),
        'DoT 로그에 실제 피해량이 노출된다');
});

// ═══════════════════════════════════════════════════════════════════════
// 구조 불변식(소스 텍스트) — "제거된 dead prop/default가 되돌아오지 않는가"
//
// 아래 항목들은 애초에 "겉으로 드러나는 변화가 없다는 것" 자체가 계약이다
// (unreachable branch/param 제거). 렌더 결과만으로는 "prop 자체가 없어서
// 안 보이는지"와 "prop은 있지만 항상 같은 값이라 안 보이는지"를 구분할 수
// 없으므로, 소스 텍스트 검증으로 남긴다.
// ═══════════════════════════════════════════════════════════════════════

// ─── cycle 458: StatusMetric inline prop / if (inline) 분기 0건 ───
test('구조 불변식(cycle 458): StatusMetric에 inline prop/분기가 없다', async () => {
    const source = await readSrc('src/components/StatusBar.tsx');
    const fnIdx = source.indexOf('const StatusMetric =');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/\binline\b/.test(sig), 'destructure에 inline 0건');

    const bodyEnd = source.indexOf('const EnemyStatus =', fnIdx);
    const block = source.slice(fnIdx, bodyEnd);
    assert.ok(!/if\s*\(\s*inline\s*\)/.test(block), 'if (inline) 분기 0건');
});

// ─── cycle 459: EnemyStatus compact prop/ternary/callsite 0건 ───
test('구조 불변식(cycle 459): EnemyStatus에 compact prop/분기가 없고, mobile도 cycle 492로 제거됐다', async () => {
    const source = await readSrc('src/components/StatusBar.tsx');
    const fnIdx = source.indexOf('const EnemyStatus =');
    const sigEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, sigEnd);
    assert.ok(!/\bcompact\b/.test(sig), 'destructure에 compact 0건');

    const bodyEnd = source.indexOf('interface StatusBarProps', fnIdx);
    const block = source.slice(fnIdx, bodyEnd);
    assert.ok(!/compact\s*\?/.test(block) && !/\bcompact\b/.test(block), '본체 compact 참조 0건');
    assert.ok(!/\bmobile\b/.test(block), 'mobile도 cycle 492 cascade로 제거됐다');

    const callMatches = source.match(/<EnemyStatus[^/]*\/>/g) || [];
    assert.equal(callMatches.length, 1, 'EnemyStatus 호출 1건');
    assert.ok(!/\bcompact\b/.test(callMatches[0]) && !/\bmobile\b/.test(callMatches[0]),
        'callsite에 compact/mobile 전달 0건');
});

// ─── cycle 491: StatusMetric compact/dense prop/callsite 0건 ───
test('구조 불변식(cycle 491): StatusMetric에 compact/dense prop이 없다', async () => {
    const source = await readSrc('src/components/StatusBar.tsx');
    const fnIdx = source.indexOf('const StatusMetric =');
    const sigEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, sigEnd);
    assert.ok(!/\bcompact\b/.test(sig) && !/\bdense\b/.test(sig), 'destructure에 compact/dense 0건');

    const bodyEnd = source.indexOf('const EnemyStatus =', fnIdx);
    const block = source.slice(fnIdx, bodyEnd);
    assert.ok(!/\bcompact\b/.test(block) && !/\bdense\b/.test(block), '본체 compact/dense 참조 0건');

    const matches = source.match(/<StatusMetric[^/]*\/>/g) || [];
    assert.equal(matches.length, 3, 'StatusMetric 호출 3건');
    matches.forEach((m, i) => {
        assert.ok(!/\bcompact\b/.test(m) && !/\bdense\b/.test(m), `callsite ${i}에 compact/dense 전달 0건`);
    });
});

// ─── cycle 495: StatusBar className prop 전체 제거 (인터페이스/destructure/본문/callsite) ───
test('구조 불변식(cycle 495): StatusBar에 className prop이 없다 (인터페이스/destructure/본문/GameRoot callsite)', async () => {
    const source = await readSrc('src/components/StatusBar.tsx');

    const ifaceIdx = source.indexOf('interface StatusBarProps');
    const ifaceEnd = source.indexOf('}', ifaceIdx);
    assert.ok(!/\bclassName\b/.test(source.slice(ifaceIdx, ifaceEnd)), 'interface에 className 0건');

    const fnIdx = source.indexOf('const StatusBar = ({');
    const fnEnd = source.indexOf('}: StatusBarProps', fnIdx);
    assert.ok(!/\bclassName\b/.test(source.slice(fnIdx, fnEnd)), 'destructure에 className 0건');

    assert.ok(!/\$\{className\}/.test(source), 'body ${className} 보간 0건');

    const gameRoot = await readSrc('src/components/app/GameRoot.tsx');
    const idx = gameRoot.indexOf('<StatusBar');
    const tagEnd = gameRoot.indexOf('/>', idx);
    assert.ok(!/className=/.test(gameRoot.slice(idx, tagEnd)), 'GameRoot <StatusBar> className 전달 0건');
});

// ─── cycle 549: tickEnemyStatus 3 defaults 제거 + 1 내부 callsite 보존 ───
test('구조 불변식(cycle 549): tickEnemyStatus 시그니처에 3 defaults가 없고, 내부 callsite는 모든 인자를 명시한다', async () => {
    const source = await readSrc('src/systems/CombatEngine.status.ts');
    const fnIdx = source.indexOf('tickEnemyStatus(enemy');
    const fnEnd = source.indexOf(')', fnIdx) + 1;
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/logs:\s*any\[\]\s*=\s*\[\]/.test(sig), 'logs default [] 제거');
    assert.ok(!/curseAmpMult\s*=\s*1/.test(sig), 'curseAmpMult default 1 제거');
    assert.ok(!/synergyDotMult\s*=\s*1/.test(sig), 'synergyDotMult default 1 제거');

    const enemyAI = await readSrc('src/systems/CombatEngine.enemyAI.ts');
    assert.ok(/this\.tickEnemyStatus\(updatedEnemy,\s*\[\],\s*curseAmpMult,\s*synergyDotMult\)/.test(enemyAI),
        '내부 callsite가 4 인자 모두 명시 전달한다');
});

// ─── cycle 583: StatusMetric variant default 'hp' 제거 + 3 callsite 보존 ───
test('구조 불변식(cycle 583): StatusMetric variant에 default가 없고, 3 callsite가 각자 variant를 명시한다', async () => {
    const source = await readSrc('src/components/StatusBar.tsx');
    const fnIdx = source.indexOf('const StatusMetric = ');
    const sigEnd = source.indexOf('=>', fnIdx);
    assert.ok(!/variant\s*=\s*'hp'/.test(source.slice(fnIdx, sigEnd)), "variant default 'hp' 제거");

    assert.ok(/<StatusMetric label="생명"[\s\S]*?variant="hp"/.test(source), '생명 callsite');
    assert.ok(/<StatusMetric label="기력"[\s\S]*?variant="mp"/.test(source), '기력 callsite');
    assert.ok(/<StatusMetric label="경험"[\s\S]*?variant="exp"/.test(source), '경험 callsite');
    assert.ok(/METER_THEME\[variant\] \|\| METER_THEME\.hp/.test(source), 'nullish fallback은 보존된다');
});

// ─── cycle 586: StatusBar 5 defaults batch 제거 + GameRoot callsite 보존 ───
test('구조 불변식(cycle 586): StatusBar 시그니처에 5 defaults가 없고, GameRoot는 여전히 값을 명시 전달한다', async () => {
    const source = await readSrc('src/components/StatusBar.tsx');
    const fnIdx = source.indexOf('const StatusBar = ');
    const sigEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, sigEnd);
    for (const dead of [/enemy\s*=\s*null/, /onCrystalClick\s*=\s*null/, /isMuted\s*=\s*false/, /onToggleMute\s*=\s*null/, /onOpenEquipment\s*=\s*null/]) {
        assert.ok(!dead.test(sig), `${dead} default가 제거됐다`);
    }

    const gameRoot = await readSrc('src/components/app/GameRoot.tsx');
    assert.ok(/<StatusBar[\s\S]*?enemy=\{engine\.gameState === GS\.COMBAT \? engine\.enemy : null\}/.test(gameRoot),
        'GameRoot가 enemy를 명시 전달한다');
    assert.ok(!/isMuted=/.test(gameRoot) && !/onToggleMute=/.test(gameRoot), '임시 비활성 사운드 props는 전달되지 않는다');
});
