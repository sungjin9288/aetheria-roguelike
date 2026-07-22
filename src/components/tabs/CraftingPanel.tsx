import { useState, useMemo } from 'react';
import { motion as Motion } from 'framer-motion';
import { ShieldCheck } from 'lucide-react';
import { DB } from '../../data/db';
import { BALANCE } from '../../data/constants';
import { getSynthesisGroups, validateSynthesis } from '../../utils/synthesisUtils';
import { getItemRarity } from '../../utils/gameUtils';
import { getCraftingInvestmentPreview, getSynthesisOutcomePreviews } from '../../utils/itemInvestmentPreview';
import FocusPanelHeader from '../FocusPanelHeader';
import ItemIcon from '../icons/ItemIcon';
import SignalBadge from '../SignalBadge';

const TYPE_LABEL: any = { weapon: '무기', armor: '방어구', shield: '방패' };
const RARITY_LABEL: any = { common: '일반', uncommon: '고급', rare: '희귀', epic: '영웅', legendary: '전설' };

/** 제작법과 장비 합성을 한 흐름에서 다룬다. */
// cycle 403: `mobileFocused?: boolean;` 제거 — 본체 destructure 미사용 + read 0건.
//   ControlPanel이 prop pass했으나 silent dropped (paired remove).
interface CraftingPanelProps {
    player: any;
    actions?: any;
    setGameState?: (state: string) => void;
    onOpenArchiveConsole?: any;
}

