import { BALANCE } from '../data/constants.js';
import { MSG } from '../data/messages.js';
import { getMirrorEffects } from './mirrorUpgrades';
import type { Player, Relic, Monster, RelicSynergy } from '../types/index.js';
import type { LootLog } from './CombatEngine.loot.js';

/**
 * 이 mixin의 메서드가 `this`로 교차호출하는 CombatEngine 멤버.
 * CombatEngine 전체 타입을 쓰면 CombatEngine.ts → relicEffectMethods → CombatEngine.ts
 * 순환 참조가 생긴다 — 실제로 호출하는 2개만 최소 인터페이스로 선언한다(호출 시점 바인딩).
 */
interface RelicEffectMixinContext {
    getEffectiveMaxMp(player: Player, relics: Relic[]): number;
    getCombatFlags(player: Player): NonNullable<Player['combatFlags']>;
}

/** 이 mixin이 CombatEngine에 spread하는 메서드 시그니처. */
interface RelicEffectMixin {
    applyCritMpRestore(player: Player, relics: Relic[], logs: LootLog[]): Player;
    applyFatalProtection(
        player: Player,
        relics: Relic[],
        incomingDamage: number,
        logs: LootLog[],
        activeSynergies?: RelicSynergy[],
    ): { updatedPlayer: Player; isDead: boolean };
    applyEntropyTick(
        player: Player,
        enemy: Monster,
        activeSynergies: RelicSynergy[],
    ): { player: Player; enemy: Monster; logs: LootLog[] };
}

/**
 * CombatEngine 유물 효과 메서드 — mixin으로 CombatEngine에 spread.
 * CombatEngine.ts 분리(행동 보존). this.getCombatFlags/getEffectiveMaxMp 교차호출은
 * 호출 시점 바인딩이라 `ThisType`으로 그 경계만 명시한다. activeSynergies는 파라미터(주입).
 */
