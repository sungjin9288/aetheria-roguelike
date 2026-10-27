import { CONSTANTS, APP_ID } from '../data/constants';
import { AT } from '../reducers/actionTypes';
import { buildCloudPlayerSnapshot } from '../platform/cloudPlayerSnapshot';
import { type GameSaveRecord } from '../platform/gameStorage';
import type { Player } from '../types';
import type { GameAction, GameState } from '../reducers/gameReducer';
import type { Firestore, doc as firestoreDoc, serverTimestamp as firestoreServerTimestamp, setDoc as firestoreSetDoc } from 'firebase/firestore';

interface MutableRef<T> {
    current: T;
}

/**
 * 클라우드 자동저장이 로컬 저장 경로와 공유하는 ref 묶음.
 * - localSavePromise: 직전 로컬 save 의 in-flight 결과(리비전 확보용)
 * - pendingCloudRecord: 로컬 import 가 실패해 아직 반영되지 못한 원격 레코드
 * - cloudRevisionFloor: 클라우드에서 받은 최신 리비전(이 아래로는 업로드 금지)
 * - cloudRevisionAdvanceRequired: floor 와 동률인 리비전도 거부해야 하는지
 * - lastLeaderboardEntryKey: 이 세션에서 마지막으로 보낸 순위표 값(`getLeaderboardEntryKey`). 같은 값이면 순위표 쓰기를
 *   건너뛴다(소유자 결정 D35). 없으면 매번 쓴다.
 */
export interface CloudAutosaveRefs {
    localSavePromise: MutableRef<Promise<GameSaveRecord | null>>;
    pendingCloudRecord: MutableRef<GameSaveRecord | null>;
    cloudRevisionFloor: MutableRef<number>;
    cloudRevisionAdvanceRequired: MutableRef<boolean>;
    lastLeaderboardEntryKey?: MutableRef<string | null>;
}

/** 순위표 문서(`public/data/leaderboard/{uid}`)에 쓰는 값 — 서버 시각(`updatedAt`)을 뺀 필드. */
export const buildLeaderboardEntry = (player: Player, uid: string) => ({
    nickname:     player.name,
    totalKills:   player.stats?.kills || 0,
    prestigeRank: player.meta?.prestigeRank || 0,
    activeTitle:  player.activeTitle || null,
    level:        player.level || 1,
    bossKills:    player.stats?.bossKills || 0,
    job:          player.job || CONSTANTS.DEFAULT_JOB,
    uid,
});

/** 순위표 값의 비교 키 — 필드 순서가 고정된 직렬화라 같은 값이면 같은 키다. */
export const getLeaderboardEntryKey = (entry: ReturnType<typeof buildLeaderboardEntry>): string => JSON.stringify(entry);

export interface CloudAutosaveDeps {
    /**
     * Firestore 인스턴스 — 이 모듈은 firebase 를 런타임 import 하지 않는다(테스트 주입 가능).
     * 시그니처는 firebase/firestore 의 실제 함수에서 `typeof` 로 가져오므로 타입 전용 import 뿐이다.
     */
    db: Firestore;
    doc: typeof firestoreDoc;
    setDoc: typeof firestoreSetDoc;
    serverTimestamp: typeof firestoreServerTimestamp;
    /** 로컬 저장소에서 최신 레코드를 읽는다(실패 시 null). */
    loadLocalRecord: () => Promise<GameSaveRecord | null>;
    dispatch: (action: GameAction) => void;
    refs: CloudAutosaveRefs;
    now?: () => number;
}

export interface CloudAutosaveSnapshot {
    uid: string;
    player: Player;
    gameState: GameState['gameState'];
    enemy: GameState['enemy'];
    grave: GameState['grave'];
    currentEvent: GameState['currentEvent'];
    quickSlots: GameState['quickSlots'];
    /** 2026-09 Wave 34: 유물 제안도 봉투에 싣는다(선택 중 리로드해도 남는다). */
    pendingRelics?: GameState['pendingRelics'];
}

export type CloudAutosaveResult = 'synced' | 'offline';

/**
 * createCloudAutosave — useFirebaseSync 의 디바운스 자동저장 본문.
 *
 * Firestore/스토리지 의존성을 전부 주입받아 훅 없이 단독 실행·테스트할 수 있다.
 * 반환된 함수는 throw 하지 않고, 결과를 `SET_SYNC_STATUS` dispatch 와 반환값으로 알린다.
 */
