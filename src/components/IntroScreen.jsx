import React, { useState } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronLeft, Zap, Shield, Skull } from 'lucide-react';

// 직업별 정보 — 스킬 전체 목록 + 패시브 특성 포함
const STARTER_CLASSES = [
    {
        id: '전사',
        icon: '⚔️',
        name: '전사',
        flavor: '강인한 체력과 근접 전투의 달인',
        passive: { icon: '🛡️', label: '전투 본능', desc: 'HP ×1.4 / 방어력 우위' },
        statTags: ['HP ×1.4', 'ATK ×1.3'],
        skills: [
            { name: '파워배시', mp: 15, desc: '강력한 내려찍기 (×2.0)' },
            { name: '광폭화', mp: 30, desc: 'ATK +50% 버프 3턴' },
            { name: '출혈베기', mp: 25, desc: '지속 출혈 피해 부여' },
        ],
        border: 'border-orange-500/60',
        bg: 'bg-orange-500/10',
        glow: 'hover:shadow-[0_0_20px_rgba(249,115,22,0.35)]',
        selectedGlow: 'shadow-[0_0_25px_rgba(249,115,22,0.5)]',
        selectedBorder: 'border-orange-400',
        accent: 'text-orange-400',
        tagColor: 'bg-orange-900/40 text-orange-300',
        skillColor: 'text-orange-300 border-orange-500/30 bg-orange-500/5',
    },
    {
        id: '마법사',
        icon: '✨',
        name: '마법사',
        flavor: '고위력 마법으로 적을 소멸시키는 원소술사',
        passive: { icon: '💎', label: '마나 친화', desc: 'MP ×1.8 / 원소 속성 강화' },
        statTags: ['MP ×1.8', 'ATK ×1.6'],
        skills: [
            { name: '화염구', mp: 20, desc: '화상 부여 (×2.2)' },
            { name: '썬더볼트', mp: 45, desc: '기절 부여 (×3.5)' },
            { name: '아이스볼트', mp: 25, desc: '빙결 부여 (×2.0)' },
        ],
        border: 'border-cyber-blue/60',
        bg: 'bg-cyber-blue/10',
        glow: 'hover:shadow-[0_0_20px_rgba(0,204,255,0.35)]',
        selectedGlow: 'shadow-[0_0_25px_rgba(0,204,255,0.5)]',
        selectedBorder: 'border-cyber-blue',
        accent: 'text-cyber-blue',
        tagColor: 'bg-cyan-900/40 text-cyan-300',
        skillColor: 'text-cyan-300 border-cyan-500/30 bg-cyan-500/5',
    },
    {
        id: '도적',
        icon: '🗡️',
        name: '도적',
        flavor: '치명타와 속도로 적의 급소를 노리는 암살자',
        passive: { icon: '⚡', label: '선제 타격', desc: '치명타율 +50% 기본 적용' },
        statTags: ['크리티컬 +50%', 'ATK ×1.4'],
        skills: [
            { name: '급소찌르기', mp: 15, desc: '50% 치명타 확률 (×1.8)' },
            { name: '독바르기', mp: 25, desc: '강력한 독 부여 (×1.5)' },
            { name: '연막탄', mp: 20, desc: '적 명중률 감소 2턴' },
        ],
        border: 'border-cyber-green/60',
        bg: 'bg-cyber-green/10',
        glow: 'hover:shadow-[0_0_20px_rgba(0,255,157,0.35)]',
        selectedGlow: 'shadow-[0_0_25px_rgba(0,255,157,0.5)]',
        selectedBorder: 'border-cyber-green',
        accent: 'text-cyber-green',
        tagColor: 'bg-emerald-900/40 text-emerald-300',
        skillColor: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/5',
    },
];

const STEP_LABELS = ['이름', '성별', '직업'];

