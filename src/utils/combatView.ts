import { getEnemyTacticalProfile } from './runProfileUtils';
import { getCombatForecast } from './combatForecast';
import { CombatEngine } from '../systems/CombatEngine';
import { getBossSignatureDrops } from './bossSignatureHint.js';

/**
 * CombatPanel의 파생 데이터(전술 프로파일·예측·콤보·전투 예보 등)를 한곳에서 계산한다.
 * 순수 함수 — 입력(player/enemy/stats/선택 스킬) → 뷰 모델. CombatPanel은 렌더링만 담당.
 * (리팩토링: 컴포넌트에서 새어나간 전투 계산 로직 분리 — 행동 보존.)
 */
export const buildCombatView = ({ player, enemy, stats, selectedSkill, skillCooldown, mobile }: any) => {
    const tacticalProfile = enemy ? getEnemyTacticalProfile(enemy, stats) : null;
    const bossBriefLine = enemy?.isBoss
        ? tacticalProfile?.entryHint || tacticalProfile?.hint || tacticalProfile?.phaseHint
        : null;
    // 전투 중 상주 reminder — boss + signature 드롭 가능 시 "끝까지 버틸 이유" 노출
    const signatureDropCandidates = enemy?.isBoss
        ? getBossSignatureDrops(CombatEngine.resolveEnemyBaseName(enemy))
        : [];
    const primarySignatureDrop = signatureDropCandidates[0] || null;
    const combatConsumables: any[] = Object.values(
        (player.inv || [])
            .filter((item: any) => ['hp', 'mp', 'cure', 'buff'].includes(item?.type))
            .sort((a: any, b: any) => {
                const typeOrder: Record<string, number> = { hp: 0, mp: 1, cure: 2, buff: 3 };
                return (typeOrder[a.type] ?? 99) - (typeOrder[b.type] ?? 99);
            })
            .reduce((acc: Record<string, any>, item: any) => {
                const key = `${item.type}:${item.name}`;
                if (!acc[key]) {
                    acc[key] = { ...item, count: 1 };
                } else {
                    acc[key].count += 1;
                }
                return acc;
            }, {} as Record<string, any>)
    ).slice(0, mobile ? 4 : 6) as any[];

    // 콤보 시스템 (연격의 반지 유물 보유 시)
    const comboRelic = player.relics?.find((r: any) => r.effect === 'combo_stack');
    const comboCount = player.combatFlags?.comboCount || 0;
    const comboStack = comboRelic?.val?.stack || 0;

    // 보스 패턴 텔레그래프 (적의 다음 행동 예측)
    const enemyTelegraph = enemy ? CombatEngine.predictEnemyNextAction(enemy) : null;
    const combatForecast = getCombatForecast({
        player,
        enemy,
        stats,
        selectedSkill,
        skillCooldown,
        enemyTelegraph,
        combatConsumables,
        primarySignatureDrop,
    });
    const combatForecastCells = combatForecast
        ? [
            { label: 'INTENT', value: combatForecast.intent },
            { label: 'RESPONSE', value: combatForecast.response },
            { label: 'WINDOW', value: combatForecast.window },
        ]
        : [];

    const mobileCombatSignals = [
        bossBriefLine
            ? {
                key: 'boss',
                text: `보스 전술 · ${bossBriefLine}`,
                className: 'border-[#d5b180]/18 bg-[#d5b180]/10 text-[#f6e7c8]',
            }
            : null,
        comboRelic
            ? {
                key: 'combo',
                text: comboCount >= comboStack ? `COMBO READY ${comboCount}/${comboStack}` : `COMBO ${comboCount}/${comboStack}`,
                className: comboCount >= comboStack
                    ? 'border-cyber-pink/50 bg-cyber-pink/12 text-cyber-pink'
                    : 'border-cyber-pink/18 bg-cyber-pink/6 text-cyber-pink/70',
            }
            : null,
    ].filter(Boolean).slice(0, 2);

    return {
        tacticalProfile,
        bossBriefLine,
        signatureDropCandidates,
        primarySignatureDrop,
        combatConsumables,
        comboRelic,
        comboCount,
        comboStack,
        combatForecast,
        combatForecastCells,
        mobileCombatSignals,
    };
};
