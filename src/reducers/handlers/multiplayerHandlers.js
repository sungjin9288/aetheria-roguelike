export const multiplayerActionMap = {
    // ── Challenge Modifiers ───────────────────────────────────────────────
    SET_CHALLENGE_MODIFIERS: (state, action) => ({
        ...state,
        player: { ...state.player, challengeModifiers: action.payload || [] },
        syncStatus: 'syncing',
    }),

    // ── Skill Branch ──────────────────────────────────────────────────────
    CHOOSE_SKILL_BRANCH: (state, action) => {
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
    SET_PUBLIC_GRAVES: (state, action) =>
        ({ ...state, publicGraves: action.payload }),

    INVADE_GRAVE: (state, action) => {
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
            publicGraves: state.publicGraves.filter((g) => g.uid !== targetUid),
            syncStatus: 'syncing',
        };
    },
};
