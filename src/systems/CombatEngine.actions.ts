import { BALANCE } from '../data/constants.js';
import { MSG } from '../data/messages.js';
import { CLASSES } from '../data/classes.js';
import type { FullStats, Monster, NumericRelicEffect, Player, Relic, RelicSynergy } from '../types/index.js';
import type { LootLog } from './CombatEngine.loot.js';
import type { CalculateDamageOptions } from './CombatEngine.js';

export function getStrongestNumericRelicValue(
    relics: readonly Relic[],
    effect: NumericRelicEffect,
): number {
    let strongest = 0;

    for (const relic of relics) {
        if (relic.effect !== effect) continue;
        if (typeof relic.val !== 'number' || !Number.isFinite(relic.val) || relic.val < 0) {
            throw new Error(`INVALID_RELIC_EFFECT_VALUE:${relic.id || effect}`);
        }
        strongest = Math.max(strongest, relic.val);
    }

    return strongest;
}

/**
 * 이 mixin의 메서드가 `this`로 교차호출하는 CombatEngine 멤버.
 * CombatEngine 전체 타입을 쓰면 CombatEngine.ts → actionMethods → CombatEngine.ts
 * 순환 참조가 생긴다 — 실제로 호출하는 멤버만 최소 인터페이스로 선언한다(호출 시점 바인딩).
 */
interface ActionsMixinContext {
    calculateDamage(stats: FullStats, options: CalculateDamageOptions): { damage: number; isCrit: boolean };
    getCombatFlags(player: Player): NonNullable<Player['combatFlags']>;
    getElementMultiplier(elem: string, enemy: Monster, relics: Relic[]): number;
    mitigateByEnemyDef(rawDamage: number, enemyDef: number, relics: Relic[]): number;
    getEffectiveMaxMp(player: Player, relics: Relic[]): number;
    applyCritMpRestore(player: Player, relics: Relic[], logs: LootLog[]): Player;
    applyStatusEffectToEnemy(enemy: Monster, effect: string): Monster;
    applyEntropyTick(
        player: Player,
        enemy: Monster,
        activeSynergies: RelicSynergy[],
    ): { player: Player; enemy: Monster; logs: LootLog[] };
    DEFAULT_SKILL_LOADOUT: { selected: number; cooldowns: Record<string, number> };
}

/**
 * `performSkill()`이 받는 스킬 정의 — 생산자 3종(classes.ts의 ClassSkill,
 * equipmentUtils.getWeaponMagicSkills의 WeaponMagicSkill, runProfile.getTraitSkill의
 * TraitSkillDef 파생)이 조금씩 다른 필드 집합을 채운다. 여기서는 이 함수가 실제로
 * 읽는 필드만 전부 optional로 선언해 세 생산자 모두를 그대로 받는다.
 */
interface Skill {
    name?: string;
    mp?: number;
    type?: string;
    mult?: number;
    effect?: string;
    val?: number;
    turn?: number;
    crit?: number;
    drainRatio?: number;
    cooldown?: number;
    effectChance?: number;
    secondEffect?: string;
    stunTurn?: number;
    curseTurn?: number;
    defBonus?: number;
    mpRestore?: number;
}

/**
 * CombatEngine 플레이어 행동 메서드 (attack / performSkill) — mixin으로 CombatEngine에 spread.
 * CombatEngine.ts 분리(행동 보존). this 교차호출은 위 ActionsMixinContext로 명시하고,
 * 실제 바인딩은 CombatEngine.ts가 이 mixin을 spread하는 시점에 이뤄진다(ThisType 마커).
 *
 * W8-Z4: `ThisType<...>` 단독 어노테이션은 변수 자체의 선언 타입을 그 마커(멤버 0개)로
 *   좁혀 `attack`/`performSkill`이 외부에는 존재하지 않는 것처럼 보인다 — 지금까지는
 *   CombatEngine.outcome/.enemyAI가 any 타입으로 spread되어 합성 객체 전체를 any로 오염시켜
 *   이 간극을 가려 왔다(그 둘을 닫으면서 드러남). `satisfies`는 원본 리터럴의 추론 타입을
 *   그대로 유지한 채 `this` 바인딩 계약만 검증한다 — 시그니처/동작 변경 없음.
 */
