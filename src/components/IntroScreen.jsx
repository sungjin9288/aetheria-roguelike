import React, { useState } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';

const IntroScreen = ({ onStart }) => {
    const [name, setName] = useState('');

    const canStart = name.trim().length > 0;

    const handleStart = () => {
        if (canStart) {
            onStart(name, 'male', '모험가'); // 기본값으로 'male' 전달 (내부 처리용)
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && canStart) handleStart();
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
                className="text-cyber-blue/70 mb-8 font-fira text-xs tracking-[0.2em]"
            >
                NEURAL LINK ESTABLISHED
            </Motion.p>

            <AnimatePresence mode="wait">
                <Motion.div
                    key="step1"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.25 }}
                    className="space-y-6"
                >
                    <div className="space-y-2">
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
            </AnimatePresence>

            <div className="flex mt-8">
                <Motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={handleStart}
                    disabled={!canStart}
                    className="flex-1 py-4 bg-cyber-blue/10 border border-cyber-blue/50 text-cyber-blue font-rajdhani font-bold hover:bg-cyber-blue/20 hover:shadow-[0_0_20px_rgba(0,204,255,0.4)] disabled:opacity-40 disabled:cursor-not-allowed transition-all rounded"
                >
                    ⚡ START AS ADVENTURER
                </Motion.button>
            </div>
        </Motion.div>
    );
};

export default IntroScreen;
