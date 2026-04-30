import React from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Circle, ChevronRight, X } from 'lucide-react';

/**
 * OnboardingGuide — 신규 유저 온보딩 (시나리오 1)
 * 첫 접속 시 주요 행동 3단계를 순서대로 안내합니다.
 * mobile prop: true이면 컴팩트 모드 (하단 고정 팝업)
 */

const STEPS = [
    { id: 'explore', label: '① EXPLORE', desc: '탐색으로 첫 전투 시작', color: 'cyber-blue', done: (s) => s.kills > 0 || (s.explores || 0) > 0 },
    { id: 'move', label: '② MOVE', desc: '다른 지역으로 이동해보세요', color: 'cyber-green', done: (s, loc) => loc !== '시작의 마을' },
    { id: 'rest', label: '③ REST', desc: '안전 지역에서 회복하기', color: 'yellow-400', done: (s) => (s.rests || 0) > 0 },
];

const OnboardingGuide = ({ player, onDismiss }) => {
    const isNewPlayer = (player.stats?.kills ?? 0) === 0 &&
                        (player.stats?.explores ?? 0) === 0 &&
                        player.level === 1;

    const activeStep = STEPS.findIndex(s => !s.done(player.stats || {}, player.loc));
    const allDone = activeStep === -1;

    if (!isNewPlayer || player.name === '') return null;

    return (
        <AnimatePresence>
            <Motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="w-full mb-2 relative z-10"
            >
                <div className="bg-cyber-dark/80 backdrop-blur-md border border-cyber-blue/20 rounded-lg px-3 py-2 flex items-center gap-3">
                    <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                        <span className="text-cyber-blue/60 text-[10px] font-fira shrink-0">▸ 추천</span>
                        {STEPS.map((step, i) => {
                            const done = step.done(player.stats || {}, player.loc);
                            const isActive = i === activeStep;
                            return (
                                <span
                                    key={step.id}
                                    className={`flex items-center gap-1 text-[10px] font-rajdhani font-bold px-2 py-0.5 rounded border transition-all
                                        ${done
                                            ? 'bg-cyber-green/10 border-cyber-green/30 text-cyber-green/70 line-through'
                                            : isActive
                                                ? 'bg-cyber-blue/10 border-cyber-blue/50 text-cyber-blue shadow-[0_0_6px_rgba(0,204,255,0.2)]'
                                                : 'bg-cyber-dark/30 border-cyber-blue/10 text-cyber-blue/30'
                                        }`}
                                >
                                    {done
                                        ? <CheckCircle size={9} className="text-cyber-green/70" />
                                        : <Circle size={9} className={isActive ? 'text-cyber-blue animate-pulse' : 'text-cyber-blue/20'} />
                                    }
                                    {step.label}
                                </span>
                            );
                        })}
                        {!allDone && activeStep >= 0 && (
                            <span className="text-cyber-blue/40 text-[10px] font-fira flex items-center gap-0.5">
                                <ChevronRight size={9} />{STEPS[activeStep]?.desc}
                            </span>
                        )}
                    </div>
                    <button
                        onClick={onDismiss}
                        className="text-cyber-blue/30 hover:text-cyber-blue/60 transition-colors shrink-0"
                        title="안내 닫기"
                    >
                        <X size={12} />
                    </button>
                </div>
            </Motion.div>
        </AnimatePresence>
    );
};

export default OnboardingGuide;
