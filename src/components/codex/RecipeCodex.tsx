import { useState } from 'react';
import { Check, ChevronDown, Hammer } from 'lucide-react';
import { DB } from '../../data/db';

interface RecipeCodexProps {
    codex?: any;
    player?: any;
}

const RecipeCodex = ({ codex = {}, player }: RecipeCodexProps) => {
    const [selected, setSelected] = useState<string | null>(null);
    const recipes = DB.ITEMS.recipes || [];
    const recipeCodex = codex.recipes || {};
    const inventory = player?.inv || [];

    const discoveredRecipes = recipes.map((recipe: any) => {
        const found = Boolean(recipeCodex[recipe.id]);
        const hasGold = (player?.gold || 0) >= recipe.gold;
        const inputs = recipe.inputs.map((input: any) => {
            const owned = inventory.filter((item: any) => item.name === input.name).length;
            return { ...input, owned, enough: owned >= input.qty };
        });
        return {
            recipe,
            found,
            hasGold,
            inputs,
            canCraft: found && hasGold && inputs.every((input: any) => input.enough),
        };
    }).filter((entry) => entry.found);

    const craftable = discoveredRecipes.filter((entry) => entry.canCraft);
    const preparing = discoveredRecipes.filter((entry) => !entry.canCraft);

    const renderGroup = (label: string, entries: typeof discoveredRecipes) => {
        if (entries.length === 0) return null;
        return (
            <details className="group border-b border-white/10">
                <summary className="flex min-h-14 cursor-pointer list-none items-center gap-2 py-3 [&::-webkit-details-marker]:hidden">
                    <Hammer size={16} className="text-[#d5b180]" />
                    <span className="aether-type-body flex-1 font-semibold text-slate-100">{label}</span>
                    <span className="aether-type-meta text-slate-400/76">{entries.length}개</span>
                    <ChevronDown size={16} className="text-slate-500 transition-transform group-open:rotate-180" />
                </summary>
                <div className="divide-y divide-white/8 pb-2">
                    {entries.map(({ recipe, canCraft, hasGold, inputs }) => {
                        const active = selected === recipe.id;
                        return (
                            <div key={recipe.id}>
                                <button
                                    type="button"
                                    onClick={() => setSelected(active ? null : recipe.id)}
                                    className="flex min-h-14 w-full items-center gap-2 px-2 text-left transition-colors hover:bg-white/[0.03]"
                                >
                                    <Check size={16} className={canCraft ? 'text-emerald-200' : 'text-slate-500'} />
                                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-100">{recipe.name}</span>
                                    <span className={`text-[11px] ${canCraft ? 'text-emerald-200' : 'text-slate-400'}`}>
                                        {canCraft ? '제작 가능' : '준비 필요'}
                                    </span>
                                </button>
                                {active && (
                                    <div data-testid={`codex-recipe-detail-${recipe.id}`} className="border-t border-white/8 px-10 py-3 text-[11px]">
                                        <div className="text-slate-400">필요 재료</div>
                                        <div className="mt-1.5 space-y-1">
                                            {inputs.map((input: any) => (
                                                <div key={input.name} className={input.enough ? 'text-emerald-200' : 'text-rose-200'}>
                                                    {input.name} · 필요 {input.qty}개 · 보유 {input.owned}개
                                                </div>
                                            ))}
                                        </div>
                                        <div className={`mt-2 ${hasGold ? 'text-[#d5b180]' : 'text-rose-200'}`}>
                                            비용: 골드 {recipe.gold} · 보유 골드 {player?.gold || 0}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </details>
        );
    };

    return (
        <div data-testid="codex-recipes" className="space-y-4">
            <div className="flex items-baseline justify-between gap-3">
                <div>
                    <h3 className="aether-type-title font-semibold text-slate-100">제작 기록</h3>
                    <p className="aether-type-meta mt-0.5 text-slate-400/76">직접 완성한 제작법과 다시 만들 준비를 확인합니다</p>
                </div>
                <span className="aether-type-body shrink-0 text-[#dff7f5]">{discoveredRecipes.length}/{recipes.length}</span>
            </div>

            {discoveredRecipes.length === 0 && (
                <div className="border-y border-white/10 py-3">
                    <div className="aether-type-body font-semibold text-slate-100">첫 제작법을 기록하세요</div>
                    <div className="aether-type-meta mt-1 text-slate-400/76">마을 제작소에서 제작에 성공하면 제작법과 결과 장비가 함께 도감에 남습니다</div>
                </div>
            )}

            <div className="border-t border-white/10">
                {renderGroup('지금 제작 가능', craftable)}
                {renderGroup('재료 준비 필요', preparing)}
            </div>

            <div data-testid="codex-recipe-undiscovered" className="border-y border-white/10 py-3">
                <div className="aether-type-body text-slate-300">미발견 제작법 {recipes.length - discoveredRecipes.length}개</div>
                <div className="aether-type-meta mt-1 text-slate-500">아직 만들지 않은 제작법은 빈 카드 대신 남은 수로만 보여 줍니다</div>
            </div>
        </div>
    );
};

export default RecipeCodex;
