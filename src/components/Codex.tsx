import { useState, useMemo, useCallback } from 'react';
import { BookOpen, Bug, Gift, Hammer, Leaf, Sparkles, Sword } from 'lucide-react';
// cycle 321: unused BALANCE / MSG imports 제거 — Codex.tsx 어디에서도 참조 0건.
import { DB } from '../data/db';
import { getCodexProgress } from '../data/codexRewards';
import { SIGNATURE_ITEM_REGISTRY } from '../data/signatureItems.js';
import { AT } from '../reducers/actionTypes';
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
import CodexDiscoveryOverlay from './codex/CodexDiscoveryOverlay';
import type { Player } from '../types/index.js';

// cycle 405: `compact?: boolean;` 제거 — 본체 destructure 미사용 + read 0건.
//   Dashboard가 prop pass했으나 silent dropped (paired remove).
interface CodexProps {
    player?: Player | null;
    dispatch: (action: any) => void;
}

type CodexTabId = 'equip' | 'monster' | 'recipe' | 'material' | 'legend';

const SUB_TABS: Array<{ id: CodexTabId; label: string; icon: typeof Sword }> = [
    { id: 'equip', label: '장비', icon: Sword },
    { id: 'monster', label: '몬스터', icon: Bug },
    { id: 'recipe', label: '제작법', icon: Hammer },
    { id: 'material', label: '소재', icon: Leaf },
    { id: 'legend', label: '전설', icon: Sparkles },
];

