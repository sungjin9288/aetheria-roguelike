import type { GameSaveRecord } from './gameStorage';

interface CloudRecordImporter {
    importRecord(record: GameSaveRecord): Promise<GameSaveRecord>;
}

export interface CloudRecordImportResult {
    record: GameSaveRecord;
    localImportFailed: boolean;
    error?: unknown;
}

export const importCloudRecordAuthority = async (
    storage: CloudRecordImporter,
    incoming: GameSaveRecord,
): Promise<CloudRecordImportResult> => {
    try {
        return {
            record: await storage.importRecord(incoming),
            localImportFailed: false,
        };
    } catch (error) {
        return {
            record: incoming,
            localImportFailed: true,
            error,
        };
    }
};
