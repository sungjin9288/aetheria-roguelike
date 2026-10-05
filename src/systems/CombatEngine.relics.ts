import { BALANCE } from '../data/constants.js';
import { MSG } from '../data/messages.js';
import { getMirrorEffects } from './mirrorUpgrades';
import { getEffectiveMaxHp } from './vitals.js';
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
        // 2026-10 Wave 58: 부활 회복의 "최대 생명"은 실효 최대다(장비 · 유물 보너스 포함) — 저장된 최대 생명으로 계산하던
        //   동안 거울 에테르 수호 2단계 "생명 60%"가 실효 최대의 48% 남짓이었다(장비 생명 보너스만큼 덜 회복).
        //   계산이 무거워 부활이 실제로 일어날 때만 읽는다.
        let reviveMaxHpCache: number | null = null;
        const getReviveMaxHp = () => {
            if (reviveMaxHpCache === null) reviveMaxHpCache = getEffectiveMaxHp(player);
            return reviveMaxHpCache;
        };
        // cycle 162: phoenix_revive atkBuff tempBuff — 부활 분기에서 set, return에 합류.
        let phoenixTempBuff: Player['tempBuff'] | null = null;
        // 2026-10 Wave 62: 부활석 차감은 "이번 호출에서 부활석으로 부활했는가"만 본다. `combatFlags.reviveTokenUsed`는
        //   전투가 끝날 때까지 남는 신호라, 그 플래그로 차감하던 동안 부활석 부활 뒤 같은 전투의 적 공격마다(치명상이
        //   아니어도) 부활석이 하나씩 더 사라지고 기력이 50%로 다시 찼다(3개 → 2 → 1).
        let reviveTokenSpent = false;

        if (nextHp <= 0) {
            const deathSaveRelic = relics.find((relic) => relic.effect === 'death_save');
            // cycle 153: 시너지 'absolute_immortal' — reviveCount 2회 부활. effect-name primary + bonus-key fallback.
            const absoluteImmortalSyn = activeSynergies.find((s) =>
                s.bonus.effect === 'absolute_immortal' || s.bonus.reviveCount);
            const maxRevives = absoluteImmortalSyn ? (absoluteImmortalSyn.bonus.reviveCount || 1) : 1;
            const reviveUsedCount = flags.deathSaveUsedCount || 0;

            // 2026-10 Wave 62 (원장 §61.4 C7, 소유자 결정 "무료 부활 먼저"): 부활 수단은 무료 → 유료 순서다 —
            //   불사의 의지 → 허공의 심장 → 불사조의 깃털(전투마다) → 에테르 거울(런당 1회) → 에테르 부활석(크리스털로 산 소모품).
            //   부활석 분기가 불사조 · 거울보다 앞에 있던 동안, 공짜 부활이 남아 있어도 산 부활석이 먼저 사라졌다.
            //   판정은 입력 플래그만 읽고 난수를 쓰지 않는다 — 순서를 바꿔도 난수 소비는 그대로(0회)다.
            const voidHeartRelic = relics.find((relic) => relic.effect === 'void_heart');
            // cycle 157: 'phoenix_revive' (불사조의 깃털) — HP 0 도달 시 1회 부활 (HP healRatio% 회복).
            // cycle 162: atkBuff/duration tempBuff 적용 추가 — 부활 직후 N턴 동안 ATK 증폭.
            const phoenixRelic = relics.find((relic) => relic.effect === 'phoenix_revive');
            // 2026-07 — 에테르 거울: revive 노드(에센스 소비 영구 업그레이드) — 런당 1회.
            //   pure function 원칙 유지: 부활 여부는 입력(player.mirrorReviveUsed 플래그)으로
            //   판정하고 새 player를 반환 — CombatEngine에 side effect 없음.
            //   플래그는 handleDefeat(새 런 시작)/ASCEND에서 자연 리셋(freshPlayer가
            //   INITIAL_STATE.player 기반이라 별도 처리 불필요).
            const mirrorEffects = getMirrorEffects(player.meta);
            // cycle 186: 'reviveTokens' (PremiumShop revive) — HP 0 도달 시 token 1개 소비해 즉시 부활.
            //   spec: 'HP/MP 50% 회복 후 즉시 부활'. token 음수 가드.
            const reviveTokens = Math.max(0, Number(player.reviveTokens) || 0);

            if (deathSaveRelic && reviveUsedCount < maxRevives) {
                nextHp = 1;
                flags.deathSaveUsed = true;
                flags.deathSaveUsedCount = reviveUsedCount + 1;
                const reviveMsg = reviveUsedCount > 0 ? MSG.RELIC_DEATH_SAVE_REVIVE(reviveUsedCount + 1) : MSG.RELIC_DEATH_SAVE_FIRST;
                logs.push({ type: 'event', text: reviveMsg });
            } else if (voidHeartRelic && !flags.voidHeartUsed) {
                nextHp = 1;
                flags.voidHeartUsed = true;
                flags.voidHeartArmed = true;
                logs.push({ type: 'event', text: MSG.RELIC_VOID_HEART_REVIVE });
            } else if (phoenixRelic && !flags.phoenixUsed) {
                const healRatio = phoenixRelic.val?.healRatio || 0.3;
                nextHp = Math.max(1, Math.floor(getReviveMaxHp() * healRatio));
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
            } else if (mirrorEffects.reviveEnabled && !player.mirrorReviveUsed) {
                nextHp = Math.max(1, Math.floor(getReviveMaxHp() * mirrorEffects.reviveHpRatio));
                flags.mirrorReviveUsed = true;
                logs.push({ type: 'event', text: MSG.MIRROR_REVIVE });
            } else if (reviveTokens > 0) {
                nextHp = Math.floor(getReviveMaxHp() * 0.5);
                // reviveTokens 소비는 updatedPlayer 합류 시점에 처리 (return 직전).
                flags.reviveTokenUsed = true;
                reviveTokenSpent = true;
                logs.push({ type: 'event', text: MSG.RELIC_REVIVE_TOKEN_USED });
            }
        }

        // 2026-10 Wave 56: 부활 조합(불멸의 전사 · 절대 불사 · 혈맹 불사 "부활할 때 생명 50%")과 난공불락 조합
        //   ("사망 방지가 발동하면 최대 생명의 30% 회복")은 어느 부활 수단이든 적용한다 — 불사의 의지 · 허공의 심장 ·
        //   부활 토큰 · 불사조 · 에테르 거울. 이전에는 불사의 의지 분기 안에만 있어서, 그 유물이 없는 조합
        //   (불멸의 전사 = 불사조 + 피의 서약, 혈맹 불사, 난공불락)에서는 발동하지 않았다. 부활 회복은 수단의 회복과 조합의
        //   회복 중 큰 쪽이고, 난공불락은 그 위에 더한다(최대 생명까지).
        const revived = (player.hp || 0) - Math.max(0, incomingDamage) <= 0 && nextHp > 0;
        if (revived) {
            const reviveMaxHp = getReviveMaxHp();
            // cycle 153: 'absolute_immortal' / 'immortal_warrior' / 'blood_immortal' — reviveHeal(가장 큰 값).
            const reviveHeal = activeSynergies
                .filter((s) => s.bonus.effect === 'absolute_immortal' || s.bonus.effect === 'immortal_warrior'
                    || s.bonus.effect === 'blood_immortal' || s.bonus.reviveHeal)
                .reduce((best: number, s) => Math.max(best, Number(s.bonus.reviveHeal) || 0), 0);
            if (reviveHeal > 0) nextHp = Math.max(nextHp, Math.floor(reviveMaxHp * reviveHeal));
            // cycle 153: 'unbreakable' — healOnSave(사망 방지 발동 시 추가 회복).
            const healOnSave = activeSynergies
                .filter((s) => s.bonus.effect === 'unbreakable' || s.bonus.healOnSave)
                .reduce((best: number, s) => Math.max(best, Number(s.bonus.healOnSave) || 0), 0);
            if (healOnSave > 0) {
                const bonus = Math.floor(reviveMaxHp * healOnSave);
                nextHp = Math.min(reviveMaxHp, nextHp + bonus);
                logs.push({ type: 'heal', text: MSG.RELIC_HEAL_ON_SAVE_PROC(bonus) });
            }
        }

        const updatedPlayer: Player = { ...player, hp: nextHp, combatFlags: flags };
        if (phoenixTempBuff) updatedPlayer.tempBuff = phoenixTempBuff;
        // cycle 186: reviveTokens 소비 + MP 50% 회복 (token 사용 시).
        if (reviveTokenSpent) {
            updatedPlayer.reviveTokens = Math.max(0, Number(player.reviveTokens) || 0) - 1;
            // 2026-10 Wave 58: "기력 50% 회복" — 실효 최대 기준이고, 회복은 기력을 줄이지 않는다.
            const reviveMaxMp = this.getEffectiveMaxMp(player, relics);
            updatedPlayer.mp = Math.min(reviveMaxMp, Math.max(player.mp || 0, Math.floor(reviveMaxMp * 0.5)));
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
        // 2026-10 Wave 56: 엔트로피의 신(세 조각)이 켜지면 늘 함께 켜지는 엔트로피 낙인(두 조각)보다 먼저 쓴다 —
        //   `find`가 앞에 정의된 낙인을 골라 신의 "매 턴 15%"가 한 번도 나가지 않았다.
        const brandSyn = activeSynergies.find((s) => s.bonus.effect === 'entropy_god')
            ?? activeSynergies.find((s) =>
                s.bonus.effect === 'entropy_brand'
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
