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

test('마왕성 진행은 발견 전에는 숨기고 실제 예언 단계와 영구 기록으로 공개한다', () => {
    for (const value of [undefined, 0, 1, 'failed', { collected: true }, NaN]) {
        const player = { ...playerAt(), eventChainProgress: { ancient_prophecy: value } };
        assert.equal(getEndgameJourney(player), null);
        assert.equal(renderStatic(createElement(EndgameJourney, { player })), '');
    }
    for (const player of [playerAt(1), playerAt(0, 1), { ...playerAt(), stats: { demonKingSlain: 1 } }, { ...playerAt(), eventChainProgress: { ancient_prophecy: 2 } }]) {
        assert.ok(getEndgameJourney(player));
    }
});

test('현재 계승과 파편의 다음 행동은 실제 마왕 정산과 일치하고 마지막 획득도 안내한다', () => {
    for (const rank of [1, 2, 3, 4]) {
        for (const shards of [0, 2, 3]) {
            const player = playerAt(rank, shards);
            const before = structuredClone(player);
            const view = getEndgameJourney(player);
            const result = resolveEndgameVictory({ player, deadEnemy: demonKing, receiptKey: `preview:${rank}:${shards}`, rng: () => 1, now: 1000 });
            assert.equal(view.ready, result.outcome === 'true_boss');
            assert.equal(view.rank, rank, '다음 계승 단계를 현재 단계로 쓰지 않는다');
            assert.deepEqual(player, before, '표시는 상태를 변경하지 않는다');
        }
    }
    const player = playerAt(3, 2);
    assert.match(getEndgameJourney(player).action, /마지막 파편.*곧바로 다음 전투/);
    const won = resolveEndgameVictory({ player, deadEnemy: demonKing, receiptKey: 'last:shard:1', rng: () => 0, now: 1000 });
    assert.equal(won.outcome, 'true_boss');
    assert.equal(won.player.meta.endgame.primalShards, 0);
    assert.match(getEndgameJourney(playerAt(2, 3)).action, /계승 3단계에 도달/);
    assert.match(getEndgameJourney(playerAt(2, 2)).action, /50%/);
});

test('완주 기록은 진입 경로와 무관하게 우선 표시하고 파편 진행은 계승 뒤 보존한다', () => {
    const player = playerAt(0);
    const won = resolveEndgameVictory({ player, deadEnemy: { ...demonKing, name: '원시의 신', baseName: '원시의 신' }, receiptKey: 'abyss:boss:1', rng: () => 1, now: 1000 });
    const html = renderStatic(createElement(EndgameJourney, { player: won.player }));
    assert.match(html, /종장 기록/);
    assert.match(html, /진엔딩을 확인했습니다/);
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
    assert.match(getBossBrief('원시의 신').entryHint, /혼돈의 심연/);
    assert.ok(!getBossBrief('원시의 신').entryHint.includes('모아야만'));
});
