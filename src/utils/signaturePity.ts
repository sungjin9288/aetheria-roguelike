/**
 * signaturePity.js — signature 드롭 bad-luck 보호막.
 *
 * 플레이어가 N마리의 보스를 signature 없이 토벌할 때마다 다음 보스 signature
 * 드롭 확률에 step-wise 배율을 적용한다. 플레이어가 "평균 10마리에서 한 번"
 * 같은 RNG 스파이크에 갇히지 않도록 하는 mercy 시스템.
 *
 * 순수 함수 — 입력(pity count) → 출력(배율). 부수효과 없음.
 *
 * ## 동작
 *   - pity < THRESHOLD → 1.0 (효과 없음, 기본 드롭률 그대로)
 *   - pity ≥ THRESHOLD → 1 + floor(pity / THRESHOLD) * STEP_MULT
 *   - CAP에서 clamp
 *
 * ## 예시 (THRESHOLD=5, STEP_MULT=0.15, CAP=2.5)
 *   pity=0~4  → 1.00x (10% 드롭률 → 10%)
 *   pity=5~9  → 1.15x (10% → 11.5%)
 *   pity=10~14 → 1.30x (10% → 13%)
 *   pity=15~19 → 1.45x (10% → 14.5%)
 *   ...
 *   pity=50+   → 2.50x (10% → 25%, CAP)
 *
 * ## 리셋 규칙 (combatVictory.js 책임)
 *   - signature 아이템 획득 순간 pity = 0
 *   - 보스 토벌 + signature 미획득 → pity += 1
 *   - 일반 몹 토벌은 pity 영향 없음
 */

const PITY_THRESHOLD = 5;
const PITY_STEP_MULT = 0.15;
const PITY_CAP = 2.5;

// cycle 445: STEP_MULT 노출 제거 — production read 0건. 내부 PITY_STEP_MULT
//   const는 getSignaturePityMultiplier 동작용으로 보존. THRESHOLD / CAP만 노출.
export const SIGNATURE_PITY = Object.freeze({
    THRESHOLD: PITY_THRESHOLD,
    CAP: PITY_CAP,
});

/**
 * Pity counter → signature 드롭률 배율.
 *
 * @param {number | null | undefined} pity - 직전 signature 획득 이후 보스 토벌 수
 * @returns {number} 1.0 ~ CAP 사이 배율
 */
export const getSignaturePityMultiplier = (pity: any) => {
    const safe = Math.max(0, Number(pity) || 0);
    if (safe < PITY_THRESHOLD) return 1.0;
    const steps = Math.floor(safe / PITY_THRESHOLD);
    const boost = 1 + steps * PITY_STEP_MULT;
    return Math.min(PITY_CAP, boost);
};
