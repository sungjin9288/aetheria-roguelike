import { BALANCE } from '../data/constants.js';
import { MSG } from '../data/messages.js';
import { getMirrorEffects } from './mirrorUpgrades';
import type { Player, Relic, Monster } from '../types/index.js';

/**
 * CombatEngine 유물 효과 메서드 — mixin으로 CombatEngine에 spread.
 * CombatEngine.ts 분리(행동 보존). this.getCombatFlags/getEffectiveMaxMp 교차호출은
 * 호출 시점 바인딩 → 객체 any. activeSynergies는 파라미터(주입).
 */
export const relicEffectMethods: any = {
    applyCritMpRestore(player: Player, relics: Relic[], logs: any[]) {
        const critMpRelic = relics.find((relic: any) => relic.effect === 'crit_mp_regen');
        if (!critMpRelic) return player;

        const nextMp = Math.min(this.getEffectiveMaxMp(player, relics), (player.mp || 0) + critMpRelic.val);
        if (nextMp > (player.mp || 0)) {
            logs.push({ type: 'event', text: `[피의 갈증] +${nextMp - (player.mp || 0)} MP` });
        }
        return { ...player, mp: nextMp };
    },

    // cycle 553: 3 defaults partial cleanup — relics/incomingDamage/logs는
    //   모든 caller (combatAttack/internal/9 tests) 명시 전달이라 unreachable.
    //   activeSynergies는 combatAttack:189 4-arg caller가 미전달이라 default
    //   reachable 보존. partial cleanup pattern (cycle 542). systems/CombatEngine
    //   method 시리즈 7번째.
    applyFatalProtection(player: Player, relics: Relic[], incomingDamage: any, logs: any[], activeSynergies: any[] = []) {
        const flags = this.getCombatFlags(player);
        let nextHp = Math.max(0, (player.hp || 0) - Math.max(0, incomingDamage));
        // cycle 162: phoenix_revive atkBuff tempBuff — 부활 분기에서 set, return에 합류.
        let phoenixTempBuff: any = null;

        if (nextHp <= 0) {
            const deathSaveRelic = relics.find((relic: any) => relic.effect === 'death_save');
            // cycle 153: 시너지 'absolute_immortal' — reviveCount 2회 부활. effect-name primary + bonus-key fallback.
            const absoluteImmortalSyn = activeSynergies.find((s: any) =>
                s.bonus.effect === 'absolute_immortal' || s.bonus.reviveCount);
            const maxRevives = absoluteImmortalSyn ? (absoluteImmortalSyn.bonus.reviveCount || 1) : 1;
            const reviveUsedCount = flags.deathSaveUsedCount || 0;

            if (deathSaveRelic && reviveUsedCount < maxRevives) {
                // cycle 153: 시너지 'absolute_immortal' / 'immortal_warrior' / 'blood_immortal' — reviveHeal 부활 시 HP 회복량 증가.
                const reviveHealSyn = activeSynergies.find((s: any) =>
                    s.bonus.effect === 'absolute_immortal'
                    || s.bonus.effect === 'immortal_warrior'
                    || s.bonus.effect === 'blood_immortal'
                    || s.bonus.reviveHeal);
                nextHp = reviveHealSyn
                    ? Math.floor((player.maxHp || BALANCE.DEFAULT_MAX_HP) * reviveHealSyn.bonus.reviveHeal)
                    : 1;
                flags.deathSaveUsed = true;
                flags.deathSaveUsedCount = reviveUsedCount + 1;
                // cycle 153: 시너지 'unbreakable' — healOnSave 부활 시 추가 HP 회복.
                const healOnSaveSyn = activeSynergies.find((s: any) =>
                    s.bonus.effect === 'unbreakable' || s.bonus.healOnSave);
                if (healOnSaveSyn) {
                    const bonus = Math.floor((player.maxHp || BALANCE.DEFAULT_MAX_HP) * healOnSaveSyn.bonus.healOnSave);
                    nextHp = Math.min(player.maxHp || BALANCE.DEFAULT_MAX_HP, nextHp + bonus);
                    logs.push({ type: 'heal', text: `[난공불락] 부활 시 +${bonus} HP 회복!` });
                }
                const reviveMsg = reviveUsedCount > 0 ? `[절대 불사] ${reviveUsedCount + 1}회 부활!` : '[불사의 의지] 치명상을 버텼습니다!';
                logs.push({ type: 'event', text: reviveMsg });
            } else {
                const voidHeartRelic = relics.find((relic: any) => relic.effect === 'void_heart');
                if (voidHeartRelic && !flags.voidHeartUsed) {
                    nextHp = 1;
                    flags.voidHeartUsed = true;
                    flags.voidHeartArmed = true;
                    logs.push({ type: 'event', text: '[허공의 심장] 죽음을 거부했습니다. 다음 공격이 강화됩니다!' });
                } else {
                    // cycle 186: 'reviveTokens' (PremiumShop revive) — HP 0 도달 시 token 1개 소비해 즉시 부활.
                    //   spec: 'HP/MP 50% 회복 후 즉시 부활'. token 음수 가드.
                    //   기존엔 token 구매되지만 소비 로직 없어 dead purchase 회귀.
                    const reviveTokens = Math.max(0, Number((player as any).reviveTokens) || 0);
                    if (reviveTokens > 0) {
                        nextHp = Math.floor((player.maxHp || BALANCE.DEFAULT_MAX_HP) * 0.5);
                        // reviveTokens 소비는 updatedPlayer 합류 시점에 처리 (return 직전).
                        flags.reviveTokenUsed = true;
                        logs.push({ type: 'event', text: `[즉시 부활] 프리미엄 부활권 사용 — HP/MP 50% 회복!` });
                    } else {
                    // cycle 157: 'phoenix_revive' (불사조의 깃털) — HP 0 도달 시 1회 부활 (HP healRatio% 회복).
                    // cycle 162: atkBuff/duration tempBuff 적용 추가 — 부활 직후 N턴 동안 ATK 증폭.
                    const phoenixRelic = relics.find((relic: any) => relic.effect === 'phoenix_revive');
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
                        logs.push({ type: 'event', text: `[불사조의 깃털] 재의 잿더미에서 부활! +${nextHp} HP, ATK +${Math.round(atkBuff * 100)}% (${duration}턴)` });
                    } else {
                        // 2026-07 — 에테르 거울: revive 노드(에센스 소비 영구 업그레이드) — 런당 1회,
                        //   위 모든 유물/토큰 부활 수단이 없거나 이미 소진됐을 때의 마지막 안전망.
                        //   pure function 원칙 유지: 부활 여부는 입력(player.mirrorReviveUsed 플래그)으로
                        //   판정하고 새 player를 반환 — CombatEngine에 side effect 없음.
                        //   플래그는 handleDefeat(새 런 시작)/ASCEND에서 자연 리셋(freshPlayer가
                        //   INITIAL_STATE.player 기반이라 별도 처리 불필요).
                        const mirrorEffects = getMirrorEffects((player as any).meta);
                        if (mirrorEffects.reviveEnabled && !(player as any).mirrorReviveUsed) {
                            nextHp = Math.max(1, Math.floor((player.maxHp || BALANCE.DEFAULT_MAX_HP) * mirrorEffects.reviveHpRatio));
                            flags.mirrorReviveUsed = true;
                            logs.push({ type: 'event', text: MSG.MIRROR_REVIVE });
                        }
                    }
                    } // close cycle 186 else (token-not-used path)
                }
            }
        }

        const updatedPlayer: any = { ...player, hp: nextHp, combatFlags: flags };
        if (phoenixTempBuff) updatedPlayer.tempBuff = phoenixTempBuff;
        // cycle 186: reviveTokens 소비 + MP 50% 회복 (token 사용 시).
        if (flags.reviveTokenUsed) {
            updatedPlayer.reviveTokens = Math.max(0, Number((player as any).reviveTokens) || 0) - 1;
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
    applyEntropyTick(player: Player, enemy: Monster, activeSynergies: any[]) {
        const relics = (player as any)?.relics || [];
        const flags: any = { ...((player as any).combatFlags || {}) };
        const turnCount = (flags.turnCount || 0) + 1;
        flags.turnCount = turnCount;

        const updatedPlayer: any = { ...player, combatFlags: flags };
        let updatedEnemy: any = enemy;
        const logs: any[] = [];

        const tickRelic = relics.find((r: any) => r.effect === 'entropy_tick');
        // cycle 236: entropy_god 시너지의 fixedDmg + interval 패턴도 catch.
        //   기존엔 'damage && interval'만 잡아 entropy_god(fixedDmg 0.15)가 dispatch 0건이던 dead config.
        const brandSyn = activeSynergies.find((s: any) =>
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
        const label = brandSyn?.bonus.effect === 'entropy_god' ? '엔트로피의 신' : (brandSyn ? '엔트로피 낙인' : '엔트로피 엔진');

        if (interval > 0 && damage > 0 && turnCount % interval === 0 && (enemy.hp ?? 0) > 0) {
            const fixedDmg = Math.max(1, Math.floor((enemy.maxHp || enemy.hp || 1) * damage));
            updatedEnemy = { ...enemy, hp: Math.max(0, (enemy.hp ?? 0) - fixedDmg) };
            logs.push({ type: 'event', text: `[${label}] 시간 무게 — ${enemy.name} 고정 피해 ${fixedDmg}!` });
        }

        return { player: updatedPlayer, enemy: updatedEnemy, logs };
    },
};
