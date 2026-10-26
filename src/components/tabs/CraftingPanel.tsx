import { useState, useMemo } from 'react';
import { motion as Motion } from 'framer-motion';
import { Hammer, ShieldCheck } from 'lucide-react';
import { DB } from '../../data/db';
import { BALANCE, RARITY_CLASSES } from '../../data/constants';
import { MSG } from '../../data/messages';
import { getSynthesisGroups, validateSynthesis } from '../../utils/synthesisUtils';
import { getItemRarity } from '../../utils/gameUtils';
import { getCraftingInvestmentPreview, getSynthesisOutcomePreviews } from '../../utils/itemInvestmentPreview';
import { getRecipeInputEnhanceUsage } from '../../utils/recipeInputSelection';
import { getVisibleCraftRecipes } from '../../utils/signatureDiscovery';
import FocusPanelHeader from '../FocusPanelHeader';
import ItemIcon from '../icons/ItemIcon';
import ActionButton from '../ui/ActionButton';
import Chip, { type ChipTone } from '../ui/Chip';
import BagCraftingSection from './BagCraftingSection';
import type { GameActions } from '../../hooks/actionDeps';
import type { Item, ItemRecipeDef, ItemType, Player } from '../../types/index.js';
import type { GameMode } from '../../reducers/gameStates';

const TYPE_LABEL: Record<string, string> = { weapon: '무기', armor: '방어구', shield: '방패' };

/** 등급 글자색 — 등급 색은 한 벌(`RARITY_CLASSES`)이다. */
const getRarityTextClass = (item: Item): string => RARITY_CLASSES[getItemRarity(item)] || 'text-ae-ink';

/** 장비 판정 점수 → 칩 색. 손해는 위험이 아니라 주의(금)다 — 장착 불가만 위험색이다. */
const getScoreChipTone = (score: number): ChipTone => (score > 0 ? 'good' : score < 0 ? 'gold' : 'neutral');

const getScoreTextClass = (score: number): string => (score > 0 ? 'text-ae-good' : score < 0 ? 'text-ae-gold-text' : 'text-ae-ink-2');

/** 재료 한 줄 — 충분하면 초록, 모자라면 위험색 칩. */
const getInputChipTone = (enough: boolean): ChipTone => (enough ? 'good' : 'threat');

/**
 * 합성 재료 고르기 목록 — 같은 타입 · 단계 묶음마다 보유 사본을 보인다. 사본마다 강화 수치(+N)를 함께 보여
 * 강화된 사본을 재료로 고르면 강화가 함께 사라진다는 것을 알 수 있다(Wave 62 C8).
 */
