export type OfflineRestoreOutcome = 'local' | 'fresh' | 'failure';

export interface OfflineBootstrapResult {
    data: any;
    outcome: OfflineRestoreOutcome;
}

export const resolveOfflineBootstrapResult = (
    result: OfflineBootstrapResult,
): OfflineBootstrapResult => ({
    data: result.data,
    outcome: result.outcome,
});
