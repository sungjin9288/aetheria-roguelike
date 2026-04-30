/**
 * player.stats 필드를 immutable하게 업데이트합니다.
 * @param {Object} player
 * @param {Object} statsUpdate - 덮어쓸 stats 필드들
 * @returns {Object} 새 player 객체
 */
export const updateStats = (player, statsUpdate) => ({
    ...player,
    stats: { ...(player.stats || {}), ...statsUpdate },
});

/**
 * player.stats의 숫자 필드에 값을 누적합니다. 필드가 없으면 0에서 시작합니다.
 * @param {Object} player
 * @param {string} field - stats 하위 필드명
 * @param {number} amount - 누적할 값 (기본 1)
 * @returns {Object} 새 player 객체
 */
export const incrementStat = (player, field, amount = 1) =>
    updateStats(player, { [field]: (player.stats?.[field] || 0) + amount });

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
