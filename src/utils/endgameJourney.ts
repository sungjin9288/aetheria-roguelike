import { BALANCE } from '../data/constants';
import { MSG } from '../data/messages';
import { normalizeEndgameProgress } from './dataMigration';
import type { Player } from '../types/player';

// 마왕 토벌 뒤 연속 전투 경로의 표시 조건. 정산 authority와의 일치는 실행 계약이 검증한다.
const REQUIRED_PRESTIGE_RANK = 3;

export const getEndgameJourney = (player: Player) => {
    const endgame = normalizeEndgameProgress(player.meta?.endgame);
    const rank = Math.max(0, Number(player.meta?.prestigeRank) || 0);
    const prophecyStep = player.eventChainProgress?.ancient_prophecy;
    const revealed = endgame.trueEndingSeen || rank >= 1 || endgame.primalShards > 0
        || (player.stats?.demonKingSlain || 0) > 0
        || (typeof prophecyStep === 'number' && Number.isFinite(prophecyStep) && prophecyStep >= 2);
    if (!revealed) return null;

    const requiredShards = Math.max(1, Number(BALANCE.PRIMAL_SHARD_REQUIRED) || 3);
    const chance = Math.round(BALANCE.PRIMAL_SHARD_DROP_CHANCE * 100);
    const ready = rank >= REQUIRED_PRESTIGE_RANK && endgame.primalShards >= requiredShards;
    const action = endgame.trueEndingSeen ? MSG.ENDGAME_JOURNEY_COMPLETE
        : rank < 1 ? MSG.ENDGAME_JOURNEY_START
        : rank < REQUIRED_PRESTIGE_RANK
            ? endgame.primalShards >= requiredShards
                ? MSG.ENDGAME_JOURNEY_RANK_LEFT(REQUIRED_PRESTIGE_RANK)
                : MSG.ENDGAME_JOURNEY_GROW(REQUIRED_PRESTIGE_RANK, chance)
            : ready ? MSG.ENDGAME_JOURNEY_READY : MSG.ENDGAME_JOURNEY_COLLECT(chance);
    return { completed: endgame.trueEndingSeen, rank, requiredRank: REQUIRED_PRESTIGE_RANK, shards: endgame.primalShards, requiredShards, ready, action };
};
