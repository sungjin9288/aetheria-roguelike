import {
    ArrowRight,
    BookOpenCheck,
    Crown,
    RotateCcw,
    ShieldAlert,
    Sparkles,
    Swords,
} from 'lucide-react';
import { getSignatureDiscoveryProgress } from '../data/signatureItems.js';
import type { Player } from '../types/index.js';
import { getAscensionOutcome } from '../utils/ascensionPreview';

interface AscensionScreenProps {
    player: Player;
    actions?: any;
}

const AscensionScreen = ({ player, actions }: AscensionScreenProps) => {
    const outcome = getAscensionOutcome(player.meta);
    const signatureProgress = getSignatureDiscoveryProgress(player);
    const statRows = [
        { label: '공격력', before: player.meta?.bonusAtk || 0, after: outcome.meta.bonusAtk, tone: 'text-rose-100' },
        { label: '생명', before: player.meta?.bonusHp || 0, after: outcome.meta.bonusHp, tone: 'text-emerald-100' },
        { label: '기력', before: player.meta?.bonusMp || 0, after: outcome.meta.bonusMp, tone: 'text-[#dff7f5]' },
        { label: '계승 정수', before: player.meta?.essence || 0, after: outcome.meta.essence, tone: 'text-[#e3dcff]' },
    ];

    return (
        <div
            data-testid="ascension-screen"
            className="fixed inset-0 z-[200] flex h-[100dvh] items-stretch justify-center bg-[#070b11]/96 sm:items-center sm:p-4"
        >
            <section className="panel-noise aether-surface-strong relative z-10 flex min-h-0 w-full max-w-[40rem] flex-col overflow-hidden border-white/10 sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl sm:border">
                <header className="shrink-0 border-b border-white/8 px-4 pb-3 pt-[max(var(--aether-safe-area-top),1rem)] sm:px-5 sm:pt-5">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <div className="text-[11px] font-readable text-[#d5b180]">마왕을 쓰러뜨린 뒤</div>
                            <h1 className="mt-1 text-[22px] font-readable font-bold text-white">다음 여정으로 계승</h1>
                            <p className="mt-1 text-[12px] font-readable leading-relaxed text-slate-300/82">
                                이번 여정을 마치고 더 강한 세계에서 다시 시작합니다.
                            </p>
                        </div>
                        <div className="shrink-0 rounded-lg border border-[#9a8ac0]/30 bg-[#9a8ac0]/10 px-3 py-2 text-center">
                            <div className="text-[11px] font-readable text-slate-300">계승 단계</div>
                            <div className="mt-0.5 text-[17px] font-readable font-bold text-[#e3dcff]">
                                {outcome.currentRank} <ArrowRight className="inline" size={13} /> {outcome.nextRank}
                            </div>
                        </div>
                    </div>
                </header>

                <main
                    data-testid="ascension-scroll-region"
                    className="custom-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3 sm:px-5 sm:py-4"
                >
                    <section
                        data-testid="ascension-primary-reward"
                        className="rounded-lg border border-[#d5b180]/26 bg-[#d5b180]/8 p-3.5"
                    >
                        <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#d5b180]/24 bg-black/22 text-[#f6e7c8]">
                                <Crown size={18} />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="text-[11px] font-readable text-[#d5b180]">새 칭호</div>
                                <div className="mt-0.5 text-[18px] font-readable font-bold text-[#f6e7c8]">
                                    {outcome.title}
                                </div>
                                {outcome.milestone && (
                                    <div data-testid="ascension-current-unlock" className="mt-2 border-t border-[#d5b180]/16 pt-2">
                                        <div className="flex items-center gap-1.5 text-[12px] font-readable font-bold text-white">
                                            <Sparkles size={13} className="text-[#d5b180]" />
                                            {outcome.milestone.name}
                                        </div>
                                        <p className="mt-1 text-[11px] font-readable leading-relaxed text-slate-300/82">
                                            {outcome.milestone.description}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </section>

                    <section data-testid="ascension-permanent-growth">
                        <h2 className="flex items-center gap-1.5 text-[12px] font-readable font-bold text-white">
                            <Sparkles size={13} className="text-[#9a8ac0]" />
                            영구 성장
                        </h2>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                            {statRows.map((row) => (
                                <div key={row.label} className="rounded-lg border border-white/8 bg-black/18 px-3 py-2.5">
                                    <div className="text-[11px] font-readable text-slate-400">{row.label}</div>
                                    <div className={`mt-1 flex items-center gap-1.5 text-[15px] font-readable font-bold ${row.tone}`}>
                                        <span className="text-slate-400">+{row.before}</span>
                                        <ArrowRight size={12} />
                                        <span>+{row.after}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <p className="mt-2 text-[11px] font-readable leading-relaxed text-slate-400">
                            계승 정수는 마을의 에테르 거울에서 원하는 영구 능력에 투자할 수 있습니다.
                        </p>
                    </section>

                    <section
                        data-testid="ascension-enemy-scaling"
                        className="rounded-lg border border-amber-300/20 bg-amber-300/[0.06] p-3"
                    >
                        <div className="flex items-start gap-2.5">
                            <Swords size={16} className="mt-0.5 shrink-0 text-amber-100" />
                            <div className="min-w-0 flex-1">
                                <h2 className="text-[12px] font-readable font-bold text-amber-50">다음 세계는 더 강하고 보상도 큽니다</h2>
                                <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] font-readable">
                                    <div className="rounded-md bg-black/18 px-2.5 py-2 text-slate-300">
                                        적 능력치
                                        <div className="mt-0.5 font-bold text-white">
                                            +{outcome.currentEnemyStatPercent}% <ArrowRight className="inline" size={11} /> +{outcome.nextEnemyStatPercent}%
                                        </div>
                                    </div>
                                    <div className="rounded-md bg-black/18 px-2.5 py-2 text-slate-300">
                                        처치 보상
                                        <div className="mt-0.5 font-bold text-emerald-100">
                                            +{outcome.currentEnemyRewardPercent}% <ArrowRight className="inline" size={11} /> +{outcome.nextEnemyRewardPercent}%
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className="grid gap-2 sm:grid-cols-2">
                        <div data-testid="ascension-preserved-summary" className="rounded-lg border border-emerald-300/18 bg-emerald-300/[0.06] p-3">
                            <h2 className="flex items-center gap-1.5 text-[12px] font-readable font-bold text-emerald-100">
                                <BookOpenCheck size={14} /> 그대로 남는 것
                            </h2>
                            <p className="mt-1.5 text-[11px] font-readable leading-relaxed text-slate-300/82">
                                영구 능력 · 직업 여정 · 설정 · 도감 · 칭호 · 업적과 누적 기록 · 시즌 진행
                            </p>
                            {signatureProgress.discovered > 0 && (
                                <p
                                    data-testid="ascension-signature-preserve"
                                    className="mt-2 border-t border-[#f6e7a2]/20 pt-2 text-[11px] font-readable text-[#f6e7a2]"
                                >
                                    ✦ 전설 각인 도감 {signatureProgress.discovered}/{signatureProgress.total} 보존
                                </p>
                            )}
                        </div>

                        <div data-testid="ascension-reset-summary" className="rounded-lg border border-rose-300/18 bg-rose-300/[0.06] p-3">
                            <h2 className="flex items-center gap-1.5 text-[12px] font-readable font-bold text-rose-100">
                                <ShieldAlert size={14} /> 새로 시작하는 것
                            </h2>
                            <p className="mt-1.5 text-[11px] font-readable leading-relaxed text-slate-300/82">
                                레벨 · 장비와 가방 · 유물 · 임무 · 현재 원정과 유해
                            </p>
                        </div>
                    </section>

                    {outcome.upcomingMilestone && (
                        <details data-testid="ascension-upcoming-unlock" className="rounded-lg border border-white/8 bg-black/16 px-3 py-2.5">
                            <summary className="cursor-pointer text-[11px] font-readable font-bold text-slate-200">
                                다음 계승 목표 · {outcome.upcomingMilestone.rank}단계 {outcome.upcomingMilestone.name}
                            </summary>
                            <p className="mt-2 text-[11px] font-readable leading-relaxed text-slate-400">
                                {outcome.upcomingMilestone.description}
                            </p>
                        </details>
                    )}
                </main>

                <footer className="shrink-0 border-t border-white/8 bg-[#0a1018]/98 px-4 pb-[max(var(--aether-safe-area-bottom),0.75rem)] pt-3 sm:px-5">
                    <div className="grid grid-cols-2 gap-2.5">
                        <button
                            type="button"
                            data-testid="ascension-cancel"
                            onClick={() => actions?.cancelAscension?.()}
                            className="flex min-h-[48px] items-center justify-center gap-2 rounded-lg border border-white/12 bg-black/18 px-3 text-[13px] font-readable font-bold text-slate-100 transition-colors hover:bg-white/[0.05]"
                        >
                            <RotateCcw size={15} /> 이 여정 계속
                        </button>
                        <button
                            type="button"
                            data-testid="ascension-confirm"
                            onClick={() => actions?.confirmAscension?.()}
                            className="flex min-h-[48px] items-center justify-center gap-2 rounded-lg border border-[#d5b180]/36 bg-[#d5b180]/14 px-3 text-[13px] font-readable font-bold text-[#f6e7c8] transition-colors hover:bg-[#d5b180]/20"
                        >
                            <Crown size={15} /> 계승하고 새 여정
                        </button>
                    </div>
                </footer>
            </section>
        </div>
    );
};

export default AscensionScreen;
