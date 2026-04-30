export const multiplayerActionMap = {
    // ── Challenge Modifiers ───────────────────────────────────────────────
    SET_CHALLENGE_MODIFIERS: (state: any, action: any) => ({
        ...state,
        player: { ...state.player, challengeModifiers: action.payload || [] },
        syncStatus: 'syncing',
    }),

    // ── Skill Branch ──────────────────────────────────────────────────────
    CHOOSE_SKILL_BRANCH: (state: any, action: any) => {
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
    SET_PUBLIC_GRAVES: (state: any, action: any) =>
        ({ ...state, publicGraves: action.payload }),

    INVADE_GRAVE: (state: any, action: any) => {
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
