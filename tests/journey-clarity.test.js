import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { INITIAL_STATE } from '../src/reducers/gameReducer.ts';
import { getEndgameJourney } from '../src/utils/endgameJourney.ts';
import { resolveEndgameVictory } from '../src/systems/endgameSettlement.ts';
import { pickPermanentPlayerState } from '../src/utils/permanentProgress.ts';
import { EVENT_CHAINS } from '../src/data/eventChains.ts';
import { getBossBrief } from '../src/data/monsters.ts';
import EndgameJourney from '../src/components/EndgameJourney.tsx';
import TerminalView from '../src/components/TerminalView.tsx';
import { renderStatic } from './helpers/render.ts';

const playerAt = (rank = 0, shards = 0) => {
    const player = structuredClone(INITIAL_STATE.player);
    return { ...player, name: '여정 검증', meta: { ...player.meta, prestigeRank: rank, endgame: { primalShards: shards, trueEndingSeen: false } } };
};
const demonKing = { name: '마왕', baseName: '마왕', isBoss: true, hp: 0, maxHp: 1 };

// 2026-10 Wave 103 (소유자 결정 §107.6 "진 엔딩 조건 숨김, 첫 단서 뒤에만"): 봉인 칸은 첫 원시의 파편(또는 진엔딩) 뒤에만 보이고,
//   보여도 열리는 조건(계승 단계 · 파편 확률)을 말하지 않는다. 계승 · 마왕 처치 · 예언 단계만으로는 열리지 않는다.
test('마왕성 봉인은 첫 파편 전에는 숨기고 계승 · 마왕 처치 · 예언만으로는 열지 않는다', () => {
    const hidden = [
        playerAt(), playerAt(1), playerAt(3), playerAt(5),
        { ...playerAt(), stats: { demonKingSlain: 1 } },
        { ...playerAt(), eventChainProgress: { ancient_prophecy: 2 } },
    ];
    for (const value of [undefined, 0, 1, 'failed', { collected: true }, NaN]) {
        hidden.push({ ...playerAt(), eventChainProgress: { ancient_prophecy: value } });
    }
    for (const player of hidden) {
        assert.equal(getEndgameJourney(player), null);
        assert.equal(renderStatic(createElement(EndgameJourney, { player })), '');
    }
    for (const player of [playerAt(0, 1), playerAt(2, 3), { ...playerAt(), meta: { ...playerAt().meta, endgame: { primalShards: 0, trueEndingSeen: true } } }]) {
        assert.ok(getEndgameJourney(player));
    }
});

test('보이는 봉인 칸은 실제 마왕 정산과 같은 준비 판정을 쓰되 계승 단계 · 확률을 말하지 않는다', () => {
    for (const rank of [0, 1, 2, 3, 4]) {
        for (const shards of [1, 2, 3]) {
            const player = playerAt(rank, shards);
            const before = structuredClone(player);
            const view = getEndgameJourney(player);
            const result = resolveEndgameVictory({ player, deadEnemy: demonKing, receiptKey: `preview:${rank}:${shards}`, rng: () => 1, now: 1000 });
            assert.equal(view.ready, result.outcome === 'true_boss');
            assert.equal('rank' in view, false, '계승 단계를 뷰에 싣지 않는다');
            assert.doesNotMatch(view.action, /계승 \d|\d+%/, '열리는 조건(계승 단계 · 확률)을 말하지 않는다');
            assert.deepEqual(player, before, '표시는 상태를 변경하지 않는다');
            const html = renderStatic(createElement(EndgameJourney, { player }));
            assert.doesNotMatch(html, /계승 \d+단계|필요 \d|\d+% 확률/);
            assert.match(html, new RegExp(`원시의 파편 ${shards}/`));
        }
    }
    // 준비 완료 경고는 조건이 아니라 곧 일어날 일이라 그대로 — 다음 토벌에서 연속 전투가 시작된다.
    assert.match(getEndgameJourney(playerAt(3, 3)).action, /다음 마왕 토벌 직후/);
    assert.equal(getEndgameJourney(playerAt(2, 3)).action, getEndgameJourney(playerAt(1, 3)).action);
});

test('완주 기록은 진입 경로와 무관하게 우선 표시하고 파편 진행은 계승 뒤 보존한다', () => {
    const player = playerAt(0);
    const won = resolveEndgameVictory({ player, deadEnemy: { ...demonKing, name: '원시의 신', baseName: '원시의 신' }, receiptKey: 'abyss:boss:1', rng: () => 1, now: 1000 });
    const html = renderStatic(createElement(EndgameJourney, { player: won.player }));
    assert.match(html, /종장 기록/);
    assert.match(html, /진 엔딩을 확인했습니다/);
    assert.ok(!html.includes('0/3'));
    assert.ok(!html.includes('봉인을 열었습니다'));
    const collecting = playerAt(2, 2);
    const carried = { ...INITIAL_STATE.player, ...pickPermanentPlayerState(collecting, INITIAL_STATE.player) };
    assert.equal(getEndgameJourney(carried).shards, 2);
});

test('첫 출발 문구는 미탐험 첫 임무에만 보이고 예언과 도감은 실제 진입 경로를 구분한다', () => {
    const fresh = { ...playerAt(), loc: '시작의 마을', quests: [{ id: 80, progress: 0 }] };
    const render = (player) => renderStatic(createElement(TerminalView, { player, logs: [], gameState: 'idle' }));
    assert.match(render(fresh), /마법전쟁이 끝난 뒤에도 고요한 숲/);
    for (const player of [{ ...fresh, loc: '고요한 숲' }, { ...fresh, quests: [{ id: 80, progress: 1 }] }, { ...fresh, stats: { claimedQuestIds: [80] } }, { ...fresh, meta: { prestigeRank: 1 } }]) {
        assert.ok(!render(player).includes('first-journey-context'));
    }
    const prophecy = EVENT_CHAINS.find((chain) => chain.id === 'ancient_prophecy').steps[1].event.desc;
    assert.match(prophecy, /계승 3단계/);
    assert.ok(!prophecy.includes('세 번'));
    // 소유자 결정 D32(2026-10-26): 보스 브리핑의 진입 추천 문구(entryHint)는 어느 화면도 그리지 않아 지웠다.
    assert.equal('entryHint' in getBossBrief('원시의 신'), false);
    assert.ok(!Object.values(getBossBrief('원시의 신')).flat().some((text) => String(text).includes('모아야만')));
});
