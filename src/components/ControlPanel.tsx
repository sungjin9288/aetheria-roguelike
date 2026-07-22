import {
  Backpack,
  ChevronDown,
  GraduationCap,
  Hammer,
  Landmark,
  Map as MapIcon,
  Moon,
  Route,
  ShoppingBag,
  Ghost,
  History,
  ScrollText,
} from 'lucide-react';
import { motion as Motion } from 'framer-motion';
import { DB } from '../data/db';
import { getAdventureGuidance, getExpeditionPreparation, getMoveRecommendations, getQuestTracker } from '../utils/adventureGuide';
import ShopPanel from './ShopPanel';
import EventPanel from './EventPanel';
import { soundManager } from '../systems/SoundManager';
import { GS } from '../reducers/gameStates';
import SignalBadge from './SignalBadge';
import { getGravesAtLoc } from '../utils/graveUtils';
import { getMapRequiredLevel, getNextMapTowardTarget } from '../utils/mapTopology';
import RouteTopology, { type RouteTopologyEntry } from './RouteTopology';

import CombatPanel from './tabs/CombatPanel';
import JobChangePanel from './tabs/JobChangePanel';
import QuestBoardPanel from './tabs/QuestBoardPanel';
import CraftingPanel from './tabs/CraftingPanel';
import { ACTION_KIND_TO_BUTTON } from './controlPanelConfig';
import type { Player, Monster } from '../types/index.js';
import { getTownActionPresentation } from '../utils/townActionPresentation';
import { getExpeditionFocusRouteTargets, MAX_EXPEDITION_FOCUS_QUESTS } from '../utils/expeditionMissionFocus';

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

