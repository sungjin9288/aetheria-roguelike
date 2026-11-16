import { BALANCE } from '../data/constants';
import { buildBossChallengeEvent, getAreaBossName, type BossGaugeEvent } from './bossGauge';
import { getEnemyThreat } from './enemyThreat';
import { spawnEnemy } from './exploreUtils';
import type { GameMap, Player } from '../types';

/**
 * 구역 보스 도전 카드("도전 / 회피") 하나 — 탐험의 카드(지도가 아닌 지역)와 지도의 보스 문(오버월드 3단계)이 같은 카드를
 * 연다. Wave 88: 카드의 위협은 도전 경로와 같은 구역 보스 스폰을 고정 난수로 만든 개체다(접두어 없음 — 게임 난수를 쓰지 않는다).
 */
export const buildAreaBossChallengeCard = (
    player: Player,
    mapData: GameMap,
    options: { door?: boolean } = {},
): BossGaugeEvent => {
    const bossName = getAreaBossName(mapData) as string;
    const probeBoss = spawnEnemy(mapData, player, player.relics || [], { addLog: () => undefined }, {
        forceAreaBoss: true, rng: () => BALANCE.ENEMY_THREAT_PROBE_ROLL,
    }).mStats;
    return buildBossChallengeEvent(bossName, probeBoss ? getEnemyThreat(player, probeBoss) : null, options);
};
