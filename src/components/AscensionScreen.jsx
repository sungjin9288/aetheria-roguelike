import { ArrowRight, Crown, Sparkles, ShieldAlert } from 'lucide-react';
import { BALANCE } from '../data/constants';
import { PRESTIGE_TITLES } from '../data/titles';
import SignalBadge from './SignalBadge';

const PRESTIGE_UNLOCKS = [
    { rank: 1, label: '에테르 각성', desc: '허공의 심연 접근 허용 · 에센스 획득 +10%' },
    { rank: 2, label: '강화된 유물', desc: '유물 최대 보유 6개 · 유물 선택지 4지선다' },
    { rank: 3, label: '심연의 메아리', desc: '엘리트 몬스터 출현 확률 +25% · 희귀 아이템 보장 드롭' },
    { rank: 5, label: '혼돈의 문', desc: '혼돈의 심연 지역 개방 · 무한 레이어 스케일링 활성화' },
    { rank: 7, label: '전설 유물 해금', desc: '전설 등급 유물 드롭 풀 추가 (오메가 코어, 허공의 심장)' },
    { rank: 10, label: '에테르 초월', desc: '모든 스탯 보너스 2배 적용 · 숨겨진 보스 "에테르 군주" 등장' },
];

const STAT_TONE = {
    atk: 'text-rose-100 border-rose-300/22 bg-rose-400/10',
    hp: 'text-emerald-100 border-emerald-300/22 bg-emerald-300/10',
    mp: 'text-[#dff7f5] border-[#7dd4d8]/22 bg-[#7dd4d8]/10',
    essence: 'text-[#e3dcff] border-[#9a8ac0]/24 bg-[#9a8ac0]/10',
};

