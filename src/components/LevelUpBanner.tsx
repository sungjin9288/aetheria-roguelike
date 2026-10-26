import { motion as Motion, AnimatePresence } from 'framer-motion';
import { ChevronsUp } from 'lucide-react';
import { MSG } from '../data/messages';
import { MOMENT_DUR_UI, MOMENT_EASE } from './moments/momentMotion';

/**
 * 레벨 상승 순간을 짧고 분명하게 보여준다.
 *
 * 2026-10 (감사 VD-02 · CL-05): 화면 가운데(위에서 30%)의 반투명 배너가 전투 기록 두 줄을 덮어
 *   같은 순간 남는 기록(보스 · 정예 위협 줄)이 비쳐 보였다 — 위쪽 알림 자리로 옮기고 배경을 불투명하게 했다.
 *   이 레벨업으로 전직이 새로 열리면 부제 한 줄을 더한다(직업 이름 없이 — 고르는 곳은 전직 화면이다).
 */
interface LevelUpBannerProps {
    level: number | null;
    /** 이 레벨업으로 전직이 새로 열렸다(`isClassChangeNewlyReady`). */
    classChangeReady?: boolean;
}

// 감사 A11Y-03: 늘 있는 상태 알림 칸 안에 그린다 — 배너가 나타나면 화면 낭독기가 읽는다(배치 밖 · 빈 칸).
const LevelUpBanner = ({ level, classChangeReady = false }: LevelUpBannerProps) => (
    <div role="status" className="pointer-events-none absolute">
    <AnimatePresence>
        {level != null && (
            <Motion.div
                key={level}
                data-testid="level-up-banner"
                data-class-change-ready={classChangeReady ? 'true' : 'false'}
                initial={{ opacity: 0, scale: 0.94, y: -12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: MOMENT_DUR_UI, ease: MOMENT_EASE }}
                className="pointer-events-none fixed inset-x-0 top-[calc(var(--aether-safe-area-top)+0.5rem)] z-[60] flex justify-center px-4"
            >
                {/* 2026-10 화면 디자인 3차: 금빛 불투명 유리 알약 — 광채는 한 번(이전 1.5초 × 3회 반복) */}
                <div className="ae-moment-pill is-gold ae-moment-glow-once flex max-w-full items-center gap-3 rounded-ae-lg py-2 pl-2 pr-5">
                    <span className="ae-moment-pill-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-full" aria-hidden="true">
                        <ChevronsUp size={20} />
                    </span>
                    <div className="min-w-0 text-left">
                        <div className="ae-moment-pill-label font-readable text-[11px] font-bold">
                            레벨 상승
                        </div>
                        <div className="mt-0.5 font-display text-[22px] font-extrabold leading-none text-ae-ink">
                            <span className="font-fira tabular-nums">레벨 {level}</span>
                        </div>
                        {classChangeReady && (
                            <div
                                data-testid="level-up-class-change-ready"
                                className="mt-1 break-keep font-readable text-[12px] font-bold text-ae-ether-hi"
                            >
                                {MSG.JOB_CHANGE_READY}
                            </div>
                        )}
                    </div>
                </div>
            </Motion.div>
        )}
    </AnimatePresence>
    </div>
);

export default LevelUpBanner;
