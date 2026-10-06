import { MSG } from '../data/messages';
import { CombatEngine } from './CombatEngine';
import { buildRunSummary, getJobSkills } from '../utils/gameUtils';
import { pushBattleRecord, makeBattleRecord } from './DifficultyManager';
import { calculateFullStats, type FullStats } from '../utils/statsCalculator';
import { endDevourBonus } from '../utils/adventureRelicBonuses';
import { endCombatScope } from '../utils/combatScope';
import { createSeededRandom } from './combatItemTurn';
import { tickAfterAction } from './combatTurnTick';
import type { Monster, Player } from '../types/index.js';
import type { GraveEntry } from '../utils/graveUtils.js';

export type CombatActionKind = 'attack' | 'skill' | 'escape';

/**
 * 이 전이가 실제로 반환하는 `attack`/`performSkill`(CombatEngine.actions.ts) 결과 병합형.
 * `attack`은 `success`/`forceEscape` 필드가 없고, `performSkill`의 거부 분기(쿨다운/MP 부족/
 * 스킬 없음)는 `updatedPlayer`/`updatedEnemy`/`isCrit`/`isVictory`가 없다 — 두 생산자를
 * 하나의 로컬 변수로 받는 이 파일만의 병합 형태라 optional로 넓힌다(실제 값은 분기마다
 * 항상 채워짐 — `!`는 그 실제 보장을 표현).
 */
interface CombatActionOutcome {
    success?: boolean;
    forceEscape?: boolean;
    updatedPlayer?: Player;
    updatedEnemy?: Monster;
    logs?: Array<{ type: string; text: string }>;
    isCrit?: boolean;
    isVictory?: boolean;
}

export type CombatActionTurnResult = {
    kind: 'continue' | 'victory' | 'defeat' | 'escape' | 'rejected';
    player: Player;
    enemy: Monster | null;
    logs: Array<{ type: string; text: string }>;
    visualEffect: string | null;
    victoryStats?: FullStats;
    deadEnemy?: Monster;
    graveData?: GraveEntry;
    runSummary?: ReturnType<typeof buildRunSummary>;
    stories: Array<{ type: string; data: Record<string, unknown> }>;
};

const selectedSkill = (player: Player, random: () => number) => {
    const skills = getJobSkills(player);
    if (skills.length === 0) return { skill: null, log: null, shuffled: false };
    const selected = Number.isInteger(player.skillLoadout?.selected)
        ? player.skillLoadout!.selected as number
        : 0;
    const index = ((selected % skills.length) + skills.length) % skills.length;
    if (player.challengeModifiers?.includes('randomSkills')) {
        // 2026-10 Wave 62 (원장 §61.4 C15): "다른 기술이 무작위로 발동" — 고른 기술을 뺀 나머지에서 뽑는다(기술이 하나뿐이면 그 기술).
        //   전체에서 고르게 뽑던 동안 고른 기술이 그대로 나갈 수 있었다. 난수는 예전처럼 한 번 쓴다.
        const others = skills.filter((_, skillIndex) => skillIndex !== index);
        const pool = others.length > 0 ? others : skills;
        const skill = pool[Math.floor(random() * pool.length)];
        return { skill, log: { type: 'warn', text: MSG.COMBAT_CHAOS_SKILL(skill.name ?? '') }, shuffled: true };
    }
    return { skill: skills[index], log: null, shuffled: false };
};

const resolveDefeat = (
    player: Player,
    initialPlayer: Player,
    location: string,
    logs: Array<{ type: string; text: string }>,
    random: () => number,
    now: number,
): CombatActionTurnResult => {
    // 2026-10 Wave 57: 빌린 유물은 기록(런 요약의 유물 수)에도 남기지 않는다.
    const deadPlayer = { ...endCombatScope(player), killStreak: 0 };
    const defeatResult = CombatEngine.handleDefeat(deadPlayer, initialPlayer, random, () => now);
    const recordedPlayer = {
        ...defeatResult.updatedPlayer,
        stats: pushBattleRecord(
            defeatResult.updatedPlayer.stats,
            makeBattleRecord('death', 0),
        ),
    };
    return {
        kind: 'defeat',
        player: recordedPlayer,
        enemy: null,
        logs: [...logs, ...defeatResult.logs],
        visualEffect: null,
        graveData: defeatResult.graveData,
        runSummary: buildRunSummary(deadPlayer, location),
        stories: [
            { type: 'death', data: { loc: location } },
            { type: 'ruinRecap', data: { name: deadPlayer.name, level: deadPlayer.level } },
        ],
    };
};

