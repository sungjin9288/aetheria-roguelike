import {
  Map as MapIcon,
  Moon,
  Route,
  ShoppingBag,
  Ghost,
  ScrollText,
} from 'lucide-react';
import { motion as Motion } from 'framer-motion';
import { DB } from '../data/db';
import { getAdventureGuidance, getMoveRecommendations, getQuestTracker } from '../utils/adventureGuide';
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
import type { Player, Monster } from '../types/index.js';

interface ControlPanelProps {
  gameState?: string;
  player: Player;
  enemy?: Monster | null;
  actions?: any;
  setGameState?: (state: string) => void;
  shopItems?: any[];
  grave?: any;
  isAiThinking?: boolean;
  currentEvent?: any;
  stats?: any;
  onOpenArchiveConsole?: any;
}

const missionTrackerTone: Record<string, string> = {
  claimable: 'border-[#d5b180]/26 bg-[linear-gradient(180deg,rgba(44,31,15,0.72)_0%,rgba(14,10,6,0.94)_100%)] text-[#f6e7c8]',
  bounty: 'border-rose-300/22 bg-[linear-gradient(180deg,rgba(42,18,25,0.72)_0%,rgba(15,8,12,0.94)_100%)] text-rose-100',
  active: 'border-[#7dd4d8]/22 bg-[linear-gradient(180deg,rgba(15,35,39,0.72)_0%,rgba(7,13,17,0.94)_100%)] text-[#dff7f5]',
};

const MissionTrackerStrip = ({ tracker }: { tracker: any }) => {
  const toneClass = missionTrackerTone[tracker.kind] || missionTrackerTone.active;
  const chipByLabel = new Map((tracker.chips || []).map((chip: any) => [chip.label, chip.value]));
  const decisionCells = [
    { label: 'NEXT', value: tracker.nextStep || chipByLabel.get('NEXT') || tracker.title },
    { label: 'ROUTE', value: tracker.routeLabel || chipByLabel.get('ROUTE') || 'RUN' },
    { label: 'REWARD', value: tracker.kind === 'claimable' ? '수령 가능' : (tracker.progressLabel || chipByLabel.get('PROG') || '진행 중') },
    { label: 'RETURN', value: tracker.returnLabel || chipByLabel.get('RETURN') || 'RUN' },
  ];

  return (
    <section
      data-testid="control-mission-tracker"
      aria-label="현재 임무"
      className={`aether-mission-strip relative overflow-hidden rounded-[1.05rem] px-3 py-2 ${toneClass}`}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{ backgroundImage: 'linear-gradient(140deg, rgba(255,255,255,0.08), transparent 42%)' }}
      />
      <div className="relative flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="aether-label text-slate-300/70">Mission</div>
          <div className="mt-0.5 truncate font-readable text-[13px] font-semibold text-white/94">
            {tracker.title}
          </div>
          <div className="mt-0.5 line-clamp-1 font-readable text-[11px] leading-snug text-slate-300/76">
            {tracker.nextStep}
          </div>
        </div>
        <div className="shrink-0 rounded-full border border-white/10 bg-black/18 px-2 py-1 font-fira text-[9px] font-bold text-white/82">
          {tracker.progressLabel}
        </div>
      </div>
      <div className="relative mt-2 h-[3px] overflow-hidden rounded-full bg-black/28">
        <div
          className="h-full rounded-full bg-[#7dd4d8]"
          style={{ width: `${Math.max(0, Math.min(100, tracker.progressPercent || 0))}%` }}
        />
      </div>
      <div className="relative mt-2 grid grid-cols-4 gap-1">
        {decisionCells.map((chip: any) => (
          <div key={`${chip.label}-${chip.value}`} className="aether-decision-cell rounded-[0.7rem] px-1.5 py-1">
            <div className="font-fira text-[7px] font-bold uppercase tracking-normal text-slate-500">{chip.label}</div>
            <div className="mt-0.5 truncate font-readable text-[9px] font-semibold text-slate-100/84">{chip.value}</div>
          </div>
        ))}
      </div>
    </section>
  );
};

