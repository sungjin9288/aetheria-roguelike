import React, { useState } from 'react';
import { Lock, Check } from 'lucide-react';
import { DB } from '../../data/db';
import SignalBadge from '../SignalBadge';

const RecipeCodex = ({ codex, player }) => {
    const [selected, setSelected] = useState(null);
    const recipes = DB.ITEMS.recipes || [];
    const recipeCodex = codex.recipes || {};
    const discovered = Object.keys(recipeCodex).length;

    const inv = player?.inv || [];

    return (
        <div className="space-y-2">
            <div className="text-[10px] font-fira text-slate-500">
                {discovered}/{recipes.length} 레시피 발견
            </div>

            <div className="space-y-1.5 max-h-[45vh] overflow-y-auto custom-scrollbar">
                {recipes.map(recipe => {
                    const found = !!recipeCodex[recipe.id];
                    const hasGold = (player?.gold || 0) >= recipe.gold;
                    const hasMats = recipe.inputs.every(inp =>
                        inv.filter(i => i.name === inp.name).length >= inp.qty
                    );
                    const canCraft = found && hasGold && hasMats;

                    return (
                        <button
                            key={recipe.id}
                            onClick={() => found && setSelected(selected === recipe.id ? null : recipe.id)}
                            className={`w-full text-left p-2.5 rounded-[0.95rem] border transition-all text-xs
                                ${found
                                    ? selected === recipe.id
                                        ? 'bg-cyber-blue/10 border-cyber-blue/30'
                                        : 'bg-black/18 border-white/8 hover:border-white/14'
                                    : 'bg-black/10 border-white/6 opacity-25 cursor-default'
                                }`}
                        >
                            <div className="flex items-center gap-2">
                                {found
                                    ? <Check size={12} className="text-cyber-green shrink-0" />
                                    : <Lock size={12} className="text-slate-600 shrink-0" />
                                }
                                <span className={`font-rajdhani font-bold truncate ${found ? 'text-white' : 'text-slate-600'}`}>
                                    {found ? recipe.name : '??? 레시피'}
                                </span>
                                {found && canCraft && (
                                    <SignalBadge tone="success" size="sm">제작 가능</SignalBadge>
                                )}
                            </div>

                            {/* Detail when selected */}
                            {found && selected === recipe.id && (
                                <div className="mt-2 space-y-1 text-[10px] font-fira">
                                    <div className="text-slate-400">재료:</div>
                                    {recipe.inputs.map(inp => {
                                        const owned = inv.filter(i => i.name === inp.name).length;
                                        const enough = owned >= inp.qty;
                                        return (
                                            <div key={inp.name} className={`pl-2 ${enough ? 'text-cyber-green' : 'text-rose-300'}`}>
                                                • {inp.name} x{inp.qty} (보유: {owned})
                                            </div>
                                        );
                                    })}
                                    <div className={hasGold ? 'text-amber-200' : 'text-rose-300'}>
                                        비용: {recipe.gold}G (보유: {player?.gold || 0}G)
                                    </div>
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default RecipeCodex;
