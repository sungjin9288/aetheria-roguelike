import { Sparkles } from 'lucide-react';
import { DB } from '../data/db';
import { getAdventureGuidance, getExpeditionPreparation, getMoveRecommendations, getQuestTracker } from '../utils/adventureGuide';
import { canBossAppearInMap } from '../utils/bossPresence';
import ShopPanel from './ShopPanel';
import EventPanel from './EventPanel';
import { GS } from '../reducers/gameStates';
import type { GameMode } from '../reducers/gameStates';
import { getGravesAtLoc } from '../utils/graveUtils';
import { getMapRequiredLevel, getNextMapTowardTarget } from '../utils/mapTopology';
import type { RouteTopologyEntry } from './RouteTopology';

import CombatPanel from './tabs/CombatPanel';
import JobChangePanel from './tabs/JobChangePanel';
import QuestBoardPanel from './tabs/QuestBoardPanel';
import CraftingPanel from './tabs/CraftingPanel';
import { ACTION_KIND_TO_BUTTON } from './controlPanelConfig';
import type { FullStats, Item, Player, Monster } from '../types/index.js';
import { getTownActionPresentation } from '../utils/townActionPresentation';
import { getExpeditionFocusRouteTargets } from '../utils/expeditionMissionFocus';
import { getScoutAvailability } from '../utils/scoutEvents';
import { getVisibleLocationName } from '../utils/challengeRules';
import { MSG } from '../data/messages';
import type { GameState } from '../reducers/gameReducer';
import type { GameActions } from '../hooks/actionDeps';
import ActionButton from './ui/ActionButton';
import MissionTrackerStrip from './control/MissionTrackerStrip';
import ExpeditionPrepStrip from './control/ExpeditionPrepStrip';
import MapSignalStrip from './control/MapSignalStrip';
import FieldDock from './control/FieldDock';
import RouteBoard from './control/RouteBoard';
import TownActions from './control/TownActions';
import type { ControlButton } from './control/types';
import { buildControlButtons } from './control/controlButtons';

interface ControlPanelProps {
  gameState?: GameMode;
  player: Player;
  enemy?: Monster | null;
  actions?: GameActions;
  setGameState?: (state: GameMode) => void;
  /** 에테르 거울 열기 — 마을 시설의 거울 단추가 쓴다(GameRoot가 거울 화면을 소유한다, CL-02). */
  onOpenMirror?: () => void;
  shopItems?: Item[];
  grave?: GameState['grave'];
  isAiThinking?: boolean;
  currentEvent?: GameState['currentEvent'];
  stats?: FullStats | null;
  onOpenArchiveConsole?: (tab?: string) => void;
  /** 전투 조작판의 내 생명 막대가 읽는 맞은 순간 · 회복한 순간(App의 `useDamageFlash`, 2026-10 감사 VD-02). */
  damageFlash?: boolean;
  healFlash?: boolean;
}

