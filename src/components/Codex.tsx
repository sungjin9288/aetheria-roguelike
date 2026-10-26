import { useState, useMemo, useCallback, type Dispatch } from 'react';
import { BookOpen, Bug, Gift, Hammer, Leaf, Sparkles, Sword } from 'lucide-react';
// cycle 321: unused BALANCE import 제거 — MSG는 2026-10 Wave 89 수집 완주 요약에서 다시 쓴다.
import { DB } from '../data/db';
import { getCodexProgress } from '../data/codexRewards';
import { SIGNATURE_ITEM_REGISTRY } from '../data/signatureItems.js';
import { AT } from '../reducers/actionTypes';
import { MSG } from '../data/messages';
import { getCollectionSummary } from '../utils/ascensionRuleView';
import {
    CODEX_CATEGORY_LABELS,
    formatCodexRewardParts,
    getNextCodexGoals,
    type CodexCategoryId,
} from '../utils/codexPresentation';
import WeaponCodex from './codex/WeaponCodex';
import MonsterCodex from './codex/MonsterCodex';
import RecipeCodex from './codex/RecipeCodex';
import MaterialCodex from './codex/MaterialCodex';
import LegendaryCodex from './codex/LegendaryCodex';
import CodexDiscoveryOverlay, { type CodexDiscoveryEntry } from './codex/CodexDiscoveryOverlay';
import ActionButton from './ui/ActionButton';
import Gauge from './ui/Gauge';
import type { Player } from '../types/index.js';
import type { GameAction } from '../reducers/gameReducer';

// cycle 405: `compact?: boolean;` 제거 — 본체 destructure 미사용 + read 0건.
//   Dashboard가 prop pass했으나 silent dropped (paired remove).
interface CodexProps {
    player?: Player | null;
    dispatch: Dispatch<GameAction>;
}

type CodexTabId = 'equip' | 'monster' | 'recipe' | 'material' | 'legend';

const SUB_TABS: Array<{ id: CodexTabId; icon: typeof Sword }> = [
    { id: 'equip', icon: Sword },
    { id: 'monster', icon: Bug },
    { id: 'recipe', icon: Hammer },
    { id: 'material', icon: Leaf },
    { id: 'legend', icon: Sparkles },
];

