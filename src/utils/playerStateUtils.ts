import type { Player } from '../types/index.js';
/**
 * player.stats 필드를 immutable하게 업데이트합니다.
 * @param {Object} player
 * @param {Object} statsUpdate - 덮어쓸 stats 필드들
 * @returns {Object} 새 player 객체
 */
// cycle 291: export 제거 — incrementStat 내부 사용만 (외부 consumer 0건).
const updateStats = (player: Player, statsUpdate: any): Player => ({
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
export const incrementStat = (player: Player, field: string, amount: number = 1): Player =>
    updateStats(player, { [field]: ((player.stats as any)?.[field] || 0) + amount });

export const EMPTY_TEMP_BUFF: any = {
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

export const hasTemporaryAdventureState = (player: Player) => {
    const buff = { ...EMPTY_TEMP_BUFF, ...(player?.tempBuff || {}) };
    const combatFlags = { ...DEFAULT_COMBAT_FLAGS, ...(player?.combatFlags || {}) };

    // cycle 198: voidHeartUsed / voidHeartArmed는 cycle 187에서 run-wide로 preserve되도록 변경됨
    //   ('런당 1회' spec). hasTemporaryAdventureState가 이들을 'temporary'로 카운트하면
    //   안전 맵 이동마다 clearTemporaryAdventureState가 무한 재호출되는 회귀가 발생.
    //   clear가 보존하는 플래그는 이 함수에서도 'temporary' 아님으로 간주.
    return Boolean(
        buff.atk
        || buff.def
        || buff.turn > 0
        || buff.name
        || (Array.isArray(player?.status) && player.status.length > 0)
        || combatFlags.comboCount > 0
        || combatFlags.deathSaveUsed
        || player?.nextHitEvaded
    );
};

/**
 * cycle 187: 안전 지대 이동 시 일시 상태 초기화. void_heart 같은 run-wide 플래그는 보존.
 *   기존엔 모든 combatFlags를 false로 reset해 voidHeartUsed가 풀려 안전 맵 이동만으로
 *   death save를 매번 리프레시 가능하던 회귀 fix. desc 'void_heart: 런당 1회'와 정합.
 */
export const clearTemporaryAdventureState = (player: Player) => ({
    ...player,
    tempBuff: { ...EMPTY_TEMP_BUFF },
    status: [],
    combatFlags: {
        ...DEFAULT_COMBAT_FLAGS,
        // run-wide 플래그 보존 (void_heart desc: '런당 1회'). applyBattleStartRelics와 정합.
        voidHeartUsed: Boolean(player?.combatFlags?.voidHeartUsed),
        voidHeartArmed: Boolean(player?.combatFlags?.voidHeartArmed),
    },
    nextHitEvaded: false,
});