// 2026-10 에테르 유리(감사 CH-08): 923줄이던 조작판을 화면 조각으로 나눴다 — 임무 카드 · 원정 준비 · 추천 경로 · 원정 도크 ·
//   이동 경로 보드 · 마을 행동은 `control/`이 그린다. 이 파일은 데이터 · 행동 서술 · 모드 분기만 소유한다(동작 · testid 그대로).
// cycle 587: 3 defaults batch 제거 (enemy/stats/onOpenArchiveConsole) —
//   2 production caller (MobileGameLayout:106/121) 12 props 모두 명시 전달
//   이라 3 defaults 모두 도달 불가. 청소 메가 시리즈 78번째.
const ControlPanel = ({
  gameState,
  player,
  enemy,
  actions,
  setGameState,
  onOpenMirror,
  shopItems,
  grave,
  isAiThinking,
  currentEvent,
  stats,
  onOpenArchiveConsole,
  damageFlash,
  healFlash,
}: ControlPanelProps) => {
  const mapData = DB.MAPS[player.loc as string];
  const currentLocation = player.loc || '';
  const playerLevel = player.level || 1;
  const questTracker = getQuestTracker(player);
  // H5(c): stats가 없을 때 가짜 {maxHp, maxMp}를 만들어 넘기던 폴백 제거 —
  //   세 함수 모두 내부에서 `stats?.maxHp || player?.maxHp`로 이미 같은 값을 쓴다.
  const guidance = getAdventureGuidance(player, stats, mapData, gameState);
  const moveRecommendations = getMoveRecommendations(player, stats, mapData, DB.MAPS);
  const expeditionPreparation = getExpeditionPreparation(player, stats, mapData, DB.MAPS);
  const questTargets = getExpeditionFocusRouteTargets(player).filter((target) => DB.MAPS[target]);
  const questNextSteps = new Set(questTargets.map((target) => getNextMapTowardTarget(DB.MAPS, currentLocation, target)).filter(Boolean));
  const routeTopologyEntries: RouteTopologyEntry[] = moveRecommendations.map((route) => {
    const targetMap = DB.MAPS[route.name];
    return {
      ...route,
      isMissionRoute: questNextSteps.has(route.name),
      isBoss: canBossAppearInMap(route.name, targetMap, player),
      isLocked: playerLevel < getMapRequiredLevel(targetMap, playerLevel),
    };
  });
  const recommendedButton = ACTION_KIND_TO_BUTTON[guidance?.primaryAction?.kind ?? ''] || null;
  const isSafeZone = mapData.type === 'safe';
  // 2026-09 D1 — 정찰 버튼. exploreActions.scout()과 같은 순수 판정(getScoutAvailability)을
  //   써서 라벨에 적힌 비용과 실제 차감, 비활성 사유가 어긋나지 않게 한다 (lessons R33).
  const scoutAvailability = getScoutAvailability(player, mapData, gameState === GS.IDLE);
  const showGraveRecovery = getGravesAtLoc(grave, player.loc).length > 0;
  const townPresentation = getTownActionPresentation({
    player,
    mapData,
    stats: stats || { maxHp: player.maxHp, maxMp: player.maxMp },
    guidance,
    preparation: expeditionPreparation,
    hasGrave: showGraveRecovery,
    classes: DB.CLASSES,
    recipes: DB.ITEMS.recipes || [],
    consumables: DB.ITEMS.consumables || [],
  });

  // cycle 626: extraClass '' / outer {} explicit default-elimination —
  //   callsite에서 ('', {}) 명시. inner destructure default `hideLabel = false`는 보존.
  //   2026-10 에테르 유리: 마을 · 회수 단추는 유리 단추(아이콘 위 · 이름 아래)이고, 안내가 고른 단추는 에테르 림이 하나 더 붙는다.
  const renderActionButton = (button: ControlButton, extraClass: string, { hideLabel = false }: { hideLabel?: boolean }) => {
    const {
      key,
      testId,
      icon: Icon,
      label,
      mobileLabel = label,
      onClick,
      disabled = false,
    } = button;
    const recommendedClass = recommendedButton === key ? 'is-recommended' : '';

    return (
      <ActionButton
        key={key}
        data-testid={testId}
        title={mobileLabel}
        disabled={disabled}
        onClick={onClick}
        icon={<Icon size={18} />}
        label={hideLabel ? <span className="sr-only">{mobileLabel}</span> : mobileLabel}
        className={`ae-dock-btn ${recommendedClass} ${extraClass}`.trim()}
      />
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
        damageFlash={damageFlash}
        healFlash={healFlash}
      />
    );
  }

  // 2026-09 Wave 19 K1: 준비 중 패널의 조건은 `EVENT && isAiThinking`이었다.
  //   `isAiThinking`의 생산자는 둘이라(탐험의 AI 이벤트 + `addStoryLog`의 전투/퀘스트
  //   내러티브) 내러티브 생성 중에 체인·캠프파이어 카드가 열리면 카드 대신 이 패널이
  //   최대 9.5초 떴다. 이제 준비 중은 **모드 자체**이므로 플래그를 읽지 않는다.
  if (gameState === GS.EVENT_PENDING) {
    return (
      <div
        role="status"
        className="ae-card relative z-20 flex min-h-0 flex-1 items-center justify-center px-5 py-6 text-center font-readable aether-type-title font-semibold text-ae-ink-2"
      >
        {MSG.AI_EVENT_PREPARING}
      </div>
    );
  }

  if (gameState === GS.EVENT) {
    // 2026-10 Wave 62 (원장 §61.2 A10): 길 잃은 여행이면 이벤트 화면의 지역 그림도 그리지 않는다(자리표시 이름에는 그림이 없다).
    return <EventPanel currentEvent={currentEvent} actions={actions} location={getVisibleLocationName(player, player.loc)} activeBuff={player.tempBuff} challengeModifiers={player.challengeModifiers} />;
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

  const {
    exploreButton,
    moveButton,
    bagButton,
    auxiliaryButtons,
    buttonByKey,
    openQuestBoard,
  } = buildControlButtons({ actions, setGameState, onOpenMirror, onOpenArchiveConsole, showGraveRecovery });

  const townQuickButtons = townPresentation.quickKeys
    .map((key) => buttonByKey.get(key))
    // 2026-09 Wave 16 H3: 라벨 소유권은 townActionPresentation의 exploreIntent다 —
    //   'investigate'(사냥감 있는 도시 조사)와 'chain'(이 지역에 대기 중인 이야기 스텝)을
    //   구분한다. 문구는 MSG 소유(컴포넌트 하드코딩 금지).
    .map((button) => (button?.key === 'explore' && townPresentation.exploreIntent !== null
      ? { ...button, label: townPresentation.exploreIntent === 'chain'
          ? MSG.TOWN_EXPLORE_CHAIN
          : MSG.TOWN_EXPLORE_INVESTIGATE }
      : button))
    .filter((button): button is ControlButton => Boolean(button));
  const townFacilityButtons = townPresentation.facilityKeys
    .map((key) => buttonByKey.get(key))
    .filter((button): button is ControlButton => Boolean(button));

  const runTownPrimaryAction = () => {
    switch (townPresentation.primary.kind) {
      case 'claim_quest':
        if (expeditionPreparation.tracker) {
          actions?.completeQuest?.(expeditionPreparation.tracker.questId);
        }
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
        openQuestBoard();
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

  const openTownArchive = onOpenArchiveConsole
    ? () => onOpenArchiveConsole('inventory')
    : undefined;
  const openMap = () => onOpenArchiveConsole?.('map');
  const lastExpedition = player.lastExpeditionSummary
    ? {
      destination: getVisibleLocationName(player, player.lastExpeditionSummary.destination) || '',
      battles: player.lastExpeditionSummary.battles,
      explores: player.lastExpeditionSummary.explores,
      expGained: player.lastExpeditionSummary.expGained,
    }
    : null;

  if (gameState === GS.MOVING) {
    return (
      <div className="ae-control relative z-10 w-full">
        <RouteBoard
          currentName={currentLocation}
          routes={routeTopologyEntries}
          recommendation={moveRecommendations[0] || null}
          blindMap={Boolean(player.challengeModifiers?.includes('blindMap'))}
          onSelect={(route) => actions?.move(route.name)}
          onCancel={() => setGameState?.(GS.IDLE)}
        />
      </div>
    );
  }

  return (
    <div className="ae-control relative z-10 w-full space-y-2">
      {isSafeZone ? (
        <div data-testid="control-map-signal" data-map-signal-mode="expedition-prep">
          <ExpeditionPrepStrip
            preparation={expeditionPreparation}
            primary={townPresentation.primary}
            onPrimaryAction={runTownPrimaryAction}
            onEditFocus={() => setGameState?.(GS.QUEST_BOARD)}
            onOpenArchive={openTownArchive}
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
      {/* 2026-09 Wave 28 (D6): 계승 화면을 한 번 미룬 런은 마왕 처치마다 다시 묻지 않는다 — 대신 여기서 연다.
          허용 여부는 REOPEN_ASCENSION 리듀서가 판정한다(이 조건은 표시일 뿐이다). */}
      {gameState === GS.IDLE && player.ascensionOfferDeferred === true && (
        <ActionButton
          data-testid="control-reopen-ascension"
          onClick={() => actions?.reopenAscension?.()}
          icon={<Sparkles size={16} />}
          label={MSG.ASCENSION_REOPEN_LABEL}
          className="ae-reopen-ascension w-full"
        />
      )}
      {/* slice 22: 가이드 스트립 — 퀘스트 트래커 부재 시(신규 플레이어 포함) 다음 행동 제목+이유를 같은 자리에 노출. */}
      {!isSafeZone && !questTracker && guidance?.title && (
        <div data-testid="adventure-guidance-strip" className="ae-card is-quiet px-3.5 py-3 font-readable">
          <div className="ae-eyebrow">다음 행동</div>
          <div className="mt-1 aether-type-title font-semibold text-ae-ink">{guidance.title}</div>
          <div className="mt-0.5 aether-type-meta text-ae-ink-2">{guidance.detail}</div>
        </div>
      )}
      {!isSafeZone && <MapSignalStrip player={player} routes={moveRecommendations} />}
      {isSafeZone ? (
        <TownActions
          lastExpedition={lastExpedition}
          onOpenDebrief={() => actions?.openExpeditionDebrief?.()}
          quickButtons={townQuickButtons.map((button) => renderActionButton(button, '', {}))}
          quickCount={townQuickButtons.length}
          facilityButtons={townFacilityButtons.map((button) => renderActionButton(button, '', {}))}
          facilityCount={townFacilityButtons.length}
          facilitySummary={townPresentation.facilitySummary}
        />
      ) : (
        <FieldDock
          explore={exploreButton}
          move={moveButton}
          bag={bagButton}
          exploreSublabel={getVisibleLocationName(player, player.loc) || ''}
          onOpenMap={onOpenArchiveConsole ? openMap : undefined}
          scoutAvailability={scoutAvailability}
          onScout={actions?.scout ? () => actions.scout?.() : undefined}
          recommendedKey={recommendedButton}
          auxiliary={auxiliaryButtons.length > 0 ? (
            <div className="mt-2 grid grid-cols-1 gap-2">
              {auxiliaryButtons.map((button) => renderActionButton(button, '', {}))}
            </div>
          ) : null}
        />
      )}
    </div>
  );
};

export default ControlPanel;