export const relicEffectMethods: RelicEffectMixin & ThisType<RelicEffectMixinContext> = {
    applyCritMpRestore(player, relics, logs) {
        const critMpRelic = relics.find((relic) => relic.effect === 'crit_mp_regen');
        if (!critMpRelic) return player;

        const nextMp = Math.min(this.getEffectiveMaxMp(player, relics), (player.mp || 0) + critMpRelic.val);
        if (nextMp > (player.mp || 0)) {
            logs.push({ type: 'event', text: MSG.RELIC_CRIT_MP_RESTORE(nextMp - (player.mp || 0)) });
        }
        return { ...player, mp: nextMp };
    },

    // cycle 553: 3 defaults partial cleanup — relics/incomingDamage/logs는
    //   모든 caller (combatAttack/internal/9 tests) 명시 전달이라 unreachable.
    //   activeSynergies는 combatAttack:189 4-arg caller가 미전달이라 default
    //   reachable 보존. partial cleanup pattern (cycle 542). systems/CombatEngine
    //   method 시리즈 7번째.
    applyFatalProtection(player, relics, incomingDamage, logs, activeSynergies = []) {
        const flags = this.getCombatFlags(player);
        let nextHp = Math.max(0, (player.hp || 0) - Math.max(0, incomingDamage));
        // cycle 162: phoenix_revive atkBuff tempBuff — 부활 분기에서 set, return에 합류.
        let phoenixTempBuff: Player['tempBuff'] | null = null;

        if (nextHp <= 0) {
            const deathSaveRelic = relics.find((relic) => relic.effect === 'death_save');
            // cycle 153: 시너지 'absolute_immortal' — reviveCount 2회 부활. effect-name primary + bonus-key fallback.
            const absoluteImmortalSyn = activeSynergies.find((s) =>
                s.bonus.effect === 'absolute_immortal' || s.bonus.reviveCount);
            const maxRevives = absoluteImmortalSyn ? (absoluteImmortalSyn.bonus.reviveCount || 1) : 1;
            const reviveUsedCount = flags.deathSaveUsedCount || 0;

            if (deathSaveRelic && reviveUsedCount < maxRevives) {
                // cycle 153: 시너지 'absolute_immortal' / 'immortal_warrior' / 'blood_immortal' — reviveHeal 부활 시 HP 회복량 증가.
                const reviveHealSyn = activeSynergies.find((s) =>
                    s.bonus.effect === 'absolute_immortal'
                    || s.bonus.effect === 'immortal_warrior'
                    || s.bonus.effect === 'blood_immortal'
                    || s.bonus.reviveHeal);
                // Number() — RelicSynergyBonus.reviveHeal은 optional(number | undefined)이라
                //   산술 연산엔 number가 필요하다. reviveHealSyn이 매칭된 이상 실측 데이터상
                //   reviveHeal이 항상 존재하므로 값 변화 없음(Number(number)=그대로).
                nextHp = reviveHealSyn
                    ? Math.floor((player.maxHp || BALANCE.DEFAULT_MAX_HP) * Number(reviveHealSyn.bonus.reviveHeal))
                    : 1;
                flags.deathSaveUsed = true;
                flags.deathSaveUsedCount = reviveUsedCount + 1;
                // cycle 153: 시너지 'unbreakable' — healOnSave 부활 시 추가 HP 회복.
                const healOnSaveSyn = activeSynergies.find((s) =>
                    s.bonus.effect === 'unbreakable' || s.bonus.healOnSave);
                if (healOnSaveSyn) {
                    const bonus = Math.floor((player.maxHp || BALANCE.DEFAULT_MAX_HP) * Number(healOnSaveSyn.bonus.healOnSave));
                    nextHp = Math.min(player.maxHp || BALANCE.DEFAULT_MAX_HP, nextHp + bonus);
                    logs.push({ type: 'heal', text: MSG.RELIC_HEAL_ON_SAVE_PROC(bonus) });
                }
                const reviveMsg = reviveUsedCount > 0 ? MSG.RELIC_DEATH_SAVE_REVIVE(reviveUsedCount + 1) : MSG.RELIC_DEATH_SAVE_FIRST;
                logs.push({ type: 'event', text: reviveMsg });
            } else {
                const voidHeartRelic = relics.find((relic) => relic.effect === 'void_heart');
                if (voidHeartRelic && !flags.voidHeartUsed) {
                    nextHp = 1;
                    flags.voidHeartUsed = true;
                    flags.voidHeartArmed = true;
                    logs.push({ type: 'event', text: MSG.RELIC_VOID_HEART_REVIVE });
                } else {
                    // cycle 186: 'reviveTokens' (PremiumShop revive) — HP 0 도달 시 token 1개 소비해 즉시 부활.
                    //   spec: 'HP/MP 50% 회복 후 즉시 부활'. token 음수 가드.
                    //   기존엔 token 구매되지만 소비 로직 없어 dead purchase 회귀.
                    const reviveTokens = Math.max(0, Number(player.reviveTokens) || 0);
                    if (reviveTokens > 0) {
                        nextHp = Math.floor((player.maxHp || BALANCE.DEFAULT_MAX_HP) * 0.5);
                        // reviveTokens 소비는 updatedPlayer 합류 시점에 처리 (return 직전).
                        flags.reviveTokenUsed = true;
                        logs.push({ type: 'event', text: MSG.RELIC_REVIVE_TOKEN_USED });
                    } else {
                    // cycle 157: 'phoenix_revive' (불사조의 깃털) — HP 0 도달 시 1회 부활 (HP healRatio% 회복).
                    // cycle 162: atkBuff/duration tempBuff 적용 추가 — 부활 직후 N턴 동안 ATK 증폭.
                    const phoenixRelic = relics.find((relic) => relic.effect === 'phoenix_revive');
                    if (phoenixRelic && !flags.phoenixUsed) {
                        const healRatio = phoenixRelic.val?.healRatio || 0.3;
                        nextHp = Math.max(1, Math.floor((player.maxHp || BALANCE.DEFAULT_MAX_HP) * healRatio));
                        flags.phoenixUsed = true;
                        const atkBuff = phoenixRelic.val?.atkBuff || 0;
                        const duration = phoenixRelic.val?.duration || 0;
                        if (atkBuff > 0 && duration > 0) {
                            phoenixTempBuff = {
                                atk: atkBuff,
                                def: 0,
                                turn: duration,
                                name: 'phoenix_revive',
                            };
                        }
                        logs.push({ type: 'event', text: MSG.RELIC_PHOENIX_REVIVE(nextHp, Math.round(atkBuff * 100), duration) });
                    } else {
                        // 2026-07 — 에테르 거울: revive 노드(에센스 소비 영구 업그레이드) — 런당 1회,
                        //   위 모든 유물/토큰 부활 수단이 없거나 이미 소진됐을 때의 마지막 안전망.
                        //   pure function 원칙 유지: 부활 여부는 입력(player.mirrorReviveUsed 플래그)으로
                        //   판정하고 새 player를 반환 — CombatEngine에 side effect 없음.
                        //   플래그는 handleDefeat(새 런 시작)/ASCEND에서 자연 리셋(freshPlayer가
                        //   INITIAL_STATE.player 기반이라 별도 처리 불필요).
                        const mirrorEffects = getMirrorEffects(player.meta);
                        if (mirrorEffects.reviveEnabled && !player.mirrorReviveUsed) {
                            nextHp = Math.max(1, Math.floor((player.maxHp || BALANCE.DEFAULT_MAX_HP) * mirrorEffects.reviveHpRatio));
                            flags.mirrorReviveUsed = true;
                            logs.push({ type: 'event', text: MSG.MIRROR_REVIVE });
                        }
                    }
                    } // close cycle 186 else (token-not-used path)
                }
            }
        }

        const updatedPlayer: Player = { ...player, hp: nextHp, combatFlags: flags };
        if (phoenixTempBuff) updatedPlayer.tempBuff = phoenixTempBuff;
        // cycle 186: reviveTokens 소비 + MP 50% 회복 (token 사용 시).
        if (flags.reviveTokenUsed) {
            updatedPlayer.reviveTokens = Math.max(0, Number(player.reviveTokens) || 0) - 1;
            updatedPlayer.mp = Math.min(player.maxMp || 50, Math.floor((player.maxMp || 50) * 0.5));
        }
        // 2026-07 — 에테르 거울: mirrorReviveUsed는 player 최상위 필드(combatFlags 아님) —
        //   handleDefeat/ASCEND의 freshPlayer 스프레드에서 자연 리셋되도록 top-level에 둔다
        //   (combatFlags는 별도 보존 규칙이 있어 top-level로 분리해 리셋 계약을 명확히 함).
        if (flags.mirrorReviveUsed) {
            updatedPlayer.mirrorReviveUsed = true;
        }
        return {
            updatedPlayer,
            isDead: nextHp <= 0
        };
    },

    // ── 스킬 효과 → 적 상태 적용 (#5) ─────────────────────────────────────
    /**
     * 스킬 effect 값을 적 오브젝트에 상태이상으로 적용합니다.
     * blind / fear / curse / taunt / stun / freeze / poison / burn / bleed 처리.
     */
    /**
     * cycle 159: entropy tick — 'entropy_tick' 유물 (entropy_engine) +
     *   'entropy_brand' 시너지의 매 N턴 고정 피해를 적에게 적용.
     *
     * 시너지 동시 보유 시 시너지 파라미터(damage 0.12 / interval 2)가 우선
     * — 시너지가 유물을 강화하는 사양.
     *
     * @returns { player, enemy, logs } — turnCount 증가 + (조건 시) 적 hp 차감.
     */
    // cycle 547: activeSynergies default [] 제거 — 2 internal callsite (line 631,
    //   1037) + N test callsite (cycle 159/236/237) 모두 || [] 명시 전달이라
    //   default 도달 불가. 청소 메가 시리즈 42번째 (cycle 502-546).
    applyEntropyTick(player, enemy, activeSynergies) {
        const relics: Relic[] = player?.relics || [];
        const flags = { ...(player.combatFlags || {}) };
        const turnCount = (flags.turnCount || 0) + 1;
        flags.turnCount = turnCount;

        const updatedPlayer = { ...player, combatFlags: flags };
        let updatedEnemy: Monster = enemy;
        const logs: LootLog[] = [];

        const tickRelic = relics.find((r) => r.effect === 'entropy_tick');
        // cycle 236: entropy_god 시너지의 fixedDmg + interval 패턴도 catch.
        //   기존엔 'damage && interval'만 잡아 entropy_god(fixedDmg 0.15)가 dispatch 0건이던 dead config.
        const brandSyn = activeSynergies.find((s) =>
            s.bonus.effect === 'entropy_brand'
            || s.bonus.effect === 'entropy_god'
            || (s.bonus.damage && s.bonus.interval)
            || (s.bonus.fixedDmg && s.bonus.interval));
        if (!tickRelic && !brandSyn) {
            return { player: updatedPlayer, enemy: updatedEnemy, logs };
        }

        // 시너지 우선 (브랜드/신 강화 사양). 누락 키는 유물에서 fallback.
        // cycle 236: fixedDmg fallback 추가 — entropy_god는 fixedDmg key 사용.
        const damage = brandSyn?.bonus.damage ?? brandSyn?.bonus.fixedDmg ?? tickRelic?.val?.damage ?? 0;
        const interval = brandSyn?.bonus.interval ?? tickRelic?.val?.interval ?? 0;
        const label = brandSyn?.bonus.effect === 'entropy_god' ? MSG.ENTROPY_LABEL_GOD : (brandSyn ? MSG.ENTROPY_LABEL_BRAND : MSG.ENTROPY_LABEL_ENGINE);

        if (interval > 0 && damage > 0 && turnCount % interval === 0 && (enemy.hp ?? 0) > 0) {
            const fixedDmg = Math.max(1, Math.floor((enemy.maxHp || enemy.hp || 1) * damage));
            updatedEnemy = { ...enemy, hp: Math.max(0, (enemy.hp ?? 0) - fixedDmg) };
            logs.push({ type: 'event', text: MSG.ENTROPY_TICK_PROC(label, enemy.name, fixedDmg) });
        }

        return { player: updatedPlayer, enemy: updatedEnemy, logs };
    },
};
