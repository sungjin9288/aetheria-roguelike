import React from 'react';
import {
  Sword,
  Zap,
  ArrowRight,
  Map as MapIcon,
  ShoppingBag,
  Moon,
  GraduationCap,
  ScrollText,
  Hammer,
  Ghost,
  X,
  RotateCw
} from 'lucide-react';
import { DB } from '../data/db';
import ShopPanel from './ShopPanel';
import EventPanel from './EventPanel';

const ControlPanel = ({ gameState, player, actions, setGameState, shopItems, grave, isAiThinking, currentEvent }) => {
  const mapData = DB.MAPS[player.loc];
  const selectedSkill = actions.getSelectedSkill ? actions.getSelectedSkill() : null;
  const skillCooldown = selectedSkill ? player.skillLoadout?.cooldowns?.[selectedSkill.name] || 0 : 0;

  if (gameState === 'combat') {
    return (
      <div className="space-y-3 mt-4">
        <div className="text-xs text-cyber-blue/60 font-fira text-center uppercase tracking-widest">
          {selectedSkill ? (
            <span>
              Skill: <span className="text-cyber-purple font-bold">{selectedSkill.name}</span> / MP {selectedSkill.mp || 0} / CD {skillCooldown}
            </span>
          ) : (
            <span className="text-slate-500">NO SKILL SELECTED</span>
          )}
        </div>
        <div className="grid grid-cols-4 gap-3">
          <button
            disabled={isAiThinking}
            onClick={() => actions.combat('attack')}
            className="bg-red-900/20 hover:bg-red-900/40 hover:shadow-[0_0_15px_rgba(239,68,68,0.4)] border border-red-500/50 p-4 rounded-sm text-red-400 font-bold flex flex-col items-center disabled:opacity-50 transition-all group"
          >
            <Sword className="group-hover:scale-110 transition-transform" /> <span className="font-rajdhani mt-1">ATTACK</span>
          </button>
          <button
            disabled={isAiThinking || !selectedSkill}
            onClick={() => actions.combat('skill')}
            className="bg-cyber-blue/20 hover:bg-cyber-blue/40 hover:shadow-neon-blue border border-cyber-blue/50 p-4 rounded-sm text-cyber-blue font-bold flex flex-col items-center disabled:opacity-50 transition-all group"
          >
            <Zap className="group-hover:scale-110 transition-transform" /> <span className="font-rajdhani mt-1">SKILL</span>
          </button>
          <button
            disabled={isAiThinking || !selectedSkill}
            onClick={() => actions.cycleSkill(1)}
            className="bg-cyber-purple/20 hover:bg-cyber-purple/40 hover:shadow-neon-purple border border-cyber-purple/50 p-4 rounded-sm text-cyber-purple font-bold flex flex-col items-center disabled:opacity-50 transition-all group"
          >
            <RotateCw className="group-hover:rotate-180 transition-transform duration-500" /> <span className="font-rajdhani mt-1">SWAP</span>
          </button>
          <button
            disabled={isAiThinking}
            onClick={() => actions.combat('escape')}
            className="bg-cyber-dark/60 hover:bg-cyber-dark/80 border border-cyber-green/30 p-4 rounded-sm text-cyber-green/70 font-bold flex flex-col items-center disabled:opacity-50 transition-all group"
          >
            <ArrowRight className="group-hover:translate-x-1 transition-transform" /> <span className="font-rajdhani mt-1">ESCAPE</span>
          </button>
        </div>
      </div>
    );
  }

  if (gameState === 'event' && isAiThinking) {
    return (
      <div className="mt-4 p-6 border border-cyber-purple/50 rounded-lg bg-cyber-black/80 text-center animate-pulse text-cyber-purple font-rajdhani tracking-widest shadow-neon-purple">
        NEURAL LINK ACTIVE... PROCESSING SCENARIO...
      </div>
    );
  }

  if (gameState === 'event' && !isAiThinking) {
    return <EventPanel currentEvent={currentEvent} actions={actions} />;
  }

  if (gameState === 'shop') {
    return <ShopPanel player={player} actions={actions} shopItems={shopItems} setGameState={setGameState} />;
  }

  if (gameState === 'job_change') {
    const current = DB.CLASSES[player.job];
    const avail = current.next || [];
    return (
      <div className="absolute inset-x-4 bottom-4 top-20 bg-cyber-black/95 z-20 p-6 rounded-lg border border-cyber-purple/50 flex flex-col items-center justify-center shadow-neon-purple backdrop-blur-xl">
        <h2 className="text-3xl text-cyber-purple font-bold mb-6 font-rajdhani uppercase tracking-[0.2em] drop-shadow-md">Class Advancement</h2>
        <div className="flex gap-4 flex-wrap justify-center">
          {avail.map((job) => (
            <button
              key={job}
              onClick={() => actions.jobChange(job)}
              disabled={player.level < DB.CLASSES[job].reqLv}
              className="p-6 bg-cyber-dark/80 border border-cyber-purple/30 rounded-sm hover:bg-cyber-purple/10 hover:border-cyber-purple hover:shadow-neon-purple disabled:opacity-30 disabled:hover:shadow-none transition-all w-48 group"
            >
              <div className="text-xl font-bold text-white group-hover:text-cyber-purple transition-colors">{job}</div>
              <div className="text-xs text-cyber-blue font-fira mt-2">REQ: Lv.{DB.CLASSES[job].reqLv}</div>
            </button>
          ))}
          {avail.length === 0 && <div className="text-cyber-blue/50 font-rajdhani">MAXIMUM POTENTIAL REACHED</div>}
        </div>
        <button onClick={() => setGameState('idle')} className="mt-8 text-cyber-blue/50 hover:text-cyber-blue font-fira text-xs uppercase tracking-widest hover:underline">
          [ ABORT SEQUENCE ]
        </button>
      </div>
    );
  }

  if (gameState === 'quest_board') {
    return (
      <div className="absolute inset-x-4 bottom-4 top-20 bg-cyber-black/95 z-20 p-4 rounded-lg border border-cyber-blue/50 flex flex-col shadow-neon-blue backdrop-blur-xl">
        <h2 className="text-2xl text-cyber-blue font-bold mb-4 font-rajdhani uppercase tracking-wider flex items-center gap-2">
          <ScrollText /> Mission Terminal
        </h2>
        <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar pr-2">
          {DB.QUESTS.map((q) => (
            <div key={q.id} className="bg-cyber-dark/50 p-4 rounded-sm border border-cyber-blue/20 flex justify-between items-center group hover:border-cyber-blue/50 transition-colors">
              <div>
                <div className="font-bold text-white font-rajdhani text-lg group-hover:text-cyber-blue transition-colors">
                  {q.title} <span className="text-xs text-cyber-purple font-fira ml-2">Lv.{q.minLv}+</span>
                </div>
                <div className="text-xs text-cyber-blue/60 font-fira">{q.desc}</div>
              </div>
              <button
                onClick={() => actions.acceptQuest(q.id)}
                disabled={player.quests.some((pq) => pq.id === q.id)}
                className="px-4 py-2 bg-cyber-blue/20 border border-cyber-blue/50 rounded-sm disabled:opacity-30 disabled:border-slate-700 text-cyber-blue text-xs font-bold hover:bg-cyber-blue/40 hover:shadow-neon-blue transition-all"
              >
                {player.quests.some((pq) => pq.id === q.id) ? 'ACCEPTED' : 'ACCEPT'}
              </button>
            </div>
          ))}
        </div>
        <button onClick={() => setGameState('idle')} className="mt-4 w-full bg-cyber-dark text-cyber-blue/50 hover:text-cyber-blue py-3 rounded-sm border border-cyber-blue/20 hover:border-cyber-blue/50 font-rajdhani font-bold tracking-widest transition-all">
          EXIT TERMINAL
        </button>
      </div>
    );
  }

  if (gameState === 'crafting') {
    const recipes = DB.ITEMS.recipes || [];
    return (
      <div className="absolute inset-x-4 bottom-4 top-20 bg-cyber-black/95 z-20 p-4 rounded-lg border border-orange-500/50 flex flex-col shadow-[0_0_20px_rgba(249,115,22,0.2)] backdrop-blur-xl">
        <h2 className="text-2xl text-orange-500 font-bold mb-4 font-rajdhani uppercase tracking-wider flex items-center gap-2">
          <Hammer /> Fabrication Unit
        </h2>
        <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar pr-2">
          {recipes.map((recipe) => {
            const canCraft =
              player.gold >= recipe.gold &&
              recipe.inputs.every((input) => player.inv.filter((i) => i.name === input.name).length >= input.qty);
            return (
              <div key={recipe.id} className={`bg-cyber-dark/50 p-4 rounded-sm border ${canCraft ? 'border-orange-500/50' : 'border-slate-800'} transition-colors`}>
                <div className="flex justify-between items-center">
                  <div>
                    <div className={`font-bold font-rajdhani text-lg ${canCraft ? 'text-orange-200' : 'text-slate-500'}`}>{recipe.name}</div>
                    <div className="text-xs text-cyber-blue/50 mt-1 font-fira">
                      REQ: {recipe.inputs.map((i) => `${i.name} x${i.qty}`).join(', ')} | COST: <span className="text-yellow-500">{recipe.gold} CR</span>
                    </div>
                  </div>
                  <button
                    onClick={() => actions.craft(recipe.id)}
                    disabled={!canCraft}
                    className="px-6 py-2 bg-orange-900/40 border border-orange-600 rounded-sm disabled:opacity-30 disabled:border-slate-700 text-sm font-bold text-orange-500 hover:bg-orange-800/50 hover:shadow-[0_0_10px_rgba(249,115,22,0.4)] transition-all uppercase tracking-wider"
                  >
                    FABRICATE
                  </button>
                </div>
              </div>
            );
          })}
          {recipes.length === 0 && <div className="text-cyber-blue/30 text-center py-4 font-rajdhani">NO BLUEPRINTS AVAILABLE</div>}
        </div>
        <button onClick={() => setGameState('idle')} className="mt-4 w-full bg-cyber-dark text-orange-500/50 hover:text-orange-500 py-3 rounded-sm border border-orange-500/20 hover:border-orange-500/50 font-rajdhani font-bold tracking-widest transition-all">
          DISCONNECT
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4">
      {gameState === 'moving' ? (
        <div className="flex flex-wrap gap-2">
          {mapData.exits.map((exit) => (
            <button
              key={exit}
              disabled={isAiThinking}
              onClick={() => actions.move(exit)}
              className="px-6 py-4 bg-cyber-dark/80 border border-cyber-green/50 rounded-sm text-cyber-green hover:bg-cyber-green/10 hover:shadow-neon-green flex items-center gap-2 disabled:opacity-50 font-rajdhani font-bold tracking-wider transition-all"
            >
              <MapIcon size={16} /> {exit}
            </button>
          ))}
          <button onClick={() => setGameState('idle')} className="px-6 py-4 bg-red-900/20 border border-red-500/30 text-red-400 rounded-sm hover:bg-red-900/40 font-bold uppercase transition-all">
            CANCEL
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-3">
          <button
            disabled={isAiThinking}
            onClick={actions.explore}
            className="bg-cyber-dark/60 hover:bg-cyber-blue/10 border border-cyber-blue/30 p-4 rounded-sm flex flex-col items-center gap-2 disabled:opacity-50 hover:shadow-neon-blue transition-all group"
          >
            <MapIcon size={20} className="text-cyber-blue group-hover:scale-110 transition-transform" /> <span className="text-[10px] sm:text-xs font-rajdhani font-bold text-cyber-blue/80">EXPLORE</span>
          </button>
          <button
            disabled={isAiThinking}
            onClick={() => setGameState('moving')}
            className="bg-cyber-dark/60 hover:bg-cyber-green/10 border border-cyber-green/30 p-4 rounded-sm flex flex-col items-center gap-2 disabled:opacity-50 hover:shadow-neon-green transition-all group"
          >
            <ArrowRight size={20} className="text-cyber-green group-hover:translate-x-1 transition-transform" /> <span className="text-[10px] sm:text-xs font-rajdhani font-bold text-cyber-green/80">MOVE</span>
          </button>
          {mapData.type === 'safe' && (
            <>
              <button
                disabled={isAiThinking}
                onClick={() => {
                  actions.setShopItems([...DB.ITEMS.consumables, ...DB.ITEMS.weapons, ...DB.ITEMS.armors]);
                  actions.setGameState('shop');
                }}
                className="bg-cyber-dark/60 hover:bg-yellow-900/20 border border-yellow-500/30 p-4 rounded-sm flex flex-col items-center gap-2 disabled:opacity-50 transition-all group"
              >
                <ShoppingBag size={20} className="text-yellow-500 group-hover:scale-110 transition-transform" /> <span className="text-[10px] sm:text-xs font-rajdhani font-bold text-yellow-500/80">MARKET</span>
              </button>
              <button
                disabled={isAiThinking}
                onClick={actions.rest}
                className="bg-cyber-dark/60 hover:bg-emerald-900/20 border border-emerald-500/30 p-4 rounded-sm flex flex-col items-center gap-2 disabled:opacity-50 transition-all group"
              >
                <Moon size={20} className="text-emerald-500 group-hover:scale-110 transition-transform" /> <span className="text-[10px] sm:text-xs font-rajdhani font-bold text-emerald-500/80">REST</span>
              </button>
              <button
                disabled={isAiThinking}
                onClick={() => setGameState('job_change')}
                className="bg-cyber-dark/60 hover:bg-purple-900/20 border border-purple-500/30 p-4 rounded-sm flex flex-col items-center gap-2 disabled:opacity-50 transition-all group"
              >
                <GraduationCap size={20} className="text-purple-500 group-hover:scale-110 transition-transform" /> <span className="text-[10px] sm:text-xs font-rajdhani font-bold text-purple-500/80">CLASS</span>
              </button>
              <button
                disabled={isAiThinking}
                onClick={() => setGameState('quest_board')}
                className="bg-cyber-dark/60 hover:bg-indigo-900/20 border border-indigo-500/30 p-4 rounded-sm flex flex-col items-center gap-2 disabled:opacity-50 transition-all group"
              >
                <ScrollText size={20} className="text-indigo-500 group-hover:scale-110 transition-transform" /> <span className="text-[10px] sm:text-xs font-rajdhani font-bold text-indigo-500/80">QUESTS</span>
              </button>
              <button
                disabled={isAiThinking}
                onClick={() => setGameState('crafting')}
                className="bg-cyber-dark/60 hover:bg-orange-900/20 border border-orange-500/30 p-4 rounded-sm flex flex-col items-center gap-2 disabled:opacity-50 transition-all group"
              >
                <Hammer size={20} className="text-orange-500 group-hover:rotate-12 transition-transform" /> <span className="text-[10px] sm:text-xs font-rajdhani font-bold text-orange-500/80">CRAFT</span>
              </button>
            </>
          )}
          {grave && grave.loc === player.loc && (
            <button
              disabled={isAiThinking}
              onClick={actions.lootGrave}
              className="bg-slate-800/60 hover:bg-slate-700 border border-slate-500/30 p-4 rounded-sm flex flex-col items-center gap-2 disabled:opacity-50 transition-all group"
            >
              <Ghost size={20} className="text-slate-400 group-hover:scale-110 transition-transform" /> <span className="text-[10px] sm:text-xs font-rajdhani font-bold text-slate-400">RECOVER</span>
            </button>
          )}
          <button
            disabled={isAiThinking}
            onClick={actions.reset}
            className="col-start-4 bg-red-950/20 hover:bg-red-900/40 border border-red-800/30 p-4 rounded-sm flex flex-col items-center gap-2 disabled:opacity-50 transition-all group"
          >
            <X size={20} className="text-red-600 group-hover:scale-110 transition-transform" /> <span className="text-[10px] sm:text-xs font-rajdhani font-bold text-red-600/80">RESET</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default ControlPanel;
