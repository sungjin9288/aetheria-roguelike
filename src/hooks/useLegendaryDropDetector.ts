import { useCallback, useState } from 'react';
import type { Item } from '../types';
import type { LegendaryAcquisition } from '../reducers/gameReducer';

/**
 * 전설 획득 화면의 대기열 — 표시만 한다.
 *
 * 2026-10-26 소유자 결정 D33: 도감 등록 · 시즌 경험 · 기록 줄은 리듀서의 획득 전이(`reducers/handlers/signatureAcquisition.ts`)가
 * 남기고, 이 훅은 그 전이가 쌓은 `legendaryAcquisitions`(순번 · 아이템)만 읽는다. 예전에는 이 훅이 가방을 관찰하며
 * dispatch로 원장을 고쳐서, 화면이 없는 경로(자연 플레이 드라이버)와 화면이 있는 경로의 도감 · 시즌이 갈렸다.
 *
 *   - 마운트 때 이미 쌓여 있던 획득은 기준이다(보여 주지 않는다).
 *   - GF-12: 대기열은 순번 커서다 — 동시에 들어온 둘, 표시 중에 들어온 하나를 잃지 않고 차례로 보인다.
 *   - GF-13: 복원(`presentationEpoch`가 바뀐 렌더)은 기준만 다시 잡는다 — 복원 전의 대기열은 그리지 않는다.
 *     복원은 획득 전이 자체가 획득으로 세지 않는다(`LOAD_DATA` 제외).
 */
interface DropCursor {
    readonly epoch: number;
    /** 이 순번까지는 보였거나 기준이다. */
    readonly through: number;
}

const lastSeqOf = (acquisitions: readonly LegendaryAcquisition[]): number => acquisitions.at(-1)?.seq ?? 0;

export const useLegendaryDropDetector = (
    acquisitions: readonly LegendaryAcquisition[] | undefined,
    resetEpoch: number,
): { currentDrop: Item | null; dismissDrop: () => void } => {
    const list = acquisitions ?? [];
    const lastSeq = lastSeqOf(list);
    const [cursor, setCursor] = useState<DropCursor>({ epoch: resetEpoch, through: lastSeq });
    // 복원으로 장면이 바뀌면 그 순간까지의 획득을 기준으로 다시 잡는다(렌더 중 상태 조정 — 이펙트를 기다리면 한 프레임 보인다).
    if (cursor.epoch !== resetEpoch) setCursor({ epoch: resetEpoch, through: lastSeq });
    const through = cursor.epoch === resetEpoch ? cursor.through : lastSeq;

    const current = list.find((entry) => entry.seq > through) ?? null;
    const currentSeq = current?.seq ?? null;
    const dismissDrop = useCallback(() => {
        if (currentSeq === null) return;
        setCursor((prev) => (prev.epoch === resetEpoch && prev.through < currentSeq ? { ...prev, through: currentSeq } : prev));
    }, [currentSeq, resetEpoch]);

    return { currentDrop: current?.item ?? null, dismissDrop };
};
