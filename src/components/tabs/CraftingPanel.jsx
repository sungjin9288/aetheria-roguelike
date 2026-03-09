import React from 'react';
import { motion as Motion } from 'framer-motion';
import { Hammer } from 'lucide-react';
import { DB } from '../../data/db';

/**
 * CraftingPanel — 제작/단조 패널
 */
const CraftingPanel = ({ player, actions, setGameState }) => {
  const overlayPanelClass = 'fixed inset-x-2 top-[calc(env(safe-area-inset-top)+4.75rem)] bottom-[calc(env(safe-area-inset-bottom)+0.5rem)] md:absolute md:inset-x-4 md:bottom-4 md:top-20';
  const recipes = DB.ITEMS.recipes || [];
  const getItemCount = (name) => player.inv.filter((item) => item.name === name).length;

  return (
    <Motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      className={`${overlayPanelClass} bg-cyber-black/95 z-30 p-4 md:p-6 rounded-lg border border-orange-500/40 flex flex-col shadow-[0_0_30px_rgba(249,115,22,0.2)] backdrop-blur-xl`}
    >
      <h2 className="text-2xl text-orange-400 font-bold mb-4 font-rajdhani uppercase tracking-wider flex items-center gap-2 drop-shadow-sm">
        <Hammer /> Forge Matrix
      </h2>
      <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-2">
        {recipes.length === 0 ? (
          <div className="rounded-lg border border-dashed border-orange-500/20 bg-cyber-dark/30 px-4 py-12 text-center text-sm font-rajdhani tracking-widest text-orange-400/40">
            NO RECIPES AVAILABLE
          </div>
        ) : recipes.map((recipe) => {
          const hasGold = player.gold >= recipe.gold;
          const hasMaterials = recipe.inputs.every((input) => getItemCount(input.name) >= input.qty);
          const canCraft = hasGold && hasMaterials;
          return (
            <div key={recipe.id} className="bg-cyber-dark/60 p-4 rounded-md border border-orange-500/20 flex flex-col gap-3 hover:border-orange-500/40 transition-colors">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-bold text-white font-rajdhani text-lg">{recipe.name}</div>
                  <div className="text-xs text-orange-300/70 font-fira mt-1">비용: {recipe.gold}G</div>
                </div>
                <Motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => actions.craft(recipe.id)}
                  disabled={!canCraft}
                  className="px-5 py-3 bg-orange-500/10 border border-orange-500/50 rounded-sm disabled:opacity-30 disabled:border-slate-700 text-orange-300 text-xs font-bold hover:bg-orange-500/20 hover:shadow-[0_0_15px_rgba(249,115,22,0.25)] transition-all whitespace-nowrap tracking-wider min-h-[44px]"
                >
                  {canCraft ? 'CRAFT' : 'LOCKED'}
                </Motion.button>
              </div>
              <div className="flex flex-wrap gap-2 text-xs font-fira">
                {recipe.inputs.map((input) => {
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
      <button onClick={() => setGameState('idle')} className="mt-4 w-full bg-cyber-dark text-orange-300/70 hover:text-orange-300 py-4 rounded-sm border border-orange-500/20 hover:border-orange-500/50 font-rajdhani text-lg font-bold tracking-[0.2em] transition-all hover:bg-orange-500/5 min-h-[44px]">
        EXIT FORGE
      </button>
    </Motion.div>
  );
};

export default CraftingPanel;
