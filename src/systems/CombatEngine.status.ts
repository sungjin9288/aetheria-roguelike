import { BALANCE } from '../data/constants.js';
import type { Monster } from '../types/index.js';

/**
 * CombatEngine 상태이상 메서드 — mixin으로 CombatEngine에 spread.
 * CombatEngine.ts 분리(행동 보존). 순수(BALANCE만 의존, this 미사용).
 */
export const statusMethods = {
    applyStatusEffectToEnemy(enemy: Monster, effect: any) {
        if (!effect) return enemy;
        switch (effect) {
            case 'blind':
                return { ...enemy, blindTurns: 2, atkMult: Math.min(enemy.atkMult ?? 1, BALANCE.BLIND_ATK_MULT) };
            case 'fear':
                return { ...enemy, fearTurns: 2, atkMult: Math.min(enemy.atkMult ?? 1, BALANCE.FEAR_ATK_MULT) };
            case 'curse':
                return { ...enemy, cursedTurns: 3, atkMult: Math.min(enemy.atkMult ?? 1, BALANCE.CURSE_ATK_MULT), cursed: true };
            case 'taunt':
                return { ...enemy, taunted: true, tauntTurns: 3 };
            case 'stun':
            case 'freeze':
                return { ...enemy, stunnedTurns: Math.max(enemy.stunnedTurns ?? 0, 1) };
            case 'poison':
            case 'burn':
            case 'bleed': {
                const existingDots = Array.isArray(enemy.dots) ? enemy.dots : [];
                if (!existingDots.includes(effect)) {
                    return { ...enemy, dots: [...existingDots, effect] };
                }
                return enemy;
            }
            default:
                return enemy;
        }
    },

    /**
     * 적의 상태이상 틱을 처리합니다. 매 적 행동 전에 호출하세요.
     * DoT 피해, 상태 턴 감소, 만료 처리를 수행합니다.
     */
    // cycle 549: logs / curseAmpMult / synergyDotMult 3 defaults batch 제거 —
    //   1 internal callsite (line 1076) 4 args 모두 명시 전달이라 default 도달
    //   불가. 외부 caller 0건, test caller 0건. single-cycle 3-default batch
    //   (cycle 524/527 패턴). 청소 메가 시리즈 44번째.
    tickEnemyStatus(enemy: Monster, logs: any[], curseAmpMult: any, synergyDotMult: any) {
        let updated = { ...enemy };

        // DoT (burn / poison / bleed) — 시너지 죽음의 예언자 dotMult 반영
        (updated.dots || []).forEach((dot: any) => {
            const dmg = Math.max(1, Math.floor((updated.maxHp || updated.hp || 100) * BALANCE.STATUS_DOT_RATIO * synergyDotMult));
            updated.hp = Math.max(0, (updated.hp ?? 0) - dmg);
            const dotKor = dot === 'burn' ? '화상' : dot === 'poison' ? '독' : '출혈';
            logs.push({ type: 'event', text: `[${dotKor}] ${updated.name}에게 ${dmg} 지속 피해!` });
        });
        // 저주 DoT (curse_amp 패시브 반영)
        if (updated.cursed) {
            const dmg = Math.max(1, Math.floor((updated.maxHp || updated.hp || BALANCE.DEFAULT_MAX_HP) * BALANCE.CURSE_DOT_RATIO * curseAmpMult));
            updated.hp = Math.max(0, (updated.hp ?? 0) - dmg);
            logs.push({ type: 'event', text: `[저주] ${updated.name}에게 ${dmg} 저주 피해!` });
        }

        // 상태 턴 감소 & 만료
        if ((updated.blindTurns ?? 0) > 0) {
            if (updated.blindTurns - 1 <= 0) {
                const { blindTurns: _b, atkMult: _a, ...rest } = updated;
                updated = rest;
            } else {
                updated = { ...updated, blindTurns: updated.blindTurns - 1 };
            }
        }
        if ((updated.fearTurns ?? 0) > 0) {
            if (updated.fearTurns - 1 <= 0) {
                const { fearTurns: _f, atkMult: _a, ...rest } = updated;
                updated = rest;
            } else {
                updated = { ...updated, fearTurns: updated.fearTurns - 1 };
            }
        }
        if ((updated.cursedTurns ?? 0) > 0) {
            if (updated.cursedTurns - 1 <= 0) {
                const { cursedTurns: _c, atkMult: _a, ...rest } = updated;
                updated = { ...rest, cursed: false };
            } else {
                updated = { ...updated, cursedTurns: updated.cursedTurns - 1 };
            }
        }
        if ((updated.tauntTurns ?? 0) > 0) {
            if (updated.tauntTurns - 1 <= 0) {
                const { tauntTurns: _t, ...rest } = updated;
                updated = { ...rest, taunted: false };
            } else {
                updated = { ...updated, tauntTurns: updated.tauntTurns - 1 };
            }
        }

        return { updatedEnemy: updated, logs };
    },
};
