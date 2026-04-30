// @ts-nocheck — TODO: cycle 59+ migration. props 인터페이스 + DB.MAPS narrowing 필요
import React, { useState } from 'react';
import {
  ArrowRight,
  Map as MapIcon,
  ShoppingBag,
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
import { getGravesAtLoc } from '../utils/graveUtils';

import CombatPanel from './tabs/CombatPanel';
import JobChangePanel from './tabs/JobChangePanel';
import QuestBoardPanel from './tabs/QuestBoardPanel';
import CraftingPanel from './tabs/CraftingPanel';
import { ACTION_KIND_TO_BUTTON } from './controlPanelConfig';

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
  mobileFocused = false,
  onOpenArchiveConsole = null,
}) => {
  const [confirmReset, setConfirmReset] = useState(false);
  const mapData = DB.MAPS[player.loc];
  const guidance = getAdventureGuidance(player, stats || { maxHp: player.maxHp, maxMp: player.maxMp }, mapData, gameState);
  const moveRecommendations = getMoveRecommendations(player, stats || { maxHp: player.maxHp, maxMp: player.maxMp }, mapData, DB.MAPS);
  const recommendedButton = ACTION_KIND_TO_BUTTON[guidance?.primaryAction?.kind] || null;
  const isSafeZone = mapData.type === 'safe';
  const showGraveRecovery = getGravesAtLoc(grave, player.loc).length > 0;

  const actionGridClass = 'grid grid-cols-3 gap-1.5';
  const actionButtonBase = 'relative h-[42px] overflow-hidden rounded-[1rem] px-2.5 flex items-center gap-2 text-left disabled:opacity-50 transition-all group backdrop-blur-xl shadow-[0_8px_18px_rgba(1,6,14,0.18),inset_0_1px_0_rgba(255,255,255,0.03)]';
  const actionLabelClass = 'text-[10px] font-rajdhani font-bold tracking-[0.12em] text-left';
  const resetButtonClass = 'h-[42px] rounded-[1rem] border px-2.5 text-[9px] font-rajdhani font-bold tracking-[0.12em] transition-all flex items-center justify-center gap-2';

  const getRecommendedClass = (buttonKey) => (
    recommendedButton === buttonKey
      ? 'ring-1 ring-cyan-300/45 shadow-[0_0_18px_rgba(34,211,238,0.18)]'
      : ''
  );

  const renderActionButton = (button, extraClass = '', { hideLabel = false } = {}) => {
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
    const buttonLabel = mobileLabel;

    return (
      <Motion.button
        key={key}
        data-testid={testId}
        title={buttonLabel}
        whileTap={{ scale: 0.95 }}
        disabled={disabled}
        onClick={onClick}
        className={`${actionButtonBase} ${getRecommendedClass(key)} ${className} ${extraClass}`.trim()}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-80"
          style={{ backgroundImage: 'radial-gradient(circle at 82% 12%, rgba(255,255,255,0.08), transparent 22%), linear-gradient(180deg, rgba(255,255,255,0.03), transparent 40%)' }}
        />
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[0.85rem] border border-white/8 bg-black/18 text-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <Icon size={13} className="transition-transform group-hover:scale-110" />
          </span>
          {hideLabel ? (
            <span className="sr-only">{buttonLabel}</span>
          ) : (
            <div className={actionLabelClass}>{buttonLabel}</div>
          )}
        </div>
        {recommendedButton === key && (
          <span className="ml-auto shrink-0 h-1.5 w-1.5 rounded-full bg-[#7dd4d8] shadow-[0_0_4px_rgba(125,212,216,0.8)]" />
        )}
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
          className={`${compact ? resetButtonClass : actionButtonBase} ${className} bg-[linear-gradient(180deg,rgba(54,18,24,0.72)_0%,rgba(18,9,12,0.94)_100%)] border border-rose-300/18 text-rose-100/80 hover:bg-rose-400/10 hover:border-rose-200/30`.trim()}
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[0.85rem] border border-rose-300/18 bg-black/18">
            <X size={13} className="text-rose-200/70 group-hover:text-rose-100 transition-all" />
          </span>
          <span className={`${actionLabelClass} text-rose-100/72 group-hover:text-rose-50`}>RESET</span>
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
    return (
      <CombatPanel
        player={player}
        actions={actions}
        enemy={enemy}
        stats={stats}
        isAiThinking={isAiThinking}
        mobile
        compact={false}
        dense={false}
      />
    );
  }

  if (gameState === GS.EVENT && isAiThinking) {
    return (
      <Motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={mobileFocused
          ? 'panel-noise aether-surface-strong relative z-20 flex min-h-0 flex-1 items-center justify-center rounded-[1.9rem] border border-[#9a8ac0]/20 px-5 py-6 text-center text-[#ece5ff] shadow-[0_24px_48px_rgba(9,12,18,0.24)] backdrop-blur-md'
          : 'panel-noise mt-4 rounded-lg border border-cyber-purple/50 bg-cyber-black/80 p-6 text-center font-rajdhani tracking-widest text-cyber-purple shadow-neon-purple backdrop-blur-md z-10 relative animate-pulse'
        }
      >
        NEURAL LINK ACTIVE... PROCESSING SCENARIO...
      </Motion.div>
    );
  }

  if (gameState === GS.EVENT && !isAiThinking) {
    return <EventPanel currentEvent={currentEvent} actions={actions} mobileFocused={mobileFocused} />;
  }

  if (gameState === GS.SHOP) {
    return <ShopPanel player={player} actions={actions} shopItems={shopItems} setGameState={setGameState} stats={stats} mobileFocused={mobileFocused} onOpenArchiveConsole={onOpenArchiveConsole} />;
  }

  if (gameState === GS.JOB_CHANGE) {
    return <JobChangePanel player={player} actions={actions} setGameState={setGameState} mobileFocused={mobileFocused} onOpenArchiveConsole={onOpenArchiveConsole} />;
  }

  if (gameState === GS.QUEST_BOARD) {
    return <QuestBoardPanel player={player} actions={actions} setGameState={setGameState} mobileFocused={mobileFocused} onOpenArchiveConsole={onOpenArchiveConsole} />;
  }

  if (gameState === GS.CRAFTING) {
    return <CraftingPanel player={player} actions={actions} setGameState={setGameState} mobileFocused={mobileFocused} onOpenArchiveConsole={onOpenArchiveConsole} />;
  }

  const coreButtons = [
    {
      key: 'explore',
      testId: 'control-explore',
      icon: MapIcon,
      label: 'EXPLORE',
      sidebarLabel: 'EXP',
      onClick: () => {
        soundManager.play('click');
        actions.explore();
      },
      className: 'bg-[linear-gradient(180deg,rgba(18,34,41,0.82)_0%,rgba(8,14,18,0.96)_100%)] border border-[#7dd4d8]/20 text-[#dff7f5] hover:border-[#d5b180]/22 hover:bg-[#d5b180]/8 hover:shadow-[0_18px_28px_rgba(125,212,216,0.1)]',
    },
    {
      key: 'move',
      testId: 'control-move',
      icon: ArrowRight,
      label: 'MOVE',
      sidebarLabel: 'MOVE',
      onClick: () => setGameState(GS.MOVING),
      className: 'bg-[linear-gradient(180deg,rgba(22,29,37,0.84)_0%,rgba(9,13,18,0.96)_100%)] border border-white/8 text-slate-200 hover:border-[#7dd4d8]/18 hover:bg-[#7dd4d8]/8 hover:shadow-[0_18px_28px_rgba(125,212,216,0.08)]',
    },
  ];

  const marketButton = {
    key: 'market',
    testId: 'control-market',
    icon: ShoppingBag,
    label: 'SHOP',
    mobileLabel: 'SHOP',
    onClick: () => {
      actions.setShopItems([...DB.ITEMS.consumables, ...DB.ITEMS.weapons, ...DB.ITEMS.armors]);
      actions.setGameState(GS.SHOP);
    },
    className: 'bg-[linear-gradient(180deg,rgba(34,24,14,0.84)_0%,rgba(16,11,7,0.96)_100%)] border border-[#d5b180]/22 text-[#f6e7c8] hover:bg-[#d5b180]/10 hover:border-[#d5b180]/30',
  };

  const safeZoneButtons = [marketButton];

  const auxiliaryButtons = [];
  if (showGraveRecovery) {
    auxiliaryButtons.push({
      key: 'grave',
      testId: 'control-recover',
      icon: Ghost,
      label: 'LOOT',
      mobileLabel: 'LOOT',
      onClick: actions.lootGrave,
      className: 'bg-[linear-gradient(180deg,rgba(26,31,38,0.85)_0%,rgba(12,15,20,0.96)_100%)] border border-white/10 text-slate-200 hover:border-[#d5b180]/16 hover:bg-white/[0.04]',
    });
  }

  return (
    <Motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="relative z-10 w-full panel-noise aether-surface rounded-[1.55rem] p-1.5"
    >
      {gameState === GS.MOVING ? (
        <div className="grid grid-cols-2 gap-2">
          {moveRecommendations.map((route) => (
            <Motion.button
              whileTap={{ scale: 0.95 }}
              key={route.name}
              disabled={isAiThinking}
              onClick={() => actions.move(route.name)}
              className={`rounded-[1.35rem] px-3 py-2.5 text-xs ${
                route.isRecommended
                  ? 'border-[#7dd4d8]/26 bg-[radial-gradient(circle_at_82%_12%,rgba(125,212,216,0.14),transparent_22%),linear-gradient(180deg,rgba(18,34,41,0.84)_0%,rgba(8,14,18,0.96)_100%)] shadow-[0_18px_30px_rgba(125,212,216,0.1)]'
                  : 'border-white/8 bg-[linear-gradient(180deg,rgba(18,21,28,0.84)_0%,rgba(8,11,16,0.96)_100%)]'
              } text-left hover:border-[#d5b180]/20 hover:bg-[#d5b180]/8 flex flex-col items-start gap-1.5 disabled:opacity-50 font-rajdhani font-bold tracking-wider transition-all backdrop-blur-md`}
            >
              <div className="flex w-full items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-[#e4f7f5] min-w-0">
                  <span className="flex shrink-0 items-center justify-center rounded-[0.75rem] border border-white/8 bg-black/18 h-7 w-7">
                    <MapIcon size={14} />
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-[12px]">{route.name}</div>
                    <div className="font-fira text-slate-400/72 text-[9px] font-normal">{route.levelLabel}</div>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <SignalBadge tone={route.isRecommended ? 'recommended' : 'neutral'} size="sm">
                    {route.isRecommended ? '추천' : route.badge}
                  </SignalBadge>
                  {route.undiscoveredSignatureCount > 0 && (
                    <span
                      data-testid={`move-recommendation-signature-${route.name}`}
                      data-signature-count={route.undiscoveredSignatureCount}
                      className="shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-fira font-bold leading-none"
                      style={{
                        color: '#f6e7a2',
                        border: '1px solid rgba(246,231,162,0.42)',
                        background: 'rgba(246,231,162,0.12)',
                      }}
                      aria-label={`미발견 전설 각인 ${route.undiscoveredSignatureCount}종`}
                    >
                      ✦{route.undiscoveredSignatureCount}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-[9px] font-fira text-slate-300/60 leading-snug line-clamp-2">
                {route.reason}
              </div>
            </Motion.button>
          ))}
          <Motion.button
            data-testid="control-move-cancel"
            whileTap={{ scale: 0.95 }}
            onClick={() => setGameState(GS.IDLE)}
            className="col-span-2 min-h-[42px] px-3 py-2 text-xs bg-[linear-gradient(180deg,rgba(54,18,24,0.72)_0%,rgba(18,9,12,0.94)_100%)] border border-rose-300/18 text-rose-100/84 rounded-[1.1rem] hover:bg-rose-400/10 font-bold tracking-wider transition-all"
          >
            CANCEL
          </Motion.button>
        </div>
      ) : (
        <div className={actionGridClass}>
          {coreButtons.map((button) => renderActionButton(button))}
          {!mobileFocused && !isSafeZone && renderResetControl({
            compact: true,
            className: '',
            confirmGridClass: 'col-span-3 grid-cols-2 gap-1.5',
          })}
          {isSafeZone && safeZoneButtons.map((button) => renderActionButton(button))}
          {auxiliaryButtons.map((button) => renderActionButton(button))}
          {!mobileFocused && isSafeZone && renderResetControl({
            compact: true,
            className: '',
            confirmGridClass: 'col-span-3 grid-cols-2 gap-1.5',
          })}
        </div>
      )}
    </Motion.div>
  );
};

export default ControlPanel;
