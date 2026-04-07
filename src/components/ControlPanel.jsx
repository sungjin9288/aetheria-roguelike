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
import { getGravesAtLoc } from '../utils/graveUtils';

import CombatPanel from './tabs/CombatPanel';
import JobChangePanel from './tabs/JobChangePanel';
import QuestBoardPanel from './tabs/QuestBoardPanel';
import CraftingPanel from './tabs/CraftingPanel';
import { ACTION_KIND_TO_BUTTON, ACTION_PRESENTATION } from './controlPanelConfig';

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
  mobileFocused = false,
  desktopSidebar = false,
  compactDesktop = false,
}) => {
  const [confirmReset, setConfirmReset] = useState(false);
  const mapData = DB.MAPS[player.loc];
  const guidance = getAdventureGuidance(player, stats || { maxHp: player.maxHp, maxMp: player.maxMp }, mapData, gameState);
  const moveRecommendations = getMoveRecommendations(player, stats || { maxHp: player.maxHp, maxMp: player.maxMp }, mapData, DB.MAPS);
  const recommendedButton = ACTION_KIND_TO_BUTTON[guidance?.primaryAction?.kind] || null;
  const isSafeZone = mapData.type === 'safe';
  const showGraveRecovery = getGravesAtLoc(grave, player.loc).length > 0;
  const useCompactDesktopRail = desktopSidebar && compactDesktop;

  const actionGridClass = mobile
    ? 'grid grid-cols-2 gap-2.5'
    : useCompactDesktopRail
      ? 'grid grid-cols-2 gap-1'
      : desktopSidebar
      ? 'grid grid-cols-2 gap-1.5'
      : 'grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3';
  const actionButtonBase = mobile
    ? 'relative min-h-[88px] overflow-hidden rounded-[1.35rem] px-3 py-3 flex flex-col items-start justify-between gap-2 text-left disabled:opacity-50 transition-all group backdrop-blur-xl shadow-[0_18px_34px_rgba(1,6,14,0.22),inset_0_1px_0_rgba(255,255,255,0.03)]'
    : useCompactDesktopRail
      ? 'relative min-h-[30px] rounded-[0.78rem] px-0.75 py-0.5 flex items-center justify-center gap-0.75 disabled:opacity-50 transition-all group backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]'
      : desktopSidebar
      ? 'relative min-h-[44px] rounded-[1rem] px-1.25 py-1.25 flex flex-col items-center justify-center gap-0.5 disabled:opacity-50 transition-all group backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]'
      : 'relative min-h-[60px] p-2 sm:p-3 rounded-[1.3rem] flex flex-col items-center justify-center gap-1.5 disabled:opacity-50 transition-all group backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]';
  const actionLabelClass = mobile
    ? 'text-[11px] font-rajdhani font-bold tracking-[0.18em] text-left'
    : useCompactDesktopRail
      ? 'text-[6.5px] font-rajdhani font-bold tracking-[0.14em]'
      : desktopSidebar
      ? 'text-[7px] font-rajdhani font-bold tracking-[0.16em]'
      : 'text-[10px] sm:text-xs font-rajdhani font-bold tracking-widest';
  const resetButtonClass = mobile
    ? 'min-h-[56px] rounded-[1.15rem] border px-2.5 py-2 text-[9px] font-rajdhani font-bold tracking-[0.18em] transition-all flex flex-col items-center justify-center gap-1'
    : useCompactDesktopRail
      ? 'min-h-[24px] rounded-[0.78rem] border px-1.25 py-0.5 text-[6.5px] font-rajdhani font-bold tracking-[0.14em] transition-all flex items-center justify-center'
      : desktopSidebar
      ? 'min-h-[32px] rounded-[0.95rem] border px-2 py-1 text-[7px] font-rajdhani font-bold tracking-[0.16em] transition-all flex items-center justify-center'
      : 'min-h-[44px] rounded-xl border px-3 py-2 text-[10px] font-rajdhani font-bold tracking-[0.18em] transition-all';

  const getRecommendedClass = (buttonKey) => (
    !desktopSidebar && recommendedButton === buttonKey
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
      sidebarLabel = mobileLabel || label,
      onClick,
      className,
      disabled = false,
    } = button;
    const buttonLabel = mobile ? mobileLabel : desktopSidebar ? sidebarLabel : label;
    const actionMeta = ACTION_PRESENTATION[key] || null;

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
        {mobile && (
          <div
            className="pointer-events-none absolute inset-0 opacity-80"
            style={{ backgroundImage: 'radial-gradient(circle at 82% 12%, rgba(255,255,255,0.08), transparent 22%), linear-gradient(180deg, rgba(255,255,255,0.03), transparent 40%)' }}
          />
        )}
        {!mobile && !desktopSidebar && recommendedButton === key && (
          <div className="absolute top-1.5 right-1.5">
            <SignalBadge tone="recommended" size="sm">추천</SignalBadge>
          </div>
        )}
        {mobile ? (
          <>
            <div className="flex w-full items-start justify-between gap-2">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[1rem] border border-white/8 bg-black/18 text-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                <Icon size={16} className="transition-transform group-hover:scale-110" />
              </span>
              <div className="flex items-center gap-1">
                {recommendedButton === key && <SignalBadge tone="recommended" size="sm">추천</SignalBadge>}
                {actionMeta?.tag && <SignalBadge tone={actionMeta.tone} size="sm">{actionMeta.tag}</SignalBadge>}
              </div>
            </div>
            {hideLabel ? (
              <span className="sr-only">{buttonLabel}</span>
            ) : (
              <div className="w-full">
                <div className={actionLabelClass}>{buttonLabel}</div>
                {actionMeta?.detail && (
                  <div className="mt-1 text-[10px] font-fira leading-snug text-white/58">
                    {actionMeta.detail}
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <>
            <Icon size={useCompactDesktopRail ? 12 : desktopSidebar ? 13 : 18} className="transition-transform group-hover:scale-110" />
            {hideLabel ? (
              <span className="sr-only">{buttonLabel}</span>
            ) : (
              <span className={actionLabelClass}>{buttonLabel}</span>
            )}
          </>
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
          <X size={mobile ? 16 : useCompactDesktopRail ? 12 : desktopSidebar ? 13 : 18} className="text-rose-200/70 group-hover:text-rose-100 group-hover:scale-110 transition-all" />
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
          className={`${compact ? `${resetButtonClass} ${useCompactDesktopRail ? 'min-h-[36px]' : 'min-h-[44px]'}` : 'flex-1 rounded-sm py-1.5 text-[10px]'} bg-red-900/60 border border-red-500/70 text-red-200 hover:bg-red-700/60`}
        >
          {compact ? 'RESET OK' : 'CONFIRM RESET'}
        </Motion.button>
        <Motion.button
          data-testid="control-reset-cancel"
          whileTap={{ scale: 0.95 }}
          onClick={() => setConfirmReset(false)}
          className={`${compact ? `${resetButtonClass} ${useCompactDesktopRail ? 'min-h-[36px]' : 'min-h-[44px]'}` : 'flex-1 rounded-sm py-1.5 text-[10px]'} bg-cyber-dark/60 border border-slate-600/50 text-slate-400 hover:bg-slate-700/40`}
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
        mobile={mobile}
        compact={desktopSidebar || useCompactDesktopRail}
        dense={useCompactDesktopRail}
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
    return <ShopPanel player={player} actions={actions} shopItems={shopItems} setGameState={setGameState} stats={stats} mobile={mobile} mobileFocused={mobileFocused} />;
  }

  if (gameState === GS.JOB_CHANGE) {
    return <JobChangePanel player={player} actions={actions} setGameState={setGameState} mobileFocused={mobileFocused} />;
  }

  if (gameState === GS.QUEST_BOARD) {
    return <QuestBoardPanel player={player} actions={actions} setGameState={setGameState} mobileFocused={mobileFocused} />;
  }

  if (gameState === GS.CRAFTING) {
    return <CraftingPanel player={player} actions={actions} setGameState={setGameState} mobileFocused={mobileFocused} />;
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

  const restButton = {
    key: 'rest',
    testId: 'control-rest',
    icon: Moon,
    label: 'REST',
    sidebarLabel: 'REST',
    onClick: actions.rest,
    className: 'bg-[linear-gradient(180deg,rgba(25,28,23,0.82)_0%,rgba(12,13,10,0.96)_100%)] border border-[#d5b180]/16 text-[#f6e7c8] hover:bg-[#d5b180]/10 hover:border-[#d5b180]/24',
  };

  const marketButton = {
    key: 'market',
    testId: 'control-market',
    icon: ShoppingBag,
    label: mobile ? 'SHOP' : 'MARKET',
    sidebarLabel: 'SHOP',
    onClick: () => {
      actions.setShopItems([...DB.ITEMS.consumables, ...DB.ITEMS.weapons, ...DB.ITEMS.armors]);
      actions.setGameState(GS.SHOP);
    },
    className: 'bg-[linear-gradient(180deg,rgba(34,24,14,0.84)_0%,rgba(16,11,7,0.96)_100%)] border border-[#d5b180]/22 text-[#f6e7c8] hover:bg-[#d5b180]/10 hover:border-[#d5b180]/30',
  };

  const classButton = {
    key: 'class',
    testId: 'control-class',
    icon: GraduationCap,
    label: 'CLASS',
    sidebarLabel: 'CLASS',
    onClick: () => setGameState(GS.JOB_CHANGE),
    className: 'bg-[linear-gradient(180deg,rgba(28,20,39,0.84)_0%,rgba(12,10,18,0.96)_100%)] border border-[#9a8ac0]/18 text-[#ece5ff] hover:bg-[#9a8ac0]/10 hover:border-[#9a8ac0]/28',
  };

  const questButton = {
    key: 'quests',
    testId: 'control-quests',
    icon: ScrollText,
    label: mobile ? 'QUEST' : 'QUESTS',
    sidebarLabel: 'QUEST',
    onClick: () => setGameState(GS.QUEST_BOARD),
    className: 'bg-[linear-gradient(180deg,rgba(20,24,34,0.84)_0%,rgba(9,11,18,0.96)_100%)] border border-white/8 text-slate-200 hover:border-[#7dd4d8]/18 hover:bg-white/[0.04]',
  };

  const craftButton = {
    key: 'craft',
    testId: 'control-craft',
    icon: Hammer,
    label: 'CRAFT',
    sidebarLabel: 'CRAFT',
    onClick: () => setGameState(GS.CRAFTING),
    className: 'bg-[linear-gradient(180deg,rgba(30,22,18,0.84)_0%,rgba(14,10,9,0.96)_100%)] border border-[#d5b180]/14 text-[#f1dcc1] hover:border-[#d5b180]/24 hover:bg-[#d5b180]/8',
  };

  const safeZoneButtons = [marketButton, restButton, classButton, questButton, craftButton];

  const auxiliaryButtons = [];
  if (showGraveRecovery) {
    auxiliaryButtons.push({
      key: 'grave',
      testId: 'control-recover',
      icon: Ghost,
      label: mobile ? 'LOOT' : 'RECOVER',
      sidebarLabel: 'LOOT',
      onClick: actions.lootGrave,
      className: 'bg-[linear-gradient(180deg,rgba(26,31,38,0.85)_0%,rgba(12,15,20,0.96)_100%)] border border-white/10 text-slate-200 hover:border-[#d5b180]/16 hover:bg-white/[0.04]',
    });
  }

  const desktopSidebarButtons = [
    ...coreButtons,
    ...(isSafeZone ? safeZoneButtons : []),
    ...auxiliaryButtons,
  ];

  const desktopPriorityKeys = (() => {
    if (!desktopSidebar) return [];
    const availableKeys = new Set(desktopSidebarButtons.map((button) => button.key));
    const ordered = [];
    const pushKey = (key) => {
      if (availableKeys.has(key) && !ordered.includes(key)) ordered.push(key);
    };

    pushKey(recommendedButton);

    const fallbacks = isSafeZone
      ? ['explore', 'move', 'market', 'rest', 'quests', 'class', 'craft', 'grave']
      : ['explore', 'move', 'grave'];

    fallbacks.forEach(pushKey);
    return ordered.slice(0, 2);
  })();

  const desktopPriorityButtons = desktopSidebarButtons
    .filter((button) => desktopPriorityKeys.includes(button.key))
    .sort((a, b) => desktopPriorityKeys.indexOf(a.key) - desktopPriorityKeys.indexOf(b.key));

  const desktopSecondaryButtons = desktopSidebarButtons
    .filter((button) => !desktopPriorityKeys.includes(button.key));

  return (
    <Motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`relative z-10 w-full ${
        mobile
          ? 'panel-noise aether-surface rounded-[1.9rem] p-3'
          : useCompactDesktopRail
            ? 'panel-noise aether-surface rounded-[1.05rem] p-1.5'
            : desktopSidebar
            ? 'panel-noise aether-surface rounded-[1.35rem] p-2.5'
            : 'mt-2.5 md:mt-4'
      }`}
    >
      {mobile && (
        <>
          <div className="pointer-events-none absolute -top-6 right-0 h-20 w-20 rounded-full bg-[#d5b180]/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-8 left-0 h-24 w-24 rounded-full bg-[#7dd4d8]/8 blur-3xl" />
        </>
      )}
      {mobile && (
        <div className="mb-2.5 rounded-[1.25rem] aether-panel-core px-3 py-2.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[9px] font-fira uppercase tracking-[0.2em] text-slate-400/68">
                {gameState === GS.MOVING ? 'Route Matrix' : 'Tactical Deck'}
              </div>
              <div className="mt-1 text-[14px] font-rajdhani font-bold leading-none text-white/94">
                {gameState === GS.MOVING ? '다음 이동 노선을 선택하세요.' : guidance.title}
              </div>
              <div className="mt-1 text-[10px] font-fira leading-snug text-slate-300/72">
                {gameState === GS.MOVING
                  ? '권장 경로와 난이도 정보를 보고 안정적으로 진입할 구역을 정합니다.'
                  : guidance.detail}
              </div>
            </div>
            <SignalBadge tone={isSafeZone ? 'upgrade' : 'neutral'} size="sm">
              {isSafeZone ? '안전 지대' : '현장 작전'}
            </SignalBadge>
          </div>
        </div>
      )}
      {desktopSidebar && (
        <div className={`${useCompactDesktopRail ? 'mb-0.5' : 'mb-1.5'} flex items-center justify-between gap-2 px-0.25`}>
          <div className={`${useCompactDesktopRail ? 'text-[8px]' : 'text-[9px]'} font-fira uppercase tracking-[0.18em] text-slate-500`}>
            {gameState === GS.MOVING ? 'Routes' : 'Actions'}
          </div>
          {useCompactDesktopRail ? (
            <SignalBadge tone={isSafeZone ? 'upgrade' : 'neutral'} size="sm">
              {isSafeZone ? '안전' : '필드'}
            </SignalBadge>
          ) : (
            <div className="text-[9px] font-fira text-slate-400/66">
              {player.loc}
            </div>
          )}
        </div>
      )}
      {gameState === GS.MOVING ? (
        <div className={`${
          mobile
            ? 'grid grid-cols-2 gap-2'
            : desktopSidebar
              ? useCompactDesktopRail
                ? 'grid grid-cols-1 gap-0.75'
                : 'grid grid-cols-1 gap-2 md:gap-3'
              : 'flex flex-wrap gap-2 md:gap-3'
        }`}>
          {moveRecommendations.map((route) => (
            <Motion.button
              whileTap={{ scale: 0.95 }}
              key={route.name}
              disabled={isAiThinking}
              onClick={() => actions.move(route.name)}
              className={`${
                mobile
                  ? 'min-h-[92px] rounded-[1.35rem] px-3 py-3 text-xs'
                  : useCompactDesktopRail
                    ? 'min-h-[40px] px-1.5 py-1.25 text-[8px]'
                    : desktopSidebar
                    ? 'min-h-[54px] px-2 py-1.5 text-[9px]'
                    : 'flex-1 min-w-[150px] min-h-[92px] px-4 py-3'
              } ${
                route.isRecommended
                  ? 'border-[#7dd4d8]/26 bg-[radial-gradient(circle_at_82%_12%,rgba(125,212,216,0.14),transparent_22%),linear-gradient(180deg,rgba(18,34,41,0.84)_0%,rgba(8,14,18,0.96)_100%)] shadow-[0_18px_30px_rgba(125,212,216,0.1)]'
                  : 'border-white/8 bg-[linear-gradient(180deg,rgba(18,21,28,0.84)_0%,rgba(8,11,16,0.96)_100%)]'
              } text-left hover:border-[#d5b180]/20 hover:bg-[#d5b180]/8 flex flex-col items-start justify-between gap-2 disabled:opacity-50 font-rajdhani font-bold tracking-wider transition-all backdrop-blur-md`}
            >
              <div className="flex w-full items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-[#e4f7f5]">
                    <span className={`flex items-center justify-center rounded-[0.9rem] border border-white/8 bg-black/18 ${mobile ? 'h-8 w-8' : 'h-7 w-7'}`}>
                      <MapIcon size={useCompactDesktopRail ? 12 : 16} />
                    </span>
                    <span className={`truncate ${useCompactDesktopRail ? 'text-[11px]' : ''}`}>{route.name}</span>
                  </div>
                  <div className={`mt-1 font-fira text-slate-400/72 ${useCompactDesktopRail ? 'text-[8px]' : 'text-[10px]'}`}>
                    {route.levelLabel}
                  </div>
                </div>
                <SignalBadge tone={route.isRecommended ? 'recommended' : 'neutral'} size="sm">
                  {route.isRecommended ? '추천' : route.badge}
                </SignalBadge>
              </div>
              {!useCompactDesktopRail && (
                <div className="text-[10px] font-fira text-slate-300/72 leading-snug">
                  {route.reason}
                </div>
              )}
            </Motion.button>
          ))}
          <Motion.button
            data-testid="control-move-cancel"
            whileTap={{ scale: 0.95 }}
            onClick={() => setGameState(GS.IDLE)}
            className={`${
              mobile
                ? 'col-span-2 min-h-[42px] px-3 py-2 text-xs'
                : useCompactDesktopRail
                  ? 'min-h-[26px] px-2 py-1 text-[8px]'
                  : desktopSidebar
                  ? 'min-h-[34px] px-2 py-1 text-[8px]'
                  : 'flex-1 min-w-[120px] min-h-[50px] px-4 md:px-6 py-3 md:py-4'
            } bg-[linear-gradient(180deg,rgba(54,18,24,0.72)_0%,rgba(18,9,12,0.94)_100%)] border border-rose-300/18 text-rose-100/84 rounded-[1.1rem] hover:bg-rose-400/10 font-bold tracking-wider transition-all`}
          >
            CANCEL
          </Motion.button>
        </div>
      ) : (
        <>
          {desktopSidebar ? (
            <div className={useCompactDesktopRail ? 'space-y-0.5' : 'space-y-1'}>
              {desktopPriorityButtons.length > 0 && (
                <div className={`grid ${desktopPriorityButtons.length === 1 ? 'grid-cols-1' : 'grid-cols-2'} ${useCompactDesktopRail ? 'gap-0.5' : 'gap-1'}`}>
                  {desktopPriorityButtons.map((button) => renderActionButton(
                    button,
                    `${useCompactDesktopRail ? 'min-h-[30px] rounded-[0.78rem]' : 'min-h-[46px] rounded-[1rem]'} ${
                      recommendedButton === button.key
                        ? 'ring-1 ring-cyan-300/35 shadow-[0_0_12px_rgba(34,211,238,0.16)]'
                        : ''
                    }`
                  ))}
                </div>
              )}

              {desktopSecondaryButtons.length > 0 && (
                <div className={`grid ${useCompactDesktopRail ? 'grid-cols-5 gap-0.5' : 'grid-cols-3 gap-[0.3125rem]'}`}>
                  {desktopSecondaryButtons.map((button) => renderActionButton(
                    button,
                    useCompactDesktopRail
                      ? 'min-h-[24px] rounded-[0.72rem] px-0.25 py-0.25'
                      : 'min-h-[30px] rounded-[0.95rem]',
                    useCompactDesktopRail ? { hideLabel: true } : {}
                  ))}
                </div>
              )}

              {renderResetControl({
                compact: true,
                className: 'w-full',
                confirmGridClass: 'grid grid-cols-2 gap-1',
              })}
            </div>
          ) : (
            <div className={actionGridClass}>
              {coreButtons.map((button) => renderActionButton(button))}
              {(mobile || desktopSidebar) && !isSafeZone && renderResetControl({
                compact: true,
                className: desktopSidebar ? 'col-span-2' : '',
                confirmGridClass: desktopSidebar ? 'col-span-2 grid-cols-2 gap-1.5' : 'col-span-2 grid-cols-2 gap-1.5',
              })}
              {isSafeZone && safeZoneButtons.map((button) => renderActionButton(button))}
              {auxiliaryButtons.map((button) => renderActionButton(button))}
              {(mobile || desktopSidebar) && isSafeZone && renderResetControl({
                compact: true,
                className: desktopSidebar ? 'col-span-2' : '',
                confirmGridClass: desktopSidebar ? 'col-span-2 grid-cols-2 gap-1.5' : 'col-span-2 grid-cols-2 gap-1.5',
              })}
              {!mobile && !desktopSidebar && renderResetControl({
                className: 'sm:col-start-4',
              })}
            </div>
          )}
        </>
      )}
    </Motion.div>
  );
};

export default ControlPanel;
