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
import { runGuidanceAction } from '../utils/adventureGuideActions';

import CombatPanel from './tabs/CombatPanel';
import JobChangePanel from './tabs/JobChangePanel';
import QuestBoardPanel from './tabs/QuestBoardPanel';
import CraftingPanel from './tabs/CraftingPanel';

const ACTION_KIND_TO_BUTTON = {
  explore: 'explore',
  open_move: 'move',
  rest: 'rest',
  open_class: 'class',
  open_quest_board: 'quests',
  open_shop: 'market',
  claim_quest: 'quests',
};

const ControlPanel = ({
  gameState,
  player,
  enemy = null,
  actions,
  setGameState,
  shopItems,
  grave,
  isAiThinking,
  currentEvent,
  stats = null,
  mobile = false,
  setSideTab = null,
}) => {
  const [confirmReset, setConfirmReset] = useState(false);
  const mapData = DB.MAPS[player.loc];
  const guidance = getAdventureGuidance(player, stats || { maxHp: player.maxHp, maxMp: player.maxMp }, mapData, gameState);
  const moveRecommendations = getMoveRecommendations(player, stats || { maxHp: player.maxHp, maxMp: player.maxMp }, mapData, DB.MAPS);
  const recommendedButton = ACTION_KIND_TO_BUTTON[guidance?.primaryAction?.kind] || null;
  const isSafeZone = mapData.type === 'safe';
  const showGraveRecovery = grave && grave.loc === player.loc;

  const actionGridClass = mobile
    ? 'grid grid-cols-4 gap-1.5'
    : 'grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3';
  const actionButtonBase = mobile
    ? 'relative min-h-[50px] px-1 py-2 rounded-[1rem] flex flex-col items-center justify-center gap-1 disabled:opacity-50 transition-all group backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]'
    : 'relative min-h-[56px] p-2 sm:p-3 rounded-2xl flex flex-col items-center justify-center gap-1.5 disabled:opacity-50 transition-all group backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]';
  const actionLabelClass = mobile
    ? 'text-[8px] font-rajdhani font-bold tracking-[0.16em]'
    : 'text-[10px] sm:text-xs font-rajdhani font-bold tracking-widest';
  const resetButtonClass = mobile
    ? 'min-h-[50px] rounded-[1rem] border px-2 py-2 text-[8px] font-rajdhani font-bold tracking-[0.16em] transition-all flex flex-col items-center justify-center gap-1'
    : 'min-h-[44px] rounded-xl border px-3 py-2 text-[10px] font-rajdhani font-bold tracking-[0.18em] transition-all';

  const getRecommendedClass = (buttonKey) => (
    recommendedButton === buttonKey
      ? 'ring-1 ring-cyan-300/45 shadow-[0_0_18px_rgba(34,211,238,0.18)]'
      : ''
  );

  const handleGuidanceAction = (action) => {
    soundManager.play('click');
    runGuidanceAction({
      action,
      actions,
      setGameState,
      setSideTab,
    });
  };

  const renderActionButton = (button, extraClass = '') => {
    const {
      key,
      testId,
      icon: Icon,
      label,
      mobileLabel = label,
      onClick,
      className,
      disabled = false,
    } = button;

    return (
      <Motion.button
        key={key}
        data-testid={testId}
        whileTap={{ scale: 0.95 }}
        disabled={disabled}
        onClick={onClick}
        className={`${actionButtonBase} ${getRecommendedClass(key)} ${className} ${extraClass}`.trim()}
      >
        {!mobile && recommendedButton === key && (
          <div className="absolute top-1.5 right-1.5">
            <SignalBadge tone="recommended" size="sm">추천</SignalBadge>
          </div>
        )}
        <Icon size={mobile ? 16 : 18} className="transition-transform group-hover:scale-110" />
        <span className={actionLabelClass}>{mobile ? mobileLabel : label}</span>
      </Motion.button>
    );
  };

  const renderResetControl = ({ compact = false, className = '', confirmGridClass = '' } = {}) => {
    if (!confirmReset) {
      return (
        <Motion.button
          data-testid="control-reset"
          whileTap={{ scale: 0.95 }}
          disabled={isAiThinking}
          onClick={() => setConfirmReset(true)}
          className={`${compact ? resetButtonClass : actionButtonBase} ${className} bg-[linear-gradient(180deg,rgba(40,10,14,0.84)_0%,rgba(18,8,10,0.96)_100%)] border border-red-800/30 text-red-500/80 hover:bg-red-900/40 hover:border-red-600/50`.trim()}
        >
          <X size={mobile ? 16 : 18} className="text-red-500/70 group-hover:text-red-500 group-hover:scale-110 transition-all" />
          <span className={`${actionLabelClass} text-red-600/70 group-hover:text-red-500`}>RESET</span>
        </Motion.button>
      );
    }

    return (
      <div className={`${compact ? `${confirmGridClass || 'grid gap-1'} ${className}` : `flex flex-col gap-1.5 min-h-[70px] justify-center ${className}`}`.trim()}>
        <Motion.button
          data-testid="control-reset-confirm"
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            actions.reset();
            setConfirmReset(false);
          }}
          className={`${compact ? `${resetButtonClass} min-h-[44px]` : 'flex-1 rounded-sm py-1.5 text-[10px]'} bg-red-900/60 border border-red-500/70 text-red-200 hover:bg-red-700/60`}
        >
          {compact ? 'RESET OK' : 'CONFIRM RESET'}
        </Motion.button>
        <Motion.button
          data-testid="control-reset-cancel"
          whileTap={{ scale: 0.95 }}
          onClick={() => setConfirmReset(false)}
          className={`${compact ? `${resetButtonClass} min-h-[44px]` : 'flex-1 rounded-sm py-1.5 text-[10px]'} bg-cyber-dark/60 border border-slate-600/50 text-slate-400 hover:bg-slate-700/40`}
        >
          CANCEL
        </Motion.button>
      </div>
    );
  };

  if (gameState === GS.COMBAT) {
    return <CombatPanel player={player} actions={actions} enemy={enemy} stats={stats} isAiThinking={isAiThinking} mobile={mobile} />;
  }

  if (gameState === GS.EVENT && isAiThinking) {
    return (
      <Motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="panel-noise mt-4 p-6 border border-cyber-purple/50 rounded-lg bg-cyber-black/80 text-center animate-pulse text-cyber-purple font-rajdhani tracking-widest shadow-neon-purple backdrop-blur-md z-10 relative"
      >
        NEURAL LINK ACTIVE... PROCESSING SCENARIO...
      </Motion.div>
    );
  }

  if (gameState === GS.EVENT && !isAiThinking) {
    return <EventPanel currentEvent={currentEvent} actions={actions} />;
  }

  if (gameState === GS.SHOP) {
    return <ShopPanel player={player} actions={actions} shopItems={shopItems} setGameState={setGameState} stats={stats} mobile={mobile} />;
  }

  if (gameState === GS.JOB_CHANGE) {
    return <JobChangePanel player={player} actions={actions} setGameState={setGameState} />;
  }

  if (gameState === GS.QUEST_BOARD) {
    return <QuestBoardPanel player={player} actions={actions} setGameState={setGameState} />;
  }

  if (gameState === GS.CRAFTING) {
    return <CraftingPanel player={player} actions={actions} setGameState={setGameState} />;
  }

  const coreButtons = [
    {
      key: 'explore',
      testId: 'control-explore',
      icon: MapIcon,
      label: 'EXPLORE',
      onClick: () => {
        soundManager.play('click');
        actions.explore();
      },
      className: 'bg-[linear-gradient(180deg,rgba(8,20,32,0.86)_0%,rgba(5,11,21,0.96)_100%)] border border-cyan-400/20 text-cyber-blue/90 hover:bg-cyan-500/10 hover:shadow-[0_0_18px_rgba(34,211,238,0.14)] hover:border-cyan-300/40',
    },
    {
      key: 'move',
      testId: 'control-move',
      icon: ArrowRight,
      label: 'MOVE',
      onClick: () => setGameState(GS.MOVING),
      className: 'bg-[linear-gradient(180deg,rgba(10,24,26,0.86)_0%,rgba(5,11,17,0.96)_100%)] border border-emerald-400/20 text-cyber-green/90 hover:bg-emerald-400/10 hover:shadow-[0_0_18px_rgba(16,185,129,0.14)] hover:border-emerald-300/40',
    },
  ];

  const restButton = {
    key: 'rest',
    testId: 'control-rest',
    icon: Moon,
    label: 'REST',
    onClick: actions.rest,
    className: 'bg-[linear-gradient(180deg,rgba(12,23,19,0.82)_0%,rgba(7,11,10,0.96)_100%)] border border-emerald-500/20 text-emerald-500/90 hover:bg-emerald-500/10 hover:shadow-[0_0_18px_rgba(16,185,129,0.14)] hover:border-emerald-400/40',
  };

  const marketButton = {
    key: 'market',
    testId: 'control-market',
    icon: ShoppingBag,
    label: mobile ? 'SHOP' : 'MARKET',
    onClick: () => {
      actions.setShopItems([...DB.ITEMS.consumables, ...DB.ITEMS.weapons, ...DB.ITEMS.armors]);
      actions.setGameState(GS.SHOP);
    },
    className: 'bg-[linear-gradient(180deg,rgba(30,22,8,0.82)_0%,rgba(15,12,6,0.96)_100%)] border border-yellow-500/20 text-yellow-500/90 hover:bg-yellow-500/10 hover:shadow-[0_0_18px_rgba(234,179,8,0.14)] hover:border-yellow-400/40',
  };

  const classButton = {
    key: 'class',
    testId: 'control-class',
    icon: GraduationCap,
    label: 'CLASS',
    onClick: () => setGameState(GS.JOB_CHANGE),
    className: 'bg-[linear-gradient(180deg,rgba(22,12,32,0.82)_0%,rgba(10,7,17,0.96)_100%)] border border-violet-500/20 text-purple-500/90 hover:bg-violet-500/10 hover:shadow-[0_0_18px_rgba(168,85,247,0.14)] hover:border-violet-400/40',
  };

  const questButton = {
    key: 'quests',
    testId: 'control-quests',
    icon: ScrollText,
    label: mobile ? 'QUEST' : 'QUESTS',
    onClick: () => setGameState(GS.QUEST_BOARD),
    className: 'bg-[linear-gradient(180deg,rgba(14,18,34,0.82)_0%,rgba(7,9,18,0.96)_100%)] border border-indigo-500/20 text-indigo-400/90 hover:bg-indigo-500/10 hover:shadow-[0_0_18px_rgba(99,102,241,0.14)] hover:border-indigo-400/40',
  };

  const craftButton = {
    key: 'craft',
    testId: 'control-craft',
    icon: Hammer,
    label: 'CRAFT',
    onClick: () => setGameState(GS.CRAFTING),
    className: 'bg-[linear-gradient(180deg,rgba(32,17,8,0.82)_0%,rgba(16,10,7,0.96)_100%)] border border-orange-500/20 text-orange-500/90 hover:bg-orange-500/10 hover:shadow-[0_0_18px_rgba(249,115,22,0.14)] hover:border-orange-400/40',
  };

  const safeZoneButtons = [marketButton, restButton, classButton, questButton, craftButton];

  const auxiliaryButtons = [];
  if (showGraveRecovery) {
    auxiliaryButtons.push({
      key: 'grave',
      testId: 'control-recover',
      icon: Ghost,
      label: mobile ? 'LOOT' : 'RECOVER',
      onClick: actions.lootGrave,
      className: 'bg-[linear-gradient(180deg,rgba(25,30,40,0.85)_0%,rgba(11,15,22,0.96)_100%)] border border-slate-500/35 text-slate-300 hover:bg-slate-800/80 hover:shadow-[0_0_18px_rgba(148,163,184,0.18)]',
    });
  }

  return (
    <Motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`mt-2.5 md:mt-4 relative z-10 w-full ${mobile ? 'panel-noise rounded-[1.65rem] border border-cyan-400/16 bg-[linear-gradient(180deg,rgba(8,13,25,0.95)_0%,rgba(5,10,18,0.96)_100%)] p-2.5 shadow-[0_24px_60px_rgba(2,8,20,0.4)] backdrop-blur-2xl' : ''}`}
    >
      {gameState === GS.MOVING ? (
        <div className={`gap-2 md:gap-3 ${mobile ? 'grid grid-cols-2' : 'flex flex-wrap'}`}>
          {moveRecommendations.map((route) => (
            <Motion.button
              whileTap={{ scale: 0.95 }}
              key={route.name}
              disabled={isAiThinking}
              onClick={() => actions.move(route.name)}
              className={`${mobile ? 'min-h-[78px] px-3 py-2 text-xs' : 'flex-1 min-w-[150px] min-h-[92px] px-4 py-3'} ${
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
                <SignalBadge tone={route.isRecommended ? 'recommended' : 'neutral'} size="sm">
                  {route.isRecommended ? '추천' : route.badge}
                </SignalBadge>
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
            className={`${mobile ? 'col-span-2 min-h-[42px] px-3 py-2 text-xs' : 'flex-1 min-w-[120px] min-h-[50px] px-4 md:px-6 py-3 md:py-4'} bg-red-900/20 border border-red-500/30 text-red-400 rounded-md hover:bg-red-900/40 font-bold tracking-wider transition-all`}
          >
            CANCEL
          </Motion.button>
        </div>
      ) : (
        <>
          {!mobile && (
            <div className="mb-2 max-w-md rounded-xl border border-cyber-blue/15 bg-cyber-black/55 px-3 py-2">
              <div className="flex items-center justify-between gap-2 text-[10px] font-fira uppercase tracking-[0.18em] text-cyber-blue/55">
                <span>추천 행동</span>
                <span className="text-cyber-green">{guidance.emphasis}</span>
              </div>
              <div className="mt-1 text-sm font-rajdhani font-bold text-white">{guidance.title}</div>
              <div className="mt-0.5 text-[11px] font-fira text-cyber-blue/65">{guidance.detail}</div>
              {(guidance.primaryAction || guidance.secondaryAction) && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {guidance.primaryAction ? (
                    <button
                      onClick={() => handleGuidanceAction(guidance.primaryAction)}
                      className="min-h-[36px] rounded-lg border border-cyber-green/30 bg-cyber-green/10 px-3 py-2 text-[10px] font-rajdhani font-bold tracking-[0.16em] text-cyber-green transition-colors hover:bg-cyber-green/15"
                    >
                      {guidance.primaryAction.label}
                    </button>
                  ) : (
                    <div />
                  )}
                  {guidance.secondaryAction ? (
                    <button
                      onClick={() => handleGuidanceAction(guidance.secondaryAction)}
                      className="min-h-[36px] rounded-lg border border-cyber-blue/20 bg-cyber-black/60 px-3 py-2 text-[10px] font-rajdhani font-bold tracking-[0.16em] text-cyber-blue/80 transition-colors hover:bg-cyber-blue/10"
                    >
                      {guidance.secondaryAction.label}
                    </button>
                  ) : (
                    <div />
                  )}
                </div>
              )}
            </div>
          )}

          <div className={actionGridClass}>
            {coreButtons.map((button) => renderActionButton(button))}
            {mobile && !isSafeZone && renderResetControl({ compact: true, confirmGridClass: 'col-span-2 grid-cols-2 gap-1.5' })}
            {isSafeZone && safeZoneButtons.map((button) => renderActionButton(button))}
            {auxiliaryButtons.map((button) => renderActionButton(button))}
            {mobile && isSafeZone && renderResetControl({ compact: true, confirmGridClass: 'col-span-2 grid-cols-2 gap-1.5' })}
            {!mobile && renderResetControl({
              className: 'sm:col-start-4',
            })}
          </div>
        </>
      )}
    </Motion.div>
  );
};

export default ControlPanel;
