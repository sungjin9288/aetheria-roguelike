import test from 'node:test';
import assert from 'node:assert/strict';

import { getTownActionPresentation } from '../src/utils/townActionPresentation.js';

const basePlayer = (overrides = {}) => ({
    job: '모험가',
    level: 1,
    hp: 180,
    maxHp: 180,
    mp: 60,
    maxMp: 60,
    gold: 200,
    inv: [
        { name: '하급 체력 물약', type: 'hp' },
        { name: '하급 체력 물약', type: 'hp' },
    ],
    quests: [],
    status: [],
    ...overrides,
});

const baseContext = (overrides = {}) => ({
    player: basePlayer(),
    stats: { maxHp: 180, maxMp: 60 },
    guidance: { primaryAction: { kind: 'open_move', label: '첫 출발' } },
    preparation: {
        tracker: null,
        isClaimable: false,
        canDepart: true,
        destination: '고요한 숲',
    },
    hasGrave: false,
    classes: {
        모험가: { next: ['전사'] },
        전사: { reqLv: 5 },
    },
    recipes: [{ id: 'r1', inputs: [{ name: '철광석', qty: 5 }], gold: 100 }],
    consumables: [{ name: '하급 체력 물약', price: 30 }],
    ...overrides,
});

test('첫 마을은 추천 출발 하나와 탐험·이동 보조 행동만 먼저 보여준다', () => {
    const result = getTownActionPresentation(baseContext());

    assert.equal(result.primary.kind, 'open_move');
    assert.equal(result.primary.label, '고요한 숲으로 첫 출발');
    assert.deepEqual(result.quickKeys, ['explore', 'move']);
    assert.deepEqual(result.facilityKeys, ['rest', 'quests', 'market', 'class', 'craft']);
});

test('첫 스토리 임무가 활성화되어도 첫 출발 문구를 유지한다', () => {
    const result = getTownActionPresentation(baseContext({
        guidance: { title: '첫 원정 준비', primaryAction: { kind: 'open_move', label: '첫 출발' } },
        preparation: {
            tracker: { questId: 80, title: '[스토리] 첫 번째 여정' },
            isClaimable: false,
            canDepart: true,
            destination: '고요한 숲',
        },
    }));

    assert.equal(result.primary.label, '고요한 숲으로 첫 출발');
    assert.deepEqual(result.quickKeys, ['explore', 'move']);
    assert.ok(result.facilityKeys.includes('quests'));
});

test('첫 탐험 전이라도 일반 임무가 활성화되어 있으면 게시판 접근을 유지한다', () => {
    const result = getTownActionPresentation(baseContext({
        guidance: { title: '첫 원정 준비', primaryAction: { kind: 'open_move', label: '첫 출발' } },
        preparation: {
            tracker: { questId: 110, title: '거미떼 퇴치' },
            isClaimable: false,
            canDepart: true,
            destination: '고요한 숲',
        },
    }));

    assert.equal(result.primary.label, '고요한 숲으로 출발');
    assert.deepEqual(result.quickKeys, ['quests', 'explore', 'move']);
});

test('진행 중인 임무가 없으면 게시판을 주 행동으로 올린다', () => {
    const result = getTownActionPresentation(baseContext({
        guidance: { primaryAction: { kind: 'open_quest_board', label: '게시판 열기' } },
    }));

    assert.equal(result.primary.kind, 'open_quest_board');
    assert.equal(result.primary.testId, 'control-quests');
    assert.ok(!result.facilityKeys.includes('quests'));
    assert.deepEqual(result.quickKeys, ['explore', 'move']);
});

test('체력이 낮은 진행 중 임무는 휴식을 주 행동으로 올리고 임무 접근을 남긴다', () => {
    const result = getTownActionPresentation(baseContext({
        player: basePlayer({ hp: 60, quests: [{ id: 1, progress: 1 }] }),
        guidance: { primaryAction: { kind: 'rest', label: '휴식' } },
        preparation: {
            tracker: { questId: 1, title: '슬라임 소탕' },
            isClaimable: false,
            canDepart: true,
            destination: '고요한 숲',
        },
    }));

    assert.equal(result.primary.kind, 'rest');
    assert.deepEqual(result.quickKeys, ['quests', 'explore', 'move']);
    assert.equal(result.facilityStatus.rest, '회복 가능');
});

test('레벨 조건을 충족한 전직은 다른 시설보다 먼저 드러난다', () => {
    const result = getTownActionPresentation(baseContext({
        player: basePlayer({ level: 5 }),
        guidance: { primaryAction: { kind: 'open_class', label: '전직 보기' } },
    }));

    assert.equal(result.primary.kind, 'open_class');
    assert.equal(result.primary.testId, 'control-class');
    assert.equal(result.facilityStatus.class, '전직 가능');
    assert.ok(!result.facilityKeys.includes('class'));
});

test('재료와 골드가 갖춰지면 제작을 보조 행동으로 끌어올린다', () => {
    const result = getTownActionPresentation(baseContext({
        player: basePlayer({
            inv: [
                { name: '철광석', type: 'mat' },
                { name: '철광석', type: 'mat' },
                { name: '철광석', type: 'mat' },
                { name: '철광석', type: 'mat' },
                { name: '철광석', type: 'mat' },
            ],
        }),
    }));

    assert.deepEqual(result.quickKeys, ['craft', 'explore', 'move']);
    assert.equal(result.facilityStatus.craft, '제작 가능');
    assert.ok(!result.facilityKeys.includes('craft'));
});

test('회복 소모품이 부족하면 상점을 보조 행동으로 끌어올린다', () => {
    const result = getTownActionPresentation(baseContext({
        player: basePlayer({
            inv: [{ name: '하급 체력 물약', type: 'hp' }],
        }),
    }));

    assert.deepEqual(result.quickKeys, ['market', 'explore', 'move']);
    assert.equal(result.facilityStatus.market, '보급 권장');
    assert.ok(!result.facilityKeys.includes('market'));
});

test('가방 정리 안내는 아카이브를 여는 주 행동으로 유지한다', () => {
    const result = getTownActionPresentation(baseContext({
        guidance: { primaryAction: { kind: 'open_inventory', label: '가방 열기' } },
    }));

    assert.equal(result.primary.kind, 'open_inventory');
    assert.equal(result.primary.testId, 'control-town-open-inventory');
    assert.equal(result.primary.label, '가방 정리하기');
});

test('완료 보상과 시체 회수는 각각 주 행동과 최우선 보조 행동을 차지한다', () => {
    const result = getTownActionPresentation(baseContext({
        guidance: { primaryAction: { kind: 'claim_quest', label: '보상 받기' } },
        preparation: {
            tracker: { questId: 1, title: '슬라임 소탕' },
            isClaimable: true,
            canDepart: true,
            destination: '고요한 숲',
        },
        hasGrave: true,
    }));

    assert.equal(result.primary.kind, 'claim_quest');
    assert.equal(result.primary.tone, 'reward');
    assert.deepEqual(result.quickKeys, ['grave', 'explore', 'move']);
});