const AscensionScreen = ({ player, actions }) => {
    const meta = player.meta || {};
    const currentRank = meta.prestigeRank || 0;
    const nextRank = currentRank + 1;
    const nextTitle = PRESTIGE_TITLES[Math.min(nextRank - 1, PRESTIGE_TITLES.length - 1)];

    const nextUnlock = PRESTIGE_UNLOCKS.find((u) => u.rank === nextRank);
    const upcomingUnlocks = PRESTIGE_UNLOCKS.filter((u) => u.rank > nextRank).slice(0, 2);

    const bonusAtk = (meta.bonusAtk || 0) + BALANCE.PRESTIGE_ATK_BONUS;
    const bonusHp = (meta.bonusHp || 0) + BALANCE.PRESTIGE_HP_BONUS;
    const bonusMp = (meta.bonusMp || 0) + BALANCE.PRESTIGE_MP_BONUS;

    const statRows = [
        { label: '영구 ATK', before: `+${meta.bonusAtk || 0}`, after: `+${bonusAtk}`, tone: 'atk' },
        { label: '영구 HP', before: `+${meta.bonusHp || 0}`, after: `+${bonusHp}`, tone: 'hp' },
        { label: '영구 MP', before: `+${meta.bonusMp || 0}`, after: `+${bonusMp}`, tone: 'mp' },
        { label: '에센스', before: `${meta.essence || 0}`, after: `${(meta.essence || 0) + 200}`, tone: 'essence' },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,8,12,0.86)_0%,rgba(7,10,15,0.94)_100%)] backdrop-blur-[14px]" />
            <div
                className="pointer-events-none absolute inset-0 opacity-70"
                style={{ backgroundImage: 'radial-gradient(circle at top left, rgba(213,177,128,0.12), transparent 30%), radial-gradient(circle at bottom right, rgba(125,212,216,0.08), transparent 24%)' }}
            />

            <div className="panel-noise aether-surface-strong relative z-10 w-full max-w-[40rem] overflow-hidden rounded-[2rem] shadow-[0_36px_96px_rgba(1,6,14,0.62)]">
                <div
                    className="pointer-events-none absolute inset-0 opacity-60"
                    style={{ backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.05), transparent 22%), radial-gradient(circle at top right, rgba(154,138,192,0.12), transparent 28%)' }}
                />

                <div className="px-6 pb-6 pt-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                            <div className="text-[10px] font-fira uppercase tracking-[0.22em] text-slate-500">
                                Ether Ascension
                            </div>
                            <h1 className="mt-2 text-[1.7rem] font-rajdhani font-bold tracking-[0.08em] text-[#f6e7c8]">
                                에테르 환생
                            </h1>
                            <p className="mt-2 max-w-[32rem] text-[11px] font-fira leading-relaxed text-slate-300/76">
                                마왕을 쓰러뜨린 기록은 사라지지 않습니다. 이번 환생은 현재 런을 닫는 대신 영구 성장과 새로운 해금 축을 엽니다.
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                            <SignalBadge tone="resonance" size="sm">Prestige {nextRank}</SignalBadge>
                            <SignalBadge tone="danger" size="sm">런 초기화</SignalBadge>
                        </div>
                    </div>

                    <div className="mt-5 grid gap-3 lg:grid-cols-[1.05fr_0.95fr]">
                        <div className="space-y-3">
                            <div className="rounded-[1.25rem] border border-[#9a8ac0]/22 bg-[#9a8ac0]/10 px-4 py-3.5">
                                <div className="flex items-center justify-between gap-3 text-[10px] font-fira uppercase tracking-[0.18em] text-slate-500">
                                    <span className="inline-flex items-center gap-1.5">
                                        <Crown size={11} />
                                        Next Title
                                    </span>
                                    <span className="text-[#e3dcff]">Rank {nextRank}</span>
                                </div>
                                <div className="mt-2 text-[1.3rem] font-rajdhani font-bold text-[#f3e7ff]">
                                    [{nextTitle}]
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2.5">
                                {statRows.map((row) => (
                                    <div key={row.label} className={`rounded-[1rem] border px-3 py-3 ${STAT_TONE[row.tone]}`}>
                                        <div className="text-[10px] font-fira uppercase tracking-[0.16em] opacity-76">
                                            {row.label}
                                        </div>
                                        <div className="mt-2 flex items-center gap-2 text-[1.05rem] font-rajdhani font-bold text-white">
                                            <span className="opacity-55">{row.before}</span>
                                            <ArrowRight size={13} className="opacity-55" />
                                            <span>{row.after}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-3">
                            {nextUnlock && (
                                <div className="rounded-[1.2rem] border border-[#d5b180]/22 bg-[#d5b180]/10 px-4 py-3.5">
                                    <div className="flex items-center gap-1.5 text-[10px] font-fira uppercase tracking-[0.18em] text-slate-500">
                                        <Sparkles size={11} />
                                        이번 환생 해금
                                    </div>
                                    <div className="mt-2 text-[1.05rem] font-rajdhani font-bold text-[#f6e7c8]">
                                        {nextUnlock.label}
                                    </div>
                                    <div className="mt-1 text-[11px] font-fira leading-relaxed text-slate-200/82">
                                        {nextUnlock.desc}
                                    </div>
                                </div>
                            )}

                            {upcomingUnlocks.length > 0 && (
                                <div className="rounded-[1.2rem] border border-white/8 bg-black/18 px-4 py-3.5">
                                    <div className="text-[10px] font-fira uppercase tracking-[0.18em] text-slate-500">
                                        다음 해금 예정
                                    </div>
                                    <div className="mt-3 space-y-2">
                                        {upcomingUnlocks.map((u) => (
                                            <div key={u.rank} className="rounded-[0.95rem] border border-white/8 bg-white/[0.03] px-3 py-2.5">
                                                <div className="flex items-center justify-between gap-2 text-[10px] font-fira uppercase tracking-[0.16em]">
                                                    <span className="text-[#f6e7c8]">Rank {u.rank}</span>
                                                    <span className="text-slate-500">Locked</span>
                                                </div>
                                                <div className="mt-1 text-[12px] font-rajdhani font-bold text-slate-100">
                                                    {u.label}
                                                </div>
                                                <div className="mt-1 text-[10px] font-fira leading-relaxed text-slate-400/76">
                                                    {u.desc}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="rounded-[1.2rem] border border-rose-300/20 bg-rose-400/10 px-4 py-3 text-[11px] font-fira text-rose-100/92">
                                <div className="flex items-start gap-2">
                                    <ShieldAlert size={14} className="mt-0.5 shrink-0" />
                                    <div className="leading-relaxed">
                                        레벨, 인벤토리, 유물, 런 진행도는 초기화됩니다. 영구 보너스, 칭호, 누적 통계는 유지됩니다.
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-3">
                        <button
                            data-testid="ascension-cancel"
                            onClick={() => actions.cancelAscension()}
                            className="min-h-[48px] rounded-[1rem] border border-white/8 bg-black/18 px-4 text-sm font-rajdhani font-bold text-slate-100 transition-colors hover:bg-white/[0.05]"
                        >
                            계속 플레이
                        </button>
                        <button
                            data-testid="ascension-confirm"
                            onClick={() => actions.confirmAscension()}
                            className="min-h-[48px] rounded-[1rem] border border-[#d5b180]/24 bg-[#d5b180]/10 px-4 text-sm font-rajdhani font-bold text-[#f6e7c8] transition-colors hover:bg-[#d5b180]/14"
                        >
                            에테르 환생
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AscensionScreen;