// cycle 588: onOpenArchiveConsole default null 제거 — 1 production caller
//   (ControlPanel:162) 4 props 모두 명시 전달이라 default 도달 불가. cycle
//   584 JobChangePanel 동일 패턴. 청소 메가 시리즈 79번째.
const CraftingPanel = ({ player, actions, setGameState, onOpenArchiveConsole }: CraftingPanelProps) => {
  const [mode, setMode] = useState('craft');
  const [selectedIds, setSelectedIds] = useState<any[]>([]);
  const [useProtect, setUseProtect] = useState(false);

  const recipes = DB.ITEMS.recipes || [];

  const synthGroups = useMemo(() => getSynthesisGroups(player.inv), [player.inv]);

  const toggleSlot = (itemId: any) => {
    setSelectedIds((prev: any) => {
      if (prev.includes(itemId)) return prev.filter((id: any) => id !== itemId);
      if (prev.length >= BALANCE.SYNTHESIS_INPUT_COUNT) return prev;
      return [...prev, itemId];
    });
  };

  const selectedItems = selectedIds.map((id: any) => player.inv.find((i: any) => i.id === id)).filter(Boolean);
  const validation = selectedItems.length === BALANCE.SYNTHESIS_INPUT_COUNT
    ? validateSynthesis(selectedItems, player.gold)
    : null;

  const handleSynthesize = () => {
    if (!validation?.valid) return;
    actions.synthesize(selectedIds, useProtect);
    setSelectedIds([]);
  };

  const renderCraftMode = () => (
    <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar pr-2">
      {recipes.length === 0 ? (
        <div className="rounded-lg border border-dashed border-orange-500/20 bg-cyber-dark/30 px-4 py-12 text-center text-sm font-readable text-orange-200/55">
          아직 발견한 제작법이 없습니다.
        </div>
      ) : recipes.map((recipe: any) => {
        const preview = getCraftingInvestmentPreview(player, recipe);
        const output = preview.output;
        const decision = output?.equipmentDecision;
        const canCraft = preview.canCraft;
        return (
          <div
            key={recipe.id}
            data-testid={`crafting-recipe-${recipe.id}`}
            data-craft-state={canCraft ? 'ready' : 'locked'}
            className={`aether-craft-row flex flex-col gap-2 rounded-md px-3 py-2.5 transition-colors hover:border-orange-500/40 ${canCraft ? '' : 'aether-locked-row'}`}
          >
            <div className="flex items-start gap-3">
              {output && <ItemIcon item={output.item} size={42} showBorder className="mt-0.5 shrink-0" />}
              <div data-testid={`crafting-output-${recipe.id}`} className="min-w-0 flex-1">
                <div className="break-words font-rajdhani text-[14px] font-bold text-white">{recipe.name}</div>
                {output && (
                  <>
                    <div className="aether-type-label mt-0.5 font-readable text-orange-200/78">
                      {[output.tierLabel, output.typeLabel].filter(Boolean).join(' · ')}
                    </div>
                    <div className="aether-type-body mt-1 font-readable leading-snug text-slate-300/82">{output.statText}</div>
                    {decision && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <SignalBadge tone={decision.equipable ? 'success' : 'danger'} size="sm">
                          {decision.equipable ? '장착 가능' : '직업 제한'}
                        </SignalBadge>
                        <SignalBadge tone={decision.score > 0 ? 'recommended' : decision.score < 0 ? 'warning' : 'neutral'} size="sm">
                          {decision.primaryDelta.text}
                        </SignalBadge>
                      </div>
                    )}
                  </>
                )}
              </div>
              <Motion.button
                data-testid="crafting-recipe-action"
                whileTap={{ scale: 0.95 }}
                onClick={() => actions.craft(recipe.id)}
                disabled={!canCraft}
                className="aether-disabled-action px-4 py-1.5 bg-orange-500/10 border border-orange-500/50 rounded-sm text-orange-200 text-[11px] font-bold hover:bg-orange-500/20 transition-all whitespace-nowrap tracking-wider min-h-[44px]"
              >
                {canCraft ? '제작' : '재료 확인'}
              </Motion.button>
            </div>
            <div className="aether-type-label font-readable text-orange-200/86">골드 {recipe.gold.toLocaleString('ko-KR')}</div>
            {!canCraft && preview.lockReason && (
              <div className="aether-lock-note rounded-[0.65rem] px-2 py-1 font-readable text-[11px] leading-snug">
                {preview.lockReason}
              </div>
            )}
            <div className="flex flex-wrap gap-1.5 text-[11px] font-fira">
              {preview.inputs.map((input) => {
                return (
                  <span key={`${recipe.id}_${input.name}`} className={`rounded border px-2 py-1 ${input.enough ? 'border-cyber-green/30 bg-cyber-green/10 text-cyber-green' : 'border-red-500/30 bg-red-950/20 text-red-400'}`}>
                    {input.name} {input.owned}/{input.required}
                  </span>
                );
              })}
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
      ? `보호권 1개 · 보유 ${protectionTokens}개`
      : `${BALANCE.PREMIUM_CURRENCY_NAME} ${BALANCE.SYNTHESIS_PROTECT_COST}개 · 보유 ${protectionCurrency}개`;
    const canSynthesize = Boolean(validation?.valid) && (!useProtect || canUseProtection);
    const lockReason = validation?.reason === 'NO_GOLD' && synthesisPreview
      ? `골드 부족 · ${player.gold}/${synthesisPreview.goldCost}`
      : useProtect && !canUseProtection
        ? `합성 보호 자산 부족 · ${protectionCost}`
        : `동일 타입·동일 티어 장비 ${BALANCE.SYNTHESIS_INPUT_COUNT}개를 선택해야 합성할 수 있습니다.`;
    const failureText = useProtect
      ? `실패해도 장비 ${BALANCE.SYNTHESIS_INPUT_COUNT}개는 모두 돌아오며 골드와 보호 자산은 소모됩니다.`
      : `실패하면 장비 ${BALANCE.SYNTHESIS_INPUT_COUNT}개 중 ${BALANCE.SYNTHESIS_FAIL_RETURN}개만 돌아오며 골드는 소모됩니다.`;

    return (
      <div className="custom-scrollbar flex-1 space-y-4 overflow-y-auto pr-2">
        <div className="rounded-md border border-purple-500/20 bg-cyber-dark/60 p-4">
          <div className="aether-type-body mb-3 font-readable text-purple-200/78">
            {BALANCE.SYNTHESIS_INPUT_COUNT}개 동일 타입 · 동일 티어 장비 선택
          </div>
          <div className="mb-3 flex justify-center gap-2">
            {Array.from({ length: BALANCE.SYNTHESIS_INPUT_COUNT }).map((_: any, index: number) => {
              const item = selectedItems[index];
              return (
                <Motion.button
                  key={index}
                  data-testid={`synthesis-slot-${index}`}
                  whileTap={item ? { scale: 0.96 } : undefined}
                  onClick={() => item && toggleSlot(item.id)}
                  className={`flex h-24 w-[5.5rem] flex-col items-center justify-center rounded-lg border-2 px-1 font-readable transition-all
                    ${item
                      ? 'border-purple-400/60 bg-purple-950/40 text-white'
                      : 'border-dashed border-purple-500/20 bg-cyber-dark/40 text-purple-500/40'
                    }`}
                >
                  {item ? (
                    <>
                      <ItemIcon item={item} size={34} showBorder />
                      <span className="aether-type-label mt-1 w-full truncate font-readable font-bold">{item.name}</span>
                      <span className="aether-type-label mt-0.5" style={{ color: BALANCE.RARITY_COLORS[getItemRarity(item)] }}>
                        {item.tier}단계 · {RARITY_LABEL[getItemRarity(item)]}
                      </span>
                    </>
                  ) : (
                    <span className="text-lg">+</span>
                  )}
                </Motion.button>
              );
            })}
          </div>

          {outputs.length > 0 && synthesisPreview && (
            <div data-testid="synthesis-investment-preview" className="space-y-3 border-t border-purple-500/14 pt-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="aether-type-label font-readable text-purple-300/68">비용</div>
                  <div className={`aether-type-body mt-0.5 font-readable font-bold ${player.gold >= synthesisPreview.goldCost ? 'text-cyber-green' : 'text-red-300'}`}>
                    골드 {synthesisPreview.goldCost.toLocaleString('ko-KR')}
                  </div>
                </div>
                <div>
                  <div className="aether-type-label font-readable text-purple-300/68">성공률</div>
                  <div className={`aether-type-body mt-0.5 font-readable font-bold ${synthesisPreview.successRate >= 0.85 ? 'text-cyber-green' : synthesisPreview.successRate >= 0.7 ? 'text-yellow-300' : 'text-red-300'}`}>
                    {Math.round(synthesisPreview.successRate * 100)}%
                  </div>
                </div>
              </div>

              {synthesisPreview.successRate < 1 && (
                <button
                  type="button"
                  data-testid="synthesis-protection-toggle"
                  disabled={!canUseProtection}
                  onClick={() => setUseProtect((current) => !current)}
                  className={`aether-type-body flex min-h-[44px] w-full items-center gap-2 rounded-lg border px-3 py-2 font-readable transition-colors disabled:cursor-not-allowed disabled:opacity-55
                    ${useProtect
                      ? 'border-amber-400/50 bg-amber-950/30 text-amber-200'
                      : 'border-white/10 bg-black/18 text-slate-300 hover:border-white/18'
                    }`}
                >
                  <ShieldCheck size={14} />
                  <span className="min-w-0 text-left">합성 보호 · {protectionCost}</span>
                  <span className="ml-auto shrink-0 font-bold">{useProtect ? '사용' : '미사용'}</span>
                </button>
              )}

              <p data-testid="synthesis-failure-consequence" className="aether-type-body font-readable leading-relaxed text-slate-300/78">
                {failureText}
              </p>

              <div className="border-t border-purple-500/14 pt-3">
                <div className="aether-type-label mb-2 font-readable font-semibold text-purple-200/78">
                  {(synthesisPreview.tier ?? 0) + 1}단계 결과 후보
                </div>
                <div className="space-y-1.5">
                  {outcomePreviews.slice(0, 6).map((outcome) => {
                    const decision = outcome.equipmentDecision;
                    return (
                      <div
                        key={outcome.item.name}
                        data-testid="synthesis-output-candidate"
                        className="flex items-center gap-2 rounded-lg border border-white/8 bg-black/16 px-2.5 py-2"
                      >
                        <ItemIcon item={outcome.item} size={34} showBorder className="shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="aether-type-body break-words font-readable font-bold text-white">{outcome.item.name}</div>
                          <div className="aether-type-label mt-0.5 font-readable text-slate-300/72">{outcome.statText}</div>
                        </div>
                        {decision && (
                          <span className={`aether-type-label shrink-0 font-readable font-bold ${decision.score > 0 ? 'text-emerald-200' : decision.score < 0 ? 'text-rose-200' : 'text-slate-300'}`}>
                            {decision.primaryDelta.text}
                          </span>
                        )}
                      </div>
                    );
                  })}
                  {outcomePreviews.length > 6 && (
                    <div className="aether-type-label font-readable text-purple-300/60">그 외 {outcomePreviews.length - 6}개 후보</div>
                  )}
                </div>
              </div>
            </div>
          )}

          <Motion.button
            data-testid="crafting-synthesize-action"
            whileTap={canSynthesize ? { scale: 0.98 } : undefined}
            onClick={handleSynthesize}
            disabled={!canSynthesize}
            className="aether-disabled-action mt-4 min-h-[44px] w-full rounded-sm border border-purple-500/50 bg-purple-500/10 py-3 text-sm font-bold tracking-wider text-purple-200 transition-all hover:bg-purple-500/20 hover:shadow-[0_0_15px_rgba(168,85,247,0.25)]"
          >
            {canSynthesize ? '합성 시작' : '합성 준비 필요'}
          </Motion.button>
          {!canSynthesize && (
            <div className="aether-lock-note mt-2 rounded-[0.7rem] px-2.5 py-1.5 font-readable text-[11px] leading-snug">
              {lockReason}
            </div>
          )}
        </div>

        {synthGroups.length === 0 ? (
          <div className="rounded-lg border border-dashed border-purple-500/20 bg-cyber-dark/30 px-4 py-8 text-center text-sm font-readable text-purple-200/55">
            합성할 수 있는 장비 조합이 없습니다.
          </div>
        ) : synthGroups.map((group: any) => (
          <div key={`${group.type}_${group.tier}`} className="rounded-md border border-purple-500/15 bg-cyber-dark/60 p-3">
            <div className="mb-2 flex items-center gap-2">
              <span className="aether-type-body font-readable font-bold text-purple-200">{TYPE_LABEL[group.type]} {group.tier}단계</span>
              <span className="aether-type-label font-readable text-purple-300/58">{group.count}개 보유</span>
            </div>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {group.items.map((item: any) => {
                const isSelected = selectedIds.includes(item.id);
                const rarity = getItemRarity(item);
                return (
                  <Motion.button
                    key={item.id}
                    data-testid={`synthesis-input-${item.id}`}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => toggleSlot(item.id)}
                    className={`flex min-h-[48px] items-center gap-2 rounded-lg border px-2 py-1.5 text-left font-readable transition-all
                      ${isSelected
                        ? 'border-purple-400/70 bg-purple-900/50 text-white ring-1 ring-purple-400/30'
                        : 'border-white/8 bg-black/20 text-slate-300 hover:border-purple-500/30'
                      }`}
                    style={isSelected ? {} : { borderLeftColor: BALANCE.RARITY_COLORS[rarity], borderLeftWidth: 2 }}
                  >
                    <ItemIcon item={item} size={30} showBorder className="shrink-0" />
                    <span className="aether-type-label min-w-0 break-words font-readable font-semibold">{item.name}</span>
                  </Motion.button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Motion.div
      data-testid="crafting-panel"
      initial={false} animate={{ opacity: 1, y: 0 }}
      className="panel-noise aether-focus-panel relative z-20 flex min-h-0 flex-1 flex-col overflow-hidden border border-[#d5b180]/18 p-4 shadow-[0_24px_48px_rgba(9,12,18,0.24)]"
    >
      <FocusPanelHeader
        eyebrow="장비 제작소"
        title={mode === 'craft' ? '제작' : '장비 합성'}
        titleClassName="flex items-center gap-2 text-[1.05rem] text-orange-400"
        meta={mode === 'craft' ? '제작 가능한 레시피와 재료 수량을 즉시 비교합니다.' : '동일 티어 장비를 골라 합성 결과를 확인합니다.'}
        onBack={() => setGameState?.('idle')}
        backLabel="복귀"
        backTestId="crafting-close"
        bleedClassName="-mx-4 px-4"
        onOpenArchive={onOpenArchiveConsole}
        archiveLabel="가방"
        archiveTestId="crafting-open-archive"
        rightSlot={
          <div className="flex overflow-hidden rounded-sm border border-orange-500/20 bg-cyber-dark/80">
            {[
              { id: 'craft', label: '제작' },
              { id: 'synth', label: '합성' },
            ].map((tab: any) => (
              <button
                key={tab.id}
                data-testid={`crafting-mode-${tab.id}`}
                onClick={() => {
                  setMode(tab.id);
                  setSelectedIds([]);
                  setUseProtect(false);
                }}
                className={`min-h-[36px] px-4 py-2 text-xs font-readable font-bold transition-all
                  ${mode === tab.id
                    ? tab.id === 'craft'
                      ? 'bg-orange-500/20 text-orange-300'
                      : 'bg-purple-500/20 text-purple-300'
                    : 'text-slate-500 hover:text-slate-300'
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        }
      />

      {mode === 'craft' ? renderCraftMode() : renderSynthMode()}
    </Motion.div>
  );
};

export default CraftingPanel;
