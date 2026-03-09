import React, { useState } from 'react';
import {
  ArrowRight,
  Map as MapIcon,
  ShoppingBag,
  Moon,
  GraduationCap,
  ScrollText,
  Hammer,
  Ghost,
  X,
} from 'lucide-react';
import { motion as Motion } from 'framer-motion';
import { DB } from '../data/db';
import ShopPanel from './ShopPanel';
import EventPanel from './EventPanel';
import { soundManager } from '../systems/SoundManager';
import { GS } from '../reducers/gameStates';

// 상태별 분리 패널 컴포넌트
import CombatPanel from './tabs/CombatPanel';
import JobChangePanel from './tabs/JobChangePanel';
import QuestBoardPanel from './tabs/QuestBoardPanel';
import CraftingPanel from './tabs/CraftingPanel';

/**
 * ControlPanel — 게임 상태별 패널 라우터 (Phase 1-C 리팩토링)
 * 각 상태에 해당하는 서브 컴포넌트로 렌더링을 위임합니다.
 */
const ControlPanel = ({ gameState, player, actions, setGameState, shopItems, grave, isAiThinking, currentEvent }) => {
  const [confirmReset, setConfirmReset] = useState(false);
  const mapData = DB.MAPS[player.loc];

  // ── 전투 패널
  if (gameState === GS.COMBAT) {
    return <CombatPanel player={player} actions={actions} isAiThinking={isAiThinking} />;
  }

  // ── AI 이벤트 로딩 중
  if (gameState === GS.EVENT && isAiThinking) {
    return (
      <Motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="mt-4 p-6 border border-cyber-purple/50 rounded-lg bg-cyber-black/80 text-center animate-pulse text-cyber-purple font-rajdhani tracking-widest shadow-neon-purple backdrop-blur-md z-10 relative"
      >
        NEURAL LINK ACTIVE... PROCESSING SCENARIO...
      </Motion.div>
    );
  }

  // ── 이벤트 선택 패널
  if (gameState === GS.EVENT && !isAiThinking) {
    return <EventPanel currentEvent={currentEvent} actions={actions} />;
  }

  // ── 상점 패널
  if (gameState === GS.SHOP) {
    return <ShopPanel player={player} actions={actions} shopItems={shopItems} setGameState={setGameState} />;
  }

  // ── 전직 패널
  if (gameState === GS.JOB_CHANGE) {
    return <JobChangePanel player={player} actions={actions} setGameState={setGameState} />;
  }

  // ── 퀘스트 패널
  if (gameState === GS.QUEST_BOARD) {
    return <QuestBoardPanel player={player} actions={actions} setGameState={setGameState} />;
  }

  // ── 제작 패널
  if (gameState === GS.CRAFTING) {
    return <CraftingPanel player={player} actions={actions} setGameState={setGameState} />;
  }

  // ── 기본 Idle / 이동 패널
  return (
    <Motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 md:mt-4 relative z-10 w-full">
      {gameState === GS.MOVING ? (
        <div className="flex flex-wrap gap-2 md:gap-3">
          {mapData.exits.map((exit) => (
            <Motion.button
              whileTap={{ scale: 0.95 }}
              key={exit}
              disabled={isAiThinking}
              onClick={() => actions.move(exit)}
              className="flex-1 min-w-[120px] min-h-[50px] px-4 md:px-6 py-3 md:py-4 bg-cyber-dark/80 border border-cyber-green/50 rounded-md text-cyber-green hover:bg-cyber-green/10 hover:shadow-[0_0_15px_rgba(0,255,157,0.3)] flex items-center justify-center gap-2 disabled:opacity-50 font-rajdhani font-bold tracking-wider transition-all backdrop-blur-md"
            >
              <MapIcon size={16} /> {exit}
            </Motion.button>
          ))}
          <Motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setGameState(GS.IDLE)}
            className="flex-1 min-w-[120px] min-h-[50px] px-4 md:px-6 py-3 md:py-4 bg-red-900/20 border border-red-500/30 text-red-400 rounded-md hover:bg-red-900/40 font-bold tracking-wider transition-all"
          >
            CANCEL
          </Motion.button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-2 sm:gap-3">
          {/* EXPLORE */}
          <Motion.button
            whileTap={{ scale: 0.95 }}
            disabled={isAiThinking}
            onClick={() => { soundManager.play('click'); actions.explore(); }}
            className="min-h-[56px] bg-cyber-dark/60 hover:bg-cyber-blue/10 border border-cyber-blue/30 p-2 sm:p-3 rounded-lg flex flex-col items-center justify-center gap-1.5 disabled:opacity-50 hover:shadow-[0_0_15px_rgba(0,204,255,0.2)] hover:border-cyber-blue/50 transition-all group backdrop-blur-sm"
          >
            <MapIcon size={18} className="text-cyber-blue group-hover:scale-110 transition-transform" />
            <span className="text-[10px] sm:text-xs font-rajdhani font-bold tracking-widest text-cyber-blue/90">EXPLORE</span>
          </Motion.button>

          {/* MOVE */}
          <Motion.button
            whileTap={{ scale: 0.95 }}
            disabled={isAiThinking}
            onClick={() => setGameState(GS.MOVING)}
            className="min-h-[56px] bg-cyber-dark/60 hover:bg-cyber-green/10 border border-cyber-green/30 p-2 sm:p-3 rounded-lg flex flex-col items-center justify-center gap-1.5 disabled:opacity-50 hover:shadow-[0_0_15px_rgba(0,255,157,0.2)] hover:border-cyber-green/50 transition-all group backdrop-blur-sm"
          >
            <ArrowRight size={18} className="text-cyber-green group-hover:translate-x-2 transition-transform" />
            <span className="text-[10px] sm:text-xs font-rajdhani font-bold tracking-widest text-cyber-green/90">MOVE</span>
          </Motion.button>

          {/* 안전 지역 전용 버튼 */}
          {mapData.type === 'safe' && (
            <>
              <Motion.button
                whileTap={{ scale: 0.95 }}
                disabled={isAiThinking}
                onClick={() => {
                  actions.setShopItems([...DB.ITEMS.consumables, ...DB.ITEMS.weapons, ...DB.ITEMS.armors]);
                  actions.setGameState(GS.SHOP);
                }}
                className="min-h-[56px] bg-cyber-dark/60 hover:bg-yellow-900/20 border border-yellow-500/30 p-2 sm:p-3 rounded-lg flex flex-col items-center justify-center gap-1.5 disabled:opacity-50 hover:shadow-[0_0_15px_rgba(234,179,8,0.2)] hover:border-yellow-500/50 transition-all group backdrop-blur-sm"
              >
                <ShoppingBag size={18} className="text-yellow-500 group-hover:scale-110 transition-transform" />
                <span className="text-[10px] sm:text-xs font-rajdhani font-bold tracking-widest text-yellow-500/90">MARKET</span>
              </Motion.button>
              <Motion.button
                whileTap={{ scale: 0.95 }}
                disabled={isAiThinking}
                onClick={actions.rest}
                className="min-h-[56px] bg-cyber-dark/60 hover:bg-emerald-900/20 border border-emerald-500/30 p-2 sm:p-3 rounded-lg flex flex-col items-center justify-center gap-1.5 disabled:opacity-50 hover:shadow-[0_0_15px_rgba(16,185,129,0.2)] hover:border-emerald-500/50 transition-all group backdrop-blur-sm"
              >
                <Moon size={18} className="text-emerald-500 group-hover:scale-110 transition-transform" />
                <span className="text-[10px] sm:text-xs font-rajdhani font-bold tracking-widest text-emerald-500/90">REST</span>
              </Motion.button>
              <Motion.button
                whileTap={{ scale: 0.95 }}
                disabled={isAiThinking}
                onClick={() => setGameState(GS.JOB_CHANGE)}
                className="min-h-[56px] bg-cyber-dark/60 hover:bg-purple-900/20 border border-purple-500/30 p-2 sm:p-3 rounded-lg flex flex-col items-center justify-center gap-1.5 disabled:opacity-50 hover:shadow-[0_0_15px_rgba(168,85,247,0.2)] hover:border-purple-500/50 transition-all group backdrop-blur-sm"
              >
                <GraduationCap size={18} className="text-purple-500 group-hover:scale-110 transition-transform" />
                <span className="text-[10px] sm:text-xs font-rajdhani font-bold tracking-widest text-purple-500/90">CLASS</span>
              </Motion.button>
              <Motion.button
                whileTap={{ scale: 0.95 }}
                disabled={isAiThinking}
                onClick={() => setGameState(GS.QUEST_BOARD)}
                className="min-h-[56px] bg-cyber-dark/60 hover:bg-indigo-900/20 border border-indigo-500/30 p-2 sm:p-3 rounded-lg flex flex-col items-center justify-center gap-1.5 disabled:opacity-50 hover:shadow-[0_0_15px_rgba(99,102,241,0.2)] hover:border-indigo-500/50 transition-all group backdrop-blur-sm"
              >
                <ScrollText size={18} className="text-indigo-500 group-hover:scale-110 transition-transform" />
                <span className="text-[10px] sm:text-xs font-rajdhani font-bold tracking-widest text-indigo-500/90">QUESTS</span>
              </Motion.button>
              <Motion.button
                whileTap={{ scale: 0.95 }}
                disabled={isAiThinking}
                onClick={() => setGameState(GS.CRAFTING)}
                className="min-h-[56px] bg-cyber-dark/60 hover:bg-orange-900/20 border border-orange-500/30 p-2 sm:p-3 rounded-lg flex flex-col items-center justify-center gap-1.5 disabled:opacity-50 hover:shadow-[0_0_15px_rgba(249,115,22,0.2)] hover:border-orange-500/50 transition-all group backdrop-blur-sm"
              >
                <Hammer size={18} className="text-orange-500 group-hover:rotate-12 transition-transform" />
                <span className="text-[10px] sm:text-xs font-rajdhani font-bold tracking-widest text-orange-500/90">CRAFT</span>
              </Motion.button>
            </>
          )}

          {/* 묘지 회수 */}
          {grave && grave.loc === player.loc && (
            <Motion.button
              whileTap={{ scale: 0.95 }}
              disabled={isAiThinking}
              onClick={actions.lootGrave}
              className="min-h-[56px] bg-slate-800/60 hover:bg-slate-700/80 border border-slate-500/50 p-2 sm:p-3 rounded-lg flex flex-col items-center justify-center gap-1.5 disabled:opacity-50 hover:shadow-[0_0_15px_rgba(148,163,184,0.3)] transition-all group backdrop-blur-sm"
            >
              <Ghost size={18} className="text-slate-400 group-hover:animate-bounce" />
              <span className="text-[10px] sm:text-xs font-rajdhani font-bold tracking-widest text-slate-300">RECOVER</span>
            </Motion.button>
          )}

          {/* FORMAT DRIVE (리셋) */}
          {!confirmReset ? (
            <Motion.button
              whileTap={{ scale: 0.95 }}
              disabled={isAiThinking}
              onClick={() => setConfirmReset(true)}
              className="min-h-[56px] sm:col-start-4 bg-red-950/20 hover:bg-red-900/40 border border-red-800/30 p-2 sm:p-3 rounded-lg flex flex-col items-center justify-center gap-1.5 disabled:opacity-50 hover:border-red-600/50 transition-all group backdrop-blur-sm"
            >
              <X size={18} className="text-red-500/70 group-hover:text-red-500 group-hover:scale-110 transition-all" />
              <span className="text-[10px] sm:text-xs font-rajdhani tracking-widest text-red-600/70 group-hover:text-red-500">FORMAT DRIVE</span>
            </Motion.button>
          ) : (
            <div className="sm:col-start-4 flex flex-col gap-1.5 min-h-[70px] justify-center">
              <Motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => { actions.reset(); setConfirmReset(false); }}
                className="flex-1 bg-red-900/60 border border-red-500/70 rounded-sm text-red-300 text-[10px] font-rajdhani font-bold tracking-widest hover:bg-red-700/60 transition-all py-1.5"
              >
                CONFIRM RESET
              </Motion.button>
              <Motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setConfirmReset(false)}
                className="flex-1 bg-cyber-dark/60 border border-slate-600/50 rounded-sm text-slate-400 text-[10px] font-rajdhani font-bold tracking-widest hover:bg-slate-700/40 transition-all py-1.5"
              >
                CANCEL
              </Motion.button>
            </div>
          )}
        </div>
      )}
    </Motion.div>
  );
};

export default ControlPanel;
