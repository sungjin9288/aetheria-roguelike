import type { RewardedAdPort, RewardedAdShowEvent } from './rewardedAdPort';

export type RewardedAdSessionPhase =
    | 'loading'
    | 'ready'
    | 'showing'
    | 'rewarded'
    | 'dismissed'
    | 'failed';

const isFailedShowPhase = (phase: RewardedAdSessionPhase) => (
    phase === 'failed' || phase === 'dismissed'
);

export const startRewardedAdSession = ({
    port,
    adGroupId,
    onPhase,
    onEarned,
    onEvent = () => undefined,
}: {
    port: RewardedAdPort;
    adGroupId: string;
    onPhase: (phase: RewardedAdSessionPhase) => void;
    onEarned: () => void;
    onEvent?: (event: 'loaded' | RewardedAdShowEvent | 'loadError' | 'showError') => void;
}) => {
    let phase: RewardedAdSessionPhase = 'loading';
    let earned = false;
    let disposed = false;
    let disposeLoad: () => void = () => undefined;
    let disposeShow: () => void = () => undefined;
    const releaseLoad = () => {
        const dispose = disposeLoad;
        disposeLoad = () => undefined;
        try {
            dispose();
        } catch {
            // Listener cleanup is best-effort and must never break gameplay.
        }
    };
    const releaseShow = () => {
        const dispose = disposeShow;
        disposeShow = () => undefined;
        try {
            dispose();
        } catch {
            // Listener cleanup is best-effort and must never break gameplay.
        }
    };
    const setPhase = (next: RewardedAdSessionPhase) => {
        if (disposed) return;
        phase = next;
        onPhase(next);
    };

    setPhase('loading');
    try {
        disposeLoad = port.load({
            adGroupId,
            onLoaded: () => {
                if (disposed || phase !== 'loading') return;
                onEvent('loaded');
                setPhase('ready');
                releaseLoad();
            },
            onError: () => {
                if (disposed || phase !== 'loading') return;
                onEvent('loadError');
                setPhase('failed');
                releaseLoad();
            },
        });
        if (phase !== 'loading') releaseLoad();
    } catch {
        onEvent('loadError');
        setPhase('failed');
    }

    return {
        show(): boolean {
            if (disposed || phase !== 'ready') return false;
            setPhase('showing');
            releaseLoad();
            try {
                disposeShow = port.show({
                    adGroupId,
                    onEvent: (event) => {
                        if (disposed) return;
                        if (event === 'userEarnedReward') {
                            if (phase !== 'showing' || earned) return;
                            onEvent(event);
                            earned = true;
                            setPhase('rewarded');
                            onEarned();
                        } else if (event === 'failedToShow') {
                            if (phase !== 'showing') return;
                            onEvent(event);
                            setPhase('failed');
                            releaseShow();
                        } else if (event === 'dismissed') {
                            if (phase === 'rewarded') {
                                onEvent(event);
                                releaseShow();
                            } else if (phase === 'showing') {
                                onEvent(event);
                                setPhase('dismissed');
                                releaseShow();
                            }
                        } else if (phase === 'showing') {
                            onEvent(event);
                        }
                    },
                    onError: () => {
                        if (disposed || phase !== 'showing') return;
                        onEvent('showError');
                        setPhase('failed');
                        releaseShow();
                    },
                });
                if (isFailedShowPhase(phase)) releaseShow();
                return true;
            } catch {
                onEvent('showError');
                setPhase('failed');
                return false;
            }
        },
        dispose(): void {
            if (disposed) return;
            disposed = true;
            releaseLoad();
            releaseShow();
        },
    };
};
