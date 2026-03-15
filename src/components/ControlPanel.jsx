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
import { getAdventureGuidance, getMoveRecommendations } from '../utils/adventureGuide';
import ShopPanel from './ShopPanel';
import EventPanel from './EventPanel';
import { soundManager } from '../systems/SoundManager';
import { GS } from '../reducers/gameStates';
import SignalBadge from './SignalBadge';

// 상태별 분리 패널 컴포넌트
import CombatPanel from './tabs/CombatPanel';
import JobChangePanel from './tabs/JobChangePanel';
import QuestBoardPanel from './tabs/QuestBoardPanel';
import CraftingPanel from './tabs/CraftingPanel';

/**
 * ControlPanel — 게임 상태별 패널 라우터 (Phase 1-C 리팩토링)
 * 각 상태에 해당하는 서브 컴포넌트로 렌더링을 위임합니다.
 */
const ACTION_KIND_TO_BUTTON = {
  explore: 'explore',
  open_move: 'move',
  rest: 'rest',
  open_class: 'class',
  open_quest_board: 'quests',
  open_shop: 'market',
  claim_quest: 'quests',
};

const ControlPanel = ({ gameState, player, enemy, actions, setGameState, shopItems, grave, isAiThinking, currentEvent, stats = null, mobile = false }) => {
  const [confirmReset, setConfirmReset] = useState(false);
  const mapData = DB.MAPS[player.loc];
  const guidance = getAdventureGuidance(player, stats || { maxHp: player.maxHp, maxMp: player.maxMp }, mapData, gameState);
  const moveRecommendations = getMoveRecommendations(player, stats || { maxHp: player.maxHp, maxMp: player.maxMp }, mapData, DB.MAPS);
  const recommendedButton = ACTION_KIND_TO_BUTTON[guidance?.primaryAction?.kind] || null;
  const actionGridClass = mobile
    ? 'grid grid-cols-4 gap-2'
    : 'grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-2 sm:gap-3';
  const actionButtonBase = mobile
    ? 'relative min-h-[58px] px-1.5 py-2.5 rounded-[1.2rem] flex flex-col items-center justify-center gap-1 disabled:opacity-50 transition-all group backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]'
    : 'relative min-h-[56px] p-2 sm:p-3 rounded-2xl flex flex-col items-center justify-center gap-1.5 disabled:opacity-50 transition-all group backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]';
  const actionLabelClass = mobile
    ? 'text-[8px] font-rajdhani font-bold tracking-[0.18em]'
    : 'text-[10px] sm:text-xs font-rajdhani font-bold tracking-widest';
  const getRecommendedClass = (buttonKey) => (
    recommendedButton === buttonKey
      ? 'ring-1 ring-cyan-300/45 shadow-[0_0_18px_rgba(34,211,238,0.18)]'
      : ''
  );

  // ── 전투 패널
  if (gameState === GS.COMBAT) {
    return <CombatPanel player={player} enemy={enemy} actions={actions} isAiThinking={isAiThinking} />;
  }

  // ── AI 이벤트 로딩 중
  if (gameState === GS.EVENT && isAiThinking) {
    return (
      <Motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="panel-noise mt-4 p-6 border border-cyber-purple/50 rounded-lg bg-cyber-black/80 text-center animate-pulse text-cyber-purple font-rajdhani tracking-widest shadow-neon-purple backdrop-blur-md z-10 relative"
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
    return <ShopPanel player={player} actions={actions} shopItems={shopItems} setGameState={setGameState} stats={stats} />;
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
    <Motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`mt-3 md:mt-4 relative z-10 w-full ${mobile ? 'panel-noise space-y-2 rounded-[1.7rem] border border-cyan-400/16 bg-[linear-gradient(180deg,rgba(8,13,25,0.95)_0%,rgba(5,10,18,0.96)_100%)] p-3.5 shadow-[0_24px_60px_rgba(2,8,20,0.4)] backdrop-blur-2xl' : ''}`}>
      {mobile && (
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-[10px] font-fira uppercase tracking-[0.22em] text-cyber-blue/45">Field Actions</div>
            <div className="mt-1 text-sm font-rajdhani font-bold text-white">현장 조작 패널</div>
          </div>
          <div className="rounded-full border border-cyan-400/18 bg-cyber-black/45 px-2.5 py-1 text-[10px] font-fira uppercase tracking-[0.16em] text-cyber-blue/70">
            {gameState === GS.MOVING ? 'Route Select' : 'Idle'}
          </div>
        </div>
      )}
      {gameState === GS.MOVING ? (
        <div className={`gap-2 md:gap-3 ${mobile ? 'grid grid-cols-2' : 'flex flex-wrap'}`}>
          {moveRecommendations.map((route) => (
            <Motion.button
              whileTap={{ scale: 0.95 }}
              key={route.name}
              disabled={isAiThinking}
              onClick={() => actions.move(route.name)}
              className={`${mobile ? 'min-h-[86px] px-3 py-2 text-xs' : 'flex-1 min-w-[150px] min-h-[92px] px-4 py-3'} ${
                route.isRecommended
                  ? 'border-cyber-green/55 bg-cyber-green/10 shadow-[0_0_18px_rgba(0,255,157,0.16)]'
                  : 'border-cyber-blue/25 bg-cyber-dark/75'
              } rounded-md text-left hover:bg-cyber-green/10 hover:shadow-[0_0_15px_rgba(0,255,157,0.18)] flex flex-col items-start justify-between gap-2 disabled:opacity-50 font-rajdhani font-bold tracking-wider transition-all backdrop-blur-md`}
            >
              <div className="flex w-full items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-cyber-green">
                    <MapIcon size={16} />
                    <span className="truncate">{route.name}</span>
                  </div>
                  <div className="mt-1 text-[10px] font-fira text-cyber-blue/50">
                    {route.levelLabel}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <SignalBadge tone={route.isRecommended ? 'recommended' : 'neutral'} size="sm">
                    {route.isRecommended ? '추천' : route.badge}
                  </SignalBadge>
                </div>
              </div>
              <div className="text-[10px] font-fira text-cyber-blue/70 leading-snug">
                {route.reason}
              </div>
            </Motion.button>
          ))}
          <Motion.button
            data-testid="control-move-cancel"
            whileTap={{ scale: 0.95 }}
            onClick={() => setGameState(GS.IDLE)}
            className={`${mobile ? 'col-span-2 min-h-[44px] px-3 py-2 text-xs' : 'flex-1 min-w-[120px] min-h-[50px] px-4 md:px-6 py-3 md:py-4'} bg-red-900/20 border border-red-500/30 text-red-400 rounded-md hover:bg-red-900/40 font-bold tracking-wider transition-all`}
          >
            CANCEL
          </Motion.button>
        </div>
      ) : (
        <>
          <div className={`mb-2 rounded-xl border border-cyber-blue/15 bg-cyber-black/55 px-3 py-2 ${mobile ? '' : 'max-w-md'}`}>
            {mobile ? (
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[9px] font-fira uppercase tracking-[0.18em] text-cyber-blue/45">추천 행동</div>
                  <div className="mt-1 truncate text-[12px] font-rajdhani font-bold text-white">{guidance.title}</div>
                </div>
                <SignalBadge tone="recommended" size="sm">{guidance.emphasis}</SignalBadge>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2 text-[10px] font-fira uppercase tracking-[0.18em] text-cyber-blue/55">
                  <span>추천 행동</span>
                  <span className="text-cyber-green">{guidance.emphasis}</span>
                </div>
                <div className="mt-1 text-sm font-rajdhani font-bold text-white">{guidance.title}</div>
                <div className="mt-0.5 text-[11px] font-fira text-cyber-blue/65">{guidance.detail}</div>
              </>
            )}
          </div>
        <div className={actionGridClass}>
          {/* EXPLORE */}
          <Motion.button
            data-testid="control-explore"
            whileTap={{ scale: 0.95 }}
            disabled={isAiThinking}
            onClick={() => { soundManager.play('click'); actions.explore(); }}
            className={`${actionButtonBase} ${getRecommendedClass('explore')} bg-[linear-gradient(180deg,rgba(8,20,32,0.86)_0%,rgba(5,11,21,0.96)_100%)] hover:bg-cyan-500/10 border border-cyan-400/20 hover:shadow-[0_0_18px_rgba(34,211,238,0.14)] hover:border-cyan-300/40`}
          >
            {recommendedButton === 'explore' && <div className="absolute top-1.5 right-1.5"><SignalBadge tone="recommended" size="sm">추천</SignalBadge></div>}
            <MapIcon size={18} className="text-cyber-blue group-hover:scale-110 transition-transform" />
            <span className={`${actionLabelClass} text-cyber-blue/90`}>EXPLORE</span>
          </Motion.button>

          {/* MOVE */}
          <Motion.button
            data-testid="control-move"
            whileTap={{ scale: 0.95 }}
            disabled={isAiThinking}
            onClick={() => setGameState(GS.MOVING)}
            className={`${actionButtonBase} ${getRecommendedClass('move')} bg-[linear-gradient(180deg,rgba(10,24,26,0.86)_0%,rgba(5,11,17,0.96)_100%)] hover:bg-emerald-400/10 border border-emerald-400/20 hover:shadow-[0_0_18px_rgba(16,185,129,0.14)] hover:border-emerald-300/40`}
          >
            {recommendedButton === 'move' && <div className="absolute top-1.5 right-1.5"><SignalBadge tone="recommended" size="sm">추천</SignalBadge></div>}
            <ArrowRight size={18} className="text-cyber-green group-hover:translate-x-2 transition-transform" />
            <span className={`${actionLabelClass} text-cyber-green/90`}>MOVE</span>
          </Motion.button>

          {/* 안전 지역 전용 버튼 */}
          {mapData.type === 'safe' && (
            <>
              <Motion.button
                data-testid="control-market"
                whileTap={{ scale: 0.95 }}
                disabled={isAiThinking}
                onClick={() => {
                  actions.setShopItems([...DB.ITEMS.consumables, ...DB.ITEMS.weapons, ...DB.ITEMS.armors]);
                  actions.setGameState(GS.SHOP);
                }}
                className={`${actionButtonBase} ${getRecommendedClass('market')} bg-[linear-gradient(180deg,rgba(30,22,8,0.82)_0%,rgba(15,12,6,0.96)_100%)] hover:bg-yellow-500/10 border border-yellow-500/20 hover:shadow-[0_0_18px_rgba(234,179,8,0.14)] hover:border-yellow-400/40`}
              >
                {recommendedButton === 'market' && <div className="absolute top-1.5 right-1.5"><SignalBadge tone="recommended" size="sm">추천</SignalBadge></div>}
                <ShoppingBag size={18} className="text-yellow-500 group-hover:scale-110 transition-transform" />
                <span className={`${actionLabelClass} text-yellow-500/90`}>{mobile ? 'SHOP' : 'MARKET'}</span>
              </Motion.button>
              <Motion.button
                data-testid="control-rest"
                whileTap={{ scale: 0.95 }}
                disabled={isAiThinking}
                onClick={actions.rest}
                className={`${actionButtonBase} ${getRecommendedClass('rest')} bg-[linear-gradient(180deg,rgba(12,23,19,0.82)_0%,rgba(7,11,10,0.96)_100%)] hover:bg-emerald-500/10 border border-emerald-500/20 hover:shadow-[0_0_18px_rgba(16,185,129,0.14)] hover:border-emerald-400/40`}
              >
                {recommendedButton === 'rest' && <div className="absolute top-1.5 right-1.5"><SignalBadge tone="recommended" size="sm">추천</SignalBadge></div>}
                <Moon size={18} className="text-emerald-500 group-hover:scale-110 transition-transform" />
                <span className={`${actionLabelClass} text-emerald-500/90`}>REST</span>
              </Motion.button>
              <Motion.button
                data-testid="control-class"
                whileTap={{ scale: 0.95 }}
                disabled={isAiThinking}
                onClick={() => setGameState(GS.JOB_CHANGE)}
                className={`${actionButtonBase} ${getRecommendedClass('class')} bg-[linear-gradient(180deg,rgba(22,12,32,0.82)_0%,rgba(10,7,17,0.96)_100%)] hover:bg-violet-500/10 border border-violet-500/20 hover:shadow-[0_0_18px_rgba(168,85,247,0.14)] hover:border-violet-400/40`}
              >
                {recommendedButton === 'class' && <div className="absolute top-1.5 right-1.5"><SignalBadge tone="recommended" size="sm">추천</SignalBadge></div>}
                <GraduationCap size={18} className="text-purple-500 group-hover:scale-110 transition-transform" />
                <span className={`${actionLabelClass} text-purple-500/90`}>CLASS</span>
              </Motion.button>
              <Motion.button
                data-testid="control-quests"
                whileTap={{ scale: 0.95 }}
                disabled={isAiThinking}
                onClick={() => setGameState(GS.QUEST_BOARD)}
                className={`${actionButtonBase} ${getRecommendedClass('quests')} bg-[linear-gradient(180deg,rgba(14,18,34,0.82)_0%,rgba(7,9,18,0.96)_100%)] hover:bg-indigo-500/10 border border-indigo-500/20 hover:shadow-[0_0_18px_rgba(99,102,241,0.14)] hover:border-indigo-400/40`}
              >
                {recommendedButton === 'quests' && <div className="absolute top-1.5 right-1.5"><SignalBadge tone="recommended" size="sm">추천</SignalBadge></div>}
                <ScrollText size={18} className="text-indigo-500 group-hover:scale-110 transition-transform" />
                <span className={`${actionLabelClass} text-indigo-500/90`}>{mobile ? 'QUEST' : 'QUESTS'}</span>
              </Motion.button>
              <Motion.button
                data-testid="control-craft"
                whileTap={{ scale: 0.95 }}
                disabled={isAiThinking}
                onClick={() => setGameState(GS.CRAFTING)}
                className={`${actionButtonBase} bg-[linear-gradient(180deg,rgba(32,17,8,0.82)_0%,rgba(16,10,7,0.96)_100%)] hover:bg-orange-500/10 border border-orange-500/20 hover:shadow-[0_0_18px_rgba(249,115,22,0.14)] hover:border-orange-400/40`}
              >
                <Hammer size={18} className="text-orange-500 group-hover:rotate-12 transition-transform" />
                <span className={`${actionLabelClass} text-orange-500/90`}>CRAFT</span>
              </Motion.button>
            </>
          )}

          {/* 묘지 회수 */}
          {grave && grave.loc === player.loc && (
            <Motion.button
              data-testid="control-reset"
              whileTap={{ scale: 0.95 }}
              disabled={isAiThinking}
              onClick={actions.lootGrave}
              className={`${actionButtonBase} bg-[linear-gradient(180deg,rgba(25,30,40,0.85)_0%,rgba(11,15,22,0.96)_100%)] hover:bg-slate-800/80 border border-slate-500/35 hover:shadow-[0_0_18px_rgba(148,163,184,0.18)]`}
            >
              <Ghost size={18} className="text-slate-400 group-hover:animate-bounce" />
              <span className={`${actionLabelClass} text-slate-300`}>{mobile ? 'LOOT' : 'RECOVER'}</span>
            </Motion.button>
          )}

          {/* FORMAT DRIVE (리셋) */}
          {!confirmReset ? (
            <Motion.button
              whileTap={{ scale: 0.95 }}
              disabled={isAiThinking}
              onClick={() => setConfirmReset(true)}
              className={`${actionButtonBase} ${mobile ? 'col-span-4' : 'sm:col-start-4'} bg-[linear-gradient(180deg,rgba(40,10,14,0.84)_0%,rgba(18,8,10,0.96)_100%)] hover:bg-red-900/40 border border-red-800/30 hover:border-red-600/50`}
            >
              <X size={18} className="text-red-500/70 group-hover:text-red-500 group-hover:scale-110 transition-all" />
              <span className={`${actionLabelClass} text-red-600/70 group-hover:text-red-500`}>{mobile ? 'RESET' : 'FORMAT DRIVE'}</span>
            </Motion.button>
          ) : (
            <div className={`${mobile ? 'col-span-4' : 'sm:col-start-4'} flex flex-col gap-1.5 min-h-[70px] justify-center`}>
              <Motion.button
                data-testid="control-reset-confirm"
                whileTap={{ scale: 0.95 }}
                onClick={() => { actions.reset(); setConfirmReset(false); }}
                className="flex-1 bg-red-900/60 border border-red-500/70 rounded-sm text-red-300 text-[10px] font-rajdhani font-bold tracking-widest hover:bg-red-700/60 transition-all py-1.5"
              >
                CONFIRM RESET
              </Motion.button>
              <Motion.button
                data-testid="control-reset-cancel"
                whileTap={{ scale: 0.95 }}
                onClick={() => setConfirmReset(false)}
                className="flex-1 bg-cyber-dark/60 border border-slate-600/50 rounded-sm text-slate-400 text-[10px] font-rajdhani font-bold tracking-widest hover:bg-slate-700/40 transition-all py-1.5"
              >
                CANCEL
              </Motion.button>
            </div>
          )}
        </div>
        </>
      )}
    </Motion.div>
  );
};

export default ControlPanel;
