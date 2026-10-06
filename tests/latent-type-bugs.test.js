import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

import { ACHIEVEMENTS, QUESTS } from '../src/data/quests.js';
import { MONSTERS } from '../src/data/monsters.js';
import { INITIAL_STATE } from '../src/reducers/gameReducer.js';
import { DB } from '../src/data/db.js';
import { excludeOwnGraves } from '../src/utils/graveUtils.js';
import {
    getAdventureGuidance,
    getExpeditionPreparation,
    getMoveRecommendations,
} from '../src/utils/adventureGuide.js';
import { createQuestProgressState, syncQuestProgress } from '../src/utils/questProgress.js';

/**
 * H5 (Wave 3 감사): 타입 작업에서 드러난 잠재 버그 4건.
 *
 * (a) GravePanel이 존재하지 않는 player.uid로 "내 묘비 제외"를 판정 → 자기 묘비 노출.
 * (b) StatsPanel의 trait null 가능성을 trait! 단언으로 덮어 둠.
 * (c) ControlPanel / MapNavigator가 가짜 {maxHp, maxMp}를 넘기던 죽은 폴백.
 * (d) 퀘스트 'Level' / 업적 'level' 표기 분열.
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

/** 주석 줄 제거 — 설계 근거 주석에 남은 옛 표현은 회귀가 아니다. */
const stripComments = (source) => source
    .split('\n')
    .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*'))
    .join('\n');

// ─── (a) 공개 묘비 목록에서 내 묘비 제외 ───────────────────────────────────────

test('H5(a): 세션 uid의 묘비는 공개 목록에서 제외된다', () => {
    const graves = [
        { uid: 'me', playerName: '리베이아' },
        { uid: 'other-1', playerName: '방랑자' },
        { uid: 'other-2', playerName: '탐색자' },
    ];

    const publicList = excludeOwnGraves(graves, 'me');
    assert.deepEqual(publicList.map((entry) => entry.uid), ['other-1', 'other-2']);
    assert.ok(!publicList.some((entry) => entry.uid === 'me'), '내 묘비는 침공 후보가 아니다');
});

test('H5(a): uid를 모르면(오프라인·인증 전) 목록을 그대로 둔다', () => {
    const graves = [{ uid: 'other-1' }, { uid: 'other-2' }];
    assert.deepEqual(excludeOwnGraves(graves, null), graves);
    assert.deepEqual(excludeOwnGraves(graves, undefined), graves);
    assert.deepEqual(excludeOwnGraves(null, 'me'), []);
});

test('H5(a): 내 묘비 제외는 player.uid가 아니라 세션 uid를 쓴다 (Wave 70: 공개 목록 화면 → 다른 차원의 묘비 풀)', async () => {
    // 2026-10 Wave 70: 공개 묘비 목록 화면(GravePanel)은 없어졌고, 세션 uid는 풀을 채우는 훅과 탐험 액션 deps로 간다.
    //   후보 선택이 세션 uid를 빼는 행동은 tests/dimension-grave-event-contract.test.js가 실제 함수로 확인한다.
    //   최종 통합 수용: 풀 조회는 `platform/publicGraveFirestore.ts`의 `readDimensionGravePool`로 옮겼고, 자기 묘비가
    //   빠지는지는 tests/firestore-rules-semantics.test.js가 에뮬레이터에서 같은 함수로 확인한다.
    const pool = stripComments(await readSrc('src/hooks/useDimensionGravePool.ts'));
    assert.doesNotMatch(pool, /player\?\.uid|player\.uid/, 'player.uid는 존재하지 않는 필드');
    assert.match(pool, /readDimensionGravePool\(firestore, uid\)/, '훅은 세션 uid를 풀 조회에 넘긴다');
    const read = stripComments(await readSrc('src/platform/publicGraveFirestore.ts'));
    assert.doesNotMatch(read, /player\?\.uid|player\.uid/);
    assert.match(read, /excludeOwnGraves\(fetched, uid\)/);

    const engine = await readSrc('src/hooks/useGameEngine.ts');
    assert.match(engine, /useDimensionGravePool\(uid\)/, '엔진 세션 uid가 풀 훅까지 내려온다');
    assert.match(engine, /\n {8}uid,\n {8}actions,/, 'useGameEngine이 uid를 노출한다');
});

// ─── (b) StatsPanel trait null 가드 ────────────────────────────────────────────

