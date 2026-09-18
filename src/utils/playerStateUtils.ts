import type { Player } from '../types/index.js';
import { clearAdventureRelicBonuses } from './adventureRelicBonuses.js';
/**
 * player.stats 필드를 immutable하게 업데이트합니다.
 * @param {Object} player
 * @param {Object} statsUpdate - 덮어쓸 stats 필드들
 * @returns {Object} 새 player 객체
 */
// cycle 291: export 제거 — incrementStat 내부 사용만 (외부 consumer 0건).
// `PlayerStats`는 private(cycle 299, tests/cycle-300-399.test.js가 export 0건을 고정)이라
// 여기서 import할 수 없다 — incrementStat이 실제로 넘기는 모양(동적 키 → 숫자 누적값)
// 그대로 `Record<string, number>`로 좁힌다.
const updateStats = (player: Player, statsUpdate: Record<string, number>): Player => ({
    ...player,
    stats: { ...(player.stats || {}), ...statsUpdate },
});

/**
 * player.stats의 숫자 필드에 1만큼 누적합니다. 필드가 없으면 0에서 시작.
 * @param {Object} player
 * @param {string} field - stats 하위 필드명
 * @returns {Object} 새 player 객체
 *
 * cycle 502: 누적량 파라미터 제거 — 3 callsite (useInventoryActions) 모두 2 args
 *   호출. default 1 도달 불가 → 정적 + 1 inline.
 */
// player.stats는 알려진 필드만 선언된 닫힌 인터페이스라 임의 문자열 키로 인덱싱할 수 없다 —
// 이 함수의 계약 자체가 "임의 stats 필드를 이름으로 누적"이라 여기서만 느슨한 레코드로
// 좁혀 읽는다(대상은 항상 숫자 카운터 필드).
export const incrementStat = (player: Player, field: string): Player =>
    updateStats(player, { [field]: (Number((player.stats as Record<string, unknown> | undefined)?.[field]) || 0) + 1 });

// cycle 317: export 제거 — playerStateUtils 내부 2회 사용만, 외부 consumer 0건.
const EMPTY_TEMP_BUFF = {
    atk: 0,
    def: 0,
    turn: 0,
    name: null,
};

// cycle 391: export 제거 — playerStateUtils 내부 2회 사용만, 외부 consumer 0건.
//   CombatEngine.DEFAULT_COMBAT_FLAGS는 별개 property (객체 멤버), 무관.
const DEFAULT_COMBAT_FLAGS = {
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
        || player?.adventureRelicBonuses
        || player?.deferredEventChainSteps
    );
};

/**
 * cycle 187: 안전 지대 이동 시 일시 상태 초기화. void_heart 같은 run-wide 플래그는 보존.
 *   기존엔 모든 combatFlags를 false로 reset해 voidHeartUsed가 풀려 안전 맵 이동만으로
 *   death save를 매번 리프레시 가능하던 회귀 fix. desc 'void_heart: 런당 1회'와 정합.
 */
export const clearTemporaryAdventureState = (player: Player) => ({
    ...clearAdventureRelicBonuses(player),
    deferredEventChainSteps: undefined,
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
