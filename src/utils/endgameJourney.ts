import { BALANCE } from '../data/constants';
import { MSG } from '../data/messages';
import { normalizeEndgameProgress } from './dataMigration';
import type { Player } from '../types/player';

// 마왕 토벌 뒤 연속 전투 경로의 표시 조건. 정산 authority와의 일치는 실행 계약이 검증한다.
const REQUIRED_PRESTIGE_RANK = 3;

/**
 * 2026-10 Wave 103 (소유자 결정 §107.6 "조건 숨김, 첫 단서 뒤에만"): 봉인 칸은 첫 원시의 파편을 얻은 뒤(또는 진엔딩을 본 뒤)에만 보인다.
 * 보여도 열리는 조건(계승 단계 · 파편 확률)은 말하지 않는다 — 파편 수와 단서 문구만. 다음 토벌에서 곧바로 연속 전투가 시작되는
 * 준비 완료 경고는 그대로다(조건이 아니라 곧 일어날 일이다). 정산 규칙(`endgameSettlement`)은 그대로다.
 */
export const getEndgameJourney = (player: Player) => {
    const endgame = normalizeEndgameProgress(player.meta?.endgame);
    const rank = Math.max(0, Number(player.meta?.prestigeRank) || 0);
    const revealed = endgame.trueEndingSeen || endgame.primalShards > 0;
    if (!revealed) return null;

    const requiredShards = Math.max(1, Number(BALANCE.PRIMAL_SHARD_REQUIRED) || 3);
    const ready = rank >= REQUIRED_PRESTIGE_RANK && endgame.primalShards >= requiredShards;
    const action = endgame.trueEndingSeen ? MSG.ENDGAME_JOURNEY_COMPLETE
        : ready ? MSG.ENDGAME_JOURNEY_READY
            : endgame.primalShards >= requiredShards ? MSG.ENDGAME_JOURNEY_CLUE_WAIT
                : MSG.ENDGAME_JOURNEY_CLUE_COLLECT;
    return { completed: endgame.trueEndingSeen, shards: endgame.primalShards, requiredShards, ready, action };
};
