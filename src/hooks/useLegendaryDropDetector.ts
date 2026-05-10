import { useCallback, useEffect, useRef, useState } from 'react';
import { hasDedicatedSignatureArt } from '../data/signatureItems.js';
import { MSG } from '../data/messages.js';
import { AT } from '../reducers/actionTypes.js';
import { SEASON_XP } from '../data/seasonPass.js';

const CODEX_BUCKET_BY_TYPE: any = Object.freeze({
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

// cycle 614: inv default [] 제거 — explicit default-elimination pattern
//   (cycle 608-613에 이은 6번째 적용). caller에 || [] defensive guard 명시
//   추가 후 default unreachable.
const getSignatureItemNames = (inv: any) => {
    const names: any[] = [];
    for (const entry of inv) {
        if (entry && hasDedicatedSignatureArt(entry)) {
            names.push(entry.name);
        }
    }
    return names;
};

// cycle 563: dispatch / codex defaults 제거 — 1 production caller (GameRoot
//   :32) 3 args 명시 전달 (engine.dispatch, engine.player?.stats?.codex)이라
//   두 default 모두 도달 불가. test caller 0건. 청소 메가 시리즈 56번째.
export const useLegendaryDropDetector = (inv: any, dispatch: any, codex: any) => {
    const seenRef = useRef<any>(null);
    const queueRef = useRef<any[]>([]);
    // cycle 208: codex prop을 ref로 받아 effect deps 미포함 (re-trigger 방지).
    //   dispatch 시점에 latest codex로 alreadyInCodex 체크 → SEASON_XP 중복 award 가드.
    //   ref 갱신은 effect 내부에서 (render 단계 직접 mutation은 react-hooks/refs 룰 위반).
    const codexRef = useRef<any>(codex);
    useEffect(() => { codexRef.current = codex; }, [codex]);
    const [currentDrop, setCurrentDrop] = useState<any>(null);

    const dismiss = useCallback(() => {
        setCurrentDrop((prev: any) => {
            if (!prev) return null;
            const next = queueRef.current.shift() || null;
            return next;
        });
    }, []);

    useEffect(() => {
        // cycle 614: |[] defensive guard 명시 추가 — explicit default-elimination
        //   pattern (cycle 608-613). getSignatureItemNames default `[]` 제거 후
        //   undefined 안전 처리는 caller-side로 이전.
        const signatureNames = getSignatureItemNames(inv || []);

        // 초기 mount: 현재 소지중인 signature 아이템을 모두 seen으로 간주
        // (세이브 로드 시 기존 레전더리로 오버레이 스팸 방지)
        if (seenRef.current === null) {
            seenRef.current = new Set(signatureNames);
            return;
        }

        const newlySeen = signatureNames.filter((name: any) => !seenRef.current.has(name));
        if (newlySeen.length === 0) return;

        for (const name of newlySeen) {
            seenRef.current.add(name);
        }

        // 신규 signature 획득 시 codex 자동 업데이트 + 전용 로그 emit.
        // 업적 카운터와 LegendaryCodex 잠금 해제 연결 + Terminal 강조 출력.
        // cycle 208: SEASON_XP.codexDiscover 누락 path fix (cycle 193 / cycle 196 패턴 follow-up).
        //   기존엔 dispatch(UPDATE_CODEX)만 하고 SEASON_XP 미적립 → 4 quest reward + 4 event chain
        //   reward로 들어오는 signature는 시즌 XP 0건이던 dead config.
        //   codexRef로 'alreadyInCodex' 체크 → combatVictory가 먼저 처리한 경우 중복 award 방지.
        if (dispatch) {
            for (const name of newlySeen) {
                const item = (inv || []).find((entry: any) => entry?.name === name);
                const bucket = CODEX_BUCKET_BY_TYPE[item?.type];
                if (bucket) {
                    const alreadyInCodex = Boolean(codexRef.current?.[bucket]?.[name]);
                    dispatch({ type: AT.UPDATE_CODEX, payload: { category: bucket, name } });
                    if (!alreadyInCodex) {
                        dispatch({ type: AT.ADD_SEASON_XP, payload: SEASON_XP.codexDiscover });
                    }
                }
                dispatch({
                    type: AT.ADD_LOG,
                    payload: {
                        type: 'legendary',
                        text: MSG.SIGNATURE_DISCOVERED(name),
                        id: `legendary_${Date.now()}_${name}`,
                    },
                });
            }
        }

        const firstItem = (inv || []).find((entry: any) => entry?.name === newlySeen[0] && hasDedicatedSignatureArt(entry));
        if (!firstItem) return;

        setCurrentDrop((prev: any) => {
            if (!prev) return firstItem;
            // 이미 표시중이면 큐에 추가
            for (const name of newlySeen.slice(1)) {
                const queuedItem = (inv || []).find((entry: any) => entry?.name === name && hasDedicatedSignatureArt(entry));
                if (queuedItem) queueRef.current.push(queuedItem);
            }
            return prev;
        });
    }, [inv, dispatch]);

    return { currentDrop, dismissDrop: dismiss };
};
