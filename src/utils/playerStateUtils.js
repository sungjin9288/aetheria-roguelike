export const EMPTY_TEMP_BUFF = {
    atk: 0,
    def: 0,
    turn: 0,
    name: null,
};

export const DEFAULT_COMBAT_FLAGS = {
    comboCount: 0,
    deathSaveUsed: false,
    voidHeartUsed: false,
    voidHeartArmed: false,
};

export const hasTemporaryAdventureState = (player) => {
    const buff = { ...EMPTY_TEMP_BUFF, ...(player?.tempBuff || {}) };
    const combatFlags = { ...DEFAULT_COMBAT_FLAGS, ...(player?.combatFlags || {}) };

    return Boolean(
        buff.atk
        || buff.def
        || buff.turn > 0
        || buff.name
        || (Array.isArray(player?.status) && player.status.length > 0)
        || combatFlags.comboCount > 0
        || combatFlags.deathSaveUsed
        || combatFlags.voidHeartUsed
        || combatFlags.voidHeartArmed
        || player?.nextHitEvaded
    );
};

export const clearTemporaryAdventureState = (player) => ({
    ...player,
    tempBuff: { ...EMPTY_TEMP_BUFF },
    status: [],
    combatFlags: { ...DEFAULT_COMBAT_FLAGS },
    nextHitEvaded: false,
});
