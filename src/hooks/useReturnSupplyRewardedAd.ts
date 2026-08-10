import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { AT } from '../reducers/actionTypes';
import { getRuntimeEnvironment } from '../platform/runtimeEnvironment';
import { trackRuntimeProductEvent } from '../platform/productEventCoordinator';
import {
    createSdkRewardedAdPort,
    resolveRewardedAdGroupId,
    type RewardedAdPort,
} from '../platform/rewardedAdPort';
import {
    startRewardedAdSession,
    type RewardedAdSessionPhase,
} from '../platform/rewardedAdSession';
import type { ExpeditionSummary, Player } from '../types/player';
import {
    getReturnSupplyRewardStatus,
    isMeaningfulSafeReturn,
} from '../utils/returnSupplyReward';

export interface ReturnSupplyRewardViewModel {
    visible: boolean;
    disabled: boolean;
    label: string;
    detail: string;
    status: RewardedAdSessionPhase | 'pending' | 'delivered' | 'unavailable';
    onPress: () => void;
}

export const resolveRewardTransactionOutcome = (
    attemptedExpeditionId: string,
    currentSummaryId: string | null,
    status: 'available' | 'pending' | 'delivered',
): 'pending' | 'delivered' | 'rejected' => (
    attemptedExpeditionId === currentSummaryId && status !== 'available' ? status : 'rejected'
);

const runtimePort = createSdkRewardedAdPort();

export const useReturnSupplyRewardedAd = ({
    summary,
    debriefOpen,
    player,
    dispatch,
    flushLocalSave,
    port = runtimePort,
    configuredGroupId = import.meta.env?.VITE_TOSS_REWARDED_AD_GROUP_ID,
}: {
    summary: ExpeditionSummary | null;
    debriefOpen: boolean;
    player: Player;
    dispatch: (action: any) => void;
    flushLocalSave?: () => Promise<unknown> | unknown;
    port?: RewardedAdPort;
    configuredGroupId?: unknown;
}): ReturnSupplyRewardViewModel => {
    const runtime = getRuntimeEnvironment();
    const adGroupId = resolveRewardedAdGroupId(configuredGroupId, runtime);
    const supported = useMemo(() => {
        try {
            return port.isSupported();
        } catch {
            return false;
        }
    }, [port]);
    const eligible = isMeaningfulSafeReturn(summary);
    const summaryId = summary?.id || null;
    const receiptStatus = summaryId
        ? getReturnSupplyRewardStatus(player, summaryId)
        : 'available';
    const visible = Boolean(debriefOpen && eligible && adGroupId && supported);
    const [phase, setPhase] = useState<RewardedAdSessionPhase>('loading');
    const [rewardAttemptId, setRewardAttemptId] = useState<string | null>(null);
    const sessionRef = useRef<ReturnType<typeof startRewardedAdSession> | null>(null);
    const resolvedAttemptRef = useRef<string | null>(null);
    const playerFieldsRef = useRef({ job: player.job || 'unknown', level: player.level || 1 });
    useEffect(() => {
        playerFieldsRef.current = { job: player.job || 'unknown', level: player.level || 1 };
    }, [player.job, player.level]);

    useEffect(() => {
        sessionRef.current?.dispose();
        sessionRef.current = null;
        if (!visible || !summaryId || receiptStatus !== 'available' || !adGroupId) return undefined;

        const fields = playerFieldsRef.current;
        trackRuntimeProductEvent({
            receipt: `ad-offer:${summaryId}`,
            name: 'ad_offer',
            fields: { ...fields, outcome: 'eligible' },
        });
        const session = startRewardedAdSession({
            port,
            adGroupId,
            onPhase: setPhase,
            onEarned: () => {
                setRewardAttemptId(summaryId);
                dispatch({
                    type: AT.RECORD_RETURN_SUPPLY_REWARD,
                    payload: { expeditionId: summaryId },
                });
            },
            onEvent: (event) => {
                if (event === 'loaded') {
                    trackRuntimeProductEvent({
                        receipt: `ad-load:${summaryId}`,
                        name: 'ad_load',
                        fields: { ...fields, outcome: 'loaded' },
                    });
                } else if (event === 'requested' || event === 'show') {
                    trackRuntimeProductEvent({
                        receipt: `ad-show:${summaryId}:${event}`,
                        name: 'ad_show',
                        fields: { ...fields, outcome: event === 'show' ? 'shown' : 'requested' },
                    });
                } else if (event === 'dismissed') {
                    trackRuntimeProductEvent({
                        receipt: `ad-show:${summaryId}:dismissed`,
                        name: 'ad_show',
                        fields: { ...fields, outcome: 'dismissed' },
                    });
                } else if (event === 'userEarnedReward') {
                    trackRuntimeProductEvent({
                        receipt: `ad-show:${summaryId}:rewarded`,
                        name: 'ad_show',
                        fields: { ...fields, outcome: 'rewarded' },
                    });
                } else if (event === 'loadError' || event === 'showError' || event === 'failedToShow') {
                    trackRuntimeProductEvent({
                        receipt: `ad-failure:${summaryId}:${event}`,
                        name: 'ad_failure',
                        fields: {
                            ...fields,
                            outcome: event === 'loadError' ? 'load_failed' : 'show_failed',
                        },
                    });
                }
            },
        });
        sessionRef.current = session;
        return () => session.dispose();
    }, [adGroupId, dispatch, eligible, port, receiptStatus, summaryId, supported, visible]);

    useEffect(() => {
        if (!rewardAttemptId || resolvedAttemptRef.current === rewardAttemptId) return;
        const outcome = resolveRewardTransactionOutcome(rewardAttemptId, summaryId, receiptStatus);
        const fields = playerFieldsRef.current;
        resolvedAttemptRef.current = rewardAttemptId;
        if (outcome === 'rejected') {
            trackRuntimeProductEvent({
                receipt: `ad-failure:${rewardAttemptId}:reward-rejected`,
                name: 'ad_failure',
                fields: { ...fields, outcome: 'reward_rejected' },
            });
            return;
        }
        trackRuntimeProductEvent({
            receipt: `ad-reward:${rewardAttemptId}:${outcome}`,
            name: 'ad_reward',
            fields: { ...fields, outcome },
        });
        void Promise.resolve(flushLocalSave?.()).catch(() => undefined);
    }, [flushLocalSave, receiptStatus, rewardAttemptId, summaryId]);

    const onPress = useCallback(() => {
        sessionRef.current?.show();
    }, []);

    const status = !visible
        ? 'unavailable'
        : receiptStatus === 'pending' || receiptStatus === 'delivered'
            ? receiptStatus
            : phase;
    const copy = status === 'pending'
        ? { label: '보급 지급 대기', detail: '가방에 공간이 생기면 하급 체력 물약 1개를 지급합니다.' }
        : status === 'delivered' || status === 'rewarded'
            ? { label: '귀환 보급 지급 완료', detail: '하급 체력 물약 1개를 받았습니다.' }
            : status === 'ready'
                ? { label: '귀환 보급 받기', detail: '광고 시청 시 하급 체력 물약 1개' }
                : status === 'failed' || status === 'dismissed'
                    ? { label: '광고를 불러오지 못했습니다', detail: '광고 없이도 다음 원정을 계속할 수 있습니다.' }
                    : { label: '귀환 보급 준비 중', detail: '광고 시청 시 하급 체력 물약 1개' };

    return {
        visible,
        disabled: status !== 'ready',
        label: copy.label,
        detail: copy.detail,
        status,
        onPress,
    };
};