const MapSignalStrip = ({
  player,
  currentMap,
  routes,
  setGameState,
  onOpenArchiveConsole,
  isAiThinking,
}: any) => {
  const recommendedRoute = routes?.[0] || null;
  const blindMap = player?.challengeModifiers?.includes('blindMap');
  const currentName = blindMap ? '???' : player?.loc;
  const routeName = blindMap ? '미확인 경로' : (recommendedRoute?.name || '경로 없음');
  const mapState = currentMap?.type === 'safe'
    ? 'SAFE'
    : currentMap?.boss
      ? 'BOSS'
      : 'FIELD';
  const routeBadge = recommendedRoute?.isRecommended ? '추천' : (recommendedRoute?.badge || '대기');

  const openMap = () => {
    soundManager.play('click');
    onOpenArchiveConsole?.('map');
  };

  const openRoute = () => {
    soundManager.play('click');
    setGameState?.(GS.MOVING);
  };

  return (
    <section
      data-testid="control-map-signal"
      aria-label="지도와 추천 경로"
      className="aether-route-strip rounded-[1.1rem] px-3 py-2"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="aether-label text-[#b9f1ec]/72">Map</div>
          <div className="mt-0.5 flex min-w-0 items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[0.8rem] border border-[#7dd4d8]/28 bg-black/24 text-[#dff7f5]">
              <MapIcon size={14} />
            </span>
            <div className="min-w-0">
              <div className="truncate font-readable text-[13px] font-semibold text-white">{currentName}</div>
              <div className="font-fira text-[9px] uppercase tracking-normal text-slate-300/70">{mapState}</div>
            </div>
          </div>
        </div>

        <div className="min-w-0 flex-1 px-1">
          <div className="aether-route-path">
            <span className="sr-only">현재 위치에서 추천 경로</span>
            <Route size={14} className="justify-self-center text-[#b9f1ec]" />
          </div>
          <div className="mt-1 flex min-w-0 items-center justify-center gap-1.5">
            <SignalBadge tone="recommended" size="sm">{routeBadge}</SignalBadge>
            <span className="truncate font-readable text-[12px] font-semibold text-[#dff7f5]">{routeName}</span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {onOpenArchiveConsole && (
            <button
              type="button"
              data-testid="control-map-open"
              onClick={openMap}
              className="min-h-[32px] rounded-[0.85rem] border border-[#7dd4d8]/26 bg-black/22 px-2 font-fira text-[9px] font-bold uppercase tracking-normal text-[#dff7f5]"
            >
              Map
            </button>
          )}
          <button
            type="button"
            data-testid="control-route-open"
            disabled={isAiThinking || !recommendedRoute}
            onClick={openRoute}
            className="min-h-[32px] rounded-[0.85rem] border border-[#d5b180]/28 bg-[#d5b180]/12 px-2 font-fira text-[9px] font-bold uppercase tracking-normal text-[#f6e7c8] disabled:opacity-45"
          >
            Route
          </button>
        </div>
      </div>
    </section>
  );
};

