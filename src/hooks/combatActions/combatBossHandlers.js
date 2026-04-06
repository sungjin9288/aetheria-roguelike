import { DB } from '../../data/db';
import { BALANCE, CONSTANTS } from '../../data/constants';
import { AT } from '../../reducers/actionTypes';
import { GS } from '../../reducers/gameStates';
import { MSG } from '../../data/messages';
import { makeItem } from '../../utils/gameUtils';
import { RELICS, pickWeightedRelics } from '../../data/relics';

/**
 * 마왕 처치 후처리: 파편 드랍 / 진 보스 진입 / 일반 환생
 * @returns {boolean} true이면 호출자가 즉시 return해야 함
 */
export const handleDemonKingSlain = (updatedPlayer, dispatch, addLog) => {
    const prestigeRank = updatedPlayer.meta?.prestigeRank || 0;
    const shardCount = (updatedPlayer.inv || []).filter((i) => i?.name === '원시의 파편').length;

    if (prestigeRank >= 1 && shardCount < 3 && Math.random() < CONSTANTS.PRIMAL_SHARD_DROP_CHANCE) {
        const shardItem = makeItem({ name: '원시의 파편', type: 'key', price: 0, tier: 5, desc: '원시의 신의 기억이 담긴 파편.' });
        dispatch({ type: AT.SET_PLAYER, payload: (p) => ({ ...p, inv: [...(p.inv || []), shardItem] }) });
        addLog('event', MSG.PRIMAL_SHARD_DROP(shardCount + 1));
    }

    const currentShardCount = (updatedPlayer.inv || []).filter((i) => i?.name === '원시의 파편').length;
    if (prestigeRank >= 3 && currentShardCount >= 3) {
        addLog('critical', MSG.TRUE_BOSS_UNLOCK);
        let removed = 0;
        const newInv = (updatedPlayer.inv || []).filter((i) => {
            if (i?.name === '원시의 파편' && removed < 3) { removed++; return false; }
            return true;
        });
        const trueBossData = DB.MONSTERS?.['원시의 신'];
        if (trueBossData) {
            const trueBoss = {
                name: '원시의 신', baseName: '원시의 신',
                hp: Math.floor(8000 * (trueBossData.hpMult || 2.2)),
                maxHp: Math.floor(8000 * (trueBossData.hpMult || 2.2)),
                atk: Math.floor(280 * (trueBossData.atkMult || 1.8)),
                def: 120, level: 70, isBoss: true,
                weakness: '빛', resistance: '어둠',
                expMult: trueBossData.expMult || 5.0,
                goldMult: trueBossData.goldMult || 5.0,
                dropMod: trueBossData.dropMod || 5.0,
                phase2: trueBossData.phase2, phase3: trueBossData.phase3,
                exp: 5000, gold: 9999,
                pattern: { guardChance: 0.05, heavyChance: 0.4 },
            };
            dispatch({ type: AT.SET_PLAYER, payload: (p) => ({ ...p, inv: newInv }) });
            dispatch({ type: AT.SET_ENEMY, payload: trueBoss });
            dispatch({ type: AT.SET_GAME_STATE, payload: GS.COMBAT });
            addLog('critical', MSG.TRUE_BOSS_APPEAR);
        }
        return true;
    }

    if (prestigeRank >= 1 && shardCount < 3) {
        addLog('info', MSG.PRIMAL_SHARD_HINT(Math.min(shardCount + 1, 3)));
    }
    dispatch({ type: AT.SET_GAME_STATE, payload: GS.ASCENSION });
    addLog('system', MSG.DEMON_KING_SLAIN_ASCEND);
    return true;
};

/**
 * 무한 심연 층 진행. 현재 위치가 심연 맵이 아니면 player를 그대로 반환.
 * @returns {object} 업데이트된 player
 */
export const applyAbyssFloorAdvance = (p, dispatch, addLog) => {
    if (p.loc !== CONSTANTS.ABYSS_MAP_NAME) return p;
    const newDepth = (p.stats?.abyssFloor || 1) + 1;
    let updated = { ...p, stats: { ...(p.stats || {}), abyssFloor: newDepth } };
    addLog('system', `심연의 더 깊은 곳으로 진입했습니다. (현재: ${newDepth}층)`);
    const milestone = BALANCE.ABYSS_MILESTONE_REWARDS[newDepth];
    if (milestone) {
        addLog('event', MSG.ABYSS_MILESTONE(newDepth));
        if (milestone.type === 'relic_choice') {
            const available = RELICS.filter(r => !(updated.relics || []).some(pr => pr.id === r.id));
            if (available.length > 0) dispatch({ type: AT.SET_PENDING_RELICS, payload: pickWeightedRelics(available, 3) });
        } else if (milestone.type === 'legendary_item') {
            const legendaryPool = (DB.ITEMS || []).flat().filter(i => i.tier === 5);
            if (legendaryPool.length > 0) {
                const item = makeItem(legendaryPool[Math.floor(Math.random() * legendaryPool.length)]);
                updated = { ...updated, inv: [...(updated.inv || []), item] };
                addLog('success', `🏆 전설 아이템 획득: [${item.name}]`);
            }
        } else if (milestone.type === 'prestige_points') {
            updated = { ...updated, prestigePoints: (updated.prestigePoints || 0) + (milestone.amount || 1) };
            addLog('success', `✨ 프레스티지 포인트 +${milestone.amount || 1}`);
        }
    }
    return updated;
};
