import { useMemo } from 'react';
import { motion as Motion } from 'framer-motion';
import { Activity, BarChart3, Coins, Compass, Flame, FlaskConical, Footprints, Hammer, Heart, Link2, Shield, Skull, Sparkles, Sword, Target, TrendingUp, Zap } from 'lucide-react';
import type { Player } from '../types/index.js';
import { getTraitPassiveParts, getTraitProfile } from '../utils/runProfileUtils';
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
    return (
        <div data-testid="stats-panel" className="space-y-4">
            <div className="flex items-center justify-between gap-2">
                <div className="text-slate-400 text-xs font-fira tracking-[0.18em] flex items-center gap-1.5 uppercase">
                    <BarChart3 size={12} /> 모험 기록
                </div>
            </div>

            <div className="overflow-hidden rounded-[1.1rem] border border-white/8 bg-black/18 p-3 space-y-2.5">
                <div className="flex items-center justify-between gap-3 text-xs font-fira uppercase tracking-[0.18em] text-slate-400/72">
                    <span className="flex items-center gap-1.5">
                        <Sparkles size={10} />
                        성향
                    </span>
                    <SignalBadge tone="resonance" size="sm">{trait.title}</SignalBadge>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                    <div className="rounded-[0.95rem] aether-panel-muted px-2.5 py-2">
                        <div className="text-[11px] text-slate-400 font-fira uppercase flex items-center gap-1 mb-0.5">
                            <Sparkles size={9} /> 현재 성향
                        </div>
                        <div className={`font-fira font-bold text-xs ${trait.accent}`}>{trait.name}</div>
                    </div>
                    <div className="rounded-[0.95rem] aether-panel-muted px-2.5 py-2">
                        <div className="text-[11px] text-slate-400 font-fira uppercase flex items-center gap-1 mb-0.5">
                            <Zap size={9} /> 전용 스킬
                        </div>
                        <div className="font-fira font-bold text-xs text-emerald-100">{trait.skill?.name || '없음'}</div>
                    </div>
                    <div className="col-span-2 rounded-[0.95rem] aether-panel-muted px-2.5 py-2">
                        <div className="text-[11px] text-slate-400 font-fira uppercase flex items-center gap-1 mb-0.5">
                            <Shield size={9} /> 패시브
                        </div>
                        <div className="font-fira font-bold text-xs text-slate-200/88">
                            {passiveParts.length > 0 ? passiveParts.join(' / ') : trait.passiveLabel}
                        </div>
                    </div>
                </div>
                <div className="text-xs font-fira text-slate-300/76 leading-snug">
                    {trait.desc}
                </div>
                <div className="text-xs font-fira text-slate-400">
                    성향 판단: {trait.reasons.join(' · ')}
                </div>
                <div className="space-y-1 pt-2 border-t border-white/8 text-xs font-fira text-slate-300/74">
                    <div>→ {trait.unlockHint}</div>
                    <div>→ 보상 방향: {trait.rewardFocus}</div>
                    <div>→ 권장 임무: {trait.questFocus}</div>
                    <div>→ 보스 대응: {trait.bossDirective}</div>
                    {trait.skill?.desc && <div>→ {trait.skill.desc}</div>}
                </div>
            </div>

            {activeSignatureSet && sigSetTone && (
                <div
                    data-testid="stats-active-signature-set"
                    data-signature-set-key={activeSignatureSet.key}
                    className="relative overflow-hidden rounded-[1.1rem] px-3 py-2.5 space-y-2"
                    style={{
                        border: `1px solid ${sigSetTone.border}`,
                        background: `radial-gradient(circle at 20% 38%, ${sigSetTone.glow}, transparent 58%), linear-gradient(180deg, rgba(20,24,30,0.92) 0%, rgba(10,12,16,1) 100%)`,
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
                            className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-fira uppercase tracking-[0.14em]"
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
                        <div className="rounded-[0.9rem] aether-panel-muted px-2.5 py-1.5">
                            <div className="text-[10px] font-fira uppercase text-slate-400 flex items-center gap-1">
                                <Sword size={9} /> 공격력
                            </div>
                            <div className="mt-0.5 text-xs font-fira font-bold" style={{ color: sigSetTone.text }}>
                                {formatMultDelta(activeSignatureSet.atkMult)}
                            </div>
                        </div>
                        <div className="rounded-[0.9rem] aether-panel-muted px-2.5 py-1.5">
                            <div className="text-[10px] font-fira uppercase text-slate-400 flex items-center gap-1">
                                <Shield size={9} /> 방어력
                            </div>
                            <div className="mt-0.5 text-xs font-fira font-bold" style={{ color: sigSetTone.text }}>
                                {formatMultDelta(activeSignatureSet.defMult)}
                            </div>
                        </div>
                        <div className="rounded-[0.9rem] aether-panel-muted px-2.5 py-1.5">
                            <div className="text-[10px] font-fira uppercase text-slate-400 flex items-center gap-1">
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
                    className="rounded-[1rem] border border-amber-300/24 bg-amber-300/[0.06] px-3 py-2 space-y-1"
                >
                    <div className="flex items-center gap-1.5 min-w-0">
                        <Sparkles size={11} className="text-amber-200 shrink-0" />
                        <span className="font-rajdhani font-bold text-[12px] text-amber-100 truncate">
                            {activeSet.prefix} 세트
                        </span>
                    </div>
                    {activeSet.desc && (
                        <div className="text-[10.5px] font-fira leading-[1.45] text-amber-50/80">
                            {activeSet.desc}
                        </div>
                    )}
                </div>
            )}

            <div className="grid grid-cols-2 gap-1.5">
                {statEntries.map((entry: any) => {
                    const Icon = entry.icon;
                    return (
                        <div key={entry.label} className="aether-panel-muted rounded-[0.95rem] px-2.5 py-2">
                            <div className="text-[11px] text-slate-400 font-fira uppercase flex items-center gap-1 mb-0.5">
                                <Icon size={9} /> {entry.label}
                            </div>
                            <div className={`font-fira font-bold text-xs ${entry.color}`}>{entry.value}</div>
                        </div>
                    );
                })}
            </div>

            {topKills.length > 0 && (
                <div className="space-y-2">
                    <div className="text-xs text-slate-400 font-readable">처치 분포 · 상위 8종</div>
                    {topKills.map(([name, count], i) => (
                        <Motion.div
                            key={name}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.03 }}
                            className="flex items-center gap-2"
                        >
                            <span className="text-xs text-slate-300/76 font-fira w-20 truncate">{name}</span>
                            <div className="flex-1 h-2 bg-black/24 rounded-full overflow-hidden">
                                <Motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${(count / maxKill) * 100}%` }}
                                    transition={{ duration: 0.5, delay: i * 0.03 }}
                                    className="h-full bg-gradient-to-r from-rose-400/70 to-[#d5b180]/70 rounded-full"
                                />
                            </div>
                            <span className="text-xs text-slate-400 font-fira w-8 text-right">{count}</span>
                        </Motion.div>
                    ))}
                </div>
            )}

            {player?.meta && (
                <div className="rounded-[1rem] border border-white/8 bg-black/18 px-3 py-2.5 space-y-1 text-xs font-fira text-slate-400/76">
                    <div className="flex justify-between"><span>계승 정수</span><span className="text-[#d9d0f3]">{player.meta.essence || 0}</span></div>
                    <div className="flex justify-between"><span>계승 단계</span><span className="text-[#f6e7c8]">{player.meta.rank || 0}</span></div>
                    <div className="flex justify-between"><span>추가 공격력</span><span className="text-rose-300">+{player.meta.bonusAtk || 0}</span></div>
                    <div className="flex justify-between"><span>추가 생명</span><span className="text-emerald-100">+{player.meta.bonusHp || 0}</span></div>
                </div>
            )}

            {stats?.activeSynergies?.length > 0 && (
                <div className="space-y-1.5">
                    <div className="text-xs text-slate-400 font-fira uppercase tracking-[0.16em] flex items-center gap-1.5">
                        <Sparkles size={10} /> 유물 시너지
                    </div>
                    {/* cycle 396: syn.name → syn.label — RELIC_SYNERGIES entry는 `label` 필드.
                          기존 syn.name은 항상 undefined로 React key 충돌 + UI 빈 칸 silent 결손. */}
                    {stats.activeSynergies.map((syn: any) => (
                        <div key={syn.label} className="rounded-[0.95rem] border border-fuchsia-400/20 bg-fuchsia-900/10 px-2.5 py-1.5 flex items-center justify-between gap-2">
                            <span className="text-[11px] font-fira text-fuchsia-200/90 font-bold">{syn.label}</span>
                            <span className="text-[8px] font-fira text-fuchsia-300/60">{syn.desc}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default StatsPanel;
