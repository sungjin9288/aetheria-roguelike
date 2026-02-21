import { useEffect, useRef, useCallback, useState } from 'react';

/**
 * useAutoExplore — 자동 탐색 훅 (Feature #7)
 * HP 30% 이하 또는 설정 횟수 소진 시 자동 정지
 */
export const useAutoExplore = ({ player, gameState, isAiThinking, actions }) => {
    const [isAutoRunning, setIsAutoRunning] = useState(false);
    const [runsLeft, setRunsLeft] = useState(0);
    const [autoLog, setAutoLog] = useState('');
    const timerRef = useRef(null);
    const runsRef = useRef(0);
    const stopReasonRef = useRef('');

    const HP_STOP_THRESHOLD = 0.3;
    const INTERVAL_MS = 1400;

    const stop = useCallback((reason = '') => {
        clearInterval(timerRef.current);
        timerRef.current = null;
        runsRef.current = 0;
        stopReasonRef.current = reason;
        setIsAutoRunning(false);
        setRunsLeft(0);
        setAutoLog(reason);
    }, []);

    const start = useCallback((runs = 10) => {
        runsRef.current = runs;
        setRunsLeft(runs);
        setIsAutoRunning(true);
        setAutoLog(`자동 탐색 시작 (${runs}회)`);
    }, []);

    useEffect(() => {
        if (!isAutoRunning) {
            clearInterval(timerRef.current);
            return;
        }
        // Pause during non-idle states (wait to resume)
        if (gameState !== 'idle' || isAiThinking) return;

        // HP guard — use a ref-read for stability, schedule stop via setTimeout
        if (player.hp / player.maxHp <= HP_STOP_THRESHOLD) {
            const msg = `HP 위험 — 자동 탐색 정지 (${player.hp}/${player.maxHp})`;
            const t = setTimeout(() => stop(msg), 0);
            return () => clearTimeout(t);
        }

        if (runsRef.current <= 0) {
            const t = setTimeout(() => stop('자동 탐색 완료'), 0);
            return () => clearTimeout(t);
        }

        clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
            const hpRatio = player.hp / player.maxHp;
            if (runsRef.current <= 0 || hpRatio <= HP_STOP_THRESHOLD) {
                const reason = runsRef.current <= 0 ? '자동 탐색 완료' : `HP 위험 — 정지 (${Math.round(hpRatio * 100)}%)`;
                clearInterval(timerRef.current);
                timerRef.current = null;
                runsRef.current = 0;
                setIsAutoRunning(false);
                setRunsLeft(0);
                setAutoLog(reason);
                return;
            }
            runsRef.current -= 1;
            setRunsLeft(runsRef.current);
            setAutoLog(`자동 탐색 중... (${runsRef.current}회 남음)`);
            actions.explore();
        }, INTERVAL_MS);

        return () => clearInterval(timerRef.current);
    }, [isAutoRunning, gameState, isAiThinking, player.hp, player.maxHp, actions, stop]);

    useEffect(() => () => clearInterval(timerRef.current), []);

    return { isAutoRunning, runsLeft, autoLog, start, stop };
};
