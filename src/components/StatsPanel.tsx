import { useMemo } from 'react';
import { motion as Motion } from 'framer-motion';
import { Activity, BarChart3, ChevronDown, Coins, Compass, Flame, FlaskConical, Footprints, Hammer, Heart, Link2, Shield, Skull, Sparkles, Sword, Target, TrendingUp, Zap } from 'lucide-react';
import type { Player } from '../types/index.js';
import { getTraitPassiveParts, getTraitProfile } from '../utils/runProfileUtils';
import { formatRelicText } from '../utils/relicPresentation';
import SignalBadge from './SignalBadge';

// cycle 475: 컴팩트 prop 인터페이스 제거 — cycle 471이 Dashboard callsite 전달
//   제거 후 caller 0건. cascade로 토글 상태 / 가지 ternary / 토글 버튼 일괄 정리.
interface StatsPanelProps {
    player?: Player | null;
    stats?: any;
}

/**
 * Signature 세트 tone → 색상 매핑.
 * EquipmentPanel.jsx의 SIG_SET_TONE과 동일한 팔레트 — 시각적 일관성 유지.
 */
// cycle 411: frost / arcane 제거 — signatureSets.json sets는 fire/holy/nature/shadow
//   4 tone만 emit. activeSignatureSet.tone / setProgress.tone 모두 동일 데이터 source라
//   frost / arcane lookup 절대 hit 안 됨 (cycle 358 steel 동일 lens).
const SIG_SET_TONE: any = Object.freeze({
    holy: { border: 'rgba(246,231,162,0.5)', glow: 'rgba(246,231,162,0.18)', text: '#f6e7a2' },
    fire: { border: 'rgba(255,180,138,0.5)', glow: 'rgba(255,180,138,0.18)', text: '#ffb48a' },
    shadow: { border: 'rgba(199,164,240,0.5)', glow: 'rgba(199,164,240,0.18)', text: '#c7a4f0' },
    nature: { border: 'rgba(168,208,160,0.5)', glow: 'rgba(168,208,160,0.18)', text: '#a8d0a0' },
});

/**
 * multiplier → 퍼센트 레이블 (1.18 → "+18%", 0.9 → "-10%"). 1.0 근처는 "—".
 * @param {number} mult
 * @returns {string}
 */
const formatMultDelta = (mult: any) => {
    if (!Number.isFinite(mult) || Math.abs(mult - 1) < 0.005) return '—';
    const delta = Math.round((mult - 1) * 100);
    return `${delta >= 0 ? '+' : ''}${delta}%`;
};

/**
 * StatsPanel — 플레이 통계 + 성향 요약
 */