export const actionMethods = {
    attack(player: Player, enemy: Monster, stats: FullStats, rng?: () => number) {
        const random = typeof rng === 'function' ? rng : Math.random;
        // cycle 107: freeze/stun 상태이상 턴 스킵 — 보스 phase 2/3가 부여하는
        // freeze/stun이 player 쪽에서 처리되지 않아 정상 공격되던 회귀 fix.
        // 적의 stunnedTurns 처리와 짝을 이룸 (one-turn effect — status 제거 후 진행).
        const incomingStatus = Array.isArray(player.status) ? player.status : [];
        const blockingStatus = incomingStatus.find((s) => s === 'freeze' || s === 'stun');
        if (blockingStatus) {
            const newStatus = incomingStatus.filter((s) => s !== blockingStatus);
            return {
                updatedPlayer: { ...player, status: newStatus },
                updatedEnemy: enemy,
                logs: [{ type: 'warning', text: MSG.PLAYER_STATUS_SKIP(blockingStatus) }],
                isCrit: false,
                isVictory: false,
            };
        }

        // cycle 109: blind 상태이상 — 매 공격마다 BLIND_PLAYER_MISS_CHANCE roll.
        // freeze/stun(1턴 effect)과 달리 status 유지 — 저주해제/purify/휴식까지 지속.
        if (incomingStatus.includes('blind') && random() < (BALANCE.BLIND_PLAYER_MISS_CHANCE || 0.30)) {
            return {
                updatedPlayer: { ...player },
                updatedEnemy: enemy,
                logs: [{ type: 'warning', text: MSG.COMBAT_BLIND_MISS }],
                isCrit: false,
                isVictory: false,
            };
        }

        // cycle 110: fear 상태이상 — flinch 확률(FEAR_PLAYER_FLINCH_CHANCE).
        // blind와 같은 모델이지만 의미는 "두려움에 움츠림"으로 차별화. status 유지.
        if (incomingStatus.includes('fear') && random() < (BALANCE.FEAR_PLAYER_FLINCH_CHANCE || 0.25)) {
            return {
                updatedPlayer: { ...player },
                updatedEnemy: enemy,
                logs: [{ type: 'warning', text: MSG.COMBAT_FEAR_FLINCH }],
                isCrit: false,
                isVictory: false,
            };
        }

        const relics = stats.relics || [];
        const elementMultiplier = this.getElementMultiplier(stats.elem, enemy, relics);
        const logs: LootLog[] = [];
        let updatedPlayer: Player = { ...player, combatFlags: this.getCombatFlags(player) };
        const flags = this.getCombatFlags(player);

        // 유물: 방어 무시 (armor_pen) — PR #3: 적 DEF 경감 단계(mitigateByEnemyDef)에서
        //   effDef를 줄이는 방식으로 작동. 여기선 태그 표기용으로만 보유 여부 확인.
        const apRelic = relics.find((r) => r.effect === 'armor_pen');

        const { damage: rawBaseDmg, isCrit } = this.calculateDamage(stats, {
            mult: 1,
            guarding: !!enemy.guarding,
            elementMultiplier,
            rng: random,
            // cycle 242: stats.critChance dispatch — finalCritChance(equipment / relic / 칭호 /
            //   심연 / 시너지 / killStreak / 트레이트 합산)가 SystemTab에 표시만 되고 실제
            //   attack/skill에는 dispatch 0건이던 dead config fix. 미정의 시 default(0.1) fallback.
            ...(typeof stats.critChance === 'number' ? { critChance: stats.critChance } : {})
        });

        // 유물: 드래곤 발톱 (crit_dmg) — 크리티컬 피해 배율 상승
        const critDmgRelic = relics.find((r) => r.effect === 'crit_dmg');
        // cycle 154: 시너지 'void_dragon' / 'primordial_wrath' — bonus.critDmg 곱셈 추가.
        const critDmgSyn = (stats.activeSynergies || []).find((s) =>
            s.bonus.effect === 'void_dragon' || s.bonus.effect === 'primordial_wrath' || s.bonus.critDmg);
        const critDmgMult = (critDmgRelic?.val || 1) * (isCrit && critDmgSyn ? (critDmgSyn.bonus.critDmg || 1) : 1);
        const baseDmg = (isCrit && (critDmgRelic || critDmgSyn)) ? Math.floor(rawBaseDmg * critDmgMult) : rawBaseDmg;

        // 유물: 연격 (double_strike) — 두 번째 타격 추가
        const dsRelic = relics.find((r) => r.effect === 'double_strike');
        const secondHit = dsRelic ? Math.floor(baseDmg * dsRelic.val) : 0;
        const damage = baseDmg + secondHit;

        // 유물: 처형자의 날 (execute_bonus) — 적 HP 25% 미만 시 추가 피해.
        const exRelic = relics.find((r) => r.effect === 'execute_bonus');
        // cycle 156: 시너지 'annihilator' (executeThreshold 0.35) — 처형 임계치 상향. 유물의 threshold와 max 합산.
        const annihilatorSyn = (stats.activeSynergies || []).find((s) =>
            s.bonus.effect === 'annihilator' || s.bonus.executeThreshold);
        const exThreshold = Math.max(exRelic?.val?.threshold || 0, annihilatorSyn?.bonus.executeThreshold || 0);
        const executeTriggered = Boolean((exRelic || annihilatorSyn) && (enemy.hp ?? 0) / (enemy.maxHp || 1) < exThreshold);
        const exMult = exRelic?.val?.mult || 0;
        let finalDamage = executeTriggered
            ? Math.floor(damage * (1 + exMult))
            : damage;

        const comboRelic = relics.find((relic) => relic.effect === 'combo_stack');
        let comboTriggered = false;
        if (comboRelic) {
            if ((flags.comboCount || 0) >= comboRelic.val.stack) {
                finalDamage = Math.floor(finalDamage * (1 + comboRelic.val.bonus));
                flags.comboCount = 0;
                comboTriggered = true;
            } else {
                flags.comboCount = (flags.comboCount || 0) + 1;
            }
        }

        const voidHeartRelic = relics.find((relic) => relic.effect === 'void_heart');
        let voidHeartTriggered = false;
        if (voidHeartRelic && flags.voidHeartArmed) {
            finalDamage = Math.floor(finalDamage * voidHeartRelic.val.dmg_mult);
            flags.voidHeartArmed = false;
            voidHeartTriggered = true;
        }

        // 유물: 예언의 돌판 (execute_atk) — 보스 HP 25% 이하 시 ATK 2배
        const executeAtkRelic = relics.find((r) => r.effect === 'execute_atk');
        let executeAtkTriggered = false;
        if (executeAtkRelic && enemy.isBoss && (enemy.hp ?? 0) / Math.max(1, enemy.maxHp || 1) < (executeAtkRelic.threshold || 0.25)) {
            finalDamage = Math.floor(finalDamage * (executeAtkRelic.val || 2.0));
            executeAtkTriggered = true;
        }

        // 유물: 공허의 메아리 (echo_atk) — 스킬 사용 후 다음 일반 공격 피해 강화
        const echoAtkRelic = relics.find((r) => r.effect === 'echo_atk');
        let echoTriggered = false;
        if (echoAtkRelic && flags.echoArmed) {
            finalDamage = Math.floor(finalDamage * (echoAtkRelic.val || 1.8));
            flags.echoArmed = false;
            echoTriggered = true;
        }

        // 유물: 피의 달 (low_hp_dmg) — HP 40% 이하 시 모든 피해 +40%
        const lowHpDmgRelic = relics.find((r) => r.effect === 'low_hp_dmg');
        if (lowHpDmgRelic) {
            const hpRatio = (player.hp ?? 0) / Math.max(1, player.maxHp || BALANCE.DEFAULT_MAX_HP);
            if (hpRatio < (lowHpDmgRelic.threshold || 0.4)) {
                finalDamage = Math.floor(finalDamage * (lowHpDmgRelic.val || 1.4));
            }
        }

        // PR #3: 적 DEF 비율 경감 — 모든 공격 배율 적용 후 최종 1회. armor_pen은 effDef 감소.
        finalDamage = this.mitigateByEnemyDef(finalDamage, enemy.def ?? 0, relics);

        const newEnemyHp = (enemy.hp ?? 0) - finalDamage;
        // slice 19: 치명타/약점/저항/연격을 본문 태그로 통합 — 기존엔 같은 정보가
        //   별도 로그 4건으로 중복 출력되어 한 턴 로그 burst의 주범이었음.
        const tags = [];
        if (isCrit) tags.push(MSG.COMBAT_TAG_CRIT);
        if (enemy.guarding) tags.push(MSG.COMBAT_TAG_GUARD_BREAK);
        if (elementMultiplier > 1) tags.push(MSG.COMBAT_TAG_ELEMENT_WEAK);
        if (elementMultiplier < 1) tags.push(MSG.COMBAT_TAG_ELEMENT_RESIST);
        if (dsRelic && secondHit > 0) tags.push(MSG.COMBAT_TAG_DOUBLE_STRIKE(secondHit));
        if (apRelic) tags.push(MSG.COMBAT_TAG_ARMOR_IGNORE);
        if (comboTriggered) tags.push(MSG.COMBAT_TAG_COMBO);
        if (voidHeartTriggered) tags.push(MSG.COMBAT_TAG_VOID_HEART);

        // cycle 229: 일반 공격 사용 시 spellStackCount 리셋 (연속 스킬 사용 깨짐).
        //   spell_stack 유물 보유 여부와 무관하게 reset (다음 사용 대비 깨끗한 상태).
        updatedPlayer = { ...updatedPlayer, combatFlags: { ...flags, spellStackCount: 0 } };
        if (isCrit) {
            updatedPlayer = this.applyCritMpRestore(updatedPlayer, relics, logs);
        }

        // cycle 153: 시너지 'vampire_lord' — lifeSteal 일반 공격 흡혈.
        const vampireSyn = (stats.activeSynergies || []).find((s) =>
            s.bonus.effect === 'vampire_lord' || s.bonus.lifeSteal);
        // cycle 156: 시너지 'hell_reaper' — lifeStealBonus 0.5 추가 흡혈 (vampire_lord와 합산).
        const hellReaperSyn = (stats.activeSynergies || []).find((s) =>
            s.bonus.effect === 'hell_reaper' || s.bonus.lifeStealBonus);
        const totalLifeSteal = (vampireSyn?.bonus.lifeSteal || 0) + (hellReaperSyn?.bonus.lifeStealBonus || 0);
        if (totalLifeSteal > 0) {
            const steal = Math.floor(finalDamage * totalLifeSteal);
            if (steal > 0) {
                updatedPlayer = { ...updatedPlayer, hp: Math.min(Number(updatedPlayer.maxHp || player.maxHp), Number(updatedPlayer.hp || player.hp) + steal) };
                logs.push({ type: 'heal', text: MSG.RELIC_LIFESTEAL_PROC(Boolean(hellReaperSyn), steal) });
            }
        }

        logs.unshift({
            type: isCrit ? 'critical' : 'combat',
            text: MSG.COMBAT_ATTACK_DETAIL(enemy.name, finalDamage, Math.max(0, newEnemyHp), enemy.maxHp, tags)
        });
        // slice 19: 치명타/약점/저항/연격 별도 로그 제거 — 본문 태그로 통합 완료.
        //   희귀 유물 proc 로그(처형/연속 베기/허공/예언/메아리)는 흥분 모먼트라 보존.
        if (executeTriggered) logs.push({ type: 'event', text: MSG.RELIC_EXECUTE_PROC });
        if (comboTriggered) logs.push({ type: 'event', text: MSG.RELIC_COMBO_PROC });
        if (voidHeartTriggered) logs.push({ type: 'event', text: MSG.RELIC_VOID_HEART_PROC });
        if (executeAtkTriggered) logs.push({ type: 'critical', text: MSG.RELIC_EXECUTE_ATK_PROC });
        if (echoTriggered) logs.push({ type: 'event', text: MSG.RELIC_ECHO_ATK_PROC });

        // cycle 152: 'on_hit_freeze' (frost_anchor) — val 확률로 적 1턴 빙결.
        let postHitEnemy: Monster = { ...enemy, hp: newEnemyHp, guarding: false };
        const freezeRelic = relics.find((r) => r.effect === 'on_hit_freeze');
        if (freezeRelic && newEnemyHp > 0 && random() < (freezeRelic.val || 0)) {
            postHitEnemy = this.applyStatusEffectToEnemy(postHitEnemy, 'freeze');
            logs.push({ type: 'event', text: MSG.RELIC_FREEZE_ON_HIT(enemy.name) });
        }

        // cycle 159: entropy_tick / entropy_brand — 매 N턴 적 maxHp 비율 고정 피해.
        const entropyResult = this.applyEntropyTick(updatedPlayer, postHitEnemy, stats.activeSynergies || []);
        updatedPlayer = entropyResult.player;
        postHitEnemy = entropyResult.enemy;
        entropyResult.logs.forEach((l) => logs.push(l));

        return {
            updatedPlayer,
            updatedEnemy: postHitEnemy,
            logs,
            isCrit,
            isVictory: (postHitEnemy.hp ?? 0) <= 0
        };
    },

    performSkill(player: Player, enemy: Monster, stats: FullStats, skillArg: Skill | null | undefined, rng?: () => number) {
        const random = typeof rng === 'function' ? rng : Math.random;
        if (!skillArg) {
            return { success: false, logs: [{ type: 'error', text: MSG.SKILL_NONE }] };
        }
        // 아래에서 skill = {...skill, ...branch.override} 로 재대입한다 — 파라미터의
        // 선언 타입이 `Skill | null | undefined`이면 중첩 블록 안의 재대입 이후
        // TypeScript가 좁혀진 타입을 널 포함 선언 타입으로 되돌려 그 아래 90여 곳이
        // 전부 "possibly null" 에러가 된다. non-null만 담는 지역 변수로 옮겨 회피한다
        // (런타임 값/제어 흐름은 완전히 동일).
        let skill: Skill = skillArg;
        const relics = stats.relics || [];
        const resolvedDotMult = getStrongestNumericRelicValue(relics, 'dot_mult');
        const hasDotMultRelic = relics.some((relic) => relic.effect === 'dot_mult');
        const dotMult = hasDotMultRelic ? resolvedDotMult : 1;

        // cycle 107: freeze/stun 상태이상 턴 스킵 — attack()와 동일 처리.
        // 스킬 발동 자체가 막히고 MP는 소비되지 않음.
        const incomingStatusSkill = Array.isArray(player.status) ? player.status : [];
        const blockingStatusSkill = incomingStatusSkill.find((s) => s === 'freeze' || s === 'stun');
        if (blockingStatusSkill) {
            const newStatus = incomingStatusSkill.filter((s) => s !== blockingStatusSkill);
            return {
                success: true,
                updatedPlayer: { ...player, status: newStatus },
                updatedEnemy: enemy,
                logs: [{ type: 'warning', text: MSG.PLAYER_STATUS_SKIP(blockingStatusSkill) }],
                isCrit: false,
                isVictory: false,
            };
        }

        // cycle 109: blind miss — attack()와 동일. miss 시 MP 소비 안 됨, status 유지.
        if (incomingStatusSkill.includes('blind') && random() < (BALANCE.BLIND_PLAYER_MISS_CHANCE || 0.30)) {
            return {
                success: true,
                updatedPlayer: { ...player },
                updatedEnemy: enemy,
                logs: [{ type: 'warning', text: MSG.SKILL_BLIND_MISS }],
                isCrit: false,
                isVictory: false,
            };
        }

        // cycle 110: fear flinch — attack()와 동일. flinch 시 MP 소비 안 됨, status 유지.
        if (incomingStatusSkill.includes('fear') && random() < (BALANCE.FEAR_PLAYER_FLINCH_CHANCE || 0.25)) {
            return {
                success: true,
                updatedPlayer: { ...player },
                updatedEnemy: enemy,
                logs: [{ type: 'warning', text: MSG.COMBAT_FEAR_FLINCH }],
                isCrit: false,
                isVictory: false,
            };
        }

        // 스킬 분기 선택 적용
        // String(skill.name) — skill.name은 optional(string | undefined)이라 인덱스
        //   타입에는 string이 필요하다. 기존에도 player.skillChoices?.[undefined]는
        //   ToPropertyKey 강제변환으로 "undefined" 문자열 키 조회와 동일했다(값 변화 없음).
        const skillChoiceKey = player.skillChoices?.[String(skill.name)];
        if (skillChoiceKey) {
            const classData = CLASSES[player.job as string];
            const branches = classData?.skillBranches?.[String(skill.name)];
            if (branches) {
                const branch = branches.find((b) => b.choice === skillChoiceKey);
                if (branch?.override) {
                    skill = { ...skill, ...branch.override };
                }
            }
        }

        const mpCost = skill.mp || BALANCE.SKILL_MP_COST;
        const loadout = player.skillLoadout || this.DEFAULT_SKILL_LOADOUT;
        const cooldowns: Record<string, number> = { ...(loadout.cooldowns || {}) };
        const cooldown = cooldowns[String(skill.name)] || 0;

        // escape_100: 즉시 100% 전투 이탈 (무당 공허의 문 / 시간술사 순간 이동)
        if (skill.effect === 'escape_100') {
            if ((player.mp ?? 0) < mpCost) {
                return { success: false, logs: [{ type: 'error', text: MSG.SKILL_NO_MP }] };
            }
            const updatedPlayer = { ...player, mp: (player.mp ?? 0) - mpCost };
            return {
                success: true,
                forceEscape: true,
                updatedPlayer,
                updatedEnemy: enemy,
                logs: [{ type: 'success', text: `[${skill.name}] ${MSG.ESCAPE_SUCCESS}` }],
                isCrit: false,
                isVictory: false
            };
        }

        if (cooldown > 0) {
            return { success: false, logs: [{ type: 'error', text: MSG.SKILL_ON_COOLDOWN(String(skill.name), cooldown) }] };
        }
        if ((player.mp ?? 0) < mpCost) {
            return { success: false, logs: [{ type: 'error', text: MSG.SKILL_NO_MP }] };
        }

        // 유물: 주문 메아리 (free_skill) — 확률 MP 무료. 중복 보유 시 최강값 1개만 적용(Codex 권한 정책).
        const baseFreeSkillChance = getStrongestNumericRelicValue(relics, 'free_skill');
        const hasFreeSkillRelic = baseFreeSkillChance > 0;
        // cycle 155: 시너지 'arcane_singularity' — bonus.freeSkillChance 35% 추가. 유물과 합산.
        const arcaneSingSyn = (stats.activeSynergies || []).find((s) =>
            s.bonus.effect === 'arcane_singularity' || s.bonus.freeSkillChance);
        const freeChance = baseFreeSkillChance + (arcaneSingSyn?.bonus.freeSkillChance || 0);
        // cycle 163: 'cooldown_reduce' (시간 군주의 왕관) — val.firstFree=true면 전투 첫 스킬 MP 무소비.
        //   cycle 151에서 cdReduction만 적용 → firstFree 보조 메커니즘 추가.
        const playerFlags = player.combatFlags || {};
        const cdRelicForFree = relics.find((r) => r.effect === 'cooldown_reduce');
        const firstFreeAvailable = cdRelicForFree?.val?.firstFree && !playerFlags.firstSkillUsed;
        const actualMpCost = firstFreeAvailable
            ? 0
            : (freeChance > 0 && random() < freeChance) ? 0 : mpCost;

        const skillElem = skill.type || stats.elem;
        const elementMultiplier = this.getElementMultiplier(skillElem, enemy, relics);
        // cycle 155: 시너지 'arcane_singularity' — bonus.skillMult 0.3 스킬 피해 +30% (mult 합산).
        const skillMultSyn = (stats.activeSynergies || []).find((s) =>
            s.bonus.effect === 'arcane_singularity' || s.bonus.skillMult);
        const skillMultBonus = skillMultSyn?.bonus.skillMult || 0;
        // cycle 242: skill.crit branch override 우선, fallback stats.critChance.
        //   도적 '치명 특화' (crit 0.7) / 어쌔신 '치명 암살' (crit 0.95) branch가 dispatch 0건이던 dead config.
        //   skill.crit 미정의 시 stats.critChance(equipment / relic / 시너지 / 칭호 합산) 사용.
        const skillCritChance = (typeof skill.crit === 'number')
            ? Math.max(0, Math.min(1, skill.crit))
            : (typeof stats.critChance === 'number' ? stats.critChance : undefined);
        const { damage: rawSkillDmg, isCrit } = this.calculateDamage(stats, {
            mult: (skill.mult || 1.5) + skillMultBonus,
            guarding: !!enemy.guarding,
            elementMultiplier,
            rng: random,
            ...(typeof skillCritChance === 'number' ? { critChance: skillCritChance } : {})
        });

        // 유물: 드래곤 발톱 (crit_dmg) — 크리티컬 피해 배율 상승
        const critDmgRelicSkill = relics.find((r) => r.effect === 'crit_dmg');
        // cycle 154: 시너지 'void_dragon' / 'primordial_wrath' — 스킬 크리에도 bonus.critDmg 곱셈 적용.
        const critDmgSynSkill = (stats.activeSynergies || []).find((s) =>
            s.bonus.effect === 'void_dragon' || s.bonus.effect === 'primordial_wrath' || s.bonus.critDmg);
        const skillCritMult = (critDmgRelicSkill?.val || 1) * (isCrit && critDmgSynSkill ? (critDmgSynSkill.bonus.critDmg || 1) : 1);
        let damage = (isCrit && (critDmgRelicSkill || critDmgSynSkill)) ? Math.floor(rawSkillDmg * skillCritMult) : rawSkillDmg;

        // cycle 229: 'spell_stack' (주문 직조자 spell_weaver) — 스킬 연속 사용 시 데미지 +perStack% 누적,
        //   max로 cap. 일반 공격(attack)이 spellStackCount를 0으로 리셋. 이전엔 정의만 있고 dispatch
        //   path 0건이던 silent dead config 8번째 (cycle 222-228 시리즈 마지막 합류).
        const spellStackRelic = relics.find((r) => r.effect === 'spell_stack');
        if (spellStackRelic) {
            const perStack = spellStackRelic.val?.perStack || 0;
            const maxStack = spellStackRelic.val?.max || 0.6;
            const prevStack = player.combatFlags?.spellStackCount || 0;
            const stackBonus = Math.min(maxStack, prevStack * perStack);
            if (stackBonus > 0) {
                damage = Math.floor(damage * (1 + stackBonus));
            }
        }

        const extraDamage = ['burn', 'poison', 'bleed'].includes(String(skill.effect))
            ? Math.floor(damage * 0.2 * dotMult)
            : 0;

        // 유물: 정신 연소 (skill_mult) — 스킬 피해 70% 증가
        const smRelic = relics.find((r) => r.effect === 'skill_mult');
        const smMult = smRelic ? (1 + smRelic.val) : 1;
        // 유물: 피의 달 (low_hp_dmg) — HP 40% 이하 시 모든 피해 +40%
        const lowHpDmgRelicSkill = relics.find((r) => r.effect === 'low_hp_dmg');
        const lowHpMultSkill = (lowHpDmgRelicSkill && (player.hp ?? 0) / Math.max(1, player.maxHp || BALANCE.DEFAULT_MAX_HP) < (lowHpDmgRelicSkill.threshold || 0.4))
            ? (lowHpDmgRelicSkill.val || 1.4) : 1;
        // PR #3: 적 DEF 비율 경감 — 스킬 배율 전부 적용 후 최종 1회 (attack()과 동일 패턴).
        const rawTotalDamage = Math.floor((damage + extraDamage) * smMult * lowHpMultSkill);
        const totalDamage = this.mitigateByEnemyDef(rawTotalDamage, enemy.def ?? 0, relics);
        const newEnemyHp = (enemy.hp ?? 0) - totalDamage;

        // logs 선언을 status effect 검사 이전으로 이동 (use-before-declaration 버그 수정).
        // slice 19: 치명타/약점/저항을 본문 태그로 통합 (attack 경로와 동일 패턴) —
        //   별도 로그 burst 제거.
        const skillTags: string[] = [];
        if (isCrit) skillTags.push(MSG.COMBAT_TAG_CRIT);
        if (elementMultiplier > 1) skillTags.push(MSG.COMBAT_TAG_ELEMENT_WEAK);
        if (elementMultiplier < 1) skillTags.push(MSG.COMBAT_TAG_ELEMENT_RESIST);
        const logs: Array<{ type: string; text: string }> = [{
            type: isCrit ? 'critical' : 'combat',
            text: MSG.SKILL_USE(skill.name, totalDamage, enemy.name, Math.max(0, newEnemyHp), enemy.maxHp, skillTags)
        }];

        // 적에게 상태이상 부여 (#5)
        // stun/freeze/poison/burn/bleed/blind/fear/curse/taunt 통합 처리
        const STATUS_EFFECTS_TO_ENEMY = ['stun', 'freeze', 'poison', 'burn', 'bleed', 'blind', 'fear', 'curse', 'taunt'];
        let postEffectEnemy: Monster = { ...enemy, hp: newEnemyHp, guarding: false };
        // 2026-09 Wave 6 X2: DOT_LABELS(8종 StatusId)에 taunt('도발', StatusId 밖 전용 효과)만 더한다.
        const effectLabels: Record<string, string> = { ...MSG.DOT_LABELS, taunt: '도발' };
        // cycle 239: skill.effectChance 게이트 — branch override의 확률적 status proc 처리.
        //   기존엔 100% 부여로 '20% 확률 기절 1턴' / '40% 확률 출혈' 같은 branch가 항상 trigger.
        //   effectChance 미정의 시 default 1.0 (100%) — 회귀 가드.
        const effectChance = skill.effectChance !== undefined ? Math.max(0, Math.min(1, skill.effectChance)) : 1;
        // cycle 241: skill.stunTurn override — branch B '마비 번개' (stunTurn 2) 등이 광고하던 다중 턴 stun을
        //   읽어주지 못해 영원히 1턴만 적용되던 silent dead config fix. stun/freeze는 stunnedTurns 카운터 공용.
        const stunTurn = Math.max(1, Math.floor(skill.stunTurn || 1));
        // cycle 244: skill.curseTurn override — '지속 저주' branch B (curseTurn 3) 등 cursedTurns 카운터 override.
        //   미정의 시 default 3 (applyStatusEffectToEnemy curse case와 동일). max(prev, curseTurn) 단축 방지.
        const curseTurn = Math.max(1, Math.floor(skill.curseTurn || 3));
        if (STATUS_EFFECTS_TO_ENEMY.includes(String(skill.effect)) && random() < effectChance) {
            postEffectEnemy = this.applyStatusEffectToEnemy(postEffectEnemy, String(skill.effect));
            if (skill.effect === 'stun' || skill.effect === 'freeze') {
                postEffectEnemy = { ...postEffectEnemy, stunnedTurns: Math.max(postEffectEnemy.stunnedTurns ?? 0, stunTurn) };
            }
            if (skill.effect === 'curse') {
                postEffectEnemy = { ...postEffectEnemy, cursedTurns: Math.max(postEffectEnemy.cursedTurns ?? 0, curseTurn) };
            }
            if (effectLabels[String(skill.effect)]) {
                logs.push({ type: 'event', text: MSG.SKILL_ENEMY_STATUS_APPLIED(skill.name, enemy.name, effectLabels[String(skill.effect)]) });
            }
        }
        // 분기 선택으로 추가된 2차 상태이상 (effectChance 동일 적용)
        if (skill.secondEffect && STATUS_EFFECTS_TO_ENEMY.includes(skill.secondEffect) && random() < effectChance) {
            postEffectEnemy = this.applyStatusEffectToEnemy(postEffectEnemy, skill.secondEffect);
            if (skill.secondEffect === 'stun' || skill.secondEffect === 'freeze') {
                postEffectEnemy = { ...postEffectEnemy, stunnedTurns: Math.max(postEffectEnemy.stunnedTurns ?? 0, stunTurn) };
            }
            if (skill.secondEffect === 'curse') {
                postEffectEnemy = { ...postEffectEnemy, cursedTurns: Math.max(postEffectEnemy.cursedTurns ?? 0, curseTurn) };
            }
            if (effectLabels[skill.secondEffect]) {
                logs.push({ type: 'event', text: MSG.SKILL_BRANCH_STATUS_APPLIED(enemy.name, effectLabels[skill.secondEffect]) });
            }
        }
        const updatedEnemy = postEffectEnemy;

        const updatedPlayer: Player = {
            ...player,
            mp: (player.mp ?? 0) - actualMpCost,
            skillLoadout: { selected: loadout.selected || 0, cooldowns: { ...cooldowns } },
            combatFlags: {
                ...this.getCombatFlags(player),
                comboCount: 0,
                // cycle 163: cooldown_reduce.firstFree — 첫 스킬 사용 후 플래그 set.
                firstSkillUsed: true,
                // cycle 229: spell_stack — 스킬 사용 시 stackCount 증분. 일반 공격 시 0으로 리셋
                //   (attack 메서드에서 처리). spell_stack 유물 미보유여도 카운터 증분은 안전 (값 사용
                //   여부는 데미지 계산 시 유물 체크).
                spellStackCount: spellStackRelic
                    ? Math.min((player.combatFlags?.spellStackCount || 0) + 1, 999)
                    : (player.combatFlags?.spellStackCount || 0),
            }
        };
        // cycle 151: 'cooldown_reduce' (시간 군주의 왕관) — 스킬 사용 시 초기 쿨다운 -val.cdReduction. firstFree는 별도 사이클.
        const cdRelic = relics.find((r) => r.effect === 'cooldown_reduce');
        // cycle 155: 시너지 'time_dominator' — bonus.cdReduction 2 추가. 유물과 합산.
        const timeDomSyn = (stats.activeSynergies || []).find((s) =>
            s.bonus.effect === 'time_dominator' || s.bonus.cdReduction);
        const cdReduction = (cdRelic?.val?.cdReduction || 0) + (timeDomSyn?.bonus.cdReduction || 0);
        const baseCd = skill.cooldown || Math.max(1, Math.ceil(mpCost / 15));
        // updatedPlayer.skillLoadout은 위 literal에서 항상 채워 넣었다(non-null 단언, 런타임 값 변화 없음).
        updatedPlayer.skillLoadout!.cooldowns[String(skill.name)] = Math.max(0, baseCd - cdReduction);

        // 유물: 영혼 흡수 (skill_lifesteal) — 스킬 피해의 10% HP 흡수
        const slRelic = relics.find((r) => r.effect === 'skill_lifesteal');
        if (slRelic) {
            const heal = Math.floor(totalDamage * slRelic.val);
            updatedPlayer.hp = Math.min(Number(updatedPlayer.maxHp || player.maxHp), Number(updatedPlayer.hp || player.hp) + heal);
        }
        if (isCrit) {
            const critLogs: LootLog[] = [];
            const restoredPlayer = this.applyCritMpRestore(updatedPlayer, relics, critLogs);
            updatedPlayer.mp = restoredPlayer.mp;
            critLogs.forEach((entry) => logs.push(entry));
        }

        if (skill.type === 'buff' || ['atk_up', 'def_up', 'all_up', 'berserk', 'counter'].includes(String(skill.effect))) {
            const buff: { atk: number; def: number; turn: number; name: string | undefined; counterChance?: number } = { atk: 0, def: 0, turn: skill.turn || 3, name: skill.name };
            if (skill.effect === 'atk_up') buff.atk = Math.max(0.15, (skill.val || 1.3) - 1);
            if (skill.effect === 'def_up') buff.def = Math.max(0.15, (skill.val || 1.3) - 1);
            if (skill.effect === 'all_up') {
                buff.atk = Math.max(0.15, (skill.val || 1.3) - 1);
                buff.def = Math.max(0.15, (skill.val || 1.3) - 1);
            }
            if (skill.effect === 'berserk') {
                buff.atk = Math.max(0.2, (skill.val || 2.0) - 1);
                buff.def = -0.2;
            }
            // cycle 172: 'counter' (반격 자세) — 피격 시 반격 확률. val(=1.4)을 chance 보정으로 해석:
            //   counterChance = val - 1 (예: 1.4 → 40%). counter damage = stats.atk (1배 반격 추가타).
            if (skill.effect === 'counter') {
                buff.counterChance = Math.max(0.2, (skill.val || 1.4) - 1);
            }
            // cycle 238: skill branch override의 defBonus 처리 — '분노의 방패' / '철벽 배시' 등이
            //   defBonus 1.2 (DEF +20%)를 override하지만 read 코드 0건이던 silent dead config fix.
            //   기본 페널티 (-0.2 berserk 등) 또는 0 def를 override.
            if (skill.defBonus !== undefined) {
                buff.def = (skill.defBonus || 1) - 1;
            }
            updatedPlayer.tempBuff = buff;
        } else if (skill.defBonus !== undefined) {
            // cycle 238: non-buff effect 스킬 ('철벽 배시' = stun 효과 + defBonus)도 buff 생성.
            //   stun 등 attack-type 스킬에 defBonus가 정의되어 있으면 별도로 buff 부여.
            updatedPlayer.tempBuff = {
                atk: 0,
                def: (skill.defBonus || 1) - 1,
                turn: skill.turn || 1,
                name: skill.name,
            };
        }

        // drain: 스킬 피해의 N% HP 흡수 (#5)
        // cycle 257: skill.drainRatio override — '혼의 흡수' (desc 30%) / '흡혈의 낫' (desc 35%)이
        //   광고와 달리 hardcoded 25%로 흡수되던 desc-data 모순 fix. 미정의 시 default 0.25.
        if (skill.effect === 'drain') {
            const ratio = (typeof skill.drainRatio === 'number' && skill.drainRatio > 0) ? skill.drainRatio : 0.25;
            const drainHeal = Math.floor(totalDamage * ratio);
            updatedPlayer.hp = Math.min(Number(updatedPlayer.maxHp || player.maxHp), Number(updatedPlayer.hp || player.hp) + drainHeal);
            logs.push({ type: 'heal', text: MSG.SKILL_DRAIN_HEAL(drainHeal) });
        }

        // hp_regen: 즉시 HP 회복 (성직자 기적의 손길, 버서커 역경의 힘 등)
        if (skill.effect === 'hp_regen' && skill.val) {
            const healAmt = Math.max(1, Math.floor(Number(updatedPlayer.maxHp || player.maxHp) * skill.val));
            updatedPlayer.hp = Math.min(Number(updatedPlayer.maxHp || player.maxHp), Number(updatedPlayer.hp || player.hp) + healAmt);
            logs.push({ type: 'heal', text: MSG.SKILL_HP_REGEN_PROC(skill.name, healAmt) });
        }

        // mp_regen: 즉시 MP 회복 (마법사 마나 가속 등)
        if (skill.effect === 'mp_regen' && skill.val) {
            const mpAmt = skill.val;
            const maxMp = this.getEffectiveMaxMp(updatedPlayer, relics);
            updatedPlayer.mp = Math.min(maxMp, Number(updatedPlayer.mp || player.mp) + mpAmt);
            logs.push({ type: 'event', text: MSG.SKILL_MP_REGEN_PROC(skill.name, mpAmt) });
        }

        // purify: 플레이어 상태이상 전부 제거 + 로그 (#5)
        if (skill.effect === 'purify') {
            const currentStatus = Array.isArray(updatedPlayer.status) ? updatedPlayer.status : [];
            if (currentStatus.length > 0) {
                updatedPlayer.status = [];
                logs.push({ type: 'success', text: MSG.SKILL_PURIFY_PROC(skill.name) });
            }
        }

        // stealth: 다음 적 공격 1회 회피 플래그 설정 (#5)
        if (skill.effect === 'stealth') {
            updatedPlayer.nextHitEvaded = true;
            logs.push({ type: 'event', text: MSG.SKILL_STEALTH_PROC(skill.name) });
        }

        // extraTurn: 이번 스킬 사용 후 적 턴 스킵 → 플레이어 추가 행동 (Sprint 16 — 시간술사)
        if (skill.effect === 'extraTurn') {
            updatedPlayer.extraTurnGranted = true;
            if (skill.val && skill.val > 1) {
                const atkBonus = skill.val - 1;
                updatedPlayer.tempBuff = { atk: atkBonus, def: 0, turn: 1, name: skill.name };
            }
            // cycle 243: skill.mpRestore branch override — '시간 충전' branch B (mpRestore 30) dead config fix.
            //   '추가 행동 + MP 30 즉시 회복' 광고가 dispatch 0건이던 silent 회귀.
            if (typeof skill.mpRestore === 'number' && skill.mpRestore > 0) {
                const effectiveMaxMp = this.getEffectiveMaxMp(player, relics);
                updatedPlayer.mp = Math.min(effectiveMaxMp, (updatedPlayer.mp || 0) + skill.mpRestore);
            }
            logs.push({ type: 'event', text: MSG.SKILL_EXTRA_TURN(String(skill.name)) });
        }

        // cycle 153: 시너지 'time_master' (extraTurnChance 0.1) / cycle 155: 'time_dominator' (extraAction 0.3) —
        //   스킬 사용 후 확률로 추가 행동. 두 시너지 동시 보유 시 더 높은 확률 채택.
        const timeMasterSyn = relics && (stats.activeSynergies || []).find((s) =>
            s.bonus.effect === 'time_master' || s.bonus.effect === 'time_dominator'
            || s.bonus.extraTurnChance || s.bonus.extraAction);
        const extraChance = (timeMasterSyn?.bonus.extraTurnChance || timeMasterSyn?.bonus.extraAction || 0);
        if (timeMasterSyn && !updatedPlayer.extraTurnGranted && random() < extraChance) {
            updatedPlayer.extraTurnGranted = true;
            logs.push({ type: 'event', text: MSG.RELIC_TIME_MASTER_EXTRA_TURN });
        }

        // resetCooldowns: 모든 스킬 쿨타임을 0으로 초기화 (Sprint 16 — 시간술사)
        if (skill.effect === 'resetCooldowns') {
            const resetLoadout = updatedPlayer.skillLoadout || { selected: 0, cooldowns: {} };
            updatedPlayer.skillLoadout = { ...resetLoadout, cooldowns: {} };
            logs.push({ type: 'event', text: MSG.SKILL_RESET_COOLDOWNS(String(skill.name)) });
        }

        // 유물: 공허의 메아리 (echo_atk) — 스킬 사용 후 다음 일반 공격 강화 플래그
        const echoRelicInSkill = relics.find((r) => r.effect === 'echo_atk');
        if (echoRelicInSkill) {
            updatedPlayer.combatFlags = { ...this.getCombatFlags(updatedPlayer), echoArmed: true };
            logs.push({ type: 'event', text: MSG.RELIC_ECHO_ATK_ARMED });
        }

        // crit_cooldown: 크리티컬 시 모든 쿨타임 -1 (Sprint 16 — 인과율 조작)
        if (skill.effect === 'crit_cooldown' && isCrit) {
            const cdLoadout = updatedPlayer.skillLoadout || { selected: 0, cooldowns: {} };
            const reducedCds: Record<string, number> = {};
            Object.entries(cdLoadout.cooldowns || {}).forEach(([k, v]) => {
                const cd = Number(v);
                if (cd > 0) reducedCds[k] = cd - 1;
            });
            updatedPlayer.skillLoadout = { ...cdLoadout, cooldowns: reducedCds };
            logs.push({ type: 'event', text: MSG.SKILL_CRIT_COOLDOWN_RESET });
        }


        // slice 19: 약점/저항 별도 로그 제거 — SKILL_USE 본문 태그로 통합 완료.
        if (extraDamage > 0) logs.push({ type: 'event', text: MSG.SKILL_STATUS_BONUS(String(skill.effect), extraDamage) });
        const activeTempBuff = updatedPlayer.tempBuff;
        if (activeTempBuff && activeTempBuff.name === skill.name) {
            logs.push({ type: 'system', text: MSG.SKILL_BUFF_ACTIVE(String(skill.name), Number(activeTempBuff.turn)) });
        }
        if (actualMpCost === 0 && firstFreeAvailable) logs.push({ type: 'event', text: MSG.RELIC_FIRST_SKILL_FREE });
        else if (actualMpCost === 0 && hasFreeSkillRelic) logs.push({ type: 'event', text: MSG.RELIC_FREE_SKILL_PROC });
        if (slRelic) {
            const healAmt = Math.floor(totalDamage * slRelic.val);
            if (healAmt > 0) logs.push({ type: 'heal', text: MSG.RELIC_SKILL_LIFESTEAL_PROC(healAmt) });
        }
        if (smRelic && smRelic.val > 0) logs.push({ type: 'event', text: MSG.RELIC_SKILL_MULT_PROC });
        if (hasDotMultRelic && extraDamage > 0) logs.push({ type: 'event', text: MSG.RELIC_DOT_MULT_PROC });

        // cycle 159: entropy_tick / entropy_brand — 매 N턴 적 maxHp 비율 고정 피해 (스킬 사용 턴에도 적용).
        const entropyResult = this.applyEntropyTick(updatedPlayer, updatedEnemy, stats.activeSynergies || []);
        const finalPlayer = entropyResult.player;
        const finalEnemy = entropyResult.enemy;
        entropyResult.logs.forEach((l) => logs.push(l));

        return {
            success: true,
            updatedPlayer: finalPlayer,
            updatedEnemy: finalEnemy,
            logs,
            isCrit,
            isVictory: (finalEnemy.hp ?? 0) <= 0
        };
    },
} satisfies ThisType<ActionsMixinContext>;
