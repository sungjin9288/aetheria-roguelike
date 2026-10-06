import type { HandlerMap } from '../gameReducer';

export const multiplayerActionMap = {
    // ── Skill Branch ──────────────────────────────────────────────────────
    CHOOSE_SKILL_BRANCH: (state, action) => {
        const { skillName, choice } = action.payload;
        if (state.player.skillChoices?.[skillName]) return state;
        return {
            ...state,
            player: {
                ...state.player,
                skillChoices: { ...(state.player.skillChoices || {}), [skillName]: choice },
            },
            syncStatus: 'syncing',
        };
    },

    // 2026-10 Wave 70: 공개 목록 침공(`INVADE_GRAVE`, 꺼져 있었다)은 다른 차원의 묘비 탐험 이벤트로 바뀌었다 —
    //   만난 기록은 탐험이, 유품은 망령 전투의 승리 정산(`applyDimensionGraveVictory`)이 소유한다.
} satisfies HandlerMap;