const Codex = ({ player, dispatch }: CodexProps) => {
    const [subTab, setSubTab] = useState<CodexTabId>('equip');
    const [discoveryEntry, setDiscoveryEntry] = useState<any>(null);
    const dismissDiscovery = useCallback(() => setDiscoveryEntry(null), []);
    const progress = useMemo(() => {
        const codex = player?.stats?.codex || {};
        const claimed = player?.stats?.codexClaimed || [];
        return getCodexProgress(codex, claimed);
    }, [player?.stats?.codex, player?.stats?.codexClaimed]);

    // 전체 도감 항목 수 계산
    const totalCounts = useMemo(() => {
        const weapons = DB.ITEMS.weapons?.length || 0;
        const armors = (DB.ITEMS.armors || []).filter((a: any) => a.type === 'armor').length;
        const shields = (DB.ITEMS.armors || []).filter((a: any) => a.type === 'shield').length;
        // cycle 70: 몬스터 도감 totalCount에 boss / bossMonsters도 포함.
        const monsters = new Set<string>();
        (Object.values(DB.MAPS) as any[]).forEach((map: any) => {
            (map.monsters || []).forEach((m: string) => monsters.add(m));
            (map.bossMonsters || []).forEach((m: string) => monsters.add(m));
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
    const pct = totalAll > 0 ? Math.round((discoveredAll / totalAll) * 100) : 0;

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
            const item = all.find((entry: any) => entry?.name === itemName);
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
        <div data-testid="codex-panel" className="font-readable">
            <header data-testid="codex-summary" className="border-b border-white/10 pb-4">
                <div className="flex items-start gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-[#7dd4d8]/24 bg-[#7dd4d8]/10">
                        <BookOpen size={20} className="text-[#dff7f5]" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-3">
                            <h2 className="aether-type-title font-semibold text-slate-100">모험 도감</h2>
                            <span className="aether-type-body shrink-0 font-semibold text-[#dff7f5]">
                                {discoveredAll}/{totalAll}
                            </span>
                        </div>
                        <p className="aether-type-meta mt-0.5 text-slate-400/76">
                            발견한 장비와 생물, 제작 기록을 오래 보존합니다
                        </p>
                    </div>
                </div>
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.07]">
                    <div
                        style={{ width: `${pct}%` }}
                        className="h-full rounded-full bg-[linear-gradient(90deg,#7dd4d8_0%,#d5b180_100%)] transition-all duration-700"
                    />
                </div>
            </header>

            {progress.unclaimed.length > 0 && (
                <section data-testid="codex-claimable" className="border-b border-[#d5b180]/20 py-4">
                    <div className="flex items-center gap-2">
                        <Gift size={16} className="text-[#f6e7c8]" />
                        <h3 className="aether-type-title font-semibold text-slate-100">받을 수집 보상</h3>
                        <span className="aether-type-meta text-[#d5b180]">{progress.unclaimed.length}개</span>
                    </div>
                    <div className="mt-2 divide-y divide-white/8">
                        {progress.unclaimed.map((milestone: any) => (
                            <div key={milestone.id} className="flex min-h-14 items-center gap-3 py-2">
                                <div className="min-w-0 flex-1">
                                    <div className="aether-type-body font-semibold text-slate-100">{milestone.label}</div>
                                    <div className="aether-type-meta mt-0.5 text-[#d5b180]">
                                        {formatCodexRewardParts(milestone.reward).join(' · ')}
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    data-testid={`codex-claim-${milestone.id}`}
                                    onClick={() => dispatch?.({
                                        type: AT.CLAIM_CODEX_REWARD,
                                        payload: { milestoneId: milestone.id },
                                    })}
                                    className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg border border-[#d5b180]/32 bg-[#d5b180]/12 px-3 text-sm font-semibold text-[#f6e7c8] transition-colors hover:bg-[#d5b180]/18"
                                >
                                    <Gift size={15} />
                                    받기
                                </button>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            <section data-testid="codex-next-goals" className="border-b border-white/10 py-4">
                <div className="flex items-baseline justify-between gap-3">
                    <h3 className="aether-type-title font-semibold text-slate-100">다음 수집 목표</h3>
                    <span className="aether-type-meta text-slate-400/76">가장 가까운 보상</span>
                </div>
                <div className="mt-2 divide-y divide-white/8">
                    {nextGoals.map((goal) => {
                        const goalPct = Math.min(100, (goal.current / Math.max(1, goal.count)) * 100);
                        return (
                            <div key={goal.id} data-testid={`codex-next-goal-${goal.id}`} className="py-2.5">
                                <div className="flex items-baseline justify-between gap-3">
                                    <div className="min-w-0">
                                        <span className="aether-type-body font-semibold text-slate-100">{goal.label}</span>
                                        <span className="aether-type-meta ml-2 text-slate-400/76">
                                            {CODEX_CATEGORY_LABELS[goal.category]}
                                        </span>
                                    </div>
                                    <span className="aether-type-body shrink-0 text-[#dff7f5]">{goal.current}/{goal.count}</span>
                                </div>
                                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                                    <div className="h-full rounded-full bg-[#7dd4d8]" style={{ width: `${goalPct}%` }} />
                                </div>
                                <div className="aether-type-meta mt-1.5 text-[#d5b180]">
                                    {formatCodexRewardParts(goal.reward).join(' · ')} · {goal.remaining}개 남음
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>

            <nav aria-label="도감 분류" className="grid grid-cols-5 gap-1 py-4" data-testid="codex-category-tabs">
                {SUB_TABS.map((tab) => {
                    const Icon = tab.icon;
                    const active = subTab === tab.id;
                    const count = tabProgress[tab.id];
                    const activeTone = tab.id === 'legend'
                        ? 'border-[#d5b180]/38 bg-[#d5b180]/12 text-[#f6e7c8]'
                        : 'border-[#7dd4d8]/38 bg-[#7dd4d8]/12 text-slate-100';
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            data-testid={`codex-tab-${tab.id}`}
                            aria-current={active ? 'page' : undefined}
                            onClick={() => setSubTab(tab.id)}
                            className={`flex min-h-14 min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg border px-1 text-[11px] font-semibold transition-colors ${
                                active ? activeTone : 'border-white/8 bg-white/[0.03] text-slate-400 hover:text-slate-200'
                            }`}
                        >
                            <span className="inline-flex items-center gap-1">
                                <Icon size={14} />
                                {tab.label}
                            </span>
                            <span className="text-[11px] font-normal opacity-75">{count.discovered}/{count.total}</span>
                        </button>
                    );
                })}
            </nav>

            <section data-testid={`codex-content-${subTab}`} className="border-t border-white/10 pt-4">
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
