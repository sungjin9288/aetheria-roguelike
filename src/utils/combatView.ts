import { getEnemyTacticalProfile } from './runProfileUtils';
import { getCombatForecast, type SelectedSkillLike } from './combatForecast';
import { CombatEngine } from '../systems/CombatEngine';
import { getDiscoveredBossSignatureDrops } from './bossSignatureHint.js';
import { getCombatSkillReadiness } from './combatSkillReadiness';
import { getBossThreatChip, getEliteThreatChip } from './enemyThreat';
import { getCombatSkillTray } from './combatSkillTray';
import { getConsumableDescription } from './consumablePresentation';
import { isConsumableItem } from '../systems/consumableRules';
import type { DictRelic, FullStats, Item, Monster, Player } from '../types/index.js';

interface CombatViewInput {
    player: Player;
    enemy?: Monster | null;
    stats?: FullStats | null;
    selectedSkill?: SelectedSkillLike | null;
    skillCooldown?: number;
    mobile?: boolean;
}

/**
 * `buildCombatView()`가 반환하는 전투 소모품 1건 — DB 원본 `Item`에 `count`와 표시 문구 `label`을 얹는다.
 * `label`은 빠른 슬롯과 같은 `getConsumableDescription`이다 — 저장된 `desc_stat`을 그리던 동안 접두어 엘릭서가
 * "HP+10006 | 신성한"으로 보였다(엔진은 완전 회복, Wave 61, 원장 §61.3).
 */
type CombatConsumableEntry = Item & { count: number; label: string };

/**
 * 전투 신호 칩의 의미 — 색은 화면(CombatPanel)이 토큰으로 정한다(2026-10 에테르 유리: 뷰모델에 색 클래스를 싣지 않는다).
 * threat = 정예 위협 · boss = 보스 위협(금빛 테두리) · ready / building = 연속 공격이 찼는지.
 */
export type CombatSignalTone = 'threat' | 'boss' | 'ready' | 'building';

/** `combo_stack`(연격의 반지) 유물만 골라 쓰는 실제 모양 — `val`이 `{stack, bonus}`로 닫힌다. */
type ComboStackRelic = Extract<DictRelic, { effect: 'combo_stack' }>;

/**
 * CombatPanel의 파생 데이터(전술 프로파일·예측·콤보·전투 예보 등)를 한곳에서 계산한다.
 * 순수 함수 — 입력(player/enemy/stats/선택 스킬) → 뷰 모델. CombatPanel은 렌더링만 담당.
 * (리팩토링: 컴포넌트에서 새어나간 전투 계산 로직 분리 — 행동 보존.)
 */
export const buildCombatView = ({ player, enemy, stats, selectedSkill, skillCooldown, mobile }: CombatViewInput) => {
    const skillReadiness = getCombatSkillReadiness({ player, selectedSkill, skillCooldown });
    // 2026-10 감사 CL-03: 가진 기술 전부 — 칸마다 같은 준비 판정(재사용 대기 · 기력)과 약점 판정(전투 예고와 같은 판정).
    const skillTray = getCombatSkillTray(player, { enemy, stats });
    // 보스 카드(기믹 · 공략 요령)가 읽는다. 2026-10 감사 CL-06: '보스 전술' 신호(entryHint · hint · phaseHint)는 지웠다 — 데스크톱
    //   분기와 보스에서 숨는 신호 줄 안에만 있어 한 번도 그려지지 않았고(Wave 135 "그리지 않는 코드"), 들어가기 전 준비 조언이었다.
    const tacticalProfile = enemy ? getEnemyTacticalProfile(enemy, stats) : null;
    // 전투 중 상주 reminder — boss + signature 드롭 가능 시 "끝까지 버틸 이유" 노출
    // 2026-10 Wave 103 (소유자 결정 §107.6): 이미 도감에 있는 각인만 — 아직 없는 각인의 획득처는 플레이어가 알아낸다.
    const signatureDropCandidates = enemy?.isBoss
        ? getDiscoveredBossSignatureDrops(CombatEngine.resolveEnemyBaseName(enemy), player)
        : [];
    const primarySignatureDrop = signatureDropCandidates[0] || null;
    const combatConsumables: CombatConsumableEntry[] = Object.values(
        (player.inv || [])
            .filter((item) => isConsumableItem(item))
            .sort((a, b) => {
                const typeOrder: Record<string, number> = { hp: 0, mp: 1, cure: 2, buff: 3 };
                return (typeOrder[a.type ?? ''] ?? 99) - (typeOrder[b.type ?? ''] ?? 99);
            })
            .reduce((acc: Record<string, CombatConsumableEntry>, item) => {
                const key = `${item.type}:${item.name}`;
                if (!acc[key]) {
                    acc[key] = { ...item, count: 1, label: getConsumableDescription(item) || item.desc_stat || item.desc || '' };
                } else {
                    acc[key].count += 1;
                }
                return acc;
            }, {} as Record<string, CombatConsumableEntry>)
    ).slice(0, mobile ? 4 : 6);

    // 콤보 시스템 (연격의 반지 유물 보유 시)
    const comboRelic = player.relics?.find((r): r is ComboStackRelic => r.effect === 'combo_stack');
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
            { label: '위협', value: combatForecast.intent },
            { label: '권장 대응', value: combatForecast.response },
            { label: '예상 흐름', value: combatForecast.window },
        ]
        : [];

    // 2026-10 Wave 111: 정예와 싸우는 동안 가장 센 한 방(격노 포함)을 칩으로 보인다 — 나타날 때의 기록 줄은 밀려 올라간다.
    // 2026-10 감사 CL-06: 보스도 같은 칩이다(페이즈 · 하수인 · 브레스 포함). 위협 칩이 언제나 첫 신호다.
    const eliteThreatChip = enemy ? getEliteThreatChip(player, enemy) : null;
    const bossThreatChip = enemy ? getBossThreatChip(player, enemy) : null;
    const mobileCombatSignals = [
        eliteThreatChip
            ? {
                key: 'elite',
                text: eliteThreatChip,
                tone: 'threat' as CombatSignalTone,
            }
            : null,
        bossThreatChip
            ? {
                key: 'boss-threat',
                text: bossThreatChip,
                tone: 'boss' as CombatSignalTone,
            }
            : null,
        comboRelic
            ? {
                key: 'combo',
                text: comboCount >= comboStack ? `연속 공격 준비 ${comboCount}/${comboStack}` : `연속 공격 ${comboCount}/${comboStack}`,
                tone: (comboCount >= comboStack ? 'ready' : 'building') as CombatSignalTone,
            }
            : null,
    ].filter(Boolean).slice(0, 2);

    return {
        tacticalProfile,
        signatureDropCandidates,
        primarySignatureDrop,
        combatConsumables,
        comboRelic,
        comboCount,
        comboStack,
        combatForecast,
        combatForecastCells,
        mobileCombatSignals,
        skillReadiness,
        skillTray,
    };
};
