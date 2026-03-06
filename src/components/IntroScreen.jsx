import React, { useState } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronLeft } from 'lucide-react';

const STEP_LABELS = ['이름', '성별'];

const IntroScreen = ({ onStart }) => {
    const [step, setStep] = useState(1);
    const [name, setName] = useState('');
    const [gender, setGender] = useState('male');

    const canNext = () => {
        if (step === 1) return name.trim().length > 0;
        if (step === 2) return true;
        return false;
    };

    const handleNext = () => {
        if (step < 2) {
            setStep((s) => s + 1);
            return;
        }
        onStart(name, gender, '모험가');
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && canNext()) handleNext();
    };

    return (
        <Motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="p-6 md:p-8 border border-cyber-purple/30 bg-cyber-slate/80 backdrop-blur-xl rounded-xl shadow-[0_0_30px_rgba(168,85,247,0.2)] w-full max-w-2xl text-center relative overflow-hidden"
        >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyber-purple to-transparent animate-scanline" />

            <Motion.h1
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.8 }}
                className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyber-blue via-cyber-purple to-cyber-pink mb-1 font-rajdhani drop-shadow-lg"
            >
                AETHERIA
            </Motion.h1>
            <Motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8, duration: 1 }}
                className="text-cyber-blue/70 mb-6 font-fira text-xs tracking-[0.2em]"
            >
                NEURAL LINK ESTABLISHED
            </Motion.p>

            <div className="flex items-center justify-center gap-2 mb-6">
                {STEP_LABELS.map((label, i) => {
                    const s = i + 1;
                    const active = s === step;
                    const done = s < step;
                    return (
                        <React.Fragment key={s}>
                            <div className={`flex items-center gap-1.5 text-xs font-rajdhani font-bold transition-all
                                ${active ? 'text-cyber-purple' : done ? 'text-cyber-green' : 'text-slate-600'}`}>
                                <span className={`w-5 h-5 rounded-full border flex items-center justify-center text-[10px] transition-all
                                    ${active ? 'border-cyber-purple bg-cyber-purple/20' : done ? 'border-cyber-green bg-cyber-green/20' : 'border-slate-700'}`}>
                                    {done ? '✓' : s}
                                </span>
                                {label}
                            </div>
                            {i < STEP_LABELS.length - 1 && (
                                <div className={`w-6 h-px transition-all ${s < step ? 'bg-cyber-green' : 'bg-slate-700'}`} />
                            )}
                        </React.Fragment>
                    );
                })}
            </div>

            <AnimatePresence mode="wait">
                {step === 1 && (
                    <Motion.div
                        key="step1"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.25 }}
                        className="space-y-4"
                    >
                        <p className="text-slate-400 text-sm font-fira">에이전트 코드명을 입력하세요</p>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="ENTER AGENT NAME"
                            className="w-full bg-cyber-dark/50 border border-cyber-blue/40 p-4 rounded text-cyber-green text-center font-rajdhani text-xl focus:outline-none focus:border-cyber-pink focus:shadow-[0_0_20px_rgba(255,0,255,0.3)] transition-all placeholder:text-cyber-blue/30"
                            autoFocus
                            maxLength={16}
                        />
                    </Motion.div>
                )}

                {step === 2 && (
                    <Motion.div
                        key="step2"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.25 }}
                        className="space-y-4"
                    >
                        <p className="text-slate-400 text-sm font-fira">에이전트 성별을 선택하세요</p>
                        <div className="flex justify-center gap-4">
                            <button
                                onClick={() => setGender('male')}
                                className={`px-8 py-3 rounded-lg font-rajdhani font-bold border transition-all text-lg ${gender === 'male' ? 'bg-cyber-blue/20 border-cyber-blue text-cyber-blue shadow-[0_0_15px_rgba(0,204,255,0.4)]' : 'bg-transparent border-slate-700 text-slate-500 hover:border-slate-500'}`}
                            >
                                ♂ MALE
                            </button>
                            <button
                                onClick={() => setGender('female')}
                                className={`px-8 py-3 rounded-lg font-rajdhani font-bold border transition-all text-lg ${gender === 'female' ? 'bg-cyber-pink/20 border-cyber-pink text-cyber-pink shadow-[0_0_15px_rgba(255,0,255,0.4)]' : 'bg-transparent border-slate-700 text-slate-500 hover:border-slate-500'}`}
                            >
                                ♀ FEMALE
                            </button>
                        </div>
                        <div className="rounded-lg border border-cyber-blue/30 bg-cyber-dark/50 p-4 text-left shadow-inner">
                            <div className="text-cyber-blue font-rajdhani font-bold tracking-wider text-sm mb-1">
                                STARTING CLASS: 모험가
                            </div>
                            <p className="text-xs text-slate-400 font-fira leading-relaxed">
                                게임은 기본 직업 <span className="text-cyber-green">모험가</span>로 시작합니다.
                                레벨 5를 달성하면 <span className="text-cyber-purple">전사 / 마법사 / 도적</span>으로 전직할 수 있습니다.
                            </p>
                        </div>
                    </Motion.div>
                )}
            </AnimatePresence>

            <div className="flex gap-3 mt-6">
                {step > 1 && (
                    <Motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => setStep((s) => s - 1)}
                        className="flex items-center gap-1 px-4 py-3 bg-transparent border border-slate-700 text-slate-400 font-rajdhani font-bold hover:border-slate-500 transition-all rounded"
                    >
                        <ChevronLeft size={16} /> BACK
                    </Motion.button>
                )}
                <Motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={handleNext}
                    disabled={!canNext()}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-cyber-blue/10 border border-cyber-blue/50 text-cyber-blue font-rajdhani font-bold hover:bg-cyber-blue/20 hover:shadow-[0_0_20px_rgba(0,204,255,0.4)] disabled:opacity-40 disabled:cursor-not-allowed transition-all rounded"
                >
                    {step < 2 ? (
                        <>{name.trim() || '다음'} <ChevronRight size={16} /></>
                    ) : (
                        '⚡ START AS ADVENTURER'
                    )}
                </Motion.button>
            </div>
        </Motion.div>
    );
};

export default IntroScreen;
