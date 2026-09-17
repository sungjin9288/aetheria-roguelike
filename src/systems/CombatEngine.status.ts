import { BALANCE } from '../data/constants.js';
import { MSG } from '../data/messages.js';
import type { Monster, Player } from '../types/index.js';

/**
 * CombatEngine 상태이상 메서드 — mixin으로 CombatEngine에 spread.
 * CombatEngine.ts 분리(행동 보존). 순수(BALANCE / MSG만 의존, this 미사용).
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
     * 플레이어 상태이상의 남은 턴을 처리합니다. tickCombatState가 DoT 적용 직후 호출.
     *
     * H1 (Wave 3 감사): 적 상태이상은 tickEnemyStatus에서 `*Turns` 필드를 감소시켜 만료하는데
     * 플레이어 status(문자열 배열)에는 대응 경로가 없어 한 번 부여되면 전투가 끝날 때까지
     * 유지됐다. 같은 모델을 플레이어에 적용한다 — 남은 턴은 적과 마찬가지로 개체(player)에
     * `statusTurns`(상태 → 남은 턴)로 보관하고, status 배열 자체는 기존 표기(문자열)를 유지해
     * UI/세이브/AI 컨텍스트 계약을 바꾸지 않는다.
     *
     * - 남은 턴이 없는 항목(구세이브, 또는 부여 시점에 기록하지 않은 경로)은 첫 틱에서
     *   BALANCE.PLAYER_STATUS_DURATION_TURNS를 기본값으로 받는다.
     * - status 배열에 없는 키는 결과에서 제거되므로 해독제/정화/휴식으로 즉시 해제된 상태가
     *   잔여 턴을 남기지 않는다(해제 경로는 종전 그대로 status만 비우면 된다).
     */
    tickPlayerStatusDurations(player: Player, logs: any[]) {
        const statusList = Array.isArray(player.status) ? player.status : [];
        const prevTurns: Record<string, number> = player.statusTurns || {};
        const status: any[] = [];
        const statusTurns: Record<string, number> = {};

        statusList.forEach((entry: any) => {
            const key = String(entry);
            const stored = prevTurns[key];
            const current = typeof stored === 'number' && Number.isFinite(stored) && stored > 0
                ? stored
                : BALANCE.PLAYER_STATUS_DURATION_TURNS;
            const remaining = current - 1;
            if (remaining > 0) {
                status.push(entry);
                statusTurns[key] = remaining;
            } else {
                logs.push({ type: 'info', text: MSG.PLAYER_STATUS_EXPIRED(key) });
            }
        });

        return { status, statusTurns, logs };
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
            // 2026-09 Wave 6 X2: DOT_LABELS 재사용 — burn/poison만 인식하고 나머지(bleed 등)는
            //   출혈로 처리하던 기존 3-분기 동작을 그대로 보존한다(라벨 값만 MSG 소유로 이동).
            const dotKor = dot === 'burn' ? MSG.DOT_LABELS.burn : dot === 'poison' ? MSG.DOT_LABELS.poison : MSG.DOT_LABELS.bleed;
            logs.push({ type: 'event', text: MSG.ENEMY_DOT_TICK(dotKor, updated.name, dmg) });
        });
        // 저주 DoT (curse_amp 패시브 반영)
        if (updated.cursed) {
            const dmg = Math.max(1, Math.floor((updated.maxHp || updated.hp || BALANCE.DEFAULT_MAX_HP) * BALANCE.CURSE_DOT_RATIO * curseAmpMult));
            updated.hp = Math.max(0, (updated.hp ?? 0) - dmg);
            logs.push({ type: 'event', text: MSG.ENEMY_CURSE_DOT_TICK(updated.name, dmg) });
        }

        // 상태 턴 감소 & 만료
        if ((updated.blindTurns ?? 0) > 0) {
            if (updated.blindTurns! - 1 <= 0) {
                const { blindTurns: _b, atkMult: _a, ...rest } = updated;
                updated = rest;
            } else {
                updated = { ...updated, blindTurns: updated.blindTurns! - 1 };
            }
        }
        if ((updated.fearTurns ?? 0) > 0) {
            if (updated.fearTurns! - 1 <= 0) {
                const { fearTurns: _f, atkMult: _a, ...rest } = updated;
                updated = rest;
            } else {
                updated = { ...updated, fearTurns: updated.fearTurns! - 1 };
            }
        }
        if ((updated.cursedTurns ?? 0) > 0) {
            if (updated.cursedTurns! - 1 <= 0) {
                const { cursedTurns: _c, atkMult: _a, ...rest } = updated;
                updated = { ...rest, cursed: false };
            } else {
                updated = { ...updated, cursedTurns: updated.cursedTurns! - 1 };
            }
        }
        if ((updated.tauntTurns ?? 0) > 0) {
            if (updated.tauntTurns! - 1 <= 0) {
                const { tauntTurns: _t, ...rest } = updated;
                updated = { ...rest, taunted: false };
            } else {
                updated = { ...updated, tauntTurns: updated.tauntTurns! - 1 };
            }
        }

        return { updatedEnemy: updated, logs };
    },
};
