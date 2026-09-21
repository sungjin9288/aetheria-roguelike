import { sanitizeQuickSlots } from './helpers';
import type { GameState, HandlerMap } from '../gameReducer';
import type { LoadDataPayload } from '../actionTypes';
import type { Player } from '../../types';
import { MSG } from '../../data/messages';
import { DB } from '../../data/db';
import { clearAdventureRelicBonuses, endDevourBonus } from '../../utils/adventureRelicBonuses';
import { normalizeAdventureRelicBonuses } from '../../utils/adventureRelicState';
import { normalizeDeferredEventChainSteps } from '../../data/eventChains';

const getBootstrapLogs = (state: GameState, playerName: string) => {
    if (state.logs.length > 0 || !playerName.trim()) return state.logs;
    return [{ id: 'bootstrap-restore', type: 'system', text: MSG.SYNC_SAVE_RESTORED }];
};

/**
 * `lastActive`는 Firestore Timestamp(`toMillis()`) 또는 이미 ms로 정규화된 숫자다.
 * 분기는 기존 인라인 삼항과 같다 — Timestamp면 toMillis(), 아니면 숫자(0/누락은 now).
 */
const resolveLastActiveMillis = (lastActive: LoadDataPayload['lastActive']): number => {
    if (lastActive && typeof lastActive === 'object' && lastActive.toMillis) return lastActive.toMillis();
    return (typeof lastActive === 'number' ? lastActive : 0) || Date.now();
};

export const bootstrapActionMap = {
    SET_BOOT_STAGE: (state, action) =>
        ({ ...state, bootStage: action.payload }),

    SET_UID: (state, action) =>
        ({ ...state, uid: action.payload }),

    LOAD_DATA: (state, action) => {
        let loadedPlayer: Player = { ...state.player, ...action.payload.player,
            deferredEventChainSteps: normalizeDeferredEventChainSteps(
                action.payload.player?.deferredEventChainSteps, action.payload.player?.eventChainProgress,
            ),
            adventureRelicBonuses: normalizeAdventureRelicBonuses(
                action.payload.player?.adventureRelicBonuses, action.payload.player?.maxHp,
            ) };
        const enemy = action.payload.enemy || null;
        const requestedMode = action.payload.gameState || 'idle';
        // 2026-09 Wave 18: **세이브 봉투에 없는 동반 상태를 요구하는 모드는 복원될 수 없다.**
        //   봉투는 {player, gameState, enemy, grave, currentEvent, quickSlots} 여섯뿐이라
        //   그 모드로 복원하면 화면을 띄울 조건이 영원히 거짓이 된다. 기존의
        //   `combat && !enemy`가 그 첫 사례였고, 같은 모양이 둘 더 있었다:
        //   - `event` + `currentEvent: null` — `explore()`가 AI 호출(최대 9.5s) **전에**
        //     `GS.EVENT`를 세우고 저장 디바운스는 500ms다. 그 창에서 저장된 세이브를
        //     복원하면 `isAiThinking`이 비영속이라 false로 돌아오고
        //     `ControlPanel`이 `<EventPanel currentEvent={null}>`을 그리는데 그건
        //     `return null`이다. TerminalView도 `FOCUS_PANEL_STATES`라 마운트되지 않고
        //     explore/move/rest는 각자 가드로 막힌다 → **웹/iOS에서 영구 벽돌**.
        //   - `dead` — `runSummary`는 전투 패배 순간에만 만들어지고 저장되지 않는다.
        //     `App.tsx`의 사망 화면 조건은 `GS.DEAD && runSummary`라 복원 후 영원히 거짓.
        //     게다가 `characterActions.start`는 `gameState`를 건드리지 않으므로 새 캐릭터를
        //     만들어도 `dead`로 남아 대부분의 버튼이 에러 로그만 남긴다.
        //   - `event_pending`(Wave 19 K1) — 위 `event` 창을 별도 모드로 뺀 것이다.
        //     동반 상태가 "없는" 것이 아니라 **진행 중인 promise**이고, 그건 리로드를
        //     넘지 못한다. 복원하면 `ControlPanel`이 영원히 "준비 중" 패널을 그린다 —
        //     스피너가 달렸을 뿐 같은 벽돌이다. 그래서 `dead`처럼 **언제나** 접는다
        //     (`currentEvent`가 우연히 함께 와도 마찬가지 — 그 카드를 만든 호출은 이미 없다).
        //   새 모드를 봉투에 넣지 않은 채 영속시키려면 여기에 줄을 추가해야 한다.
        const restorableMode = (mode: string) => {
            if (mode === 'combat' && !enemy) return false;
            if (mode === 'event' && !action.payload.currentEvent) return false;
            if (mode === 'event_pending') return false;
            if (mode === 'dead') return false;
            return true;
        };
        const gameState = restorableMode(requestedMode) ? requestedMode : 'idle';
        // 두 조건이 읽는 값이 다르다 — 의도가 다르기 때문이다.
        //   첫 조건은 "세이브가 **어떤 상황에서** 찍혔는가"를 묻는다 → `requestedMode`.
        //     `dead` 폴드(아래 restorableMode) 뒤에 `gameState`로 읽으면 사망 세이브의
        //     모험 유물 정리가 조용히 건너뛰어진다.
        //   `else if`는 "**실제로 전투에 들어갈 것인가**"를 묻는다 → 폴드된 `gameState`.
        //     `combat && !enemy`로 접힌 불완전 전투는 포식 보너스를 끝내야 하고,
        //     `requestedMode`로 읽으면 그게 건너뛰어진다
        //     (`adventure-relic-lifetime.test.js`가 그 한 칸을 고정한다 — 실측으로 확인).
        if (DB.MAPS[loadedPlayer.loc ?? '']?.type === 'safe' || requestedMode === 'dead') {
            loadedPlayer = clearAdventureRelicBonuses(loadedPlayer);
            loadedPlayer.deferredEventChainSteps = undefined;
        } else if (gameState !== 'combat') {
            loadedPlayer = endDevourBonus(loadedPlayer);
        }
        return {
            ...state,
            player: loadedPlayer,
            gameState,
            enemy,
            grave: action.payload.grave || null,
            currentEvent: action.payload.currentEvent || null,
            quickSlots: sanitizeQuickSlots(action.payload.quickSlots, loadedPlayer.inv),
            logs: getBootstrapLogs(state, loadedPlayer.name ?? ''),
            bootStage: 'ready',
            presentationEpoch: state.presentationEpoch + 1,
            syncStatus: 'synced',
            lastLoadedTimestamp: resolveLastActiveMillis(action.payload.lastActive),
        };
    },

    SET_LIVE_CONFIG: (state, action) =>
        ({ ...state, liveConfig: { ...state.liveConfig, ...action.payload } }),

    SET_LEADERBOARD: (state, action) =>
        ({ ...state, leaderboard: action.payload }),
} satisfies HandlerMap;