const MissionTrackerStrip = ({ tracker, canClaimReward, onClaimReward }: {
  tracker: any;
  canClaimReward: boolean;
  onClaimReward?: () => void;
}) => {
  const toneClass = missionTrackerTone[tracker.kind] || missionTrackerTone.active;
  const missionSteps = [
    { label: '할 일', value: tracker.nextStep || tracker.title },
    { label: '장소', value: tracker.routeLabel || '현재 지역' },
    { label: '진행', value: tracker.kind === 'claimable' ? '보상 대기' : (tracker.progressLabel || '진행 중') },
    { label: '마무리', value: tracker.returnLabel || '계속 진행' },
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
          <div className="aether-label text-slate-300/70">이번 원정 · {tracker.focusCount}/{MAX_EXPEDITION_FOCUS_QUESTS}</div>
          <div className="aether-type-title mt-0.5 font-readable font-semibold text-white/94">
            {tracker.title}
          </div>
          <div className="aether-type-body mt-0.5 font-readable text-slate-300/76">
            {tracker.nextStep}
          </div>
        </div>
        <div className="aether-type-meta shrink-0 rounded-full border border-white/10 bg-black/18 px-2 py-1 font-fira font-bold text-white/82">
          {tracker.progressLabel}
        </div>
      </div>
      <div className="relative mt-2 h-[3px] overflow-hidden rounded-full bg-black/28">
        <div
          className="h-full rounded-full bg-[#7dd4d8]"
          style={{ width: `${Math.max(0, Math.min(100, tracker.progressPercent || 0))}%` }}
        />
      </div>
      <div className="relative mt-2 grid gap-1 min-[401px]:grid-cols-3" data-testid="control-expedition-focus-list">
        {tracker.focusQuests?.map((quest: any) => (
          <div key={quest.questId} className="aether-decision-cell min-h-[38px] rounded-[0.7rem] px-2 py-1.5">
            <div className="aether-type-meta break-words font-readable font-semibold text-slate-100/88">{quest.title}</div>
            <div className="aether-type-label mt-0.5 font-readable text-slate-400">{quest.progressLabel}</div>
          </div>
        ))}
      </div>
      <div className="relative mt-2 grid grid-cols-2 gap-1 min-[401px]:grid-cols-4">
        {missionSteps.map((step: any, index: number) => {
          const isClaimAction = tracker.kind === 'claimable' && index === missionSteps.length - 1;
          if (isClaimAction) {
            return (
              <button
                key={`${step.label}-${step.value}`}
                type="button"
                data-testid="control-claim-quest-reward"
                disabled={!canClaimReward || !onClaimReward}
                onClick={onClaimReward}
                className="aether-decision-cell min-h-[44px] rounded-[0.7rem] border border-[#d5b180]/30 bg-[#d5b180]/12 px-2 py-1.5 text-left disabled:cursor-not-allowed disabled:opacity-55"
              >
                <div className="aether-type-label font-readable font-bold tracking-normal text-[#d5b180]/72">{step.label}</div>
                <div className="aether-type-meta mt-0.5 break-words font-readable font-bold text-[#f6e7c8]">
                  {canClaimReward ? '보상 받기' : '마을에서 수령'}
                </div>
              </button>
            );
          }

          return (
            <div key={`${step.label}-${step.value}`} className="aether-decision-cell min-h-[44px] rounded-[0.7rem] px-2 py-1.5">
              <div className="aether-type-label font-readable font-bold tracking-normal text-slate-500">{step.label}</div>
              <div className="aether-type-meta mt-0.5 break-words font-readable font-semibold text-slate-100/84">{step.value}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

const townPrimaryIcons: Record<string, any> = {
  claim_quest: ScrollText,
  explore: MapIcon,
  open_class: GraduationCap,
  open_inventory: Backpack,
  open_move: Route,
  open_quest_board: ScrollText,
  rest: Moon,
};

const ExpeditionPrepStrip = ({ preparation, guidance, primary, onPrimaryAction, onEditFocus }: {
  preparation: any;
  guidance: any;
  primary: any;
  onPrimaryAction: () => void;
  onEditFocus: () => void;
}) => {
  const PrimaryIcon = townPrimaryIcons[primary.kind] || Route;
  const checks = [
    { label: '목적지', value: preparation.destination },
    { label: '자원', value: preparation.resourceLabel },
    { label: '장비', value: preparation.equipmentLabel },
    { label: '귀환 기준', value: preparation.returnLabel },
  ];

  return (
    <section
      data-testid="control-expedition-prep"
      data-expedition-readiness={preparation.readinessLabel}
      aria-label="원정 준비"
      className="aether-expedition-prep overflow-hidden px-3 py-2.5"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="aether-label text-[#b9f1ec]/72">원정 준비</div>
          <div className="aether-type-title mt-0.5 font-readable font-semibold text-white">
            {preparation.missionTitle}
          </div>
          <div className="aether-type-body mt-0.5 font-readable text-slate-300/76">
            {preparation.missionStatus}
          </div>
        </div>
        <SignalBadge tone={preparation.readinessLabel === '출발 가능' ? 'recommended' : 'neutral'} size="sm">
          {preparation.readinessLabel}
        </SignalBadge>
      </div>

      {!preparation.tracker && guidance?.title && (
        <div data-testid="adventure-guidance-strip" className="mt-2 border-t border-white/8 pt-2">
          <div className="aether-type-body font-readable font-semibold text-[#dff7f5]">{guidance.title}</div>
          <div className="aether-type-meta mt-0.5 font-readable text-slate-300/82">{guidance.detail}</div>
        </div>
      )}

      {preparation.focusQuests.length > 0 && (
        <div className="mt-2" data-testid="control-expedition-focus-list">
          <div className="mb-1 flex items-center justify-between gap-2">
            <div className="aether-label">이번 원정 임무</div>
            <span className="aether-type-meta font-readable text-[#b9f1ec]">{preparation.focusQuests.length}/{MAX_EXPEDITION_FOCUS_QUESTS}</span>
          </div>
          <div className="grid gap-1 min-[401px]:grid-cols-3">
            {preparation.focusQuests.map((quest: any) => (
              <div key={quest.questId} className="aether-expedition-check min-w-0 px-2 py-1.5">
                <div className="aether-type-meta break-words font-readable font-semibold text-slate-100/90">{quest.title}</div>
                <div className="aether-type-label mt-0.5 font-readable text-slate-400">{quest.progressLabel}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-2 grid grid-cols-2 gap-1">
        {checks.map((check) => (
          <div key={check.label} className="aether-expedition-check min-w-0 px-2 py-1.5">
            <div className="aether-type-label font-readable font-bold text-slate-400">{check.label}</div>
            <div className="aether-type-body mt-0.5 break-words font-readable font-semibold text-slate-100/90" title={check.value}>
              {check.value}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        <div data-testid="control-town-primary" data-town-primary-kind={primary.kind}>
          <button
            type="button"
            data-testid={primary.testId}
            disabled={primary.disabled}
            onClick={onPrimaryAction}
            className={`${primary.tone === 'reward' ? 'aether-cta-gold text-[#f6e7c8]' : 'aether-cta-primary text-[#dff7f5]'} flex min-h-[48px] w-full items-center justify-center gap-2 px-3 font-readable text-xs font-bold disabled:cursor-not-allowed disabled:opacity-55`}
          >
            <PrimaryIcon size={14} />
            {primary.label}
          </button>
        </div>
        <button
          type="button"
          data-testid="control-edit-expedition-focus"
          title="원정 임무 구성"
          onClick={onEditFocus}
          className="aether-action-button flex min-h-[48px] min-w-[48px] items-center justify-center rounded-[0.75rem] border border-white/10 text-[#b9f1ec]"
        >
          <ScrollText size={16} />
          <span className="sr-only">원정 임무 구성</span>
        </button>
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
    ? '안전지대'
    : currentMap?.boss
      ? '보스 권역'
      : '탐험 지역';
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
          <div className="aether-label text-[#b9f1ec]/72">현재 지역</div>
          <div className="mt-0.5 flex min-w-0 items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[0.8rem] border border-[#7dd4d8]/28 bg-black/24 text-[#dff7f5]">
              <MapIcon size={14} />
            </span>
            <div className="min-w-0">
              <div className="aether-type-title font-readable font-semibold text-white">{currentName}</div>
              <div className="aether-type-meta font-fira uppercase tracking-normal text-slate-300/70">{mapState}</div>
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
            <span className="aether-type-body min-w-0 font-readable font-semibold text-[#dff7f5]">{routeName}</span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {onOpenArchiveConsole && (
            <button
              type="button"
              data-testid="control-map-open"
              onClick={openMap}
              className="aether-type-meta min-h-[44px] rounded-[0.85rem] border border-[#7dd4d8]/26 bg-black/22 px-2 font-fira font-bold uppercase tracking-normal text-[#dff7f5]"
            >
              지도
            </button>
          )}
          <button
            type="button"
            data-testid="control-route-open"
            disabled={isAiThinking || !recommendedRoute}
            onClick={openRoute}
            className="aether-type-meta min-h-[44px] rounded-[0.85rem] border border-[#d5b180]/28 bg-[#d5b180]/12 px-2 font-fira font-bold uppercase tracking-normal text-[#f6e7c8] disabled:opacity-45"
          >
            이동
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
  const currentLocation = player.loc || '';
  const playerLevel = player.level || 1;
  const questTracker = getQuestTracker(player);
  const guidance = getAdventureGuidance(player, stats || { maxHp: player.maxHp, maxMp: player.maxMp }, mapData, gameState);
  const moveRecommendations = getMoveRecommendations(player, stats || { maxHp: player.maxHp, maxMp: player.maxMp }, mapData, DB.MAPS);
  const expeditionPreparation = getExpeditionPreparation(
    player,
    stats || { maxHp: player.maxHp, maxMp: player.maxMp },
    mapData,
    DB.MAPS,
  );
  const questTargets = getExpeditionFocusRouteTargets(player).filter((target) => DB.MAPS[target]);
  const questNextSteps = new Set(questTargets.map((target) => getNextMapTowardTarget(DB.MAPS, currentLocation, target)).filter(Boolean));
  const routeTopologyEntries: RouteTopologyEntry[] = moveRecommendations.map((route: any) => {
    const targetMap = DB.MAPS[route.name];
    return {
      ...route,
      isMissionRoute: questNextSteps.has(route.name),
      isBoss: Boolean(targetMap?.boss),
      isLocked: playerLevel < getMapRequiredLevel(targetMap, playerLevel),
    };
  });
  const recommendedButton = ACTION_KIND_TO_BUTTON[guidance?.primaryAction?.kind as any] || null;
  const isSafeZone = mapData.type === 'safe';
  const showGraveRecovery = getGravesAtLoc(grave, player.loc).length > 0;
  const townPresentation = getTownActionPresentation({
    player,
    stats: stats || { maxHp: player.maxHp, maxMp: player.maxMp },
    guidance,
    preparation: expeditionPreparation,
    hasGrave: showGraveRecovery,
    classes: DB.CLASSES,
    recipes: DB.ITEMS.recipes || [],
    consumables: DB.ITEMS.consumables || [],
  });

  const actionGridClass = 'grid grid-cols-3 gap-2';
  const actionButtonBase = 'aether-action-button relative min-h-[48px] overflow-hidden rounded-[1rem] px-2.5 flex items-center gap-2 text-left disabled:opacity-50 transition-all group';
  const actionLabelClass = 'aether-type-body font-readable font-bold uppercase tracking-normal text-left';

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
        className="panel-noise aether-surface-strong relative z-20 flex min-h-0 flex-1 items-center justify-center rounded-[1.5rem] border border-[#9a8ac0]/20 px-5 py-6 text-center text-[#ece5ff] shadow-[0_24px_48px_rgba(9,12,18,0.24)] backdrop-blur-md"
      >
        이야기를 준비하고 있습니다...
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
      label: '탐험',
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
      label: '이동',
      mobileLabel: '이동',
      onClick: () => setGameState?.(GS.MOVING),
      className: 'bg-[linear-gradient(180deg,rgba(22,29,37,0.84)_0%,rgba(9,13,18,0.96)_100%)] border border-white/8 text-slate-200 hover:border-[#7dd4d8]/18 hover:bg-[#7dd4d8]/8 hover:shadow-[0_18px_28px_rgba(125,212,216,0.08)]',
    },
  ];

  const marketButton: Record<string, any> = {
    key: 'market',
    testId: 'control-market',
    icon: ShoppingBag,
    label: '상점',
    mobileLabel: '상점',
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
    label: '휴식',
    mobileLabel: '휴식',
    onClick: () => actions?.rest?.(),
    className: 'bg-[linear-gradient(180deg,rgba(24,30,44,0.84)_0%,rgba(9,12,18,0.96)_100%)] border border-[#9a8ac0]/22 text-[#ece5ff] hover:bg-[#9a8ac0]/10 hover:border-[#9a8ac0]/30',
  };

  const questButton: Record<string, any> = {
    key: 'quests',
    testId: 'control-quests',
    icon: ScrollText,
    label: '임무',
    mobileLabel: '임무',
    onClick: () => {
      if (actions?.setGameState) {
        actions.setGameState(GS.QUEST_BOARD);
        return;
      }
      setGameState?.(GS.QUEST_BOARD);
    },
    className: 'bg-[linear-gradient(180deg,rgba(16,32,37,0.84)_0%,rgba(7,13,17,0.96)_100%)] border border-[#7dd4d8]/22 text-[#dff7f5] hover:bg-[#7dd4d8]/10 hover:border-[#7dd4d8]/30',
  };

  const classButton: Record<string, any> = {
    key: 'class',
    testId: 'control-class',
    icon: GraduationCap,
    label: '전직',
    mobileLabel: '전직',
    onClick: () => setGameState?.(GS.JOB_CHANGE),
    className: 'bg-[linear-gradient(180deg,rgba(32,27,18,0.84)_0%,rgba(14,11,7,0.96)_100%)] border border-[#d5b180]/18 text-[#f6e7c8] hover:bg-[#d5b180]/10 hover:border-[#d5b180]/28',
  };

  const craftButton: Record<string, any> = {
    key: 'craft',
    testId: 'control-craft',
    icon: Hammer,
    label: '제작',
    mobileLabel: '제작',
    onClick: () => setGameState?.(GS.CRAFTING),
    className: 'bg-[linear-gradient(180deg,rgba(25,30,34,0.84)_0%,rgba(10,13,16,0.96)_100%)] border border-white/10 text-slate-200 hover:border-[#7dd4d8]/18 hover:bg-[#7dd4d8]/8',
  };

  const safeZoneButtons = [restButton, questButton, marketButton, classButton, craftButton];

  const auxiliaryButtons: any[] = [];
  if (showGraveRecovery) {
    auxiliaryButtons.push({
      key: 'grave',
      testId: 'control-recover',
      icon: Ghost,
      label: '회수',
      mobileLabel: '회수',
      onClick: actions.lootGrave,
      className: 'bg-[linear-gradient(180deg,rgba(26,31,38,0.85)_0%,rgba(12,15,20,0.96)_100%)] border border-white/10 text-slate-200 hover:border-[#d5b180]/16 hover:bg-white/[0.04]',
    });
  }

  const buttonByKey = new Map(
    [...coreButtons, ...safeZoneButtons, ...auxiliaryButtons].map((button) => [button.key, button]),
  );
  const townQuickButtons = townPresentation.quickKeys
    .map((key) => buttonByKey.get(key))
    .filter(Boolean);
  const townFacilityButtons = townPresentation.facilityKeys
    .map((key) => buttonByKey.get(key))
    .filter(Boolean);

  const runTownPrimaryAction = () => {
    soundManager.play('click');
    switch (townPresentation.primary.kind) {
      case 'claim_quest':
        actions?.completeQuest?.(expeditionPreparation.tracker?.questId);
        return;
      case 'explore':
        actions?.explore?.();
        return;
      case 'open_class':
        setGameState?.(GS.JOB_CHANGE);
        return;
      case 'open_inventory':
        onOpenArchiveConsole?.('inventory');
        return;
      case 'open_quest_board':
        if (actions?.setGameState) {
          actions.setGameState(GS.QUEST_BOARD);
          return;
        }
        setGameState?.(GS.QUEST_BOARD);
        return;
      case 'rest':
        actions?.rest?.();
        return;
      case 'open_move':
        if (expeditionPreparation.departure) {
          actions?.move?.(expeditionPreparation.departure.name);
          return;
        }
        setGameState?.(GS.MOVING);
        return;
      default:
        return;
    }
  };

  return (
    <Motion.div
      initial={false}
      animate={{ opacity: 1 }}
      className="relative z-10 w-full panel-noise aether-surface rounded-[1.5rem] p-1.5"
    >
      {gameState === GS.MOVING ? (
        <div className="space-y-2">
          <div
            data-testid="control-route-board"
            className="aether-map-current-card rounded-[0.75rem] px-2.5 py-2"
          >
            <div className="mb-1.5 flex items-center justify-between gap-2 px-0.5">
              <div className="aether-label text-[#b9f1ec]/72">이동 경로</div>
              <div className="aether-type-meta font-readable text-slate-400">지역을 눌러 이동</div>
            </div>
            <RouteTopology
              compact
              disableLockedRoutes
              testId="control-route-topology"
              currentTestId="control-route-current"
              connectorTestId="control-route-connector"
              currentName={currentLocation}
              routes={routeTopologyEntries}
              blindMap={player.challengeModifiers?.includes('blindMap')}
              onSelect={(route) => actions.move(route.name)}
              routeTestId={(route) => `control-route-option-${route.name}`}
            />
            {moveRecommendations[0] && (
              <div data-testid="control-route-guide" className="mt-2 border-t border-white/8 px-0.5 pt-2">
                <div className="aether-type-meta flex flex-wrap items-center justify-between gap-2 font-readable">
                  <span className="text-[#b9f1ec]">추천 · {moveRecommendations[0].name}</span>
                  <span className="text-slate-400">귀환 · {moveRecommendations[0].routePlan.returnLabel}</span>
                </div>
                <p className="aether-type-meta mt-1 font-readable text-slate-300/68">
                  {moveRecommendations[0].reason}
                </p>
              </div>
            )}
          </div>
          <Motion.button
            data-testid="control-move-cancel"
            whileTap={{ scale: 0.95 }}
            onClick={() => setGameState?.(GS.IDLE)}
            className="min-h-[44px] w-full rounded-[0.5rem] border border-rose-300/18 bg-[linear-gradient(180deg,rgba(54,18,24,0.72)_0%,rgba(18,9,12,0.94)_100%)] px-3 py-2 font-readable text-xs font-bold text-rose-100/84 transition-all hover:bg-rose-400/10"
          >
            돌아가기
          </Motion.button>
        </div>
      ) : (
        <div className="space-y-1.5">
          {isSafeZone ? (
            <div data-testid="control-map-signal" data-map-signal-mode="expedition-prep">
              <ExpeditionPrepStrip
                preparation={expeditionPreparation}
                guidance={guidance}
                primary={townPresentation.primary}
                onPrimaryAction={runTownPrimaryAction}
                onEditFocus={() => setGameState?.(GS.QUEST_BOARD)}
              />
            </div>
          ) : questTracker ? (
            <MissionTrackerStrip
              tracker={questTracker}
              canClaimReward={isSafeZone}
              onClaimReward={questTracker.kind === 'claimable' && actions?.completeQuest
                ? () => actions.completeQuest(questTracker.questId)
                : undefined}
            />
          ) : null}
          {/* slice 22: 가이드 스트립 — getAdventureGuidance가 계산만 되고 추천 버튼
              하이라이트 외엔 렌더 0건이던 갭 해소. 퀘스트 트래커 부재 시(신규
              플레이어 포함) 다음 행동 제목+이유를 같은 자리에 노출. */}
          {!isSafeZone && !questTracker && guidance?.title && (
            <div data-testid="adventure-guidance-strip" className="aether-panel-core rounded-[1.05rem] px-3 py-2">
              <div className="aether-label text-[#7dd4d8]/72">다음 행동</div>
              <div className="aether-type-body mt-0.5 font-readable font-semibold text-white/92">{guidance.title}</div>
              <div className="aether-type-meta mt-0.5 font-readable text-slate-300/82">{guidance.detail}</div>
            </div>
          )}
          {!isSafeZone && (
            <MapSignalStrip
              player={player}
              currentMap={mapData}
              routes={moveRecommendations}
              setGameState={setGameState}
              onOpenArchiveConsole={onOpenArchiveConsole}
              isAiThinking={isAiThinking}
            />
          )}
          {isSafeZone ? (
            <>
              {player.lastExpeditionSummary && (
                <button
                  type="button"
                  data-testid="control-last-expedition"
                  onClick={() => actions?.openExpeditionDebrief?.()}
                  className="flex min-h-[44px] w-full items-center gap-2 border-y border-white/8 px-2.5 py-2 text-left transition-colors hover:bg-white/[0.035]"
                >
                  <History size={14} className="shrink-0 text-[#d5b180]" />
                  <div className="min-w-0 flex-1">
                    <div className="aether-type-body font-readable font-semibold text-slate-100">
                      지난 원정 · {player.lastExpeditionSummary.destination}
                    </div>
                    <div className="aether-type-meta mt-0.5 font-readable text-slate-400">
                      전투 {player.lastExpeditionSummary.battles} · 탐험 {player.lastExpeditionSummary.explores} · +{player.lastExpeditionSummary.expGained.toLocaleString('ko-KR')} EXP
                    </div>
                  </div>
                  <span className="aether-type-body shrink-0 font-readable font-semibold text-[#b9f1ec]">보기</span>
                </button>
              )}
              <div data-testid="control-town-quick-actions" className={actionGridClass}>
                {townQuickButtons.map((button: any) => renderActionButton(button, '', {}))}
              </div>
              {townFacilityButtons.length > 0 && (
                <details
                  data-testid="control-town-facilities"
                  className="group rounded-[1rem] border border-white/8 bg-black/16"
                >
                  <summary className="flex min-h-[44px] cursor-pointer list-none items-center gap-2 px-3 py-2 text-left [&::-webkit-details-marker]:hidden">
                    <Landmark size={14} className="shrink-0 text-[#d5b180]" />
                    <span className="aether-type-body font-readable font-semibold text-slate-100">마을 시설</span>
                    <span className="aether-type-meta min-w-0 flex-1 text-right font-readable text-slate-400">
                      {townPresentation.facilitySummary}
                    </span>
                    <ChevronDown size={14} className="shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
                  </summary>
                  <div data-testid="control-town-facility-actions" className="grid grid-cols-2 gap-2 border-t border-white/8 p-2">
                    {townFacilityButtons.map((button: any) => renderActionButton(button, '', {}))}
                  </div>
                </details>
              )}
            </>
          ) : (
            <div className={actionGridClass}>
              {coreButtons.map((button: any) => renderActionButton(button, '', {}))}
              {auxiliaryButtons.map((button: any) => renderActionButton(button, '', {}))}
            </div>
          )}
        </div>
      )}
    </Motion.div>
  );
};

export default ControlPanel;
