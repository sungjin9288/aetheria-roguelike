import { MSG } from '../../data/messages';
import { BAG_RECIPES, getBagSlotBonus, getBagTier } from '../../data/bagRecipes';
import { getBaseInventoryCapacity, getInventoryCapacity } from '../../utils/inventoryCapacity';
import { getBagCraftReadiness } from '../../utils/bagCrafting';
import ActionButton from '../ui/ActionButton';
import Chip from '../ui/Chip';
import type { Player } from '../../types/index.js';

interface BagCraftingSectionProps {
    player: Player;
    onCraftBag?: () => void;
}

/**
 * 제작소의 가방 탭(2026-09 Wave 33). 단계 목록과 다음 단계의 재료 충족 여부만 그린다 —
 * 단계·재료·골드 판정의 정본은 reducer `CRAFT_BAG`이고, 여기서의 준비 표시는 안내다.
 * 2026-10 에테르 유리: 단계마다 유리 카드(`.ae-town .aether-craft-row`) · 만들기는 유리 단추 · 재료는 칩.
 */
const BagCraftingSection = ({ player, onCraftBag }: BagCraftingSectionProps) => {
    const tier = getBagTier(player.bagTier);
    const base = getBaseInventoryCapacity(player);
    const bonus = getBagSlotBonus(tier);
    const inventory = player.inv || [];
    const countOf = (name: string) => inventory.filter((item) => item.name === name).length;
    const next = getBagCraftReadiness(player);

    return (
        <div data-testid="bag-crafting-section" className="flex-1 space-y-2 overflow-y-auto pr-1 custom-scrollbar">
            <div data-testid="bag-capacity" className="ae-card px-3 py-2.5">
                <div className="font-readable text-[13px] font-bold text-ae-ink">{MSG.BAG_CAPACITY(getInventoryCapacity(player), base, bonus)}</div>
                <div className="aether-type-body mt-1 font-readable leading-snug text-ae-ink-2">{MSG.BAG_RUN_SCOPE_NOTE}</div>
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
                        className={`aether-craft-row flex flex-col gap-2 px-3 py-2.5 ${state === 'locked' ? 'aether-locked-row' : ''}`}
                    >
                        <div className="flex items-start gap-3">
                            <div className="min-w-0 flex-1">
                                <div className="break-words font-display text-[14px] font-bold text-ae-ink">
                                    {recipe.name} <span className="text-ae-ether-hi">{MSG.BAG_SLOTS(recipe.slots)}</span>
                                </div>
                                <div className="aether-type-body mt-0.5 font-readable leading-snug text-ae-ink-2">{recipe.desc}</div>
                            </div>
                            {done ? (
                                <Chip tone="good" className="shrink-0 font-bold">{MSG.BAG_STATE_DONE}</Chip>
                            ) : isNext ? (
                                <ActionButton
                                    data-testid="bag-craft-action"
                                    onClick={() => onCraftBag?.()}
                                    disabled={!ready}
                                    label={ready ? MSG.BAG_ACTION_CRAFT : MSG.BAG_ACTION_CHECK}
                                    className="aether-disabled-action min-h-[44px] shrink-0 whitespace-nowrap px-3.5 text-[13px]"
                                />
                            ) : null}
                        </div>
                        {!done && (
                            <>
                                <div className="aether-type-label font-readable text-ae-gold-text">{MSG.BAG_GOLD(recipe.gold)}</div>
                                {state === 'locked' && (
                                    <div className="aether-lock-note px-2 py-1 font-readable text-[12px] leading-snug">{MSG.BAG_STATE_LOCKED}</div>
                                )}
                                <div className="flex flex-wrap gap-1.5">
                                    {inputs.map((input) => (
                                        <Chip
                                            key={`${recipe.tier}_${input.name}`}
                                            tone={input.owned >= input.qty ? 'good' : 'threat'}
                                        >
                                            {input.name} {Math.min(input.owned, input.qty)}/{input.qty}
                                        </Chip>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                );
            })}
            {tier >= BAG_RECIPES.length && (
                <div className="px-3 py-2 text-center font-readable text-[12px] text-ae-ink-2">{MSG.BAG_ALL_DONE}</div>
            )}
        </div>
    );
};

export default BagCraftingSection;
