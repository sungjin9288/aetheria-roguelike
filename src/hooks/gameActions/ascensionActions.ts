import { AT } from '../../reducers/actionTypes';
import { GS } from '../../reducers/gameStates';
import { MSG } from '../../data/messages';
import { getAscensionOutcome } from '../../utils/ascensionPreview';
import { getClaimableQuestEntries } from '../../utils/questProgress';
import type { GameActionDeps } from '../actionDeps';

// cycle 315: _shared?: any 미사용 2번째 파라미터 제거 — ascensionActions에서 shared 헬퍼 사용 0건.
//   useGameActions에서 createAscensionActions(deps, shared) 호출하지만 extra arg는 무시되어 동작 동일.
export const createAscensionActions = (deps: GameActionDeps) => {
    const { player, gameState, dispatch, addLog } = deps;
    let ascensionRequestInFlight = false;
    return {
        /** 2026-10 Wave 58: 계승 화면에서 고른 새 여정의 도전 조건과 첫 유물 선택지 씨앗을 함께 보낸다(리듀서가 다시 거른다). */
        confirmAscension: (challengeModifiers?: string[]) => {
            if ((gameState === GS.ASCENSION || gameState === GS.TRUE_ENDING) && getClaimableQuestEntries(player).length > 0) return;
            if (ascensionRequestInFlight) return;
            ascensionRequestInFlight = true;
            const outcome = getAscensionOutcome(player.meta);
            dispatch({
                type: AT.ASCEND,
                payload: {
                    expectedPrestigeRank: outcome.currentRank,
                    sourceReceiptKey: player.meta?.endgame?.lastEndgameReceiptKey ?? null,
                    challengeModifiers: Array.isArray(challengeModifiers) ? challengeModifiers : [],
                    seed: Math.floor(Math.random() * 2 ** 31),
                },
            });
        },

        cancelAscension: () => {
            // 2026-09 Wave 28 (D6): 계승 화면의 "미루기"는 이번 런 동안 다시 묻지 않는 결정이다 — 리듀서가 소유한다.
            //   진엔딩 화면의 취소는 계승 제안이 아니므로 이전 동작 그대로다.
            if (gameState === GS.ASCENSION) {
                dispatch({ type: AT.DEFER_ASCENSION });
                return;
            }
            dispatch({ type: AT.SET_GAME_STATE, payload: GS.IDLE });
            addLog('info', MSG.ASCEND_CANCEL);
        },

        /** 미룬 계승 화면을 다시 연다. 허용 여부(이번 런에 미뤘는가 · idle인가)는 리듀서가 판정한다. */
        reopenAscension: () => {
            dispatch({ type: AT.REOPEN_ASCENSION });
        },
    };
};
