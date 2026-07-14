import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { getAdventureGuidance } from '../src/utils/adventureGuide.js';

/**
 * Slice 22: 첫 세션 온보딩 + 결정 CTA 한국어화
 *
 * 갭 진단:
 * - getAdventureGuidance가 전직/정비/디버프/인벤/임무 등 상황 힌트는 충실하나
 *   "완전 신규 플레이어"(탐험 0회 / 처치 0회) 분기가 없어, 첫 5분의
 *   이동→탐험→전투 시퀀스를 스스로 찾아야 했다.
 * - 퀘스트 보드의 결정 CTA(START OPERATION / ACCEPT MISSION / REQUEST DAILY
 *   BOUNTY)가 영문 — 헤더/라벨의 콘솔 무드는 정체성으로 보존하되, "행동을
 *   확정하는 버튼"은 한국어로 즉시 이해되어야 한다.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

const freshPlayer = (overrides = {}) => ({
    level: 1,
    hp: 178, maxHp: 178, mp: 52, maxMp: 52,
    gold: 200,
    job: '모험가',
    loc: '시작의 마을',
    inv: [],
    quests: [],
    status: [],
    stats: { kills: 0, explores: 0 },
    ...overrides,
});

const SAFE_MAP = { type: 'safe', level: 1 };
const FIELD_MAP = { type: 'dungeon', level: 1 };

test('slice 22: 신규 플레이어 — 마을에서 첫 출발 안내', () => {
    const guidance = getAdventureGuidance(freshPlayer(), { maxHp: 178, maxMp: 52 }, SAFE_MAP, 'idle');
    assert.equal(guidance.title, '첫 원정 준비');
    assert.equal(guidance.primaryAction?.kind, 'open_move');
});

test('slice 22: 신규 플레이어 — 필드에서 첫 교전 안내', () => {
    const player = freshPlayer({ loc: '고요한 숲' });
    const guidance = getAdventureGuidance(player, { maxHp: 178, maxMp: 52 }, FIELD_MAP, 'idle');
    assert.equal(guidance.title, '첫 교전');
    assert.equal(guidance.primaryAction?.kind, 'explore');
    assert.ok(/강타/.test(guidance.detail), '첫 스킬(강타) 사용법 언급');
});

test('slice 22: 첫 교전 분기는 처치 1회 후 종료 (기존 흐름 복귀)', () => {
    const player = freshPlayer({ loc: '고요한 숲', stats: { kills: 1, explores: 2 } });
    const guidance = getAdventureGuidance(player, { maxHp: 178, maxMp: 52 }, FIELD_MAP, 'idle');
    assert.notEqual(guidance.title, '첫 교전');
});

test('slice 22: 탐험 이력 있으면 첫 출발 분기 미발동 (기존 흐름 보존)', () => {
    const player = freshPlayer({ stats: { kills: 0, explores: 3 } });
    const guidance = getAdventureGuidance(player, { maxHp: 178, maxMp: 52 }, SAFE_MAP, 'idle');
    assert.notEqual(guidance.title, '첫 원정 준비');
});

test('slice 22: 보상 회수 가능 상태가 온보딩보다 우선', () => {
    const player = freshPlayer({
        quests: [{ id: 1, progress: 3 }],
    });
    const guidance = getAdventureGuidance(player, { maxHp: 178, maxMp: 52 }, SAFE_MAP, 'idle');
    // quests[0] id 1 = 슬라임 소탕 (goal 3) — 완료 상태면 보상 회수가 먼저.
    assert.equal(guidance.title, '보상 회수 가능');
});

test('slice 22: ControlPanel 가이드 스트립 — guidance 텍스트가 실제 렌더', async () => {
    const cp = await readSrc('src/components/ControlPanel.tsx');
    assert.ok(/data-testid="adventure-guidance-strip"/.test(cp),
        '가이드 스트립 testid 존재');
    assert.ok(/\{guidance\.title\}/.test(cp), 'guidance.title 렌더');
    assert.ok(/\{guidance\.detail\}/.test(cp), 'guidance.detail 렌더');
    assert.ok(/!questTracker && guidance\?\.title/.test(cp),
        '퀘스트 트래커 부재 시에만 노출 (이중 스트립 방지)');
});

test('slice 22: 퀘스트 보드 결정 CTA 한국어화', async () => {
    const qb = await readSrc('src/components/tabs/QuestBoardPanel.tsx');
    assert.ok(/임무 수락/.test(qb), 'ACCEPT MISSION → 임무 수락');
    assert.ok(/현상수배 발급/.test(qb), 'REQUEST DAILY BOUNTY → 현상수배 발급');
    assert.ok(!/START OPERATION|ACCEPT MISSION|REQUEST DAILY BOUNTY/.test(qb),
        '영문 결정 CTA 잔존 0건');
});