export const createCloudAutosave = ({
    db,
    doc,
    setDoc,
    serverTimestamp,
    loadLocalRecord,
    dispatch,
    refs,
    now = Date.now,
}: CloudAutosaveDeps) => async ({
    uid,
    player,
    gameState,
    enemy,
    grave,
    currentEvent,
    quickSlots,
    pendingRelics,
}: CloudAutosaveSnapshot): Promise<CloudAutosaveResult> => {
    try {
        const userDocRef = doc(db, 'artifacts', APP_ID, 'users', uid);
        const localRecord = (await refs.localSavePromise.current)
            ?? await loadLocalRecord();
        if (
            !localRecord
            || refs.pendingCloudRecord.current
            || localRecord.revision < refs.cloudRevisionFloor.current
            || (
                refs.cloudRevisionAdvanceRequired.current
                && localRecord.revision <= refs.cloudRevisionFloor.current
            )
        ) {
            dispatch({ type: AT.SET_SYNC_STATUS, payload: 'offline' });
            return 'offline';
        }
        // 복귀 브리핑 카드(returnBriefing.ts)가 클라이언트 ms 타임스탬프로 경과 시간을
        // 계산하므로, Firestore serverTimestamp()(lastActive)와 별도로 player.stats에
        // 저장 시각을 기록한다. 매 autosave마다 갱신 — 플레이 중에는 계속 최신화되고,
        // 세션 종료 후에는 마지막 저장 시각에 고정된다.
        //   Firestore는 undefined를 거부하므로 신규 선택 필드는 null로 정규화한다
        //   (buildCloudPlayerSnapshot — Codex d8a111e). 레거시 archivedHistory 배관은
        //   Codex가 죽은 배관으로 제거했다(tests/release-dead-plumbing.test.js).
        const playerPayload = buildCloudPlayerSnapshot(player, now());
        const payload = {
            player: playerPayload,
            gameState,
            enemy,
            grave,
            currentEvent,
            quickSlots,
            // Firestore는 undefined를 거부한다 — 제안이 없으면 null.
            pendingRelics: pendingRelics ?? null,
            version: CONSTANTS.DATA_VERSION,
            saveSchemaVersion: localRecord?.saveVersion ?? 1,
            saveRevision: localRecord?.revision ?? 0,
            savedAt: localRecord?.savedAt ?? now(),
            lastActive: serverTimestamp()
        };

        // CH-01: 문서 전체를 **교체**한다(merge 없음). `merge: true`는 SDK가 중첩 맵 안으로 재귀해
        //   말단 경로만 field mask에 넣으므로, 로컬에서 지운 중첩 키(무기의 `hands`/`elem`,
        //   `merchantVisit`, `huntContracts`, `statusStacks` …)가 서버에 남았다가 다른 기기 ·
        //   재설치 복원에서 되살아났다(장비 능력치가 바뀌고 Wave 108 초기화가 풀렸다).
        //   이 문서를 쓰는 곳은 여기 하나이고 페이로드가 봉투 전체이므로 교체가 정본이다 —
        //   하위 컬렉션(`quota`/`history`)은 별개 문서라 영향이 없다.
        await setDoc(userDocRef, payload);

        // v5.0: 리더보드 entry 업데이트 (kills > 0 일 때만)
        // 소유자 결정 D35(감사 CH-04): 자동 저장은 행동마다 돌고 그 순위표 쓰기의 73%가 같은 값이었다 — 이 세션에서
        //   마지막으로 보낸 값과 같으면 순위표 쓰기만 건너뛴다(세이브 문서 교체 쓰기 · 순위표 merge 방식은 그대로).
        //   보내기 전에 키를 적어 두므로 겹친 두 저장도 서버에 들어가는 순서대로 비교하고, 쓰기가 실패하면 키를 지워
        //   다음 저장이 다시 쓴다.
        if (player.name && (player.stats?.kills || 0) > 0) {
            const entry = buildLeaderboardEntry(player, uid);
            const entryKey = getLeaderboardEntryKey(entry);
            const lastKey = refs.lastLeaderboardEntryKey;
            if (!lastKey || lastKey.current !== entryKey) {
                if (lastKey) lastKey.current = entryKey;
                const lbDocRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'leaderboard', uid);
                try {
                    await setDoc(lbDocRef, { ...entry, updatedAt: serverTimestamp() }, { merge: true });
                } catch (error) {
                    if (lastKey && lastKey.current === entryKey) lastKey.current = null;
                    throw error;
                }
            }
        }

        dispatch({ type: AT.SET_SYNC_STATUS, payload: 'synced' });
        return 'synced';
    } catch (e) {
        console.error('Save Failed', e);
        dispatch({ type: AT.SET_SYNC_STATUS, payload: 'offline' });
        return 'offline';
    }
};