export const resolveCombatActionTurn = ({
    player,
    enemy,
    kind,
    initialPlayer,
    seed,
    now,
    rng,
}: {
    player: Player;
    enemy: Monster;
    kind: CombatActionKind;
    initialPlayer: Player;
    seed: number;
    now: number;
    rng?: () => number;
}): CombatActionTurnResult => {
    const random = rng || createSeededRandom(seed);
    // calculateFullStats(player)는 `!player`일 때만 null을 반환한다 — 이 전이는 항상
    // 실제 Player를 받으므로 non-null(W8-Z4: outcome/enemyAI 타이핑으로 CombatEngine의
    // 실제 반환 타입이 드러나면서 이 호출부의 느슨한 any 전파가 끝났다).
    const stats = calculateFullStats(player)!;

    if (kind === 'escape') {
        const escapeResult = CombatEngine.attemptEscape(enemy, stats, random);
        if (escapeResult.success) {
            const hpRatio = (player.hp || 0) / Math.max(1, player.maxHp || 1);
            return {
                kind: 'escape',
                player: {
                    ...endCombatScope(endDevourBonus(player)),
                    stats: {
                        ...pushBattleRecord(player.stats, makeBattleRecord('escape', hpRatio)),
                        escapes: (player.stats?.escapes || 0) + 1,
                    },
                },
                enemy: null,
                logs: escapeResult.logs,
                visualEffect: null,
                stories: [],
            };
        }

        const protectionLogs: Array<{ type: string; text: string }> = [];
        const protectedResult = CombatEngine.applyFatalProtection(
            player,
            stats?.relics || [],
            escapeResult.damage || 0,
            protectionLogs,
        );
        const logs = [...escapeResult.logs, ...protectionLogs];
        if (protectedResult.isDead) {
            return resolveDefeat(
                protectedResult.updatedPlayer,
                initialPlayer,
                player.loc || MSG.LOCATION_UNKNOWN_FALLBACK,
                logs,
                random,
                now,
            );
        }
        return {
            kind: 'continue',
            player: protectedResult.updatedPlayer,
            enemy,
            logs,
            visualEffect: null,
            stories: [],
        };
    }

    let actionResult: CombatActionOutcome;
    const logs: Array<{ type: string; text: string }> = [];
    let ignoredGuard = false;
    if (kind === 'skill') {
        const selected = selectedSkill(player, random);
        ignoredGuard = Boolean(selected.skill && 'ignoreGuard' in selected.skill && selected.skill.ignoreGuard);
        if (selected.log) logs.push(selected.log);
        actionResult = CombatEngine.performSkill(player, enemy, stats, selected.skill, random);
        if (!actionResult.success && selected.shuffled) {
            // 2026-10 Wave 62 (원장 §61.4 C15): 뒤섞인 기술이 쓸 수 없는 기술(기력 부족 · 재사용 대기)을 뽑아도 차례는 지나간다 —
            //   기력은 쓰지 않고 적은 평소처럼 행동한다. 거부하던 동안 다음 입력이 새 씨앗으로 다시 뽑아 비용 없는 다시 굴리기였다.
            actionResult = {
                success: true,
                updatedPlayer: player,
                updatedEnemy: enemy,
                logs: [
                    ...(actionResult.logs || []),
                    { type: 'warn', text: MSG.COMBAT_CHAOS_SKILL_FIZZLE(selected.skill?.name ?? '') },
                ],
                isCrit: false,
                isVictory: false,
            };
        }
        if (!actionResult.success) {
            return {
                kind: 'rejected',
                player,
                enemy,
                logs: [...logs, ...(actionResult.logs || [])],
                visualEffect: null,
                stories: [],
            };
        }
    } else {
        actionResult = CombatEngine.attack(player, enemy, stats, random);
    }
    logs.push(...(actionResult.logs || []));

    if (actionResult.forceEscape) {
        const escapedPlayer = endCombatScope(endDevourBonus(actionResult.updatedPlayer!));
        const hpRatio = (escapedPlayer.hp || 0) / Math.max(1, escapedPlayer.maxHp || 1);
        return {
            kind: 'escape',
            player: {
                ...escapedPlayer,
                stats: {
                    ...pushBattleRecord(escapedPlayer.stats, makeBattleRecord('escape', hpRatio)),
                    escapes: (escapedPlayer.stats?.escapes || 0) + 1,
                },
            },
            enemy: null,
            logs,
            visualEffect: null,
            stories: [],
        };
    }

    if (actionResult.isVictory) {
        return {
            kind: 'victory',
            player: actionResult.updatedPlayer!,
            enemy: null,
            logs,
            visualEffect: null,
            victoryStats: stats,
            deadEnemy: enemy,
            stories: [],
        };
    }

    // 2026-10 Wave 59: 보스의 반응 — 내 피해 행동은 소환된 망자 하나를 쓰러뜨리고(네크론 "망자 소환"), 방어 자세 중에 맞은
    //   보스는 반격한다(아이스 드래곤 "강한 카운터" — 방어 무시 기술에는 반격하지 않는다). 피해를 못 준 행동(기절 · 빗나감)은 둘 다 없다.
    let playerAfterAction = actionResult.updatedPlayer!;
    let enemyAfterAction = actionResult.updatedEnemy!;
    const enemyDamaged = (enemyAfterAction.hp ?? 0) < (enemy.hp ?? 0);
    const summonsLeft = enemyAfterAction.summons ?? 0;
    if (enemyDamaged && summonsLeft > 0) {
        enemyAfterAction = { ...enemyAfterAction, summons: summonsLeft - 1 };
        logs.push({ type: 'success', text: MSG.ENEMY_SUMMON_SLAIN(enemyAfterAction.mechanics?.summon?.name ?? '', summonsLeft - 1) });
    }
    if (enemy.guarding && enemyDamaged && !ignoredGuard) {
        const counter = CombatEngine.resolveGuardCounter(playerAfterAction, enemyAfterAction, calculateFullStats(playerAfterAction)!);
        if (counter) {
            logs.push(...counter.logs);
            playerAfterAction = counter.updatedPlayer;
            if (counter.isDead) {
                return resolveDefeat(
                    playerAfterAction,
                    initialPlayer,
                    player.loc || MSG.LOCATION_UNKNOWN_FALLBACK,
                    logs,
                    random,
                    now,
                );
            }
        }
    }

    if (playerAfterAction.extraTurnGranted) {
        return {
            kind: 'continue',
            player: { ...playerAfterAction, extraTurnGranted: false },
            enemy: enemyAfterAction,
            logs,
            visualEffect: null,
            stories: [],
        };
    }

    const turnTick = tickAfterAction(player, playerAfterAction);
    const playerForEnemyTurn = turnTick.updatedPlayer;
    const counterStats = calculateFullStats(playerForEnemyTurn)!;
    const counterResult = CombatEngine.enemyAttack(
        playerForEnemyTurn,
        enemyAfterAction,
        counterStats,
        random,
    );
    const stories = !enemyAfterAction.phase2Triggered
        && counterResult.updatedEnemy?.phase2Triggered
        ? [{ type: 'bossPhase2', data: { bossName: counterResult.updatedEnemy.name } }]
        : [];
    const turnLogs = [...logs, ...turnTick.logs, ...counterResult.logs];

    if (counterResult.isEnemyDead) {
        return {
            kind: 'victory',
            player: counterResult.updatedPlayer,
            enemy: null,
            logs: [
                ...turnLogs,
                { type: 'success', text: counterResult.damage > 0
                    ? MSG.COMBAT_COUNTER_KILL(String(enemyAfterAction.name))
                    : MSG.COMBAT_DOT_KILL(String(enemyAfterAction.name)) },
            ],
            visualEffect: null,
            victoryStats: counterStats,
            deadEnemy: enemyAfterAction,
            stories,
        };
    }

    if (counterResult.isDead) {
        const defeated = resolveDefeat(
            counterResult.updatedPlayer,
            initialPlayer,
            playerForEnemyTurn.loc || MSG.LOCATION_UNKNOWN_FALLBACK,
            turnLogs,
            random,
            now,
        );
        return { ...defeated, stories: [...stories, ...defeated.stories] };
    }

    return {
        kind: 'continue',
        player: counterResult.updatedPlayer,
        enemy: counterResult.updatedEnemy,
        logs: turnLogs,
        visualEffect: counterResult.isCrit ? 'shake' : null,
        stories,
    };
};
