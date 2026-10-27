import {
  Backpack,
  Gem,
  GraduationCap,
  Hammer,
  Map as MapIcon,
  Moon,
  Route,
  ShoppingBag,
  Ghost,
  ScrollText,
  Sparkles,
} from 'lucide-react';
import { GS } from '../../reducers/gameStates';
import type { GameMode } from '../../reducers/gameStates';
import { MSG } from '../../data/messages';
import type { GameActions } from '../../hooks/actionDeps';
import type { ControlButton } from './types';

export interface ControlButtonDeps {
  actions?: GameActions;
  setGameState?: (state: GameMode) => void;
  onOpenMirror?: () => void;
  /** 에테르 교환소 열기 — 마을 시설의 교환소 단추가 쓴다(GameRoot가 교환소 화면을 소유한다, D2). */
  onOpenCrystalExchange?: () => void;
  onOpenArchiveConsole?: (tab?: string) => void;
  showGraveRecovery: boolean;
}

export interface ControlButtonSet {
  exploreButton: ControlButton;
  moveButton: ControlButton;
  bagButton: ControlButton;
  safeZoneButtons: ControlButton[];
  auxiliaryButtons: ControlButton[];
  buttonByKey: Map<string, ControlButton>;
  openQuestBoard: () => void;
}

/** 임무 게시판 열기 — 액션이 있으면 액션의 전이를, 없으면 화면 전이를 쓴다. */
const makeOpenQuestBoard = ({ actions, setGameState }: ControlButtonDeps) => () => {
  if (actions?.setGameState) {
    actions.setGameState(GS.QUEST_BOARD);
    return;
  }
  setGameState?.(GS.QUEST_BOARD);
};

// cycle 423: coreButtons 부가 라벨 출력 dead 제거 — label / mobileLabel만 활성.
const buildFieldButtons = ({ actions, setGameState, onOpenArchiveConsole }: ControlButtonDeps) => ({
  exploreButton: {
    key: 'explore',
    testId: 'control-explore',
    icon: MapIcon,
    label: '탐험',
    onClick: () => actions?.explore(),
  } satisfies ControlButton,
  moveButton: {
    key: 'move',
    testId: 'control-move',
    icon: Route,
    label: '이동',
    mobileLabel: '이동',
    onClick: () => setGameState?.(GS.MOVING),
  } satisfies ControlButton,
  // UX-07: 원정 중 가방 · 기록으로 가는 이름 있는 진입점(기록 열기 게이트는 openArchive 액션이 소유한다 — Wave 19 K2).
  bagButton: {
    key: 'bag',
    testId: 'control-open-bag',
    icon: Backpack,
    label: MSG.FIELD_ACTION_BAG,
    onClick: () => onOpenArchiveConsole?.('inventory'),
    disabled: !onOpenArchiveConsole,
  } satisfies ControlButton,
});

const buildTownButtons = (deps: ControlButtonDeps, openQuestBoard: () => void): ControlButton[] => {
  const { actions, setGameState, onOpenMirror, onOpenCrystalExchange } = deps;
  return [
    { key: 'rest', testId: 'control-rest', icon: Moon, label: '휴식', mobileLabel: '휴식', onClick: () => actions?.rest?.() },
    { key: 'quests', testId: 'control-quests', icon: ScrollText, label: '임무', mobileLabel: '임무', onClick: openQuestBoard },
    {
      key: 'market',
      testId: 'control-market',
      icon: ShoppingBag,
      label: '상점',
      mobileLabel: '상점',
      // 2026-09 Wave 17 I1 보정: 이 버튼이 **세 번째** 상점 진입 표면이었다. 파서와
      //   GameRoot는 `openShop`으로 돌렸는데 여기만 시퀀스를 복제하고 있었다 — 지금은
      //   조작판의 `gameState === GS.COMBAT` 조기 반환이 상태 가드를 대신하지만, 그건
      //   **렌더 조건에 얹힌 가드**라 조기 반환 목록이 바뀌면 조용히 사라진다
      //   (실측: 그 목록에 `dead`/`ascension`/`true_ending`이 없다). 가드는 액션이 갖는다.
      onClick: () => actions?.openShop(),
    },
    { key: 'class', testId: 'control-class', icon: GraduationCap, label: '전직', mobileLabel: '전직', onClick: () => setGameState?.(GS.JOB_CHANGE) },
    { key: 'craft', testId: 'control-craft', icon: Hammer, label: '제작', mobileLabel: '제작', onClick: () => setGameState?.(GS.CRAFTING) },
    // CL-02: 계승 정수를 쓰는 곳 — 설정 탭 끝과 계승 화면에만 있던 거울을 마을 시설로도 연다(규칙 · 비용은 거울 화면 그대로).
    {
      key: 'mirror',
      testId: 'control-mirror',
      icon: Sparkles,
      label: MSG.TOWN_FACILITY_LABELS.mirror,
      onClick: () => onOpenMirror?.(),
      disabled: !onOpenMirror,
    },
    {
      key: 'crystal',
      testId: 'control-crystal-exchange',
      icon: Gem,
      label: MSG.TOWN_FACILITY_LABELS.crystal,
      onClick: () => onOpenCrystalExchange?.(),
      disabled: !onOpenCrystalExchange,
    },
  ];
};

const buildAuxiliaryButtons = ({ actions, showGraveRecovery }: ControlButtonDeps): ControlButton[] => (
  showGraveRecovery
    ? [{ key: 'grave', testId: 'control-recover', icon: Ghost, label: '회수', mobileLabel: '회수', onClick: () => actions?.lootGrave?.() }]
    : []
);

/**
 * 조작판의 행동 단추 서술 전부(2026-10 에테르 유리 CH-08 — ControlPanel에서 분리).
 *   마을 빠른 행동 · 시설 · 원정 도크가 이 묶음을 key로 찾아 그린다. 동작(액션 · 화면 전이)은 분리 전과 같다.
 */
export const buildControlButtons = (deps: ControlButtonDeps): ControlButtonSet => {
  const openQuestBoard = makeOpenQuestBoard(deps);
  const field = buildFieldButtons(deps);
  const safeZoneButtons = buildTownButtons(deps, openQuestBoard);
  const auxiliaryButtons = buildAuxiliaryButtons(deps);
  const coreButtons: ControlButton[] = [field.exploreButton, field.moveButton];
  const buttonByKey = new Map(
    [...coreButtons, ...safeZoneButtons, ...auxiliaryButtons].map((button) => [button.key, button]),
  );
  return { ...field, safeZoneButtons, auxiliaryButtons, buttonByKey, openQuestBoard };
};
