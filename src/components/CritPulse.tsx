import { motion as Motion, AnimatePresence } from 'framer-motion';
import { BALANCE } from '../data/constants';

/**
 * CritPulse — 전투 한 방의 화면 가장자리 비네트 (slice 31 → 게임 필 감사 GF-01).
 *
 * 두 가지 색조가 있다:
 *   - 'crit'  : 내 치명타 — 옅은 금빛(`--aether-gold-hi`). 플레이어의 "한 방" 신호다.
 *   - 'heavy' : 적의 강타 · 브레스 — 붉은빛(`--aether-life-lo`, 생명이 깎이는 색). 맞은 순간이라 금빛을 쓰지 않는다(예전에는 기록 꼬리가 'critical'이면
 *               금빛이 떠서 적 강타가 내 치명타처럼 보였다).
 *
 * GameRoot가 리듀서의 차례 기록(`combatFeedback`)에서 active를 잠깐 올린다(`useCombatFeedbackBeats`).
 * MotionConfig reducedMotion="user"가 모션 민감 사용자에겐 자동 완화.
 */
type CritPulseTone = 'crit' | 'heavy';

interface CritPulseProps {
    active: boolean;
    tone?: CritPulseTone;
}

const PULSE_TONES: Record<CritPulseTone, { testId: string; background: string }> = {
    crit: {
        testId: 'crit-pulse',
        background: 'radial-gradient(circle at 50% 40%, transparent 52%, rgb(var(--aether-gold-hi-rgb) / 0.26) 100%)',
    },
    heavy: {
        testId: 'heavy-hit-pulse',
        background: 'radial-gradient(circle at 50% 40%, transparent 48%, rgb(var(--aether-life-lo-rgb) / 0.4) 100%)',
    },
};

const CritPulse = ({ active, tone = 'crit' }: CritPulseProps) => {
    const { testId, background } = PULSE_TONES[tone];
    return (
        <AnimatePresence>
            {active && (
                <Motion.div
                    key={testId}
                    data-testid={testId}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0, 0.6, 0] }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: BALANCE.COMBAT_PULSE_MS / 1000, ease: 'easeOut' }}
                    className="pointer-events-none fixed inset-0 z-[58]"
                    style={{ background }}
                />
            )}
        </AnimatePresence>
    );
};

export default CritPulse;
