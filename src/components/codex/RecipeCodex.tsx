import { useState } from 'react';
import { Check, ChevronDown, Hammer } from 'lucide-react';
import { DB } from '../../data/db';
import { MSG } from '../../data/messages';
import type { CodexEntry, ItemRecipeDef, Player } from '../../types/index.js';

interface RecipeCodexProps {
    codex?: { recipes?: Record<string, CodexEntry> };
    player?: Player | null;
}

const RecipeCodex = ({ codex = {}, player }: RecipeCodexProps) => {
    const [selected, setSelected] = useState<string | null>(null);
    const recipes = DB.ITEMS.recipes || [];
    const recipeCodex = codex.recipes || {};
    const inventory = player?.inv || [];

    const discoveredRecipes = recipes.map((recipe: ItemRecipeDef) => {
        const found = Boolean(recipeCodex[recipe.id ?? '']);
        const hasGold = (player?.gold || 0) >= (recipe.gold ?? 0);
        const inputs = (recipe.inputs || []).map((input) => {
            const owned = inventory.filter((item) => item.name === input.name).length;
            return { ...input, owned, enough: owned >= (input.qty ?? 0) };
        });
        return {
            recipe,
            found,
            hasGold,
            inputs,
            canCraft: found && hasGold && inputs.every((input) => input.enough),
        };
    }).filter((entry) => entry.found);

    const craftable = discoveredRecipes.filter((entry) => entry.canCraft);
    const preparing = discoveredRecipes.filter((entry) => !entry.canCraft);

    const renderGroup = (label: string, entries: typeof discoveredRecipes) => {
        if (entries.length === 0) return null;
        return (
            <details className="group">
                <summary className="ab-summary min-h-14">
                    <span className="ab-icon-well is-gold" aria-hidden="true">
                        <Hammer size={16} />
                    </span>
                    <span className="aether-type-body flex-1 font-semibold text-ae-ink">{label}</span>
                    <span className="aether-type-meta font-fira tabular-nums text-ae-ink-3">{MSG.CODEX_PANEL_COUNT(entries.length)}</span>
                    <ChevronDown size={16} className="ab-chevron" aria-hidden="true" />
                </summary>
                <div className="ab-rows pb-2">
                    {entries.map(({ recipe, canCraft, hasGold, inputs }) => {
                        const active = selected === recipe.id;
                        return (
                            <div key={recipe.id}>
                                <button
                                    type="button"
                                    aria-expanded={active}
                                    onClick={() => setSelected(active ? null : (recipe.id ?? null))}
                                    className="ab-link-row flex min-h-14 w-full items-center gap-2 px-2 text-left"
                                >
                                    <Check size={16} className={`shrink-0 ${canCraft ? 'text-ae-good' : 'text-ae-ink-3'}`} aria-hidden="true" />
                                    <span className="aether-type-body min-w-0 flex-1 font-semibold text-ae-ink">{recipe.name}</span>
                                    <span className={`aether-type-meta shrink-0 ${canCraft ? 'text-ae-good' : 'text-ae-ink-3'}`}>
                                        {canCraft ? MSG.CODEX_RECIPE_STATUS_READY : MSG.CODEX_RECIPE_STATUS_PREP}
                                    </span>
                                </button>
                                {active && (
                                    <div data-testid={`codex-recipe-detail-${recipe.id}`} className="ae-well aether-type-meta mx-2 mb-2 px-3.5 py-3">
                                        <div className="text-ae-ink-3">{MSG.CODEX_RECIPE_INPUTS_TITLE}</div>
                                        <div className="mt-1.5 space-y-1">
                                            {inputs.map((input) => (
                                                <div key={input.name} className={input.enough ? 'text-ae-good' : 'text-ae-threat'}>
                                                    {MSG.CODEX_RECIPE_INPUT_ROW(input.name ?? '', input.qty, input.owned)}
                                                </div>
                                            ))}
                                        </div>
                                        <div className={`mt-2 font-fira tabular-nums ${hasGold ? 'text-ae-gold-text' : 'text-ae-threat'}`}>
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
        <div data-testid="codex-recipes" className="ab-stack">
            <div className="flex items-baseline justify-between gap-3 px-1">
                <div>
                    <h3 className="ab-section-title">{MSG.CODEX_RECIPE_TITLE}</h3>
                    <p className="aether-type-meta mt-0.5 text-ae-ink-3">{MSG.CODEX_RECIPE_DESC}</p>
                </div>
                <span className="aether-type-body shrink-0 font-fira tabular-nums text-ae-ether-hi">{discoveredRecipes.length}/{recipes.length}</span>
            </div>

            {discoveredRecipes.length === 0 && (
                <div className="ae-card is-quiet ab-card-pad">
                    <div className="aether-type-body font-semibold text-ae-ink">{MSG.CODEX_RECIPE_EMPTY_TITLE}</div>
                    <div className="aether-type-meta mt-1 text-ae-ink-3">{MSG.CODEX_RECIPE_EMPTY_HINT}</div>
                </div>
            )}

            {discoveredRecipes.length > 0 && (
                <div className="ae-card ab-rows px-3.5">
                    {renderGroup(MSG.CODEX_RECIPE_GROUP_READY, craftable)}
                    {renderGroup(MSG.CODEX_RECIPE_GROUP_PREP, preparing)}
                </div>
            )}

            <div data-testid="codex-recipe-undiscovered" className="ab-tile is-undiscovered px-3.5 py-3">
                <div className="aether-type-body text-ae-ink-2">{MSG.CODEX_RECIPE_UNDISCOVERED(recipes.length - discoveredRecipes.length)}</div>
                <div className="aether-type-meta mt-1 text-ae-ink-3">{MSG.CODEX_RECIPE_UNDISCOVERED_HINT}</div>
            </div>
        </div>
    );
};

export default RecipeCodex;