const IntroScreen = ({ onStart }) => {
    const [step, setStep] = useState(1);
    const [name, setName] = useState('');
    const [gender, setGender] = useState('male');
    const [jobId, setJobId] = useState(null);

    const canNext = () => {
        if (step === 1) return name.trim().length > 0;
        if (step === 2) return true;
        if (step === 3) return jobId !== null;
        return false;
    };

    const handleNext = () => {
        if (step < 3) setStep(s => s + 1);
        else if (step === 3 && jobId) onStart(name, gender, jobId);
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

            {/* 타이틀 */}
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

            {/* 스텝 인디케이터 */}
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
                            {i < 2 && <div className={`w-6 h-px transition-all ${s < step ? 'bg-cyber-green' : 'bg-slate-700'}`} />}
                        </React.Fragment>
                    );
                })}
            </div>

            {/* 스텝 콘텐츠 */}
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
                    </Motion.div>
                )}

                {step === 3 && (
                    <Motion.div
                        key="step3"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.25 }}
                        className="space-y-3"
                    >
                        <p className="text-slate-400 text-sm font-fira">시작 직업을 선택하세요</p>
                        {/* 직업 카드 그리드 — 넓은 카드로 스킬 전체 표시 */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-left">
                            {STARTER_CLASSES.map((cls) => {
                                const selected = jobId === cls.id;
                                return (
                                    <button
                                        key={cls.id}
                                        onClick={() => setJobId(cls.id)}
                                        className={`p-3 rounded-lg border transition-all text-left
                                            ${cls.bg} ${selected
                                                ? `${cls.selectedBorder} ${cls.selectedGlow} ring-1 ring-inset ${cls.selectedBorder}`
                                                : `${cls.border} ${cls.glow} opacity-80 hover:opacity-100`}`}
                                    >
                                        {/* 아이콘 + 직업명 */}
                                        <div className="flex items-center gap-2 mb-1.5">
                                            <span className="text-xl">{cls.icon}</span>
                                            <span className={`font-rajdhani font-bold text-base ${cls.accent}`}>{cls.name}</span>
                                            {selected && (
                                                <span className={`ml-auto text-[9px] font-rajdhani font-bold px-1.5 py-0.5 rounded ${cls.tagColor}`}>
                                                    SELECTED
                                                </span>
                                            )}
                                        </div>

                                        {/* 플레이버 텍스트 */}
                                        <p className="text-[10px] text-slate-400 font-fira leading-tight mb-2">{cls.flavor}</p>

                                        {/* 스탯 태그 */}
                                        <div className="flex flex-wrap gap-1 mb-2">
                                            {cls.statTags.map(t => (
                                                <span key={t} className={`text-[9px] px-1.5 py-0.5 rounded font-fira font-bold ${cls.tagColor}`}>{t}</span>
                                            ))}
                                        </div>

                                        {/* 패시브 특성 */}
                                        <div className={`flex items-center gap-1 text-[9px] font-fira border rounded px-1.5 py-1 mb-2 ${cls.skillColor}`}>
                                            <span>{cls.passive.icon}</span>
                                            <span className="font-bold">{cls.passive.label}:</span>
                                            <span className="text-slate-400">{cls.passive.desc}</span>
                                        </div>

                                        {/* 스킬 목록 */}
                                        <div className="space-y-1">
                                            <p className={`text-[9px] font-fira font-bold uppercase tracking-wider ${cls.accent} opacity-70`}>
                                                <Zap size={8} className="inline mr-0.5" />Skills
                                            </p>
                                            {cls.skills.map(sk => (
                                                <div key={sk.name} className={`flex items-center justify-between text-[9px] font-fira border rounded px-1.5 py-0.5 ${cls.skillColor}`}>
                                                    <span className="font-bold">{sk.name}</span>
                                                    <span className="text-slate-500 ml-1 truncate text-right">{sk.desc}</span>
                                                    <span className="ml-1 shrink-0 opacity-60">MP {sk.mp}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                        <p className="text-[10px] text-slate-600 font-fira">
                            Lv.10 이후 상위 직업으로 전직 가능 (전사→나이트/버서커 등)
                        </p>
                    </Motion.div>
                )}
            </AnimatePresence>

            {/* 네비게이션 버튼 */}
            <div className="flex gap-3 mt-6">
                {step > 1 && (
                    <Motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => setStep(s => s - 1)}
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
                    {step < 3 ? (
                        <>{name.trim() || '다음'} <ChevronRight size={16} /></>
                    ) : (
                        '⚡ INITIALIZE CONNECTION'
                    )}
                </Motion.button>
            </div>
        </Motion.div>
    );
};

export default IntroScreen;
