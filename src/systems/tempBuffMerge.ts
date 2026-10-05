import { MSG } from '../data/messages';
import type { Player } from '../types/index.js';

/**
 * 강화 칸(`tempBuff`) 합치기 — Wave 62 C6, 소유자 결정 "버프는 더 센 쪽 유지".
 *
 * 강화 칸은 하나다. 물약 · 모닥불 단련 · 밀어붙인다 · 이야기 전투 보너스 · 한정 조우 · 사건 강화 · 전쟁의 북이 모두 이
 * 칸을 덮어써, 나중에 들어온 약한 강화가 더 센 강화를 지웠다(+50% · 3턴 기술 강화 위에 수호의 물약 → 공격력 345 → 235,
 * 전투 전에 마신 물약을 전쟁의 북이 전투 시작에 덮음). 이 모듈이 그 규칙 하나를 소유한다 — 모든 비기술 경로가 이것을 읽는다.
 *
 * 세기(potency) = (공격 증가 + 방어 증가 + 반격 확률) × 남은 턴. 턴이 0 이하면 꺼진 강화(세기 0)다.
 *   - 들어온 강화의 세기가 더 크면 들어온 강화가 칸을 갖는다.
 *   - 세기가 같으면 한 턴의 증가량(공격 + 방어 + 반격)이 더 큰 쪽이 갖는다(+50% · 3턴이 +30% · 5턴을 이긴다).
 *   - 그것도 같으면 지금 강화를 둔다 — 같은 강화로 바꿔 봐야 얻는 것이 없고, 물약은 쓰지 않는다.
 * 유지되는 쪽은 객체째 남는다 — 이름 · 반격 확률 같은 부가 필드가 함께 간다(지금 강화가 남으면 같은 참조라
 * `tickAfterAction`의 "이번 행동이 건 강화" 판정도 그대로다).
 *
 * 전투 기술이 거는 강화(`CombatEngine.actions.ts`, Wave 52 · 53)는 이 규칙 밖이다 — 기술은 고르는 순간의 결정이다.
 * 다만 기술 강화가 걸린 동안 들어오는 물약 · 보너스는 이 규칙을 따른다.
 */

export type TempBuffValue = NonNullable<Player['tempBuff']>;

/** 부동소수 비교 여유 — 0.3 × 5와 0.5 × 3 같은 같은 세기를 같게 본다. */
const POTENCY_EPSILON = 1e-9;

const finiteOrZero = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

const activeTurns = (buff: TempBuffValue | null | undefined): number => Math.max(0, finiteOrZero(buff?.turn));

/** 한 턴의 증가량 = 공격 + 방어 + 반격 확률. */
export const getTempBuffMagnitude = (buff: TempBuffValue | null | undefined): number => (
    finiteOrZero(buff?.atk) + finiteOrZero(buff?.def) + finiteOrZero(buff?.counterChance)
);

/** 강화의 세기 = 한 턴의 증가량 × 남은 턴. 꺼진 강화는 0. */
export const getTempBuffPotency = (buff: TempBuffValue | null | undefined): number => {
    const turns = activeTurns(buff);
    return turns > 0 ? getTempBuffMagnitude(buff) * turns : 0;
};

export type TempBuffMergeResult =
    | { kept: 'incoming'; tempBuff: TempBuffValue }
    | { kept: 'current'; tempBuff: TempBuffValue | undefined };

/** 들어온 강화가 칸을 가져가는지 — 위 규칙 그대로. */
const incomingWins = (current: TempBuffValue | null | undefined, incoming: TempBuffValue): boolean => {
    const incomingPotency = getTempBuffPotency(incoming);
    if (incomingPotency <= 0) return false;
    const currentPotency = getTempBuffPotency(current);
    if (incomingPotency > currentPotency + POTENCY_EPSILON) return true;
    if (incomingPotency < currentPotency - POTENCY_EPSILON) return false;
    return getTempBuffMagnitude(incoming) > getTempBuffMagnitude(current) + POTENCY_EPSILON;
};

/** 강화 칸 합치기 — 더 센 쪽을 남긴다. 순수 함수. */
export const mergeTempBuff = (
    current: TempBuffValue | null | undefined,
    incoming: TempBuffValue,
): TempBuffMergeResult => (
    incomingWins(current, incoming)
        ? { kept: 'incoming', tempBuff: incoming }
        : { kept: 'current', tempBuff: current ?? undefined }
);

/**
 * 플레이어에 강화를 건다 — 규칙을 거친 새 player와, 들어온 강화가 밀렸을 때의 안내 문구(MSG)를 돌려준다.
 * @param incomingLabel 밀렸을 때 안내에 쓸 들어온 강화의 이름(물약 이름 · 모닥불 단련 · 전쟁의 북 …)
 */
export const applyTempBuffRule = (
    player: Player,
    incoming: TempBuffValue,
    incomingLabel: string,
): { player: Player; applied: boolean; notice: string | null } => {
    const merged = mergeTempBuff(player.tempBuff, incoming);
    if (merged.kept === 'incoming') {
        return { player: { ...player, tempBuff: merged.tempBuff }, applied: true, notice: null };
    }
    return { player, applied: false, notice: formatTempBuffKeptNotice(player.tempBuff, incomingLabel) };
};

/** 밀린 강화 안내 — 남은 강화의 수치(백분율 · 턴)로 말한다. */
export const formatTempBuffKeptNotice = (kept: TempBuffValue | null | undefined, incomingLabel: string): string => (
    MSG.TEMP_BUFF_KEPT_STRONGER(incomingLabel, {
        atk: Math.round(finiteOrZero(kept?.atk) * 100),
        def: Math.round(finiteOrZero(kept?.def) * 100),
        counter: Math.round(finiteOrZero(kept?.counterChance) * 100),
        turns: activeTurns(kept),
    })
);
