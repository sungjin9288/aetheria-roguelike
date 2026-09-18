import type { Player } from '../types/index.js';
import type { MigratedPlayerSave } from '../utils/dataMigration.js';

export type OfflineRestoreOutcome = 'local' | 'fresh' | 'failure';

/**
 * 오프라인 부트스트랩이 `AT.LOAD_DATA`로 넘기는 스냅샷.
 * 저장본을 복원했으면 `migrateData`의 반환(`MigratedPlayerSave`)이고, 저장본이 없거나
 * (fresh) 복원에 실패했으면(failure) 새 캐릭터 기본값이다. 두 경우 모두 `player`가
 * 반드시 있다 — 그게 `LOAD_DATA` payload의 최소 계약이다.
 * (타입 전용 import라 platform → utils 런타임 의존은 생기지 않는다.)
 */
export type OfflineBootstrapData = MigratedPlayerSave | { player: Player };

export interface OfflineBootstrapResult {
    data: OfflineBootstrapData;
    outcome: OfflineRestoreOutcome;
}

export const resolveOfflineBootstrapResult = (
    result: OfflineBootstrapResult,
): OfflineBootstrapResult => ({
    data: result.data,
    outcome: result.outcome,
});
