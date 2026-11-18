import { DB } from '../data/db';
import { GS, type GameMode } from '../reducers/gameStates';
import { getLogBadgeKind, type LogBadgeKind } from '../data/logBadge';
import { canBossAppearInMap } from './bossPresence';
import { FIRST_STORY_QUEST_ID } from '../data/quests';
import type { Player } from '../types/index.js';
import type { LogEntry } from '../types/session.js';

/**
 * 2026-11 디자인 고도화 A2(docs/DESIGN_MODERNIZATION_2026-11.md): 휴대폰 필드 화면의 무대 판정 — 표시 계층만 읽는다.
 * 판정 · 난수 · 기록 줄 · 세이브는 바꾸지 않는다.
 */

/** 지역 종류 칩 — 안전지대 · 보스 권역(이 플레이어가 실제로 보스를 만날 수 있을 때만, Wave 61) · 탐험 지역. */
export type FieldSceneKind = 'safe' | 'boss' | 'field';

export const getFieldSceneKind = (player: Player | null | undefined, loc: string | null | undefined): FieldSceneKind => {
    const map = loc ? DB.MAPS[loc] : null;
    if (map?.type === 'safe') return 'safe';
    return player && canBossAppearInMap(loc, map, player) ? 'boss' : 'field';
};

/** 무대를 세우는 곳 — 대기 중이고 안전지대가 아닌 지역(사냥 지역). 마을은 시설 조작판이 높이를 쓴다. */
export const isFieldStageMode = (player: Player | null | undefined, gameState: GameMode | null | undefined): boolean => {
    if (!player?.loc || gameState !== GS.IDLE) return false;
    const map = DB.MAPS[player.loc];
    return Boolean(map) && map.type !== 'safe';
};

/**
 * 2026-11 마을 무대 — 안전지대의 대기 화면도 기록 창 자리의 위쪽이 무대(마을 그림 · 주인공)이고, 기록은 아래 띠다.
 * 표시 판정이다 — 마을 규칙 · 시설 동작은 바꾸지 않는다.
 */
export const isTownStageMode = (
    player: Player | null | undefined,
    gameState: GameMode | null | undefined,
    logs: readonly LogEntry[] = [],
): boolean => {
    if (!player?.loc || gameState !== GS.IDLE) return false;
    if (DB.MAPS[player.loc]?.type !== 'safe') return false;
    // 마지막 줄이 이야기 · 사건이면 무대가 비켜서고 기록 창이 열 전체를 쓴다 — 임무 수령의 단서 + 장의 본문은 260px 안팎이라
    //   무대와 나눈 띠(약 170px)에서는 둘 중 하나가 잘렸다(e2e event-choice-visual). 다음 행동의 줄이 오면 무대가 돌아온다.
    const latestType = logs.length > 0 ? logs[logs.length - 1]?.type : undefined;
    return !(latestType && READ_FIRST_LOG_TYPES.has(latestType));
};

/** 한 묶음이 기록 창에 다 들어가지 않을 때 처음부터 읽혀야 하는 기록 종류 — 기록 창의 묶음 맞춤과 마을 무대의 비켜서기가 같이 읽는다. */
export const READ_FIRST_LOG_TYPES: ReadonlySet<string> = new Set(['story', 'event']);

/** 첫 여정 안내(숲에 남은 전쟁의 흔적) — 첫 이야기 임무를 받고 아직 시작하지 않은 첫 회차의 시작 마을. 기록 창과 마을 무대가 같이 읽는다. */
export const isFirstJourneyIntro = (player: Player | null | undefined, gameState: GameMode | null | undefined): boolean => (
    gameState === GS.IDLE && player?.loc === '시작의 마을'
    && !(player.meta?.prestigeRank || 0)
    && !player.stats?.claimedQuestIds?.includes(FIRST_STORY_QUEST_ID)
    && Boolean(player.quests?.some((quest) => quest.id === FIRST_STORY_QUEST_ID && quest.progress === 0))
);

/**
 * 무대 위 카드가 보이는 기록 종류 — 방금 탐험이 낳은 결과(사건 · 실제로 얻은 줄 · 전설 · 안내 · 주의 · 오류).
 * 이야기 줄은 길어서 기록 띠에만 남고, 전투 줄은 전투 무대가 보였다. 작은 기기에서는 기록 띠가 접혀 이 카드가 방금의 결과를 말한다.
 */
const DISCOVERY_KINDS: ReadonlySet<LogBadgeKind> = new Set<LogBadgeKind>(['event', 'success', 'legendary', 'system', 'warning', 'error']);
/** 발견 카드는 최근 몇 줄 안에 있을 때만 — 다음 행동의 줄이 밀어내면 사라진다(타이머 없음). */
export const FIELD_DISCOVERY_RECENT_LINES = 3;

export interface FieldDiscovery {
    readonly log: LogEntry;
    readonly kind: LogBadgeKind;
}

/**
 * 가장 최근의 발견 줄 — `floorId`(무대가 선 순간의 마지막 기록) 뒤의 줄 가운데, 최근 `FIELD_DISCOVERY_RECENT_LINES`줄 안에서 찾는다.
 * 무대가 서기 전(마을 · 전투 · 이벤트 화면)의 줄은 카드가 되지 않는다 — 그 줄은 그 화면이 이미 보였다.
 */
export const selectFieldDiscovery = (logs: readonly LogEntry[], floorId: string | null): FieldDiscovery | null => {
    const start = Math.max(0, logs.length - FIELD_DISCOVERY_RECENT_LINES);
    for (let i = logs.length - 1; i >= start; i -= 1) {
        const log = logs[i];
        if (floorId !== null && log.id === floorId) return null;
        const kind = getLogBadgeKind(log);
        if (kind && DISCOVERY_KINDS.has(kind)) return { log, kind };
    }
    return null;
};

/** 지역별 미세 입자 — 지역 색 테마 키(utils/regionTheme)가 고른다. 길 잃은 여행이면 테마가 없어 입자도 없다. */
export const FIELD_MOTE_COUNT = 8;
