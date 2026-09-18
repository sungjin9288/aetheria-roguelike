import { useEffect, useRef, useState } from 'react';

/**
 * useHitFlash — 추적 값(예: 적 HP)이 감소할 때 flash + 데미지 숫자 상태를
 * 생성합니다 (slice 30). useDamageFlash(플레이어 HP 전용)의 일반화 버전.
 *
 * - resetKey가 바뀌면(새 적 등장) baseline만 재설정하고 flash는 트리거하지
 *   않는다 (maxHP 리셋이 가짜 타격으로 보이는 것 방지).
 * - meta는 타격이 발생하는 시점의 스냅샷(예: 크리 여부)을 amount에 동봉 —
 *   이후 로그 변화로 meta가 바뀌어도 진행 중인 숫자 연출은 고정된다.
 *
 * @returns { flash: boolean, amount: { value, meta } | null }
 */

/** 타격 시점 스냅샷 — 현재 소비처(StatusBar)는 크리티컬 여부만 읽는다. */
export interface HitFlashMeta {
    crit?: boolean;
}

export interface HitFlashAmount {
    /** 감소량(= 받은 피해, 양수). */
    value: number;
    meta: HitFlashMeta | null;
    /** 같은 피해량이 연속으로 들어와도 연출을 다시 트리거하기 위한 키. */
    key: string;
}

export const useHitFlash = (
    value: number | undefined,
    resetKey: string | number | undefined,
    meta: HitFlashMeta | null = null,
) => {
    const [flash, setFlash] = useState(false);
    const [amount, setAmount] = useState<HitFlashAmount | null>(null);
    const prevRef = useRef<number | undefined>(value);
    const keyRef = useRef(resetKey);

    useEffect(() => {
        // 추적 대상이 바뀌면(새 적) baseline 재설정 — flash 없음.
        if (keyRef.current !== resetKey) {
            keyRef.current = resetKey;
            prevRef.current = value;
            return undefined;
        }
        if (typeof value !== 'number') return undefined;

        const prev = prevRef.current;
        prevRef.current = value;
        if (typeof prev !== 'number') return undefined;

        const delta = prev - value; // 감소량 = 받은 피해 (양수)
        if (delta <= 0) return undefined;

        setFlash(true);
        setAmount({ value: delta, meta, key: `${resetKey}_${prev}_${value}` });

        const flashTimer = window.setTimeout(() => setFlash(false), 320);
        const amountTimer = window.setTimeout(() => setAmount(null), 900);
        return () => {
            window.clearTimeout(flashTimer);
            window.clearTimeout(amountTimer);
        };
    }, [value, resetKey]); // eslint-disable-line react-hooks/exhaustive-deps

    return { flash, amount };
};
