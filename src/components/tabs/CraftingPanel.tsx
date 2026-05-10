import { useState, useMemo } from 'react';
import { motion as Motion } from 'framer-motion';
import { ShieldCheck } from 'lucide-react';
import { DB } from '../../data/db';
import { BALANCE } from '../../data/constants';
import { getSynthesisGroups, validateSynthesis } from '../../utils/synthesisUtils';
import { getItemRarity } from '../../utils/gameUtils';
import FocusPanelHeader from '../FocusPanelHeader';

const TYPE_LABEL: any = { weapon: '무기', armor: '방어구', shield: '방패' };
const RARITY_LABEL: any = { common: '일반', uncommon: '고급', rare: '희귀', epic: '영웅', legendary: '전설' };

/**
 * CraftingPanel — 제작/합성 패널 (탭 전환)
 */
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

  // ──── 제작 모드 ────
  const recipes = DB.ITEMS.recipes || [];
  const getItemCount = (name: any) => player.inv.filter((item: any) => item.name === name).length;

  // ──── 합성 모드 ────
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
        <div className="rounded-lg border border-dashed border-orange-500/20 bg-cyber-dark/30 px-4 py-12 text-center text-sm font-rajdhani tracking-widest text-orange-400/40">
          NO RECIPES AVAILABLE
        </div>
      ) : recipes.map((recipe: any) => {
        const hasGold = player.gold >= recipe.gold;
        const hasMaterials = recipe.inputs.every((input: any) => getItemCount(input.name) >= input.qty);
        const canCraft = hasGold && hasMaterials;
        return (
          <div key={recipe.id} className="bg-cyber-dark/60 px-3 py-2.5 rounded-md border border-orange-500/20 flex flex-col gap-2 hover:border-orange-500/40 transition-colors">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="font-bold text-white font-rajdhani text-[14px]">{recipe.name}</div>
                <div className="text-[11px] text-orange-300/70 font-fira">{recipe.gold}G</div>
              </div>
              <Motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => actions.craft(recipe.id)}
                disabled={!canCraft}
                className="px-4 py-1.5 bg-orange-500/10 border border-orange-500/50 rounded-sm disabled:opacity-30 disabled:border-slate-700 text-orange-300 text-[11px] font-bold hover:bg-orange-500/20 transition-all whitespace-nowrap tracking-wider min-h-[36px]"
              >
                {canCraft ? 'CRAFT' : 'LOCKED'}
              </Motion.button>
            </div>
            <div className="flex flex-wrap gap-1.5 text-[11px] font-fira">
              {recipe.inputs.map((input: any) => {
                const owned = getItemCount(input.name);
                const enough = owned >= input.qty;
                return (
                  <span key={`${recipe.id}_${input.name}`} className={`px-2 py-1 rounded border ${enough ? 'border-cyber-green/30 text-cyber-green bg-cyber-green/10' : 'border-red-500/30 text-red-400 bg-red-950/20'}`}>
                    {input.name} {owned}/{input.qty}
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
    const outputs = validation?.valid ? validation.outputs : [];
    return (
      <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar pr-2">
        {/* 슬롯 영역 */}
        <div className="bg-cyber-dark/60 p-4 rounded-md border border-purple-500/20">
          <div className="text-xs text-purple-300/70 font-fira mb-3">
            {BALANCE.SYNTHESIS_INPUT_COUNT}개 동일 타입 · 동일 티어 장비 선택
          </div>
          <div className="flex gap-2 justify-center mb-3">
            {Array.from({ length: BALANCE.SYNTHESIS_INPUT_COUNT }).map((_: any, i: any) => {
              const item = selectedItems[i];
              return (
                <Motion.button
                  key={i}
                  whileTap={item ? { scale: 0.9 } : undefined}
                  onClick={() => item && toggleSlot(item.id)}
                  className={`w-20 h-20 rounded-lg border-2 flex flex-col items-center justify-center text-xs font-fira transition-all
                    ${item
                      ? 'border-purple-400/60 bg-purple-950/40 text-white'
                      : 'border-dashed border-purple-500/20 bg-cyber-dark/40 text-purple-500/30'
                    }`}
                >
                  {item ? (
                    <>
                      <span className="truncate max-w-[4.5rem] text-[10px] font-bold">{item.name}</span>
                      <span className="text-[9px] mt-0.5" style={{ color: BALANCE.RARITY_COLORS[getItemRarity(item)] }}>
                        T{item.tier} {RARITY_LABEL[getItemRarity(item)]}
                      </span>
                    </>
                  ) : (
                    <span className="text-lg">+</span>
                  )}
                </Motion.button>
              );
            })}
          </div>

          {/* 합성 정보 */}
          {validation?.valid && (
            <div className="space-y-2 text-xs font-fira">
              <div className="flex justify-between text-purple-200">
                <span>비용</span>
                <span className={player.gold >= validation.goldCost ? 'text-cyber-green' : 'text-red-400'}>
                  {validation.goldCost.toLocaleString()}G
                </span>
              </div>
              <div className="flex justify-between text-purple-200">
                <span>성공률</span>
                <span className={validation.successRate >= 0.85 ? 'text-cyber-green' : validation.successRate >= 0.7 ? 'text-yellow-400' : 'text-red-400'}>
                  {Math.round(validation.successRate * 100)}%
                </span>
              </div>
              {/* 보호 토글 */}
              {validation.successRate < 1 && (
                <button
                  onClick={() => setUseProtect((p: any) => !p)}
                  className={`flex items-center gap-1.5 w-full py-2 px-3 rounded border text-[10px] transition-all
                    ${useProtect
                      ? 'border-amber-400/50 bg-amber-950/30 text-amber-300'
                      : 'border-slate-600 bg-cyber-dark/40 text-slate-400 hover:border-slate-500'
                    }`}
                >
                  <ShieldCheck size={12} />
                  <span>합성 보호 ({BALANCE.SYNTHESIS_PROTECT_COST} {BALANCE.PREMIUM_CURRENCY_NAME})</span>
                  <span className="ml-auto">{useProtect ? 'ON' : 'OFF'}</span>
                </button>
              )}
              {/* 가능한 결과물 미리보기 */}
              {outputs.length > 0 && (
                <div className="mt-2 pt-2 border-t border-purple-500/10">
                  <div className="text-[10px] text-purple-400/60 mb-1.5">T{(validation.tier ?? 0) + 1} 결과 후보</div>
                  <div className="flex flex-wrap gap-1.5">
                    {outputs.slice(0, 6).map((o: any) => (
                      <span
                        key={o.name}
                        className="px-2 py-0.5 rounded text-[9px] border"
                        style={{
                          borderColor: BALANCE.RARITY_COLORS[getItemRarity(o)] + '40',
                          color: BALANCE.RARITY_COLORS[getItemRarity(o)],
                        }}
                      >
                        {o.name}
                      </span>
                    ))}
                    {outputs.length > 6 && (
                      <span className="text-[9px] text-purple-400/40">+{outputs.length - 6}</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 합성 버튼 */}
          <Motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleSynthesize}
            disabled={!validation?.valid}
            className="mt-4 w-full py-3 bg-purple-500/10 border border-purple-500/50 rounded-sm disabled:opacity-30 disabled:border-slate-700 text-purple-300 text-sm font-bold hover:bg-purple-500/20 hover:shadow-[0_0_15px_rgba(168,85,247,0.25)] transition-all tracking-wider min-h-[44px]"
          >
            {validation?.valid ? 'SYNTHESIZE' : 'SELECT ITEMS'}
          </Motion.button>
        </div>

        {/* 합성 가능 장비 목록 */}
        {synthGroups.length === 0 ? (
          <div className="rounded-lg border border-dashed border-purple-500/20 bg-cyber-dark/30 px-4 py-8 text-center text-sm font-rajdhani tracking-widest text-purple-400/40">
            NO SYNTHESIZABLE SETS
          </div>
        ) : synthGroups.map((group: any) => (
          <div key={`${group.type}_${group.tier}`} className="bg-cyber-dark/60 p-3 rounded-md border border-purple-500/15">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-bold font-rajdhani text-purple-300">{TYPE_LABEL[group.type]} T{group.tier}</span>
              <span className="text-[10px] font-fira text-purple-400/50">{group.count}개 보유</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {group.items.map((item: any) => {
                const isSelected = selectedIds.includes(item.id);
                const rarity = getItemRarity(item);
                return (
                  <Motion.button
                    key={item.id}
                    whileTap={{ scale: 0.92 }}
                    onClick={() => toggleSlot(item.id)}
                    className={`px-2.5 py-1.5 rounded text-[10px] font-fira border transition-all min-h-[36px]
                      ${isSelected
                        ? 'border-purple-400/70 bg-purple-900/50 text-white ring-1 ring-purple-400/30'
                        : 'border-white/8 bg-black/20 text-slate-300 hover:border-purple-500/30'
                      }`}
                    style={isSelected ? {} : { borderLeftColor: BALANCE.RARITY_COLORS[rarity], borderLeftWidth: 2 }}
                  >
                    {item.name}
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
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      className="panel-noise aether-surface-strong relative z-20 flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1.95rem] border border-[#d5b180]/18 p-4 shadow-[0_24px_48px_rgba(9,12,18,0.24)] backdrop-blur-xl"
    >
      <FocusPanelHeader
        eyebrow="Forge Circuit"
        title={mode === 'craft' ? 'FORGE MATRIX' : 'SYNTHESIS'}
        titleClassName="flex items-center gap-2 text-[1.05rem] text-orange-400"
        meta={mode === 'craft' ? '제작 가능한 레시피와 재료 수량을 즉시 비교합니다.' : '동일 티어 장비를 골라 합성 결과를 확인합니다.'}
        onBack={() => setGameState?.('idle')}
        backLabel="복귀"
        bleedClassName="-mx-4 px-4"
        onOpenArchive={onOpenArchiveConsole}
        archiveLabel="INV"
        archiveTestId="crafting-open-archive"
        rightSlot={
          <div className="flex overflow-hidden rounded-sm border border-orange-500/20 bg-cyber-dark/80">
            {[
              { id: 'craft', label: 'CRAFT' },
              { id: 'synth', label: 'SYNTH' },
            ].map((tab: any) => (
              <button
                key={tab.id}
                onClick={() => { setMode(tab.id); setSelectedIds([]); }}
                className={`min-h-[36px] px-4 py-2 text-xs font-rajdhani font-bold tracking-wider transition-all
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
