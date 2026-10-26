import type { CombatFeedback, CombatTurnSignals, Monster, Player } from '../../types/index.js';

/**
 * 전투 차례의 연출 기록을 만든다(GF-01 · 02 · 06 · 11) — 정산(`settleVictory` · `settleNonVictory`) 한 곳이 부른다.
 *
 * 입력은 차례 **앞**의 플레이어 · 적(화면이 마지막으로 그린 모습)과 차례 해석기의 결과다. 쓰러진 적의 모습은 앞의 적에서
 * 가져온다 — 처치 순간을 그리는 동안 상태 표시줄이 같은 이름으로 이어 그려야 마지막 일격의 피해 숫자가 뜬다.
 * 순수 함수이고 게임 판정은 이 기록을 읽지 않는다.
 */
export interface CombatFeedbackInput {
    key: string;
    kind: CombatFeedback['kind'];
    playerBefore: Player;
    enemyBefore: Monster;
    /** 차례 뒤 플레이어 생명 — 쓰러진 차례는 0이다(정산 결과의 플레이어는 이미 다시 세워진 모습이다). */
    playerHpAfter: number;
    /** 차례 뒤 적 — 처치 · 도주 · 사망이면 null. */
    enemyAfter: Monster | null;
    signals?: CombatTurnSignals;
}

export const buildCombatFeedback = ({
    key,
    kind,
    playerBefore,
    enemyBefore,
    playerHpAfter,
    enemyAfter,
    signals,
}: CombatFeedbackInput): CombatFeedback => {
    const enemyHpBefore = enemyBefore.hp ?? 0;
    const killed = kind === 'victory';
    const enemyHpAfter = signals?.enemyHpAfter ?? (killed ? 0 : enemyAfter?.hp ?? enemyHpBefore);
    return {
        key,
        kind,
        enemyDamage: Math.max(0, enemyHpBefore - enemyHpAfter),
        playerHpDelta: playerHpAfter - (playerBefore.hp ?? 0),
        playerCrit: Boolean(signals?.playerCrit),
        enemyHeavy: Boolean(signals?.enemyHeavy),
        enemyActed: Boolean(signals?.enemyActed),
        defeatedEnemy: killed
            ? {
                name: enemyBefore.name ?? '',
                baseName: enemyBefore.baseName ?? enemyBefore.name ?? '',
                maxHp: enemyBefore.maxHp ?? enemyHpBefore,
                // 마지막 일격 뒤 값 — 막대는 0에서 멈추고(표시는 0 아래로 내려가지 않는다) 피해 숫자는 넘친 피해까지 말한다.
                hp: Math.min(0, enemyHpAfter),
                isBoss: Boolean(enemyBefore.isBoss),
                isElite: Boolean(enemyBefore.isElite),
                ...(enemyBefore.huntChampion ? { huntChampion: enemyBefore.huntChampion } : {}),
            }
            : null,
    };
};
