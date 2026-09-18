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
 */
export interface CloudAutosaveRefs {
    localSavePromise: MutableRef<Promise<GameSaveRecord | null>>;
    pendingCloudRecord: MutableRef<GameSaveRecord | null>;
    cloudRevisionFloor: MutableRef<number>;
    cloudRevisionAdvanceRequired: MutableRef<boolean>;
}

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
        const payload: Record<string, any> = {
            player: playerPayload,
            gameState,
            enemy,
            grave,
            currentEvent,
            quickSlots,
            version: CONSTANTS.DATA_VERSION,
            saveSchemaVersion: localRecord?.saveVersion ?? 1,
            saveRevision: localRecord?.revision ?? 0,
            savedAt: localRecord?.savedAt ?? now(),
            lastActive: serverTimestamp()
        };

        await setDoc(userDocRef, payload, { merge: true });

        // v5.0: 리더보드 entry 업데이트 (kills > 0 일 때만)
        if (player.name && (player.stats?.kills || 0) > 0) {
            const lbDocRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'leaderboard', uid);
            await setDoc(lbDocRef, {
                nickname:     player.name,
                totalKills:   player.stats?.kills || 0,
                prestigeRank: player.meta?.prestigeRank || 0,
                activeTitle:  player.activeTitle || null,
                level:        player.level || 1,
                bossKills:    player.stats?.bossKills || 0,
                job:          player.job || CONSTANTS.DEFAULT_JOB,
                uid,
                updatedAt:    serverTimestamp(),
            }, { merge: true });
        }

        dispatch({ type: AT.SET_SYNC_STATUS, payload: 'synced' });
        return 'synced';
    } catch (e) {
        console.error('Save Failed', e);
        dispatch({ type: AT.SET_SYNC_STATUS, payload: 'offline' });
        return 'offline';
    }
};
