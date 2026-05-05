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
    INVADE_GRAVE: (state: GameState, action: GameAction) => {
        const { reward, uid: targetUid } = action.payload;
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
            publicGraves: state.publicGraves.filter((g: any) => g.uid !== targetUid),
            syncStatus: 'syncing',
        };
    },
};
