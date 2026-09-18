import { BALANCE, CONSTANTS } from '../../data/constants';
import { CLASSES } from '../../data/classes';
import { makeEmitTitles } from '../../utils/gameUtils';
import { AT } from '../../reducers/actionTypes';
import { advanceExploreState } from '../../utils/explorationPacing';
import { SEASON_XP } from '../../data/seasonPass';
import { resetDailyProtocolIfNeeded, resetWeeklyProtocolIfNeeded } from './exploreFlow';
import { getPrestigeUnlocks } from '../../systems/prestigeUnlocks';
import { advanceBossGauge } from '../../utils/bossGauge';
import { QUESTS } from '../../data/quests';
import { syncQuestProgress } from '../../utils/questProgress';
import type { GameMap, Player } from '../../types';
import type { EmitUnlockedTitles, GameActionDeps } from '../actionDeps';

/**
 * 탐험 1회의 공통 정산(일일/주간 프로토콜 · 시즌 XP · explores 카운터 · 페이싱 상태 ·
 * 보스 게이지 · 퀘스트 동기화)을 한 번에 커밋한다.
 *
 * @param outcome        페이싱 상태 전이 키 ('combat' | 'narrative_event' | 'relic_found' | …)
 * @param transformPlayer 같은 SET_PLAYER 전이 안에서 추가로 적용할 변환 (없으면 null)
 * @param mapData        보스 게이지를 누적할 지역 (누적하지 않으려면 생략/null)
 */
export type CommitExploreOutcome = (
    outcome: string,
    transformPlayer: ((p: Player) => Player) | null,
    mapData?: GameMap | null,
) => void;

/** makeSharedHelpers가 읽는 deps 조각 — 엔진 deps를 그대로 넘겨도 맞는다. */
export type SharedHelperDeps = Pick<GameActionDeps, 'player' | 'dispatch' | 'addLog'>;

/**
 * 클래스 기반 HP/MP 최대치 계산
 */
// cycle 532: meta default {} 제거 — 2 callsite (characterActions.ts:17/129)
//   모두 player.meta || {} 명시 전달이라 default 도달 불가. body의
//   (meta.bonusHp/bonusMp || 0) defensive guard는 별개 보존. hooks/ 디렉토리
//   진입 (cycle 529 components/에 이은 lens 확장 28번째).
export const buildClassVitals = (
    level: number,
    jobId: string,
    meta: NonNullable<Player['meta']>,
) => {
    const cls = CLASSES[jobId] || CLASSES[CONSTANTS.DEFAULT_JOB];
    // PR #8: 프레스티지 rank≥10 "에테르 초월" — 영구 스탯 보너스 ×2 (statsCalculator atk와 대칭).
    const statMult = getPrestigeUnlocks(meta.prestigeRank).statMult;
    const maxHp = Math.floor(CONSTANTS.START_HP * cls.hpMod!) + Math.max(0, level - 1) * BALANCE.HP_PER_LEVEL + (meta.bonusHp || 0) * statMult;
    const maxMp = Math.floor(CONSTANTS.START_MP * cls.mpMod!) + Math.max(0, level - 1) * BALANCE.MP_PER_LEVEL + (meta.bonusMp || 0) * statMult;
    return { maxHp, maxMp };
};

/**
 * 공유 헬퍼 팩토리 — emitUnlockedTitles, commitExploreOutcome
 */
export const makeSharedHelpers = ({ player, dispatch, addLog }: SharedHelperDeps) => {
    const emitUnlockedTitles: EmitUnlockedTitles = makeEmitTitles(dispatch, addLog);

    // 2026-07 — 원정 보스 접근 게이지: mapData를 3번째 인자로 받아 미격파 구역 보스가
    //   있는 던전이면 탐험 결과 분기(체인/캠프파이어/스카우팅/quiet/전투)와 무관하게
    //   "탐험할 때마다" 게이지를 누적한다. commitExploreOutcome은 explore()의 모든
    //   분기가 공통으로 거치는 단일 지점이라 여기 한 곳만 수정하면 전체 파이프 커버.
    //   보스 도전/회피 선택 해소(handleBossGaugeChoice)는 이 함수를 거치지 않고 별도로
    //   게이지를 리셋하므로 이중 누적 없음.
    const commitExploreOutcome: CommitExploreOutcome = (outcome, transformPlayer, mapData) => {
        resetDailyProtocolIfNeeded(player, dispatch);
        resetWeeklyProtocolIfNeeded(player, dispatch);
        dispatch({ type: AT.UPDATE_DAILY_PROTOCOL, payload: { type: 'explores' } });
        dispatch({ type: AT.UPDATE_WEEKLY_PROTOCOL, payload: { type: 'explores' } });
        dispatch({ type: AT.ADD_SEASON_XP, payload: SEASON_XP.explore });
        dispatch({
            type: AT.SET_PLAYER,
            payload: (currentPlayer: Player) => {
                // cycle 84: stats.discoveries 누적 제거 — cycle 83에서 'discoveries' 시맨틱이
                // visitedMaps.length(맵 발견 수)로 통일되면서 이 이벤트 카운터는 어디서도
                // 읽히지 않는 dead write가 되었음. 안전하게 제거 (Firebase save에 잔존하는
                // discoveries 필드는 무시되므로 forward-compatible).
                const exploresByLocation = { ...(currentPlayer.stats?.exploresByLocation || {}) };
                if (currentPlayer.loc) {
                    exploresByLocation[currentPlayer.loc] = (exploresByLocation[currentPlayer.loc] || 0) + 1;
                }
                let nextPlayer: Player = {
                    ...currentPlayer,
                    stats: {
                        ...(currentPlayer.stats || {}),
                        explores: (currentPlayer.stats?.explores || 0) + 1,
                        exploresByLocation,
                        exploreState: advanceExploreState(currentPlayer.stats, outcome),
                    }
                };
                if (mapData) {
                    nextPlayer = { ...nextPlayer, stats: advanceBossGauge(nextPlayer, mapData) };
                }
                if (typeof transformPlayer === 'function') {
                    nextPlayer = transformPlayer(nextPlayer) || nextPlayer;
                }
                const { updatedQuests } = syncQuestProgress(nextPlayer, '', QUESTS);
                return { ...nextPlayer, quests: updatedQuests };
            }
        });
    };

    return { emitUnlockedTitles, commitExploreOutcome };
};

/** makeSharedHelpers가 돌려주는 공유 헬퍼 묶음 — 각 액션 팩토리의 2번째 인자. */
export type SharedHelpers = ReturnType<typeof makeSharedHelpers>;

/** questActions/characterActions처럼 칭호 로그만 쓰는 팩토리의 2번째 인자. */
export type TitleSharedHelpers = Pick<SharedHelpers, 'emitUnlockedTitles'>;