test('H5(b): StatsPanel이 trait 단언 없이 성향 구획을 조건부로 렌더한다', async () => {
    const source = await readSrc('src/components/StatsPanel.tsx');
    const body = source.slice(source.indexOf('const StatsPanel'));

    assert.doesNotMatch(body, /trait!\./, 'trait! 단언 0건');
    assert.match(body, /\{trait && \(\s*\n\s*<section data-testid="stats-current-growth"/,
        '성향 구획은 trait이 있을 때만 렌더');
    // 누적 기록 구획은 trait과 무관하게 남는다.
    assert.match(body, /data-testid="stats-panel"/);
});

// ─── (c) adventureGuide 죽은 폴백 제거 ────────────────────────────────────────

const guidePlayer = () => ({
    ...structuredClone(INITIAL_STATE.player),
    loc: '고요한 숲',
    level: 5,
    hp: 60,
    maxHp: 120,
    mp: 20,
    maxMp: 40,
});

test('H5(c): stats가 없을 때의 결과가 가짜 {maxHp, maxMp} 폴백과 같다', () => {
    const player = guidePlayer();
    const fake = { maxHp: player.maxHp, maxMp: player.maxMp };
    const mapData = DB.MAPS[player.loc];

    assert.deepEqual(
        getAdventureGuidance(player, null, mapData, 'idle'),
        getAdventureGuidance(player, fake, mapData, 'idle'),
    );
    assert.deepEqual(
        getMoveRecommendations(player, null, mapData, DB.MAPS),
        getMoveRecommendations(player, fake, mapData, DB.MAPS),
    );
    assert.deepEqual(
        getExpeditionPreparation(player, null, mapData, DB.MAPS),
        getExpeditionPreparation(player, fake, mapData, DB.MAPS),
    );
});

test('H5(c): 화면은 가짜 stats 객체를 만들지 않고, 세 함수는 FullStats만 받는다', async () => {
    // getAdventureGuidance 계열 3개 호출부만 대상 — 다른 함수(getTownActionPresentation 등)의
    // 폴백은 이 사이클의 범위가 아니다.
    const control = await readSrc('src/components/ControlPanel.tsx');
    const navigator = await readSrc('src/components/MapNavigator.tsx');
    ['getAdventureGuidance', 'getMoveRecommendations', 'getExpeditionPreparation'].forEach((fn) => {
        [control, navigator].forEach((source) => {
            const at = source.indexOf(`${fn}(`);
            if (at === -1) return;
            const call = source.slice(at, at + 220);
            assert.doesNotMatch(call, /\{ maxHp: player\.maxHp/, `${fn} 호출에 가짜 stats 폴백`);
        });
    });
    assert.match(control, /getAdventureGuidance\(player, stats,/);
    assert.match(navigator, /getMoveRecommendations\(player, stats,/);

    const guide = await readSrc('src/utils/adventureGuide.ts');
    assert.doesNotMatch(guide, /stats: Partial<FullStats>/,
        '내부에서 이미 폴백하므로 Partial을 받을 이유가 없다');
    assert.equal((guide.match(/stats: FullStats \| null \| undefined/g) || []).length, 3);
});

// ─── (d) 퀘스트 / 업적 target 표기 통일 ───────────────────────────────────────

/** 몬스터 이름이 아닌 "시스템 진행도" target 전부. */
const SYSTEM_TARGETS = new Set([
    'level', 'kills', 'bossKills', 'explores', 'deaths', 'rests', 'crafts', 'synths',
    'bountiesCompleted', 'discoveries', 'discoveryChains', 'maxKillStreak', 'prestige',
    'relicCount', 'abyssRecord', 'demonKingSlain', 'escapes', 'lowHpWins', 'total_gold',
    'signaturesDiscovered', 'signatureSetsCompleted',
    // 빌드 프로파일 태그(build_victory)
    'arcane', 'crusher', 'dual', 'fortress',
]);

test('H5(d): 모든 퀘스트 / 업적 target이 알려진 집합에 속한다', () => {
    const unknown = [];
    [...QUESTS, ...ACHIEVEMENTS].forEach((entry) => {
        const target = entry.target;
        assert.equal(typeof target, 'string', `${entry.id} target은 문자열`);
        if (SYSTEM_TARGETS.has(target)) return;
        if (Object.prototype.hasOwnProperty.call(MONSTERS, target)) return;
        unknown.push(`${entry.id}:${target}`);
    });
    assert.deepEqual(unknown, [], '몬스터 이름도 시스템 키도 아닌 target');
});

test('H5(d): 레벨 목표는 퀘스트와 업적 모두 소문자 level 한 표기만 쓴다', () => {
    const casings = new Set(
        [...QUESTS, ...ACHIEVEMENTS]
            .map((entry) => entry.target)
            .filter((target) => typeof target === 'string' && target.toLowerCase() === 'level'),
    );
    assert.deepEqual([...casings], ['level'], "'Level' 표기는 남지 않는다");
    assert.ok(QUESTS.some((quest) => quest.target === 'level'), '레벨 목표 퀘스트가 존재한다');
    assert.ok(ACHIEVEMENTS.some((ach) => ach.target === 'level'), '레벨 목표 업적이 존재한다');
});

test('H5(d): 레벨 목표 퀘스트는 통일 이후에도 그대로 진행된다', () => {
    const levelQuest = QUESTS.find((quest) => quest.target === 'level');
    assert.ok(levelQuest, '레벨 목표 퀘스트 fixture');

    const player = { ...structuredClone(INITIAL_STATE.player), level: 3 };
    const accepted = createQuestProgressState(levelQuest, player);
    assert.equal(accepted.progress, 3, '수락 시점의 레벨이 초기 진행도가 된다');

    const grown = { ...player, level: levelQuest.goal, quests: [accepted] };
    const { updatedQuests } = syncQuestProgress(grown, '슬라임', QUESTS);
    assert.equal(updatedQuests[0].progress, levelQuest.goal, '레벨이 오르면 진행도가 따라 오른다');

    // 진행도는 내려가지 않는다(latch).
    const fallen = { ...grown, level: 1, quests: updatedQuests };
    assert.equal(syncQuestProgress(fallen, '슬라임', QUESTS).updatedQuests[0].progress, levelQuest.goal);
});
