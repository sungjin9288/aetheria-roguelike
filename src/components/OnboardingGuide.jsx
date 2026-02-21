import React, { useEffect, useRef } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Circle, ChevronRight } from 'lucide-react';

/**
 * OnboardingGuide — 신규 유저 온보딩 (시나리오 1)
 * 첫 접속 시 주요 행동 3단계를 순서대로 안내합니다.
 */

const STEPS = [
    { id: 'explore', label: '① EXPLORE', desc: '탐색으로 첫 전투 시작', color: 'cyber-blue', done: (s) => s.kills > 0 },
    { id: 'move', label: '② MOVE', desc: '다른 지역으로 이동해보세요', color: 'cyber-green', done: (s, loc) => loc !== '시작의 마을' },
    { id: 'rest', label: '③ REST', desc: '안전 지역에서 회복하기', color: 'yellow-400', done: (s) => s.deaths >= 0 && s.kills >= 1 },
];

const OnboardingGuide = ({ player, gameState, onDismiss }) => {
    const dismissedRef = useRef(false);

    // 이미 kills가 있다면 튜토리얼 완료로 간주 
    const isNewPlayer = player.stats?.kills === 0 && player.level === 1;

    // 자동 해제: 마지막 스텝 완료 시
    useEffect(() => {
        if (!isNewPlayer && !dismissedRef.current) {
            dismissedRef.current = true;
        }
    }, [isNewPlayer]);

    const activeStep = STEPS.findIndex(s => !s.done(player.stats || {}, player.loc));

    if (!isNewPlayer || player.name === '') return null;

    return (
        <AnimatePresence>
            <Motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mb-3 relative z-10"
            >
                <div className="bg-cyber-dark/60 backdrop-blur-md border border-cyber-blue/20 rounded-lg px-3 py-2.5 flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                        <div className="text-cyber-blue/70 text-xs font-fira mb-2 tracking-widest">▸ 추천 행동 가이드</div>
                        <div className="flex flex-wrap gap-2">
                            {STEPS.map((step, i) => {
                                const done = step.done(player.stats || {}, player.loc);
                                const isActive = i === activeStep;
                                return (
                                    <Motion.div
                                        key={step.id}
                                        animate={isActive ? { scale: [1, 1.04, 1] } : {}}
                                        transition={{ repeat: Infinity, duration: 2 }}
                                        className={`flex items-center gap-1.5 text-xs font-rajdhani font-bold px-2 py-1 rounded border transition-all
                                            ${done
                                                ? 'bg-cyber-green/10 border-cyber-green/30 text-cyber-green/70 line-through'
                                                : isActive
                                                    ? 'bg-cyber-blue/10 border-cyber-blue/50 text-cyber-blue shadow-[0_0_8px_rgba(0,204,255,0.2)]'
                                                    : 'bg-cyber-dark/30 border-cyber-blue/10 text-cyber-blue/30'
                                            }`}
                                    >
                                        {done
                                            ? <CheckCircle size={11} className="text-cyber-green/70" />
                                            : <Circle size={11} className={isActive ? 'text-cyber-blue animate-pulse' : 'text-cyber-blue/20'} />
                                        }
                                        {step.label}
                                    </Motion.div>
                                );
                            })}
                        </div>
                        {activeStep >= 0 && (
                            <div className="text-cyber-blue/50 text-xs font-fira mt-1.5 flex items-center gap-1">
                                <ChevronRight size={11} /> {STEPS[activeStep]?.desc}
                            </div>
                        )}
                    </div>
                    <button
                        onClick={onDismiss}
                        className="text-cyber-blue/30 hover:text-cyber-blue/60 transition-colors text-xs font-fira shrink-0 mt-0.5"
                        title="안내 닫기"
                    >✕</button>
                </div>
            </Motion.div>
        </AnimatePresence>
    );
};

export default OnboardingGuide;
