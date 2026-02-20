import React, { useState } from 'react';
import { motion as Motion } from 'framer-motion';

const IntroScreen = ({ onStart }) => {
    const [name, setName] = useState('');
    const [gender, setGender] = useState('male');

    const handleSubmit = () => {
        if (name.trim()) onStart(name, gender);
    };

    return (
        <Motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="p-10 border border-cyber-purple/30 bg-cyber-slate/80 backdrop-blur-xl rounded-xl shadow-[0_0_30px_rgba(168,85,247,0.2)] max-w-md w-full text-center relative overflow-hidden transition-all duration-500 hover:shadow-[0_0_40px_rgba(168,85,247,0.4)]"
        >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyber-purple to-transparent animate-scanline"></div>
            <Motion.h1
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.8 }}
                className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyber-blue via-cyber-purple to-cyber-pink mb-2 font-rajdhani drop-shadow-lg"
            >
                AETHERIA
            </Motion.h1>
            <Motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8, duration: 1 }}
                className="text-cyber-blue/70 mb-8 font-fira text-xs tracking-[0.2em] relative z-10"
            >
                NEURAL LINK ESTABLISHED
            </Motion.p>

            <Motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.2, duration: 0.8 }}
                className="space-y-6 relative z-10"
            >
                <div className="flex justify-center gap-4">
                    <button
                        onClick={() => setGender('male')}
                        className={`px-6 py-2 rounded-lg font-rajdhani font-bold border transition-all ${gender === 'male' ? 'bg-cyber-blue/20 border-cyber-blue text-cyber-blue shadow-[0_0_15px_rgba(0,204,255,0.4)]' : 'bg-transparent border-slate-700 text-slate-500 hover:border-slate-500'}`}
                    >
                        MALE
                    </button>
                    <button
                        onClick={() => setGender('female')}
                        className={`px-6 py-2 rounded-lg font-rajdhani font-bold border transition-all ${gender === 'female' ? 'bg-cyber-pink/20 border-cyber-pink text-cyber-pink shadow-[0_0_15px_rgba(255,0,255,0.4)]' : 'bg-transparent border-slate-700 text-slate-500 hover:border-slate-500'}`}
                    >
                        FEMALE
                    </button>
                </div>

                <div className="relative group">
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="ENTER AGENT NAME"
                        className="w-full bg-cyber-dark/50 border border-cyber-blue/40 p-4 rounded text-cyber-green text-center font-rajdhani text-xl focus:outline-none focus:border-cyber-pink focus:shadow-[0_0_20px_rgba(255,0,255,0.3)] transition-all placeholder:text-cyber-blue/30"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSubmit();
                        }}
                        autoFocus
                    />
                    <div className="absolute inset-0 border border-transparent group-hover:border-cyber-blue/20 rounded pointer-events-none transition-all"></div>
                </div>

                <Motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleSubmit}
                    disabled={!name.trim()}
                    className="w-full py-3 bg-cyber-blue/10 border border-cyber-blue/50 text-cyber-blue font-rajdhani font-bold hover:bg-cyber-blue/20 hover:shadow-[0_0_20px_rgba(0,204,255,0.4)] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                    INITIALIZE CONNECTION
                </Motion.button>
            </Motion.div>
        </Motion.div>
    );
};

export default IntroScreen;