export const SynthesisInputGroups = ({ groups, selectedIds, onToggle }: {
  groups: ReturnType<typeof getSynthesisGroups>;
  selectedIds: string[];
  onToggle: (itemId: string) => void;
}) => (
  <>
    {groups.length === 0 ? (
      <div className="ae-town-group px-4 py-8 text-center font-readable text-[13px] text-ae-ink-2">
        합성할 수 있는 장비 조합이 없습니다.
      </div>
    ) : groups.map((group) => (
      <div key={`${group.type}_${group.tier}`} className="ae-town-group p-3">
        <div className="mb-2 flex items-center gap-2">
          <span className="aether-type-body font-readable font-bold text-ae-ink">{TYPE_LABEL[group.type]} {group.tier}단계</span>
          <span className="aether-type-label font-readable text-ae-ink-2"><span className="font-fira tabular-nums">{group.count}</span>개 보유</span>
        </div>
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {group.items.map((item) => {
            const isSelected = selectedIds.includes(item.id ?? '');
            return (
              <button
                type="button"
                key={item.id}
                data-testid={`synthesis-input-${item.id}`}
                aria-pressed={isSelected}
                onClick={() => item.id && onToggle(item.id)}
                className="ae-town-pick flex min-h-[48px] items-center gap-2 px-2 py-1.5 font-readable"
              >
                <ItemIcon item={item} size={30} showBorder className="shrink-0" />
                <span className={`aether-type-label min-w-0 break-words font-readable font-semibold ${getRarityTextClass(item)}`}>{item.name}</span>
                {(item.enhance || 0) > 0 && (
                  <span data-testid={`synthesis-input-enhance-${item.id}`} className="ml-auto shrink-0 font-fira text-[12px] font-bold tabular-nums text-ae-gold-text">
                    {MSG.SYNTHESIS_INPUT_ENHANCE(item.enhance || 0)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    ))}
  </>
);

/** CraftingPanel이 실제로 호출하는 액션만 좁혀 받는다 (제작/합성). */
type CraftingPanelActions = Pick<GameActions, 'craft' | 'craftBag' | 'synthesize'>;

/** 제작법과 장비 합성을 한 흐름에서 다룬다. */
// cycle 403: `mobileFocused?: boolean;` 제거 — 본체 destructure 미사용 + read 0건.
//   ControlPanel이 prop pass했으나 silent dropped (paired remove).
interface CraftingPanelProps {
    player: Player;
    actions?: CraftingPanelActions;
    setGameState?: (state: GameMode) => void;
    onOpenArchiveConsole?: (tab?: string) => void;
}

// cycle 588: onOpenArchiveConsole default null 제거 — 1 production caller
//   (ControlPanel:162) 4 props 모두 명시 전달이라 default 도달 불가. cycle
//   584 JobChangePanel 동일 패턴. 청소 메가 시리즈 79번째.
// 2026-10 에테르 유리: 집중 화면 유리 한 장(`.ae-town`) · 제작 방식은 44px 분할 단추 · 레시피는 유리 카드 ·
//   화면의 금빛 주 행동은 합성 시작 하나다(제작 · 가방 만들기는 유리 단추 — 레시피마다 하나씩이라).
const CraftingPanel = ({ player, actions, setGameState, onOpenArchiveConsole }: CraftingPanelProps) => {
  const [mode, setMode] = useState('craft');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [useProtect, setUseProtect] = useState(false);

  // 2026-10 Wave 103: 아직 없는 전설 각인의 제작법은 보이지 않는다(획득처는 플레이어가 알아낸다).
  const recipes = getVisibleCraftRecipes(DB.ITEMS.recipes || [], player);

  const synthGroups = useMemo(() => getSynthesisGroups(player.inv ?? []), [player.inv]);

  const toggleSlot = (itemId: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(itemId)) return prev.filter((id) => id !== itemId);
      if (prev.length >= BALANCE.SYNTHESIS_INPUT_COUNT) return prev;
      return [...prev, itemId];
    });
  };

  const selectedItems = selectedIds
    .map((id) => (player.inv || []).find((i) => i.id === id))
    .filter(Boolean) as Item[];
  const validation = selectedItems.length === BALANCE.SYNTHESIS_INPUT_COUNT
    ? validateSynthesis(selectedItems, player.gold)
    : null;

  const handleSynthesize = () => {
    if (!validation?.valid) return;
    // 보호 토글은 실패할 수 있는 합성에서만 보인다 — 보이지 않을 때는 보호를 보내지 않고, 합성 뒤에는 끈다(Wave 61).
    const protectable = 'successRate' in validation && Number(validation.successRate) < 1;
    actions?.synthesize(selectedIds, useProtect && protectable);
    setSelectedIds([]);
    setUseProtect(false);
  };

  const renderCraftMode = () => (
    <div className="flex-1 space-y-2 overflow-y-auto pr-1 custom-scrollbar">
      {recipes.length === 0 ? (
        <div className="ae-town-group px-4 py-12 text-center font-readable text-[13px] text-ae-ink-2">
          아직 발견한 제작법이 없습니다.
        </div>
      ) : recipes.map((recipe: ItemRecipeDef) => {
        const preview = getCraftingInvestmentPreview(player, recipe);
        // 같은 이름의 사본 중 강화된 것이 있으면 제작에 쓰일 사본의 +N을 보인다(Wave 62 C8 — 낮은 강화부터 쓴다).
        const enhanceUsage = getRecipeInputEnhanceUsage(player.inv, recipe);
        const output = preview.output;
        const decision = output?.equipmentDecision;
        const canCraft = preview.canCraft;
        return (
          <div
            key={recipe.id}
            data-testid={`crafting-recipe-${recipe.id}`}
            data-craft-state={canCraft ? 'ready' : 'locked'}
            className={`aether-craft-row flex flex-col gap-2 px-3 py-2.5 ${canCraft ? '' : 'aether-locked-row'}`}
          >
            <div className="flex items-start gap-3">
              {output && <ItemIcon item={output.item} size={42} showBorder className="mt-0.5 shrink-0" />}
              <div data-testid={`crafting-output-${recipe.id}`} className="min-w-0 flex-1">
                <div className={`break-words font-display text-[14px] font-bold ${output ? getRarityTextClass(output.item) : 'text-ae-ink'}`}>{recipe.name}</div>
                {output && (
                  <>
                    <div className="aether-type-label mt-0.5 font-readable text-ae-ink-2">
                      {[output.tierLabel, output.typeLabel].filter(Boolean).join(' · ')}
                    </div>
                    <div className="aether-type-body mt-1 font-readable leading-snug text-ae-ink">{output.statText}</div>
                    {decision && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <Chip tone={decision.equipable ? 'good' : 'threat'}>
                          {decision.equipable ? '장착 가능' : decision.recommendation}
                        </Chip>
                        <Chip tone={getScoreChipTone(decision.score)}>
                          {!decision.equipable && '가정 비교 · '}{decision.primaryDelta.text}
                        </Chip>
                      </div>
                    )}
                  </>
                )}
              </div>
              <ActionButton
                data-testid="crafting-recipe-action"
                onClick={() => recipe.id && actions?.craft(recipe.id)}
                disabled={!canCraft}
                label={canCraft ? '제작' : '재료 확인'}
                className="aether-disabled-action min-h-[44px] shrink-0 whitespace-nowrap px-3.5 text-[13px]"
              />
            </div>
            <div className="aether-type-label font-readable text-ae-ink-2">골드 <span className="font-fira font-semibold tabular-nums text-ae-gold-text">{(recipe.gold ?? 0).toLocaleString('ko-KR')}</span></div>
            {!canCraft && preview.lockReason && (
              <div className="aether-lock-note px-2 py-1 font-readable text-[12px] leading-snug">
                {preview.lockReason}
              </div>
            )}
            <div className="flex flex-wrap gap-1.5">
              {preview.inputs.map((input) => (
                <Chip key={`${recipe.id}_${input.name}`} tone={getInputChipTone(input.enough)}>
                  {input.name} <span className="font-fira tabular-nums">{input.owned}/{input.required}</span>
                  {enhanceUsage[input.name] && (
                    <span data-testid={`crafting-input-enhance-${recipe.id}-${input.name}`} className="ml-1 font-bold text-ae-gold-text">
                      · {MSG.CRAFT_INPUT_ENHANCE_USED(enhanceUsage[input.name])}
                    </span>
                  )}
                </Chip>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderSynthMode = () => {
    const synthesisPreview = validation && 'outputs' in validation ? validation : null;
    const outputs = synthesisPreview?.outputs ?? [];
    const outcomePreviews = getSynthesisOutcomePreviews(player, outputs);
    const protectionTokens = player.stats?.synthProtects || 0;
    const protectionCurrency = player.premiumCurrency || 0;
    const canUseProtection = protectionTokens > 0 || protectionCurrency >= BALANCE.SYNTHESIS_PROTECT_COST;
    const protectionCost = protectionTokens > 0
      ? MSG.SYNTHESIS_PROTECT_TOKEN_COST(protectionTokens)
      : `${BALANCE.PREMIUM_CURRENCY_NAME} ${BALANCE.SYNTHESIS_PROTECT_COST}개 · 보유 ${protectionCurrency}개`;
    const canSynthesize = Boolean(validation?.valid) && (!useProtect || canUseProtection);
    const lockReason = validation?.reason === 'NO_GOLD' && synthesisPreview
      ? `골드 부족 · ${player.gold}/${synthesisPreview.goldCost}`
      : useProtect && !canUseProtection
        ? `합성 보호 자산 부족 · ${protectionCost}`
        : MSG.SYNTHESIS_SELECT_REQUIRED(BALANCE.SYNTHESIS_INPUT_COUNT);
    const failureText = useProtect
      ? `실패해도 장비 ${BALANCE.SYNTHESIS_INPUT_COUNT}개는 모두 돌아오며 골드와 보호 자산은 소모됩니다.`
      : `실패하면 장비 ${BALANCE.SYNTHESIS_INPUT_COUNT}개 중 ${BALANCE.SYNTHESIS_FAIL_RETURN}개만 돌아오며 골드는 소모됩니다.`;

    return (
      <div className="custom-scrollbar flex-1 space-y-3 overflow-y-auto pr-1">
        <div className="ae-card p-3.5">
          <div className="aether-type-body mb-3 font-readable text-ae-ink-2">
            {MSG.SYNTHESIS_SELECT_HINT(BALANCE.SYNTHESIS_INPUT_COUNT)}
          </div>
          <div className="mb-3 grid grid-cols-3 gap-2">
            {Array.from({ length: BALANCE.SYNTHESIS_INPUT_COUNT }).map((_, index) => {
              const item = selectedItems[index];
              return (
                <button
                  type="button"
                  key={index}
                  data-testid={`synthesis-slot-${index}`}
                  aria-pressed={Boolean(item)}
                  onClick={() => item?.id && toggleSlot(item.id)}
                  className={`flex min-h-24 min-w-0 flex-col items-center justify-center rounded-ae-md px-1.5 py-2 font-readable ${item ? 'ae-town-pick' : 'ae-sunk text-ae-ink-3'}`}
                >
                  {item ? (
                    <>
                      <ItemIcon item={item} size={34} showBorder />
                      <span className={`aether-type-label mt-1 w-full break-words text-center font-readable font-bold ${getRarityTextClass(item)}`}>
                        {item.name}
                        {(item.enhance || 0) > 0 && (
                          <span data-testid={`synthesis-slot-enhance-${index}`} className="ml-1 font-fira tabular-nums text-ae-gold-text">{MSG.SYNTHESIS_INPUT_ENHANCE(item.enhance || 0)}</span>
                        )}
                      </span>
                      <span className={`aether-type-label mt-0.5 text-center ${getRarityTextClass(item)}`}>
                        {item.tier}단계 · {MSG.RARITY_LABEL[getItemRarity(item)]}
                      </span>
                    </>
                  ) : (
                    <span aria-hidden="true" className="text-lg">+</span>
                  )}
                </button>
              );
            })}
          </div>

          {outputs.length > 0 && synthesisPreview && (
            <div data-testid="synthesis-investment-preview" className="space-y-3 pt-3 shadow-[inset_0_1px_0_var(--aether-hairline)]">
              <div className="grid grid-cols-2 gap-2">
                <div className="ae-sunk rounded-ae-sm px-2.5 py-2">
                  <div className="aether-type-label font-readable text-ae-ink-2">비용</div>
                  <div className={`aether-type-body mt-0.5 font-readable font-bold ${(player.gold ?? 0) >= synthesisPreview.goldCost ? 'text-ae-gold-text' : 'text-ae-threat'}`}>
                    골드 <span className="font-fira tabular-nums">{synthesisPreview.goldCost.toLocaleString('ko-KR')}</span>
                  </div>
                </div>
                <div className="ae-sunk rounded-ae-sm px-2.5 py-2">
                  <div className="aether-type-label font-readable text-ae-ink-2">성공률</div>
                  <div className={`aether-type-body mt-0.5 font-fira font-bold tabular-nums ${synthesisPreview.successRate >= 0.85 ? 'text-ae-good' : synthesisPreview.successRate >= 0.7 ? 'text-ae-gold-text' : 'text-ae-threat'}`}>
                    {Math.round(synthesisPreview.successRate * 100)}%
                  </div>
                </div>
              </div>

              {synthesisPreview.successRate < 1 && (
                <button
                  type="button"
                  data-testid="synthesis-protection-toggle"
                  aria-pressed={useProtect}
                  disabled={!canUseProtection}
                  onClick={() => setUseProtect((current) => !current)}
                  className="ae-town-pick aether-disabled-action aether-type-body flex min-h-[44px] items-center gap-2 px-3 py-2 font-readable text-ae-ink disabled:cursor-not-allowed"
                >
                  <ShieldCheck size={15} aria-hidden="true" className={useProtect ? 'text-ae-ether-hi' : 'text-ae-ink-2'} />
                  <span className="min-w-0 text-left">합성 보호 · {protectionCost}</span>
                  <span className={`ml-auto shrink-0 font-bold ${useProtect ? 'text-ae-ether-hi' : 'text-ae-ink-2'}`}>{useProtect ? '사용' : '미사용'}</span>
                </button>
              )}

              <p data-testid="synthesis-failure-consequence" className="aether-type-body font-readable leading-relaxed text-ae-ink-2">
                {failureText}
              </p>

              <div className="pt-3 shadow-[inset_0_1px_0_var(--aether-hairline)]">
                <div className="ae-eyebrow mb-2 font-readable">
                  {(synthesisPreview.tier ?? 0) + 1}단계 결과 후보
                </div>
                <div className="ae-town-group">
                  {outcomePreviews.slice(0, 6).map((outcome) => {
                    const decision = outcome.equipmentDecision;
                    return (
                      <div
                        key={outcome.item.name}
                        data-testid="synthesis-output-candidate"
                        className="ae-town-row flex items-center gap-2 px-2.5 py-2"
                      >
                        <ItemIcon item={outcome.item} size={34} showBorder className="shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className={`aether-type-body break-words font-readable font-bold ${getRarityTextClass(outcome.item)}`}>{outcome.item.name}</div>
                          <div className="aether-type-label mt-0.5 font-readable text-ae-ink-2">{outcome.statText}</div>
                        </div>
                        {decision && (
                          <div className="min-w-0 max-w-[45%] text-right">
                            {!decision.equipable && <div className="aether-type-label font-readable text-ae-threat">{decision.recommendation}</div>}
                            <span className={`aether-type-label font-readable font-bold ${getScoreTextClass(decision.score)}`}>
                              {!decision.equipable && '가정 비교 · '}{decision.primaryDelta.text}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {outcomePreviews.length > 6 && (
                    <div className="ae-town-row aether-type-label px-2.5 py-2 font-readable text-ae-ink-2">그 외 {outcomePreviews.length - 6}개 후보</div>
                  )}
                </div>
              </div>
            </div>
          )}

          <ActionButton
            variant="primary"
            data-testid="crafting-synthesize-action"
            onClick={handleSynthesize}
            disabled={!canSynthesize}
            icon={<Hammer size={16} />}
            label={canSynthesize ? '합성 시작' : '합성 준비 필요'}
            className="aether-disabled-action mt-4 w-full font-display"
          />
          {!canSynthesize && (
            <div className="aether-lock-note mt-2 px-2.5 py-1.5 font-readable text-[12px] leading-snug">
              {lockReason}
            </div>
          )}
        </div>

        <SynthesisInputGroups groups={synthGroups} selectedIds={selectedIds} onToggle={toggleSlot} />
      </div>
    );
  };

  const modeTabs = [
    { id: 'craft', label: '제작' },
    { id: 'synth', label: '합성' },
    { id: 'bag', label: MSG.BAG_TAB_LABEL },
  ];

  return (
    <Motion.div
      data-testid="crafting-panel"
      initial={false} animate={{ opacity: 1, y: 0 }}
      className="ae-town aether-focus-panel relative z-20 flex min-h-0 flex-1 flex-col overflow-hidden p-3"
    >
      <FocusPanelHeader
        eyebrow="장비 제작소"
        title={mode === 'bag' ? MSG.BAG_PANEL_TITLE : mode === 'craft' ? '제작' : '장비 합성'}
        titleClassName="flex items-center gap-2 text-[1.05rem] leading-tight"
        meta={mode === 'bag' ? MSG.BAG_PANEL_META : mode === 'craft' ? '제작 가능한 레시피와 재료 수량을 즉시 비교합니다.' : MSG.SYNTHESIS_PANEL_META}
        onBack={() => setGameState?.('idle')}
        backLabel={MSG.UI_BACK}
        backTestId="crafting-close"
        bleedClassName="-mx-3 px-3"
        onOpenArchive={onOpenArchiveConsole}
        archiveLabel="가방"
        archiveTestId="crafting-open-archive"
      />
      <div role="group" aria-label={MSG.CRAFTING_MODE_GROUP_ARIA} className="ae-town-seg mb-3 w-full">
        {modeTabs.map((tab) => (
          <button
            type="button"
            key={tab.id}
            data-testid={`crafting-mode-${tab.id}`}
            aria-pressed={mode === tab.id}
            onClick={() => {
              setMode(tab.id);
              setSelectedIds([]);
              setUseProtect(false);
            }}
            className="ae-town-seg-btn min-h-11 min-w-11 px-3 font-readable"
          >
            {tab.label}
          </button>
        ))}
      </div>

      {mode === 'bag'
        ? <BagCraftingSection player={player} onCraftBag={() => actions?.craftBag()} />
        : mode === 'craft' ? renderCraftMode() : renderSynthMode()}
    </Motion.div>
  );
};

export default CraftingPanel;
