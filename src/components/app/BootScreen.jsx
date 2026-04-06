import React from 'react';
import { motion as Motion, MotionConfig } from 'framer-motion';
import AetherMark from '../AetherMark';

const BootScreen = ({ bootStage }) => (
    <MotionConfig reducedMotion="user">
        <div className="flex h-[100dvh] w-full bg-cyber-black items-center justify-center text-cyber-blue font-rajdhani relative overflow-hidden">
            <div
                className="absolute inset-0 opacity-20 pointer-events-none"
                style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.12) 0.7px, transparent 0.7px)', backgroundSize: '3px 3px' }}
            />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(213,177,128,0.12),transparent_28%),radial-gradient(circle_at_78%_20%,rgba(125,212,216,0.12),transparent_24%),linear-gradient(180deg,rgba(6,9,14,0.94)_0%,rgba(4,7,10,0.98)_100%)] pointer-events-none" />
            <Motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="panel-noise aether-surface-strong text-center z-10 rounded-[2rem] p-8"
            >
                <div className="mb-4 flex justify-center">
                    <AetherMark size="lg" />
                </div>
                <h1 className="mb-3 bg-gradient-to-r from-[#f3e6c9] via-[#a4e6e2] to-[#82c7d4] bg-clip-text text-4xl font-bold tracking-[0.18em] text-transparent">
                    AETHERIA
                </h1>
                <div className="mx-auto mb-4 h-px w-40 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                <div className="flex items-center justify-center gap-2 text-[#d9ecec]">
                    <span className="h-2 w-2 rounded-full bg-[#7dd4d8] animate-ping shadow-[0_0_12px_rgba(125,212,216,0.5)]" />
                    <p className="tracking-widest text-sm">SYSTEM INITIALIZING... ({bootStage})</p>
                </div>
            </Motion.div>
        </div>
    </MotionConfig>
);

export default BootScreen;
