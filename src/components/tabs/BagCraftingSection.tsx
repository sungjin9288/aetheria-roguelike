import { motion as Motion } from 'framer-motion';
import { MSG } from '../../data/messages';
import { BAG_RECIPES, getBagSlotBonus, getBagTier } from '../../data/bagRecipes';
import { getBaseInventoryCapacity, getInventoryCapacity } from '../../utils/inventoryCapacity';
import { getBagCraftReadiness } from '../../utils/bagCrafting';
import type { Player } from '../../types/index.js';

interface BagCraftingSectionProps {
    player: Player;
    onCraftBag?: () => void;
}

/**
 * 제작소의 가방 탭(2026-09 Wave 33). 단계 목록과 다음 단계의 재료 충족 여부만 그린다 —
 * 단계·재료·골드 판정의 정본은 reducer `CRAFT_BAG`이고, 여기서의 준비 표시는 안내다.
 */
const BagCraftingSection = ({ player, onCraftBag }: BagCraftingSectionProps) => {
    const tier = getBagTier(player.bagTier);
    const base = getBaseInventoryCapacity(player);
    const bonus = getBagSlotBonus(tier);
    const inventory = player.inv || [];
    const countOf = (name: string) => inventory.filter((item) => item.name === name).length;
    const next = getBagCraftReadiness(player);

    return (
        <div data-testid="bag-crafting-section" className="flex-1 space-y-2 overflow-y-auto pr-2 custom-scrollbar">
            <div data-testid="bag-capacity" className="aether-craft-row rounded-md px-3 py-2.5">
                <div className="font-readable text-[13px] font-bold text-white">{MSG.BAG_CAPACITY(getInventoryCapacity(player), base, bonus)}</div>
                <div className="aether-type-body mt-1 font-readable leading-snug text-slate-300/82">{MSG.BAG_RUN_SCOPE_NOTE}</div>
            </div>
            {BAG_RECIPES.map((recipe) => {
                const done = recipe.tier <= tier;
                const isNext = recipe.tier === tier + 1;
                const inputs = recipe.inputs.map((input) => ({ ...input, owned: countOf(input.name) }));
                const ready = isNext && Boolean(next?.ready);
                const state = done ? 'done' : ready ? 'ready' : isNext ? 'short' : 'locked';
                return (
                    <div
                        key={recipe.tier}
                        data-testid={`bag-recipe-${recipe.tier}`}
                        data-bag-state={state}
                        className={`aether-craft-row flex flex-col gap-2 rounded-md px-3 py-2.5 ${state === 'locked' ? 'aether-locked-row' : ''}`}
                    >
                        <div className="flex items-start gap-3">
                            <div className="min-w-0 flex-1">
                                <div className="break-words font-rajdhani text-[14px] font-bold text-white">
                                    {recipe.name} <span className="text-orange-200/86">{MSG.BAG_SLOTS(recipe.slots)}</span>
                                </div>
                                <div className="aether-type-body mt-0.5 font-readable leading-snug text-slate-300/82">{recipe.desc}</div>
                            </div>
                            {done ? (
                                <span className="shrink-0 text-[11px] font-readable font-bold text-cyber-green">{MSG.BAG_STATE_DONE}</span>
                            ) : isNext ? (
                                <Motion.button
                                    data-testid="bag-craft-action"
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => onCraftBag?.()}
                                    disabled={!ready}
                                    className="aether-disabled-action min-h-[44px] whitespace-nowrap rounded-sm border border-orange-500/50 bg-orange-500/10 px-4 py-1.5 text-[11px] font-bold tracking-wider text-orange-200 transition-all hover:bg-orange-500/20"
                                >
                                    {ready ? MSG.BAG_ACTION_CRAFT : MSG.BAG_ACTION_CHECK}
                                </Motion.button>
                            ) : null}
                        </div>
                        {!done && (
                            <>
                                <div className="aether-type-label font-readable text-orange-200/86">{MSG.BAG_GOLD(recipe.gold)}</div>
                                {state === 'locked' && (
                                    <div className="aether-lock-note rounded-[0.65rem] px-2 py-1 font-readable text-[11px] leading-snug">{MSG.BAG_STATE_LOCKED}</div>
                                )}
                                <div className="flex flex-wrap gap-1.5 text-[11px] font-fira">
                                    {inputs.map((input) => (
                                        <span
                                            key={`${recipe.tier}_${input.name}`}
                                            className={`rounded border px-2 py-1 ${input.owned >= input.qty ? 'border-cyber-green/30 bg-cyber-green/10 text-cyber-green' : 'border-red-500/30 bg-red-950/20 text-red-400'}`}
                                        >
                                            {input.name} {Math.min(input.owned, input.qty)}/{input.qty}
                                        </span>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                );
            })}
            {tier >= BAG_RECIPES.length && (
                <div className="px-3 py-2 text-center font-readable text-[12px] text-slate-300/78">{MSG.BAG_ALL_DONE}</div>
            )}
        </div>
    );
};

export default BagCraftingSection;
