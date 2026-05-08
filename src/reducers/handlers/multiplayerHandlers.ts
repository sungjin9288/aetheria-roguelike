import type { GameState, GameAction } from '../gameReducer';

export const multiplayerActionMap = {
    // ── Skill Branch ──────────────────────────────────────────────────────
    CHOOSE_SKILL_BRANCH: (state: GameState, action: GameAction) => {
        const { skillName, choice } = action.payload;
        return {
            ...state,
            player: {
                ...state.player,
                skillChoices: { ...(state.player.skillChoices || {}), [skillName]: choice },
            },
            syncStatus: 'syncing',
        };
    },

    // ── Grave PvP ─────────────────────────────────────────────────────────
    // cycle 305: publicGraves filter 제거 — state.publicGraves dead (항상 []),
    //   filter no-op. targetUid 인자도 현재 dispatch에서 미사용.
    INVADE_GRAVE: (state: GameState, action: GameAction) => {
        const { reward } = action.payload;
        const today = new Date().toDateString();
        const lastInvadeDate = state.player.stats?.lastInvadeDate;
        const currentCount = lastInvadeDate === today ? (state.player.stats?.dailyInvadeCount || 0) : 0;
        const nextInv = reward
            ? [...(state.player.inv || []), reward]
            : state.player.inv;
        return {
            ...state,
            player: {
                ...state.player,
                inv: nextInv,
                stats: {
                    ...(state.player.stats || {}),
                    dailyInvadeCount: currentCount + 1,
                    lastInvadeDate: today,
                },
            },
            syncStatus: 'syncing',
        };
    },
};