// cycle 587: 3 defaults batch 제거 (enemy/stats/onOpenArchiveConsole) —
//   2 production caller (MobileGameLayout:106/121) 12 props 모두 명시 전달
//   이라 3 defaults 모두 도달 불가. 청소 메가 시리즈 78번째.
const ControlPanel = ({
  gameState,
  player,
  enemy,
  actions,
  setGameState,
  shopItems,
  grave,
  isAiThinking,
  currentEvent,
  stats,
  onOpenArchiveConsole,
}: ControlPanelProps) => {
  // cycle 486-489: 모바일 포커스 플래그 4사이클 cascade — caller 항상 truthy
  //   전달 (2 callsite shorthand) → reset 확인 상태 / reset helper 함수 /
  //   비-truthy 가드 2 unreachable 블록 / EVENT 비-모바일 분기 + 3 subchild
  //   (QuestBoardPanel/ShopPanel/EventPanel) cascade 정리. 본체 변수 read 0건이라
  //   destructure에서 완전 제거. interface도 정리.
  const mapData = DB.MAPS[player.loc as string];
  const questTracker = getQuestTracker(player);
  const guidance = getAdventureGuidance(player, stats || { maxHp: player.maxHp, maxMp: player.maxMp }, mapData, gameState);
  const moveRecommendations = getMoveRecommendations(player, stats || { maxHp: player.maxHp, maxMp: player.maxMp }, mapData, DB.MAPS);
  const recommendedButton = ACTION_KIND_TO_BUTTON[guidance?.primaryAction?.kind as any] || null;
  const isSafeZone = mapData.type === 'safe';
  const showGraveRecovery = getGravesAtLoc(grave, player.loc).length > 0;

  const actionGridClass = 'grid grid-cols-3 gap-2';
  const actionButtonBase = 'aether-action-button relative min-h-[48px] overflow-hidden rounded-[1rem] px-2.5 flex items-center gap-2 text-left disabled:opacity-50 transition-all group';
  const actionLabelClass = 'text-[10px] font-readable font-bold uppercase tracking-normal text-left leading-tight';

  const getRecommendedClass = (buttonKey: any) => (
    recommendedButton === buttonKey
      ? 'ring-1 ring-cyan-300/45 shadow-[0_0_18px_rgba(34,211,238,0.18)]'
      : ''
  );

  // cycle 626: extraClass '' / outer {} explicit default-elimination —
  //   3 callsite (line 284/285/286)에서 ('', {}) 명시 추가 후 outer defaults
  //   제거. inner destructure default `hideLabel = false`는 보존 (caller {}
  //   시 그대로 기본값 적용). explicit default-elimination paired batch 3번째.
  const renderActionButton = (button: any, extraClass: any, { hideLabel = false }: any) => {
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
          style={{ backgroundImage: 'linear-gradient(145deg, rgba(255,255,255,0.08), transparent 42%), linear-gradient(180deg, rgba(255,255,255,0.035), transparent 42%)' }}
        />
        <div className="flex items-center gap-2">
          <span className="aether-action-icon flex h-7 w-7 shrink-0 items-center justify-center rounded-[0.85rem] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
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

  if (gameState === GS.COMBAT) {
    return (
      <CombatPanel
        player={player}
        actions={actions}
        enemy={enemy}
        stats={stats}
        isAiThinking={isAiThinking}
        mobile
      />
    );
  }

  if (gameState === GS.EVENT && isAiThinking) {
    return (
      <Motion.div
        initial={false}
        animate={{ opacity: 1 }}
        className="panel-noise aether-surface-strong relative z-20 flex min-h-0 flex-1 items-center justify-center rounded-[1.9rem] border border-[#9a8ac0]/20 px-5 py-6 text-center text-[#ece5ff] shadow-[0_24px_48px_rgba(9,12,18,0.24)] backdrop-blur-md"
      >
        NEURAL LINK ACTIVE... PROCESSING SCENARIO...
      </Motion.div>
    );
  }

  if (gameState === GS.EVENT && !isAiThinking) {
    return <EventPanel currentEvent={currentEvent} actions={actions} />;
  }

  if (gameState === GS.SHOP) {
    return <ShopPanel player={player} actions={actions} shopItems={shopItems} setGameState={setGameState} stats={stats} onOpenArchiveConsole={onOpenArchiveConsole} />;
  }

  if (gameState === GS.JOB_CHANGE) {
    return <JobChangePanel player={player} actions={actions} setGameState={setGameState} onOpenArchiveConsole={onOpenArchiveConsole} />;
  }

  if (gameState === GS.QUEST_BOARD) {
    return <QuestBoardPanel player={player} actions={actions} setGameState={setGameState} onOpenArchiveConsole={onOpenArchiveConsole} />;
  }

  if (gameState === GS.CRAFTING) {
    return <CraftingPanel player={player} actions={actions} setGameState={setGameState} onOpenArchiveConsole={onOpenArchiveConsole} />;
  }

  // cycle 423: coreButtons 부가 라벨 출력 dead 제거 — renderActionButton
  //   destructure 미포함이라 read 0건. label / mobileLabel만 활성.
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
      className: 'bg-[linear-gradient(180deg,rgba(18,34,41,0.82)_0%,rgba(8,14,18,0.96)_100%)] border border-[#7dd4d8]/20 text-[#dff7f5] hover:border-[#d5b180]/22 hover:bg-[#d5b180]/8 hover:shadow-[0_18px_28px_rgba(125,212,216,0.1)]',
    },
    {
      key: 'move',
      testId: 'control-move',
      icon: Route,
      label: 'MOVE',
      mobileLabel: 'MAP',
      onClick: () => setGameState?.(GS.MOVING),
      className: 'bg-[linear-gradient(180deg,rgba(22,29,37,0.84)_0%,rgba(9,13,18,0.96)_100%)] border border-white/8 text-slate-200 hover:border-[#7dd4d8]/18 hover:bg-[#7dd4d8]/8 hover:shadow-[0_18px_28px_rgba(125,212,216,0.08)]',
    },
  ];

  const marketButton: Record<string, any> = {
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

  const restButton: Record<string, any> = {
    key: 'rest',
    testId: 'control-rest',
    icon: Moon,
    label: 'REST',
    mobileLabel: 'REST',
    onClick: () => actions?.rest?.(),
    className: 'bg-[linear-gradient(180deg,rgba(24,30,44,0.84)_0%,rgba(9,12,18,0.96)_100%)] border border-[#9a8ac0]/22 text-[#ece5ff] hover:bg-[#9a8ac0]/10 hover:border-[#9a8ac0]/30',
  };

  const questButton: Record<string, any> = {
    key: 'quests',
    testId: 'control-quests',
    icon: ScrollText,
    label: 'QUESTS',
    mobileLabel: 'QUEST',
    onClick: () => {
      if (actions?.setGameState) {
        actions.setGameState(GS.QUEST_BOARD);
        return;
      }
      setGameState?.(GS.QUEST_BOARD);
    },
    className: 'bg-[linear-gradient(180deg,rgba(16,32,37,0.84)_0%,rgba(7,13,17,0.96)_100%)] border border-[#7dd4d8]/22 text-[#dff7f5] hover:bg-[#7dd4d8]/10 hover:border-[#7dd4d8]/30',
  };

  const safeZoneButtons = [restButton, questButton, marketButton];

  const auxiliaryButtons: any[] = [];
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
      initial={false}
      animate={{ opacity: 1 }}
      className="relative z-10 w-full panel-noise aether-surface rounded-[1.55rem] p-1.5"
    >
      {gameState === GS.MOVING ? (
        <div className="space-y-2">
          <div
            data-testid="control-route-board"
            className="aether-map-current-card rounded-[1.05rem] px-3 py-2"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="aether-label text-[#b9f1ec]/72">Route Map</div>
                <div className="mt-0.5 truncate font-readable text-[13px] font-semibold text-white">{player.loc}</div>
              </div>
              {moveRecommendations[0] && (
                <div className="shrink-0 text-right">
                  <div className="font-fira text-[8px] uppercase tracking-normal text-slate-400/76">Recommended</div>
                  <div className="mt-0.5 font-readable text-[12px] font-semibold text-[#dff7f5]">{moveRecommendations[0].name}</div>
                </div>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
          {moveRecommendations.map((route: any) => (
            <Motion.button
              whileTap={{ scale: 0.95 }}
              key={route.name}
              data-testid={`control-route-option-${route.name}`}
              disabled={isAiThinking}
              onClick={() => actions.move(route.name)}
              className={`aether-map-route-card ${route.isRecommended ? 'is-recommended' : ''} rounded-[1rem] px-3 py-2.5 text-xs ${
                route.isRecommended
                  ? 'shadow-[0_16px_28px_rgba(125,212,216,0.12)]'
                  : ''
              } text-left hover:border-[#d5b180]/20 hover:bg-[#d5b180]/8 flex flex-col items-start gap-1.5 disabled:opacity-50 font-readable font-semibold transition-all`}
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
              {route.routePlan && (
                <div className="grid w-full grid-cols-2 gap-1 pt-0.5">
                  <div className="min-w-0 rounded-lg border border-white/8 bg-black/16 px-2 py-1">
                    <div className="text-[8px] font-fira uppercase tracking-normal text-slate-500">PLAN</div>
                    <div className="mt-0.5 truncate text-[9px] font-fira font-normal text-slate-300/80">{route.routePlan.approach}</div>
                  </div>
                  <div className="min-w-0 rounded-lg border border-white/8 bg-black/16 px-2 py-1">
                    <div className="text-[8px] font-fira uppercase tracking-normal text-slate-500">RETURN</div>
                    <div className="mt-0.5 truncate text-[9px] font-fira font-normal text-slate-300/80">{route.routePlan.exitRule}</div>
                  </div>
                </div>
              )}
            </Motion.button>
          ))}
          <Motion.button
            data-testid="control-move-cancel"
            whileTap={{ scale: 0.95 }}
            onClick={() => setGameState?.(GS.IDLE)}
            className="col-span-2 min-h-[42px] px-3 py-2 text-xs bg-[linear-gradient(180deg,rgba(54,18,24,0.72)_0%,rgba(18,9,12,0.94)_100%)] border border-rose-300/18 text-rose-100/84 rounded-[1.1rem] hover:bg-rose-400/10 font-bold tracking-wider transition-all"
          >
            CANCEL
          </Motion.button>
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          {questTracker && <MissionTrackerStrip tracker={questTracker} />}
          {/* slice 22: 가이드 스트립 — getAdventureGuidance가 계산만 되고 추천 버튼
              하이라이트 외엔 렌더 0건이던 갭 해소. 퀘스트 트래커 부재 시(신규
              플레이어 포함) 다음 행동 제목+이유를 같은 자리에 노출. */}
          {!questTracker && guidance?.title && (
            <div data-testid="adventure-guidance-strip" className="aether-panel-core rounded-[1.05rem] px-3 py-2">
              <div className="aether-label text-[#7dd4d8]/72">NEXT</div>
              <div className="mt-0.5 font-readable text-[12px] font-semibold text-white/92">{guidance.title}</div>
              <div className="mt-0.5 font-readable text-[10px] leading-snug text-slate-300/82 line-clamp-2">{guidance.detail}</div>
            </div>
          )}
          <MapSignalStrip
            player={player}
            currentMap={mapData}
            routes={moveRecommendations}
            setGameState={setGameState}
            onOpenArchiveConsole={onOpenArchiveConsole}
            isAiThinking={isAiThinking}
          />
          <div className={actionGridClass}>
            {coreButtons.map((button: any) => renderActionButton(button, '', {}))}
            {isSafeZone && safeZoneButtons.map((button: any) => renderActionButton(button, '', {}))}
            {auxiliaryButtons.map((button: any) => renderActionButton(button, '', {}))}
          </div>
        </div>
      )}
    </Motion.div>
  );
};

export default ControlPanel;