const Codex = ({ player, dispatch }: CodexProps) => {
    const [subTab, setSubTab] = useState<CodexTabId>('equip');
    const [discoveryEntry, setDiscoveryEntry] = useState<CodexDiscoveryEntry | null>(null);
    const dismissDiscovery = useCallback(() => setDiscoveryEntry(null), []);
    const progress = useMemo(() => {
        const codex = player?.stats?.codex || {};
        const claimed = player?.stats?.codexClaimed || [];
        return getCodexProgress(codex, claimed);
    }, [player?.stats?.codex, player?.stats?.codexClaimed]);

    // 전체 도감 항목 수 계산
    const totalCounts = useMemo(() => {
        const weapons = DB.ITEMS.weapons?.length || 0;
        const armors = (DB.ITEMS.armors || []).filter((a) => a.type === 'armor').length;
        const shields = (DB.ITEMS.armors || []).filter((a) => a.type === 'shield').length;
        // cycle 70: 몬스터 도감 totalCount에 boss / bossMonsters도 포함.
        const monsters = new Set<string>();
        Object.values(DB.MAPS).forEach((map) => {
            (map.monsters || []).forEach((m) => monsters.add(m));
            (map.bossMonsters || []).forEach((m) => monsters.add(m));
            if (typeof map.boss === 'string') monsters.add(map.boss);
        });
        const recipes = DB.ITEMS.recipes?.length || 0;
        const materials = DB.ITEMS.materials?.length || 0;
        return { weapons, armors, shields, monsters: monsters.size, recipes, materials };
    }, []);

    const discoveredCounts = useMemo(() => {
        const codex = player?.stats?.codex || {};
        return {
            weapons: Object.keys(codex.weapons || {}).length,
            armors: Object.keys(codex.armors || {}).length,
            shields: Object.keys(codex.shields || {}).length,
            monsters: Object.keys(codex.monsters || {}).length,
            recipes: Object.keys(codex.recipes || {}).length,
            materials: Object.keys(codex.materials || {}).length,
        };
    }, [player?.stats?.codex]);

    const codex = useMemo(() => player?.stats?.codex || {}, [player?.stats?.codex]);
    const totalAll = totalCounts.weapons + totalCounts.armors + totalCounts.shields + totalCounts.monsters + totalCounts.recipes + totalCounts.materials;
    const discoveredAll = discoveredCounts.weapons + discoveredCounts.armors + discoveredCounts.shields + discoveredCounts.monsters + discoveredCounts.recipes + discoveredCounts.materials;

    // cycle 454: 백분율 출력 dead 정리 — UI는 `discovered/total`만 표시.
    //   pct 필드 read 0건 (전체 src/).
    const legendaryCount = useMemo(() => {
        const total = Object.keys(SIGNATURE_ITEM_REGISTRY).length;
        let discovered = 0;
        const all = [
            ...(DB.ITEMS.weapons || []),
            ...(DB.ITEMS.armors || []),
        ];
        for (const itemName of Object.keys(SIGNATURE_ITEM_REGISTRY)) {
            const item = all.find((entry) => entry?.name === itemName);
            if (!item) continue;
            const bucket = item.type === 'weapon' ? 'weapons' : item.type === 'shield' ? 'shields' : 'armors';
            if (codex[bucket]?.[itemName]) discovered += 1;
        }
        return { total, discovered };
    }, [codex]);

    const nextGoals = useMemo(() => getNextCodexGoals(
        progress.milestones,
        discoveredCounts as Partial<Record<CodexCategoryId, number>>,
    ), [discoveredCounts, progress.milestones]);

    const collection = useMemo(() => (player ? getCollectionSummary(player) : null), [player]);

    const tabProgress = useMemo(() => ({
        equip: {
            discovered: discoveredCounts.weapons + discoveredCounts.armors + discoveredCounts.shields,
            total: totalCounts.weapons + totalCounts.armors + totalCounts.shields,
        },
        monster: { discovered: discoveredCounts.monsters, total: totalCounts.monsters },
        recipe: { discovered: discoveredCounts.recipes, total: totalCounts.recipes },
        material: { discovered: discoveredCounts.materials, total: totalCounts.materials },
        legend: legendaryCount,
    }), [discoveredCounts, legendaryCount, totalCounts]);

    return (
        <div data-testid="codex-panel" className="ab-stack font-readable">
            <header data-testid="codex-summary" className="ae-card ab-card-pad">
                <div className="flex items-start gap-3">
                    <span className="ab-icon-well is-ether" aria-hidden="true">
                        <BookOpen size={20} />
                    </span>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-3">
                            <h2 className="ab-section-title">{MSG.CODEX_PANEL_TITLE}</h2>
                            <span className="aether-type-body shrink-0 font-fira font-semibold tabular-nums text-ae-ether-hi">
                                {discoveredAll}/{totalAll}
                            </span>
                        </div>
                        <p className="aether-type-meta mt-0.5 text-ae-ink-3">
                            {MSG.CODEX_SUBTITLE}
                        </p>
                    </div>
                </div>
                <Gauge kind="ether" value={discoveredAll} max={Math.max(1, totalAll)} label={MSG.CODEX_PANEL_TITLE} className="mt-3" />
            </header>

            {progress.unclaimed.length > 0 && (
                <section data-testid="codex-claimable" className="ab-mission ab-card-pad">
                    <div className="flex items-center gap-2">
                        <Gift size={16} className="text-ae-gold-text" aria-hidden="true" />
                        <h3 className="ab-section-title">{MSG.CODEX_PANEL_CLAIMABLE_TITLE}</h3>
                        <span className="aether-type-meta font-fira tabular-nums text-ae-gold-text">{MSG.CODEX_PANEL_COUNT(progress.unclaimed.length)}</span>
                    </div>
                    <div className="ab-rows mt-2">
                        {progress.unclaimed.map((milestone) => (
                            <div key={milestone.id} className="flex min-h-14 items-center gap-3 py-2">
                                <div className="min-w-0 flex-1">
                                    <div className="aether-type-body font-semibold text-ae-ink">{milestone.label}</div>
                                    <div className="aether-type-meta mt-0.5 text-ae-gold-text">
                                        {formatCodexRewardParts(milestone.reward, player).join(' · ')}
                                    </div>
                                </div>
                                <ActionButton
                                    variant="glass"
                                    data-testid={`codex-claim-${milestone.id}`}
                                    onClick={() => dispatch?.({
                                        type: AT.CLAIM_CODEX_REWARD,
                                        payload: { milestoneId: milestone.id },
                                    })}
                                    icon={<Gift size={15} />}
                                    label={MSG.CODEX_PANEL_CLAIM}
                                    className="shrink-0"
                                />
                            </div>
                        ))}
                    </div>
                </section>
            )}

            <section data-testid="codex-next-goals" className="ae-card ab-card-pad">
                <div className="flex items-baseline justify-between gap-3">
                    <h3 className="ab-section-title">{MSG.CODEX_PANEL_NEXT_TITLE}</h3>
                    <span className="aether-type-meta text-ae-ink-3">{MSG.CODEX_PANEL_NEXT_HINT}</span>
                </div>
                <div className="ab-rows mt-2">
                    {nextGoals.map((goal) => (
                        <div key={goal.id} data-testid={`codex-next-goal-${goal.id}`} className="py-2.5">
                            <div className="flex items-baseline justify-between gap-3">
                                <div className="min-w-0">
                                    <span className="aether-type-body font-semibold text-ae-ink">{goal.label}</span>
                                    <span className="aether-type-meta ml-2 text-ae-ink-3">
                                        {CODEX_CATEGORY_LABELS[goal.category]}
                                    </span>
                                </div>
                                <span className="aether-type-body shrink-0 font-fira tabular-nums text-ae-ether-hi">{goal.current}/{goal.count}</span>
                            </div>
                            <Gauge
                                kind="ether"
                                value={Math.min(goal.current, goal.count)}
                                max={Math.max(1, goal.count)}
                                label={goal.label}
                                className="ab-gauge-thin mt-1.5"
                            />
                            <div className="aether-type-meta mt-1.5 text-ae-gold-text">
                                {MSG.CODEX_PANEL_GOAL_REWARD(formatCodexRewardParts(goal.reward, player).join(' · '), goal.remaining)}
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {collection && (
                // 2026-10 Wave 89: 수집 완주 — 전설 각인 세트별 발견 수와 회차 규칙 정복 수, 이번 회차의 표적 세트.
                <section data-testid="codex-collection" className="ae-card is-quiet ab-card-pad">
                    <div className="flex items-baseline justify-between gap-3">
                        <h3 className="ab-section-title">{MSG.COLLECTION_SUMMARY_TITLE}</h3>
                        <span data-testid="codex-collection-conquest" className="aether-type-meta shrink-0 text-ae-gold-text">{collection.conquestLabel}</span>
                    </div>
                    {collection.featuredLabel && (
                        <p data-testid="codex-collection-featured" className="aether-type-meta mt-1 text-ae-ether-hi">{collection.featuredLabel}</p>
                    )}
                    <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
                        {collection.sets.map((row) => (
                            <li
                                key={row.key}
                                data-testid={`codex-collection-set-${row.key}`}
                                className={`aether-type-meta ${row.complete ? 'text-ae-gold-text' : row.featured ? 'text-ae-ether-hi' : 'text-ae-ink-2'}`}
                            >
                                {row.label}
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            <nav aria-label={MSG.CODEX_PANEL_CATEGORY_ARIA} className="ab-rail grid-cols-5" data-testid="codex-category-tabs">
                {SUB_TABS.map((tab) => {
                    const Icon = tab.icon;
                    const active = subTab === tab.id;
                    const count = tabProgress[tab.id];
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            data-testid={`codex-tab-${tab.id}`}
                            aria-current={active ? 'page' : undefined}
                            onClick={() => setSubTab(tab.id)}
                            className="ab-rail-tab min-w-0 px-1"
                        >
                            <span className="inline-flex items-center gap-1">
                                <Icon size={14} aria-hidden="true" />
                                {MSG.CODEX_PANEL_TAB_LABELS[tab.id]}
                            </span>
                            <span className="font-fira font-normal tabular-nums">{count.discovered}/{count.total}</span>
                        </button>
                    );
                })}
            </nav>

            <section data-testid={`codex-content-${subTab}`}>
                {subTab === 'equip' && (
                    <WeaponCodex
                        codex={codex}
                        totalCounts={totalCounts}
                        discoveredCounts={discoveredCounts}
                        progress={progress}
                        player={player}
                    />
                )}
                {subTab === 'monster' && <MonsterCodex player={player} />}
                {subTab === 'recipe' && <RecipeCodex codex={codex} player={player} />}
                {subTab === 'material' && <MaterialCodex codex={codex} />}
                {subTab === 'legend' && <LegendaryCodex player={player} />}
            </section>

            <CodexDiscoveryOverlay entry={discoveryEntry} onDismiss={dismissDiscovery} />
        </div>
    );
};

export default Codex;
