import { motion as Motion, MotionConfig } from 'framer-motion';
import AetherMark from '../AetherMark';
import { MSG } from '../../data/messages';

// 2026-10 에테르 유리 3차(shell · VD-09): 부팅 화면은 시작 화면과 같은 표제 — 문장 · 금빛 'AETHERIA' · 한 줄 진행 안내.
//   바탕은 앱 바탕 한 겹(.ae-app-backdrop)이고, 진행 표시는 퍼지는 고리(ping) 대신 제자리에서 밝아지는 점 하나다.
const BootScreen = ({ bootStage }: { bootStage: string }) => (
    <MotionConfig reducedMotion="user">
        <div className="relative flex h-[100dvh] w-full items-center justify-center overflow-hidden bg-ae-void font-display text-ae-ink">
            <div aria-hidden="true" className="ae-app-backdrop pointer-events-none absolute inset-0" />
            <Motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.32, ease: [0.2, 0.8, 0.2, 1] }}
                className="ae-sheet z-10 rounded-ae-xl px-8 py-8 text-center"
            >
                <div className="mb-4 flex justify-center">
                    <AetherMark size="lg" />
                </div>
                <h1 className="ae-intro-title mb-3 text-4xl font-bold">
                    AETHERIA
                </h1>
                <div aria-hidden="true" className="ae-divider mx-auto mb-4 w-40" />
                <div
                    data-testid="boot-progress"
                    data-boot-stage={bootStage}
                    className="flex items-center justify-center gap-2 text-ae-ink-2"
                >
                    <span aria-hidden="true" className="ae-boot-dot h-2 w-2 animate-pulse rounded-full bg-ae-ether" />
                    <p className="font-readable text-sm">{MSG.SHELL_BOOT_PREPARING}</p>
                </div>
            </Motion.div>
        </div>
    </MotionConfig>
);

export default BootScreen;
