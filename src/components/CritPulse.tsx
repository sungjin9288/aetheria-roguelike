import { motion as Motion, AnimatePresence } from 'framer-motion';

/**
 * CritPulse — 치명타 순간 화면 가장자리 골드 임팩트 (slice 31).
 *
 * criticalHit 키프레임은 정의돼 있었으나 미사용(dead)이었고, 크리는 본문
 * 태그(slice 20)와 적 데미지 숫자 강조(slice 30)만 있었다. 화면 전체에 짧고
 * 옅은 골드 비네트를 깜빡여 "한 방" 느낌을 더한다 (블로킹/노이즈 없이).
 *
 * GameRoot가 새 'critical' 로그 id를 감지해 active를 잠깐 true로 올린다.
 * MotionConfig reducedMotion="user"가 모션 민감 사용자에겐 자동 완화.
 */
interface CritPulseProps {
    active: boolean;
}

const CritPulse = ({ active }: CritPulseProps) => (
    <AnimatePresence>
        {active && (
            <Motion.div
                key="crit-pulse"
                data-testid="crit-pulse"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.6, 0] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.32, ease: 'easeOut' }}
                className="pointer-events-none fixed inset-0 z-[58]"
                style={{
                    background:
                        'radial-gradient(circle at 50% 40%, transparent 52%, rgba(246,231,162,0.26) 100%)',
                }}
            />
        )}
    </AnimatePresence>
);

export default CritPulse;
