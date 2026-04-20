import { useCallback, useEffect, useRef, useState } from 'react';
import { hasDedicatedSignatureArt } from '../data/signatureItems.js';
import { AT } from '../reducers/actionTypes.js';

const CODEX_BUCKET_BY_TYPE = Object.freeze({
    weapon: 'weapons',
    shield: 'shields',
    armor: 'armors',
});

/**
 * player.inv를 관찰해서 dedicated signature art를 가진 아이템이 새로 추가되면
 * { item } 을 currentDrop으로 노출. 타 Overlay와 달리 서버에서 오는 트리거가 아니라
 * 순수 클라이언트 관찰 기반이라 refactoring 영향이 작다.
 *
 * 주의:
 * - 같은 signature 아이템 여러 개가 동시에 들어오면 queue로 누적해 순차 노출.
 * - 초기 mount 시점의 인벤토리는 seen으로 기록하고 알림 없음 (세이브 로드시 스팸 방지).
 * - 이미 본 아이템 이름은 재노출 안 함 (같은 전설을 두 번 봐도 한 번만).
 */

const getSignatureItemNames = (inv = []) => {
    const names = [];
    for (const entry of inv) {
        if (entry && hasDedicatedSignatureArt(entry)) {
            names.push(entry.name);
        }
    }
    return names;
};

export const useLegendaryDropDetector = (inv, dispatch = null) => {
    const seenRef = useRef(null);
    const queueRef = useRef([]);
    const [currentDrop, setCurrentDrop] = useState(null);

    const dismiss = useCallback(() => {
        setCurrentDrop((prev) => {
            if (!prev) return null;
            const next = queueRef.current.shift() || null;
            return next;
        });
    }, []);

    useEffect(() => {
        const signatureNames = getSignatureItemNames(inv);

        // 초기 mount: 현재 소지중인 signature 아이템을 모두 seen으로 간주
        // (세이브 로드 시 기존 레전더리로 오버레이 스팸 방지)
        if (seenRef.current === null) {
            seenRef.current = new Set(signatureNames);
            return;
        }

        const newlySeen = signatureNames.filter((name) => !seenRef.current.has(name));
        if (newlySeen.length === 0) return;

        for (const name of newlySeen) {
            seenRef.current.add(name);
        }

        // 신규 signature 획득 시 codex 자동 업데이트 — 업적 카운터와 LegendaryCodex 잠금 해제 연결
        if (dispatch) {
            for (const name of newlySeen) {
                const item = (inv || []).find((entry) => entry?.name === name);
                const bucket = CODEX_BUCKET_BY_TYPE[item?.type];
                if (bucket) {
                    dispatch({ type: AT.UPDATE_CODEX, payload: { category: bucket, name } });
                }
            }
        }

        const firstItem = (inv || []).find((entry) => entry?.name === newlySeen[0] && hasDedicatedSignatureArt(entry));
        if (!firstItem) return;

        setCurrentDrop((prev) => {
            if (!prev) return firstItem;
            // 이미 표시중이면 큐에 추가
            for (const name of newlySeen.slice(1)) {
                const queuedItem = (inv || []).find((entry) => entry?.name === name && hasDedicatedSignatureArt(entry));
                if (queuedItem) queueRef.current.push(queuedItem);
            }
            return prev;
        });
    }, [inv, dispatch]);

    return { currentDrop, dismissDrop: dismiss };
};
