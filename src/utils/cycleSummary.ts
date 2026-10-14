import { MSG } from '../data/messages.js';
import { getActiveAscensionRule, isActiveAscensionRuleOptional } from '../systems/ascensionRule.js';
import { getMirrorEndlessCycle, isMirrorTreeComplete, type MirrorEndlessCycle } from '../systems/mirrorUpgrades.js';
import type { Player } from '../types/index.js';
import { ELITE_TITLE_MAPS, sumEliteTitleBonus } from './eliteTitles.js';
import { hasConqueredRank } from './ruleConquest.js';
import { getDiscoveredSignatureNames, SIGNATURE_NAMES } from './signatureDiscovery.js';

/**
 * 이번 회차 요약 (2026-10 Wave 100, 원장 §104.4 c — 소유자 결정 "c로 진행").
 *
 * 계승 화면이 이번 회차(지금 계승 단계)에 얻은 성장을 한곳에 모은다 — 회차 규칙 정복 · 새 전설 각인 · 새 정예 칭호 · 끝없는 거울(Wave 99).
 * 각인 · 정예 칭호는 계정 단위로 쌓이는 수집이라 "이번 회차에 새로"는 회차 시작 기준점(`meta.cycleStart`)과의 차이다. 기준점은 계승(`ASCEND`)
 * 한 곳이 새 단계로 남기고, 영구 meta라 사망 재시작을 넘는다. 처음 시작한 여정(단계 0)은 기준점이 비어 있다(모든 수집이 이 회차다).
 * 기준점이 없는 이전 세이브의 계승 단계에서는 각인 · 정예 칭호 줄을 그리지 않는다 — 모르는 값을 지어내지 않는다.
 */

export type CycleStart = NonNullable<NonNullable<Player['meta']>['cycleStart']>;

export interface CycleSummary {
    rank: number;
    /** 이번 회차의 회차 규칙 — 단계 0 · 규칙 없음이면 null. */
    rule: { name: string; status: 'conquered' | 'declined' | 'open'; titleName: string } | null;
    /** 새 전설 각인 — 기준점을 모르면 null. */
    signatures: { newNames: string[]; discovered: number; total: number } | null;
    /** 새 정예 칭호 — 기준점을 모르면 null. */
    eliteTitles: { gained: number; owned: number; total: number } | null;
    /** 끝없는 거울이 열렸을 때만 의미가 있다(Wave 99). */
    mirrorUnlocked: boolean;
    mirror: MirrorEndlessCycle;
}

const currentRankOf = (player: Pick<Player, 'meta'>): number => Math.max(0, Math.floor(Number(player.meta?.prestigeRank) || 0));

/** 회차 시작 기준점 — 계승이 새 단계(`rank`)로 남긴다. */
export const snapshotCycleStart = (player: Player, rank: number): CycleStart => ({
    rank,
    signatures: getDiscoveredSignatureNames(player),
    eliteTitles: sumEliteTitleBonus(player.titles).count,
});

/** 지금 회차의 기준점 — 단계가 맞는 기록, 단계 0은 빈 기준점, 그 밖(기록 없는 이전 세이브)은 null. */
export const getCycleStart = (player: Pick<Player, 'meta'>): CycleStart | null => {
    const rank = currentRankOf(player);
    const record = player.meta?.cycleStart;
    if (record && record.rank === rank && Array.isArray(record.signatures)) return record;
    return rank === 0 ? { rank: 0, signatures: [], eliteTitles: 0 } : null;
};

export const getCycleSummary = (player: Player): CycleSummary => {
    const rank = currentRankOf(player);
    const activeRule = rank >= 1 ? getActiveAscensionRule(player.meta) : null;
    const rule = activeRule ? {
        name: activeRule.name,
        status: isActiveAscensionRuleOptional(player.meta) && player.ascensionRuleDeclined === true
            ? 'declined' as const
            : hasConqueredRank(player, rank) ? 'conquered' as const : 'open' as const,
        titleName: activeRule.conquestTitle.name,
    } : null;

    const start = getCycleStart(player);
    const discoveredNames = getDiscoveredSignatureNames(player);
    const known = new Set(start?.signatures || []);
    const ownedElite = sumEliteTitleBonus(player.titles).count;

    return {
        rank,
        rule,
        signatures: start ? {
            newNames: discoveredNames.filter((name) => !known.has(name)),
            discovered: discoveredNames.length,
            total: SIGNATURE_NAMES.length,
        } : null,
        eliteTitles: start ? {
            gained: Math.max(0, ownedElite - start.eliteTitles),
            owned: ownedElite,
            total: ELITE_TITLE_MAPS.length,
        } : null,
        mirrorUnlocked: isMirrorTreeComplete(player.meta?.mirror),
        mirror: getMirrorEndlessCycle(player.meta),
    };
};

export type CycleSummaryLineId = 'rule' | 'signatures' | 'elite' | 'mirror';
export interface CycleSummaryLine { id: CycleSummaryLineId; text: string; highlight: boolean }

/** 요약 줄에 이름을 다 싣지 않는다 — 앞의 몇 개와 나머지 수. */
const SUMMARY_SIGNATURE_NAME_LIMIT = 3;

/** 계승 · 진 엔딩 화면이 그리는 줄 — 모르는 값(기준점 없는 이전 세이브)과 아직 열리지 않은 거울은 줄을 만들지 않는다. */
export const getCycleSummaryLines = (summary: CycleSummary): CycleSummaryLine[] => {
    const lines: CycleSummaryLine[] = [];
    if (summary.rule) {
        const { name, status, titleName } = summary.rule;
        lines.push({
            id: 'rule',
            highlight: status === 'conquered',
            text: status === 'conquered' ? MSG.CYCLE_SUMMARY_RULE_CONQUERED(name, titleName)
                : status === 'declined' ? MSG.CYCLE_SUMMARY_RULE_DECLINED(name)
                    : MSG.CYCLE_SUMMARY_RULE_OPEN(name),
        });
    }
    if (summary.signatures) {
        const { newNames, discovered, total } = summary.signatures;
        const shown = newNames.slice(0, SUMMARY_SIGNATURE_NAME_LIMIT).join(' · ');
        const rest = newNames.length - SUMMARY_SIGNATURE_NAME_LIMIT;
        lines.push({
            id: 'signatures',
            highlight: newNames.length > 0,
            text: newNames.length > 0
                ? MSG.CYCLE_SUMMARY_SIGNATURES(newNames.length, rest > 0 ? MSG.CYCLE_SUMMARY_SIGNATURES_MORE(shown, rest) : shown, discovered, total)
                : MSG.CYCLE_SUMMARY_SIGNATURES_NONE(discovered, total),
        });
    }
    if (summary.eliteTitles) {
        const { gained, owned, total } = summary.eliteTitles;
        lines.push({
            id: 'elite',
            highlight: gained > 0,
            text: gained > 0 ? MSG.CYCLE_SUMMARY_ELITE(gained, owned, total) : MSG.CYCLE_SUMMARY_ELITE_NONE(owned, total),
        });
    }
    if (summary.mirrorUnlocked) {
        const { steps, gains } = summary.mirror;
        lines.push({
            id: 'mirror',
            highlight: steps > 0,
            text: steps > 0 ? MSG.ASCEND_MIRROR_ENDLESS_CYCLE(steps, gains.atk, gains.hp, gains.mp) : MSG.ASCEND_MIRROR_ENDLESS_CYCLE_NONE,
        });
    }
    return lines;
};