// cycle 452: 컴팩트 default 제거 — Dashboard 호출자가 명시 전달이라 도달 불가.
const StatsPanel = ({ player, stats }: StatsPanelProps) => {
    const overview = useMemo(() => {
        const s = player?.stats || {};
        return {
            kills: s.kills || 0,
            deaths: s.deaths || 0,
            totalGold: s.total_gold || 0,
            bossKills: s.bossKills || 0,
            bountiesCompleted: s.bountiesCompleted || 0,
            killRegistry: s.killRegistry || {},
        };
    }, [player]);

    const trait = useMemo(() => stats?.traitProfile || (player ? getTraitProfile(player, stats) : null), [player, stats]);
    const passiveParts = useMemo(() => getTraitPassiveParts(trait), [trait]);

    const activeSignatureSet = stats?.activeSignatureSet || null;
    const sigSetTone = activeSignatureSet ? (SIG_SET_TONE[activeSignatureSet.tone] || SIG_SET_TONE.holy) : null;
    // cycle 250: stats.activeSet (prefix-based items 세트) UI dispatch — items.ts sets[]
    //   ('불타는' 화염의 결속, '얼어붙은' 혹한의 방벽 등 7종)이 stats에는 적용되지만 UI 표시
    //   0건이던 silent 회귀. activeSignatureSet (signature 세트)와 paired 동작.
    const activeSet = stats?.activeSet || null;

    const topKills = useMemo(() => (
        (Object.entries(overview.killRegistry) as Array<[string, number]>)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 8)
    ), [overview.killRegistry]);

    const maxKill = topKills.length > 0 ? topKills[0][1] : 1;
    const kd = overview.deaths > 0 ? (overview.kills / overview.deaths).toFixed(1) : overview.kills > 0 ? '∞' : '0';
    const statEntries = [
        { label: '총 처치', value: overview.kills, icon: Sword, color: 'text-red-400' },
        { label: '사망', value: overview.deaths, icon: Skull, color: 'text-cyber-blue/60' },
        { label: '보스 처치', value: overview.bossKills, icon: Target, color: 'text-cyber-purple' },
        { label: '현상수배 완료', value: overview.bountiesCompleted, icon: Target, color: 'text-cyber-blue' },
        { label: '처치/사망', value: kd, icon: Shield, color: 'text-cyber-green' },
        { label: '누적 골드', value: overview.totalGold.toLocaleString(), icon: Coins, color: 'text-yellow-400' },
        { label: '레벨', value: player?.level || 1, icon: Activity, color: 'text-cyber-blue' },
        { label: '탐험 횟수', value: player?.stats?.explores || 0, icon: Compass, color: 'text-teal-300' },
        // cycle 83: 'discoveries' 시맨틱 통일 — visitedMaps.length(맵 발견 수).
        // 기존엔 stats.discoveries(이벤트 카운터)를 읽어 ach_discover_*("새 지역 N곳") /
        // 타이틀 cartographer("지도 제작자") 의도와 어긋났음. 모든 surface가 맵 발견 수로 일치.
        { label: '발견 지역', value: (player?.stats?.visitedMaps || []).length, icon: Sparkles, color: 'text-fuchsia-300' },
        { label: '휴식 횟수', value: player?.stats?.rests || 0, icon: TrendingUp, color: 'text-emerald-300' },
        // cycle 80: ESCAPES — cycle 74-78에서 통합한 도주 카운터를 stats panel에도 노출.
        { label: '도주 횟수', value: (player?.stats as any)?.escapes || 0, icon: Footprints, color: 'text-sky-300' },
        // cycle 82: CRAFTS / SYNTHESES — 제작/합성 누적도 stats panel에 노출.
        // crafts는 INITIAL_STATE에 있었으나 syntheses는 누락되어 같이 선언적 추가.
        // achievement 'synths'(target='synths' → stats.syntheses) 3종이 cycle 30+부터
        // 존재하던 갭을 가시화로 닫음. orange/amber 톤으로 제작 계열 묶음.
        { label: '제작 횟수', value: player?.stats?.crafts || 0, icon: Hammer, color: 'text-orange-300' },
        { label: '합성 횟수', value: (player?.stats as any)?.syntheses || 0, icon: FlaskConical, color: 'text-amber-300' },
        // cycle 96: MAX STREAK — cycle 95에서 추가한 stats.maxKillStreak를 stats panel에도
        // 노출. killStreak 시스템 톤(red)과 매치. berserker 칭호 진행도 시각화.
        { label: '최대 연속 처치', value: (player?.stats as any)?.maxKillStreak || 0, icon: Flame, color: 'text-red-400' },
        // cycle 104: CHAINS — cycle 102/103 ach_chain_*/chain_master 칭호 진행도 가시화.
        // chain_master 칭호 톤(indigo)과 매치. exploreUtils.checkDiscoveryChains에서 누적.
        { label: '완료한 발견 여정', value: ((player?.stats as any)?.discoveryChains || []).length, icon: Link2, color: 'text-indigo-300' },
    ];
    const coreRecordLabels = new Set(['레벨', '총 처치', '보스 처치', '최대 연속 처치']);
    const coreRecordEntries = statEntries.filter((entry) => coreRecordLabels.has(entry.label));
    const detailRecordEntries = statEntries.filter((entry) => !coreRecordLabels.has(entry.label));

    return (
        <div data-testid="stats-panel" className="space-y-3 pb-2">
            <header className="flex items-center justify-between gap-3 px-0.5">
                <div>
                    <div className="flex items-center gap-1.5 text-[11px] font-readable text-slate-400">
                        <BarChart3 size={13} /> 모험 기록
                    </div>
                    <h3 className="mt-0.5 text-[15px] font-readable font-bold text-white/92">현재 성장과 누적 기록</h3>
                </div>
                <SignalBadge tone="resonance" size="sm">레벨 {player?.level || 1}</SignalBadge>
            </header>

            <section data-testid="stats-current-growth" className="border-y border-white/10 py-3">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                        <Sparkles size={14} className="shrink-0 text-[#f6e7a2]" />
                        <div className="min-w-0">
                            <div className="text-[11px] font-readable text-slate-400">현재 성장</div>
                            <div className={`truncate text-[14px] font-readable font-bold ${trait.accent}`}>{trait.name}</div>
                        </div>
                    </div>
                    <SignalBadge tone="resonance" size="sm">{trait.title}</SignalBadge>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="aether-panel-muted rounded-lg px-3 py-2.5">
                        <div className="flex items-center gap-1 text-[11px] font-readable text-slate-400">
                            <Zap size={11} /> 전용 기술
                        </div>
                        <div className="mt-1 text-xs font-readable font-bold text-emerald-100">
                            {trait.skill?.name || '없음'}
                        </div>
                    </div>
                    <div className="aether-panel-muted rounded-lg px-3 py-2.5">
                        <div className="flex items-center gap-1 text-[11px] font-readable text-slate-400">
                            <Shield size={11} /> 패시브
                        </div>
                        <div className="mt-1 text-xs font-readable font-bold text-slate-100/90">
                            {passiveParts.length > 0 ? passiveParts.join(' / ') : trait.passiveLabel}
                        </div>
                    </div>
                </div>

                <p className="mt-3 text-xs font-readable leading-relaxed text-slate-300/82">{trait.desc}</p>
                <div className="mt-3 grid gap-2 border-t border-white/8 pt-3 text-[11px] font-readable">
                    <div className="flex items-start gap-2">
                        <span className="w-14 shrink-0 text-[#d5b180]">다음 성장</span>
                        <span className="text-slate-200/84">{trait.rewardFocus}</span>
                    </div>
                    <div className="flex items-start gap-2">
                        <span className="w-14 shrink-0 text-[#8fd6cf]">추천 임무</span>
                        <span className="text-slate-200/84">{trait.questFocus}</span>
                    </div>
                </div>
            </section>

            {activeSignatureSet && sigSetTone && (
                <div
                    data-testid="stats-active-signature-set"
                    data-signature-set-key={activeSignatureSet.key}
                    className="rounded-lg px-3 py-3 space-y-2"
                    style={{
                        border: `1px solid ${sigSetTone.border}`,
                        background: 'rgba(16, 20, 26, 0.94)',
                    }}
                >
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                            <Sparkles size={12} style={{ color: sigSetTone.text }} />
                            <span
                                className="font-rajdhani font-bold text-[13px] truncate"
                                style={{ color: sigSetTone.text }}
                            >
                                {activeSignatureSet.name}
                            </span>
                        </div>
                        <span
                            className="shrink-0 rounded-full px-2 py-1 text-[11px] font-readable"
                            style={{ color: sigSetTone.text, border: `1px solid ${sigSetTone.border}` }}
                        >
                            {activeSignatureSet.tier}세트 활성
                        </span>
                    </div>
                    {activeSignatureSet.desc && (
                        <div className="text-[11px] font-fira leading-[1.45] text-slate-300/85">
                            {activeSignatureSet.desc}
                        </div>
                    )}
                    <div className="grid grid-cols-3 gap-1.5 pt-1">
                        <div className="rounded-lg aether-panel-muted px-2.5 py-1.5">
                            <div className="text-[11px] font-readable text-slate-400 flex items-center gap-1">
                                <Sword size={9} /> 공격력
                            </div>
                            <div className="mt-0.5 text-xs font-fira font-bold" style={{ color: sigSetTone.text }}>
                                {formatMultDelta(activeSignatureSet.atkMult)}
                            </div>
                        </div>
                        <div className="rounded-lg aether-panel-muted px-2.5 py-1.5">
                            <div className="text-[11px] font-readable text-slate-400 flex items-center gap-1">
                                <Shield size={9} /> 방어력
                            </div>
                            <div className="mt-0.5 text-xs font-fira font-bold" style={{ color: sigSetTone.text }}>
                                {formatMultDelta(activeSignatureSet.defMult)}
                            </div>
                        </div>
                        <div className="rounded-lg aether-panel-muted px-2.5 py-1.5">
                            <div className="text-[11px] font-readable text-slate-400 flex items-center gap-1">
                                <Heart size={9} /> 생명
                            </div>
                            <div className="mt-0.5 text-xs font-fira font-bold" style={{ color: sigSetTone.text }}>
                                {formatMultDelta(activeSignatureSet.hpMult)}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* cycle 250: prefix-based 세트 보너스 표시 — items.ts sets ('불타는' 등)
                stats에는 적용되지만 UI invisible이던 silent 회귀 fix. */}
            {activeSet && (
                <div
                    data-testid="stats-active-set"
                    data-active-set-prefix={activeSet.prefix}
                    className="rounded-lg border border-amber-300/24 bg-amber-300/[0.06] px-3 py-2.5 space-y-1"
                >
                    <div className="flex items-center gap-1.5 min-w-0">
                        <Sparkles size={11} className="text-amber-200 shrink-0" />
                        <span className="font-readable font-bold text-xs text-amber-100 truncate">
                            {activeSet.prefix} 세트
                        </span>
                    </div>
                    {activeSet.desc && (
                        <div className="text-[11px] font-readable leading-relaxed text-amber-50/80">
                            {activeSet.desc}
                        </div>
                    )}
                </div>
            )}

            {stats?.activeSynergies?.length > 0 && (
                <section data-testid="stats-active-synergies" className="border-y border-fuchsia-300/14 py-3">
                    <div className="mb-2 flex items-center gap-1.5 text-xs font-readable font-bold text-fuchsia-100/90">
                        <Sparkles size={12} /> 활성 유물 조합
                    </div>
                    <div className="space-y-2">
                        {stats.activeSynergies.map((syn: any) => (
                            <div key={syn.label} className="flex items-start justify-between gap-3 rounded-lg bg-fuchsia-900/10 px-3 py-2">
                                <span className="shrink-0 text-[11px] font-readable font-bold text-fuchsia-200/90">{syn.label}</span>
                                <span className="text-right text-[11px] font-readable leading-relaxed text-fuchsia-100/70">{formatRelicText(syn.desc)}</span>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            <section data-testid="stats-core-records">
                <div className="mb-2 flex items-center gap-1.5 text-xs font-readable font-bold text-slate-200/88">
                    <Activity size={13} className="text-[#8fd6cf]" /> 핵심 기록
                </div>
                <div className="grid grid-cols-2 gap-2">
                    {coreRecordEntries.map((entry: any) => {
                        const Icon = entry.icon;
                        return (
                            <div key={entry.label} className="aether-panel-muted rounded-lg px-3 py-2.5">
                                <div className="flex items-center gap-1 text-[11px] font-readable text-slate-400">
                                    <Icon size={11} /> {entry.label}
                                </div>
                                <div className={`mt-1 font-readable font-bold text-sm ${entry.color}`}>{entry.value}</div>
                            </div>
                        );
                    })}
                </div>
            </section>

            <div className="divide-y divide-white/8 border-y border-white/10">
                <details data-testid="stats-lifetime-records" className="group">
                    <summary className="flex min-h-14 cursor-pointer list-none items-center gap-2 py-2 font-readable [&::-webkit-details-marker]:hidden">
                        <BarChart3 size={14} className="text-[#d5b180]" />
                        <span className="flex-1 text-xs font-bold text-slate-200/90">세부 기록</span>
                        <span className="text-[11px] text-slate-500">{detailRecordEntries.length}개</span>
                        <ChevronDown size={16} className="text-slate-500 transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="grid grid-cols-2 gap-2 pb-3">
                        {detailRecordEntries.map((entry: any) => {
                            const Icon = entry.icon;
                            return (
                                <div key={entry.label} className="aether-panel-muted rounded-lg px-3 py-2.5">
                                    <div className="flex items-center gap-1 text-[11px] font-readable text-slate-400">
                                        <Icon size={11} /> {entry.label}
                                    </div>
                                    <div className={`mt-1 text-xs font-readable font-bold ${entry.color}`}>{entry.value}</div>
                                </div>
                            );
                        })}
                    </div>
                </details>

                <details data-testid="stats-top-kills" className="group">
                    <summary className="flex min-h-14 cursor-pointer list-none items-center gap-2 py-2 font-readable [&::-webkit-details-marker]:hidden">
                        <Sword size={14} className="text-rose-300" />
                        <span className="flex-1 text-xs font-bold text-slate-200/90">처치 분포</span>
                        <span className="text-[11px] text-slate-500">상위 {topKills.length}종</span>
                        <ChevronDown size={16} className="text-slate-500 transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="space-y-3 pb-4">
                        {topKills.length === 0 && (
                            <p className="text-[11px] font-readable text-slate-400">아직 처치 기록이 없습니다.</p>
                        )}
                        {topKills.map(([name, count], i) => (
                            <Motion.div
                                key={name}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.03 }}
                                className="flex items-center gap-2"
                            >
                                <span className="w-20 truncate text-xs font-readable text-slate-300/76">{name}</span>
                                <div className="h-2 flex-1 overflow-hidden rounded-full bg-black/24">
                                    <Motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${(count / maxKill) * 100}%` }}
                                        transition={{ duration: 0.5, delay: i * 0.03 }}
                                        className="h-full rounded-full bg-rose-300/70"
                                    />
                                </div>
                                <span className="w-8 text-right text-xs font-readable text-slate-400">{count}</span>
                            </Motion.div>
                        ))}
                    </div>
                </details>

                <details data-testid="stats-legacy-records" className="group">
                    <summary className="flex min-h-14 cursor-pointer list-none items-center gap-2 py-2 font-readable [&::-webkit-details-marker]:hidden">
                        <Sparkles size={14} className="text-[#d9d0f3]" />
                        <span className="flex-1 text-xs font-bold text-slate-200/90">계승 기록</span>
                        <span className="text-[11px] text-slate-500">단계 {player?.meta?.rank || 0}</span>
                        <ChevronDown size={16} className="text-slate-500 transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="grid grid-cols-2 gap-2 pb-3 text-xs font-readable">
                        <div className="aether-panel-muted rounded-lg px-3 py-2.5">
                            <div className="text-[11px] text-slate-400">계승 정수</div>
                            <div className="mt-1 font-bold text-[#d9d0f3]">{player?.meta?.essence || 0}</div>
                        </div>
                        <div className="aether-panel-muted rounded-lg px-3 py-2.5">
                            <div className="text-[11px] text-slate-400">계승 단계</div>
                            <div className="mt-1 font-bold text-[#f6e7c8]">{player?.meta?.rank || 0}</div>
                        </div>
                        <div className="aether-panel-muted rounded-lg px-3 py-2.5">
                            <div className="text-[11px] text-slate-400">추가 공격력</div>
                            <div className="mt-1 font-bold text-rose-300">+{player?.meta?.bonusAtk || 0}</div>
                        </div>
                        <div className="aether-panel-muted rounded-lg px-3 py-2.5">
                            <div className="text-[11px] text-slate-400">추가 생명</div>
                            <div className="mt-1 font-bold text-emerald-100">+{player?.meta?.bonusHp || 0}</div>
                        </div>
                    </div>
                </details>
            </div>
        </div>
    );
};

export default StatsPanel;
