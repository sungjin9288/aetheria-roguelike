import { useEffect, useRef, useState } from 'react';

/** 레벨 상승 배너가 머무는 시간(ms) — 표시 전용. */
const LEVEL_UP_BANNER_MS = 1800;

/**
 * 레벨 상승 축하 배너의 트리거 (slice 29 → 게임 필 감사 GF-13).
 *
 * `player.level`이 오른 렌더에만 그 레벨을 돌려주고 1.8초 뒤 null로 되돌린다. visualEffect 'levelUp'은 연속 레벨업에서
 * 값이 안 바뀌어 다시 걸 수 없으므로 실제 레벨 변화를 본다.
 *
 * 복원(`LOAD_DATA` — 기기 간 복원 · QA 시드)은 `presentationEpoch`를 올린다. 그 렌더의 레벨 변화는 기준만 다시 잡고
 * 축하하지 않는다(오르지 않은 레벨을 축하하지 않는다 — `useDamageFlash`와 같은 규칙). 떠 있던 배너도 내린다.
 */
export const useLevelUpCelebration = (level: number | undefined, resetEpoch: number): number | null => {
    const [banner, setBanner] = useState<{ level: number; epoch: number } | null>(null);
    const prevLevelRef = useRef<number | undefined>(level);
    const epochRef = useRef(resetEpoch);

    useEffect(() => {
        const prev = prevLevelRef.current;
        prevLevelRef.current = level;
        if (epochRef.current !== resetEpoch) {
            epochRef.current = resetEpoch;
            return;
        }
        if (typeof level !== 'number' || typeof prev !== 'number' || level <= prev) return;
        setBanner({ level, epoch: resetEpoch });
    }, [level, resetEpoch]);

    // 해제 타이머는 배너에만 묶는다 — 레벨 · 복원 효과가 다시 돌아도 떠 있는 배너의 해제가 취소되지 않는다.
    useEffect(() => {
        if (!banner) return undefined;
        const timer = setTimeout(() => setBanner(null), LEVEL_UP_BANNER_MS);
        return () => clearTimeout(timer);
    }, [banner]);

    return banner && banner.epoch === resetEpoch ? banner.level : null;
};
