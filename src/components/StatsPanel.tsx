import { Fragment, useMemo } from 'react';
import { motion as Motion } from 'framer-motion';
import { Activity, BarChart3, ChevronDown, Coins, Compass, Flame, FlaskConical, Footprints, Hammer, Heart, Link2, Shield, Skull, Sparkles, Sword, Target, TrendingUp, Zap } from 'lucide-react';
import type { FullStats, Player, Relic } from '../types/index.js';
import { getTraitPassiveParts, getTraitProfile } from '../utils/runProfileUtils';
import { formatRelicText, getRelicDisplayName } from '../utils/relicPresentation';
import { formatEventText } from '../utils/eventPresentation';
import { formatSynergyDrawback } from '../utils/relicSynergyHint';
import SignalChip from './archive/SignalChip';
import { MSG } from '../data/messages';
import { BALANCE, RARITY_CLASSES } from '../data/constants';
import { getPrestigeUnlocks } from '../systems/prestigeUnlocks';
import { countOwnedRelics } from '../systems/chaosHeart';
import RelicIcon from './icons/RelicIcon';
import { getMetaBonusRamp } from '../systems/metaBonusRamp';
import { countDiscoveredMaps } from '../utils/discoveredMaps';
import { ELITE_TITLE_MAPS, sumEliteTitleBonus } from '../utils/eliteTitles';
import { formatPermanentStatBonus, readStoryStatBonus } from '../utils/permanentStatSources';

// cycle 475: 컴팩트 prop 인터페이스 제거 — cycle 471이 Dashboard callsite 전달
//   제거 후 caller 0건. cascade로 토글 상태 / 가지 ternary / 토글 버튼 일괄 정리.
interface StatsPanelProps {
    player?: Player | null;
    stats?: FullStats | null;
}

/**
 * Signature 세트 tone → 색상 매핑.
 * EquipmentPanel.jsx의 SIG_SET_TONE과 동일한 팔레트 — 시각적 일관성 유지.
 */
// cycle 411: frost / arcane 제거 — signatureSets.json sets는 fire/holy/nature/shadow
//   4 tone만 emit. activeSignatureSet.tone / setProgress.tone 모두 동일 데이터 source라
//   frost / arcane lookup 절대 hit 안 됨 (cycle 358 steel 동일 lens).
const SIG_SET_TONE: Record<string, { border: string; glow: string; text: string }> = Object.freeze({
    holy: { border: 'rgb(var(--aether-sig-holy-rgb) / 0.42)', glow: 'rgb(var(--aether-sig-holy-rgb) / 0.12)', text: 'rgb(var(--aether-sig-holy-rgb))' },
    fire: { border: 'rgb(var(--aether-sig-fire-rgb) / 0.42)', glow: 'rgb(var(--aether-sig-fire-rgb) / 0.12)', text: 'rgb(var(--aether-sig-fire-rgb))' },
    shadow: { border: 'rgb(var(--aether-sig-shadow-rgb) / 0.42)', glow: 'rgb(var(--aether-sig-shadow-rgb) / 0.12)', text: 'rgb(var(--aether-sig-shadow-rgb))' },
    nature: { border: 'rgb(var(--aether-sig-nature-rgb) / 0.42)', glow: 'rgb(var(--aether-sig-nature-rgb) / 0.12)', text: 'rgb(var(--aether-sig-nature-rgb))' },
});

/**
 * multiplier → 퍼센트 레이블 (1.18 → "+18%", 0.9 → "-10%"). 1.0 근처는 "—".
 * @param {number} mult
 * @returns {string}
 */
const formatMultDelta = (mult: number) => {
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

    // 2026-10 Wave 72: 영구 원천 — 이야기 보상(영구로 전환)과 정예 목격 칭호(모은 만큼 합산)의 원래 양. 아래 레벨 비례 줄이 함께 설명한다.
    const storyBonus = useMemo(() => readStoryStatBonus(player?.storyStatBonus), [player?.storyStatBonus]);
    const eliteTitleTotal = useMemo(() => sumEliteTitleBonus(player?.titles), [player?.titles]);

    const trait = useMemo(() => stats?.traitProfile || (player ? getTraitProfile(player, stats) : null), [player, stats]);
    const passiveParts = useMemo(() => getTraitPassiveParts(trait), [trait]);
    // 소유자 결정 2026-10-26 D28: 패시브는 항목("방어력 +4%")마다 한 덩어리로 줄을 넘긴다 — 한 줄에 이어 쓰던 동안
    //   402px에서 "+4%"만 다음 줄로 떨어졌다. 수치 조각이 없는 성향은 데이터 문구를 같은 구분자로 나눈다.
    const passiveSegments = useMemo(() => (
        passiveParts.length > 0 ? passiveParts : String(trait?.passiveLabel || '').split(' / ').filter(Boolean)
    ), [passiveParts, trait]);
    // 소유자 결정 2026-10-26 D2: 보유 유물 목록은 설정 탭에서 이 능력치 탭으로 옮겼다(펼친 채로 보인다).
    const relics = useMemo<Relic[]>(() => player?.relics || [], [player?.relics]);
    const relicCapacity = getPrestigeUnlocks(player?.meta?.prestigeRank).maxRelics;

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
        { label: '총 처치', value: overview.kills, icon: Sword, color: 'text-ae-threat' },
        { label: '사망', value: overview.deaths, icon: Skull, color: 'text-ae-ink-2' },
        { label: '보스 처치', value: overview.bossKills, icon: Target, color: 'text-ae-exp' },
        { label: '현상수배 완료', value: overview.bountiesCompleted, icon: Target, color: 'text-ae-ether' },
        { label: '처치/사망', value: kd, icon: Shield, color: 'text-ae-good' },
        { label: '누적 골드', value: overview.totalGold.toLocaleString(), icon: Coins, color: 'text-ae-gold' },
        { label: '레벨', value: player?.level || 1, icon: Activity, color: 'text-ae-ether' },
        { label: '탐험 횟수', value: player?.stats?.explores || 0, icon: Compass, color: 'text-ae-ether' },
        // cycle 83: 'discoveries' 시맨틱 통일 — visitedMaps.length(맵 발견 수).
        // 기존엔 stats.discoveries(이벤트 카운터)를 읽어 ach_discover_*("새 지역 N곳") /
        // 타이틀 cartographer("지도 제작자") 의도와 어긋났음. 모든 surface가 맵 발견 수로 일치.
        { label: '발견 지역', value: countDiscoveredMaps(player?.stats), icon: Sparkles, color: 'text-ae-exp' },
        { label: '휴식 횟수', value: player?.stats?.rests || 0, icon: TrendingUp, color: 'text-ae-good' },
        // cycle 80: ESCAPES — cycle 74-78에서 통합한 도주 카운터를 stats panel에도 노출.
        { label: '도주 횟수', value: player?.stats?.escapes || 0, icon: Footprints, color: 'text-ae-ether-hi' },
        // cycle 82: CRAFTS / SYNTHESES — 제작/합성 누적도 stats panel에 노출.
        // crafts는 INITIAL_STATE에 있었으나 syntheses는 누락되어 같이 선언적 추가.
        // achievement 'synths'(target='synths' → stats.syntheses) 3종이 cycle 30+부터
        // 존재하던 갭을 가시화로 닫음. orange/amber 톤으로 제작 계열 묶음.
        { label: '제작 횟수', value: player?.stats?.crafts || 0, icon: Hammer, color: 'text-ae-gold-lo' },
        { label: '합성 성공', value: player?.stats?.syntheses || 0, icon: FlaskConical, color: 'text-ae-gold-hi' },
        // cycle 96: MAX STREAK — cycle 95에서 추가한 stats.maxKillStreak를 stats panel에도
        // 노출. killStreak 시스템 톤(red)과 매치. berserker 칭호 진행도 시각화.
        { label: '최대 연속 처치', value: player?.stats?.maxKillStreak || 0, icon: Flame, color: 'text-ae-threat' },
        // cycle 104: CHAINS — cycle 102/103 ach_chain_*/chain_master 칭호 진행도 가시화.
        // chain_master 칭호 톤(indigo)과 매치. exploreFlow.checkDiscoveryChains에서 누적.
        { label: '완료한 발견 여정', value: (player?.stats?.discoveryChains || []).length, icon: Link2, color: 'text-ae-exp' },
    ];
    const coreRecordLabels = new Set(['레벨', '총 처치', '보스 처치', '최대 연속 처치']);
    const coreRecordEntries = statEntries.filter((entry) => coreRecordLabels.has(entry.label));
    const detailRecordEntries = statEntries.filter((entry) => !coreRecordLabels.has(entry.label));

    return (
        <div data-testid="stats-panel" className="space-y-3 pb-2">
            <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-1">
                <div className="min-w-0">
                    <div className="ae-eyebrow flex items-center gap-1.5">
                        <BarChart3 size={13} aria-hidden="true" /> 모험 기록
                    </div>
                    <h3 className="mt-0.5 text-[15px] font-readable font-bold text-ae-ink">현재 성장과 누적 기록</h3>
                </div>
                <SignalChip tone="resonance" className="shrink-0">레벨 <span className="font-fira tabular-nums">{player?.level || 1}</span></SignalChip>
            </header>

            {/* H5(b): trait은 player/stats가 모두 없을 때 null이 될 수 있다 —
                이전에는 trait! 단언으로 8곳을 무방비로 읽었다. 성향을 알 수 없으면
                이 구획만 생략하고 누적 기록은 그대로 보여 준다. */}
            {trait && (
                <section data-testid="stats-current-growth" className="ae-card p-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                        <div className="flex min-w-0 items-center gap-2">
                            <Sparkles size={14} aria-hidden="true" className="shrink-0 text-ae-gold" />
                            <div className="min-w-0">
                                <div className="ae-eyebrow">현재 성장</div>
                                <div className={`text-[15px] font-readable font-bold ${trait.accent}`}>{trait.name}</div>
                            </div>
                        </div>
                        <SignalChip tone="resonance" className="shrink-0">{trait.title}</SignalChip>
                    </div>

                    <div className="ae-well ae-cols mt-3 grid grid-cols-2">
                        <div className="px-3 py-2.5">
                            <div className="flex items-center gap-1 text-[11px] font-readable text-ae-ink-3">
                                <Zap size={12} aria-hidden="true" /> 전용 기술
                            </div>
                            <div className="mt-1 text-[13px] font-readable font-bold text-ae-good">
                                {trait.skill?.name || '없음'}
                            </div>
                        </div>
                        <div className="px-3 py-2.5">
                            <div className="flex items-center gap-1 text-[11px] font-readable text-ae-ink-3">
                                <Shield size={12} aria-hidden="true" /> 패시브
                            </div>
                            <div className="mt-1 text-[13px] font-readable font-bold text-ae-ink">
                                {/* 구분자는 앞 항목에 붙인다 — 줄이 넘어가도 '/'만 홀로 한 줄을 차지하지 않는다. */}
                                {passiveSegments.map((part, index) => (
                                    <Fragment key={part}>
                                        {index > 0 && ' '}
                                        <span data-testid="stats-passive-part" className="whitespace-nowrap">
                                            {index < passiveSegments.length - 1 ? `${part} /` : part}
                                        </span>
                                    </Fragment>
                                ))}
                            </div>
                        </div>
                    </div>

                    <p className="mt-3 text-[13px] font-readable leading-relaxed text-ae-ink-2">{trait.desc}</p>
                    <div className="ae-rows mt-3 border-t border-ae-ink/10 text-[12px] font-readable">
                        <div className="flex items-start gap-2 py-2">
                            <span className="w-16 shrink-0 font-semibold text-ae-gold-text">다음 성장</span>
                            <span className="text-ae-ink-2">{trait.rewardFocus}</span>
                        </div>
                        <div className="flex items-start gap-2 py-2">
                            <span className="w-16 shrink-0 font-semibold text-ae-ether-hi">추천 임무</span>
                            <span className="text-ae-ink-2">{trait.questFocus}</span>
                        </div>
                    </div>
                </section>
            )}

            {activeSignatureSet && sigSetTone && (
                <div
                    data-testid="stats-active-signature-set"
                    data-signature-set-key={activeSignatureSet.key}
                    className="ae-card space-y-2 p-3.5"
                    style={{ boxShadow: `var(--aether-e1), inset 0 0 0 1px ${sigSetTone.border}` }}
                >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-1.5">
                            <Sparkles size={13} aria-hidden="true" style={{ color: sigSetTone.text }} />
                            <span
                                className="font-display text-[14px] font-bold"
                                style={{ color: sigSetTone.text }}
                            >
                                {activeSignatureSet.name}
                            </span>
                        </div>
                        <span
                            className="ae-chip shrink-0"
                            style={{ color: sigSetTone.text, boxShadow: `inset 0 0 0 1px ${sigSetTone.border}`, background: sigSetTone.glow }}
                        >
                            <span className="font-fira tabular-nums">{activeSignatureSet.tier}</span>세트 활성
                        </span>
                    </div>
                    {activeSignatureSet.desc && (
                        <div className="text-[12px] font-readable leading-relaxed text-ae-ink-2">
                            {activeSignatureSet.desc}
                        </div>
                    )}
                    <div className="ae-well ae-cols grid grid-cols-3">
                        <div className="px-2.5 py-2">
                            <div className="flex items-center gap-1 text-[11px] font-readable text-ae-ink-3">
                                <Sword size={11} aria-hidden="true" /> 공격력
                            </div>
                            <div className="mt-0.5 font-fira text-[13px] font-bold tabular-nums" style={{ color: sigSetTone.text }}>
                                {formatMultDelta(activeSignatureSet.atkMult)}
                            </div>
                        </div>
                        <div className="px-2.5 py-2">
                            <div className="flex items-center gap-1 text-[11px] font-readable text-ae-ink-3">
                                <Shield size={11} aria-hidden="true" /> 방어력
                            </div>
                            <div className="mt-0.5 font-fira text-[13px] font-bold tabular-nums" style={{ color: sigSetTone.text }}>
                                {formatMultDelta(activeSignatureSet.defMult)}
                            </div>
                        </div>
                        <div className="px-2.5 py-2">
                            <div className="flex items-center gap-1 text-[11px] font-readable text-ae-ink-3">
                                <Heart size={11} aria-hidden="true" /> 생명
                            </div>
                            <div className="mt-0.5 font-fira text-[13px] font-bold tabular-nums" style={{ color: sigSetTone.text }}>
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
                    className="ae-card is-quiet space-y-1 px-3.5 py-3"
                >
                    <div className="flex min-w-0 items-center gap-1.5">
                        <Sparkles size={12} aria-hidden="true" className="shrink-0 text-ae-gold" />
                        <span className="text-[13px] font-readable font-bold text-ae-gold-text">
                            {activeSet.prefix} 세트
                        </span>
                    </div>
                    {activeSet.desc && (
                        <div className="text-[12px] font-readable leading-relaxed text-ae-ink-2">
                            {formatEventText(activeSet.desc)}
                        </div>
                    )}
                </div>
            )}

            {(stats?.activeSynergies?.length ?? 0) > 0 && (
                <section data-testid="stats-active-synergies" className="ae-card is-quiet px-3.5 py-3">
                    <div className="mb-1 flex items-center gap-1.5 text-[13px] font-readable font-bold text-ae-ink">
                        <Sparkles size={13} aria-hidden="true" className="text-ae-exp" /> 활성 유물 조합
                    </div>
                    <div className="ae-rows">
                        {stats!.activeSynergies.map((syn) => (
                            <div key={syn.label} className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 py-2">
                                <span className="shrink-0 text-[12px] font-readable font-bold text-ae-exp">{syn.label}</span>
                                <span className="min-w-0 flex-[1_1_10rem] text-right text-[12px] font-readable leading-relaxed text-ae-ink-2">
                                    {formatRelicText(syn.desc)}
                                    <span data-testid="stats-synergy-drawback" className="block text-ae-threat">
                                        {MSG.RELIC_SYNERGY_DRAWBACK_LINE(formatSynergyDrawback(syn))}
                                    </span>
                                </span>
                            </div>
                    ))}
                    </div>
                </section>
            )}

            {relics.length > 0 && (
                <section data-testid="stats-relic-section" className="ae-card is-quiet px-3.5 py-3">
                    <div className="mb-1 flex items-center gap-1.5 text-[13px] font-readable font-bold text-ae-ink">
                        <Sparkles size={13} aria-hidden="true" className="text-ae-ether" />
                        <span data-testid="stats-relic-title" className="font-fira tabular-nums">{MSG.STATS_RELIC_TITLE(countOwnedRelics(relics), relicCapacity)}</span>
                    </div>
                    <p className="font-readable aether-type-meta leading-snug text-ae-ink-3">{MSG.STATS_RELIC_DESC}</p>
                    <div data-testid="stats-relic-list" className="ae-rows mt-1">
                        {relics.map((relic) => (
                            <div key={relic.id} data-testid="stats-relic-row" className="flex items-center gap-3 py-2.5">
                                <RelicIcon relic={relic} size={42} />
                                <div className="min-w-0 flex-1">
                                    <div className={`font-readable aether-type-body font-bold ${RARITY_CLASSES[relic.rarity ?? ''] || 'text-ae-ink'}`}>
                                        {getRelicDisplayName(relic.name)}
                                        {relic.borrowed && (
                                            <span data-testid="stats-relic-borrowed" className="ae-chip ml-2 align-middle">
                                                {MSG.CHAOS_HEART_BORROWED_TAG}
                                            </span>
                                        )}
                                    </div>
                                    <p className="mt-1 font-readable aether-type-meta leading-snug text-ae-ink-2">{formatRelicText(relic.desc)}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            <section data-testid="stats-core-records">
                <div className="mb-2 flex items-center gap-1.5 px-1 text-[13px] font-readable font-bold text-ae-ink">
                    <Activity size={13} aria-hidden="true" className="text-ae-ether" /> 핵심 기록
                </div>
                <div className="grid grid-cols-2 gap-2">
                    {coreRecordEntries.map((entry) => {
                        const Icon = entry.icon;
                        return (
                            <div key={entry.label} className="ae-card is-quiet px-3.5 py-3">
                                <div className="flex items-center gap-1 text-[11px] font-readable text-ae-ink-3">
                                    <Icon size={12} aria-hidden="true" className={entry.color} /> {entry.label}
                                </div>
                                <div className="mt-1 font-fira text-[17px] font-bold tabular-nums text-ae-ink">{entry.value}</div>
                            </div>
                        );
                    })}
                </div>
            </section>

            <div className="ae-card is-quiet ae-rows px-3.5">
                <details data-testid="stats-lifetime-records" className="group">
                    <summary className="flex min-h-14 cursor-pointer list-none items-center gap-2 py-2 font-readable [&::-webkit-details-marker]:hidden">
                        <BarChart3 size={14} aria-hidden="true" className="text-ae-gold" />
                        <span className="flex-1 text-[13px] font-bold text-ae-ink">세부 기록</span>
                        <span className="text-[12px] text-ae-ink-3"><span className="font-fira tabular-nums">{detailRecordEntries.length}</span>개</span>
                        <ChevronDown size={16} aria-hidden="true" className="text-ae-ink-3 transition-transform duration-200 ease-[cubic-bezier(.2,.8,.2,1)] group-open:rotate-180 motion-reduce:transition-none" />
                    </summary>
                    <div className="ae-rows pb-2">
                        {detailRecordEntries.map((entry) => {
                            const Icon = entry.icon;
                            return (
                                <div key={entry.label} className="flex items-center justify-between gap-3 py-2">
                                    <div className="flex min-w-0 items-center gap-1.5 text-[12px] font-readable text-ae-ink-2">
                                        <Icon size={13} aria-hidden="true" className={`shrink-0 ${entry.color}`} /> {entry.label}
                                    </div>
                                    <div className="shrink-0 font-fira text-[13px] font-bold tabular-nums text-ae-ink">{entry.value}</div>
                                </div>
                            );
                        })}
                    </div>
                </details>

                <details data-testid="stats-top-kills" className="group">
                    <summary className="flex min-h-14 cursor-pointer list-none items-center gap-2 py-2 font-readable [&::-webkit-details-marker]:hidden">
                        <Sword size={14} aria-hidden="true" className="text-ae-threat" />
                        <span className="flex-1 text-[13px] font-bold text-ae-ink">처치 분포</span>
                        <span className="text-[12px] text-ae-ink-3">상위 <span className="font-fira tabular-nums">{topKills.length}</span>종</span>
                        <ChevronDown size={16} aria-hidden="true" className="text-ae-ink-3 transition-transform duration-200 ease-[cubic-bezier(.2,.8,.2,1)] group-open:rotate-180 motion-reduce:transition-none" />
                    </summary>
                    <div className="space-y-2.5 pb-4">
                        {topKills.length === 0 && (
                            <p className="text-[12px] font-readable text-ae-ink-3">아직 처치 기록이 없습니다.</p>
                        )}
                        {topKills.map(([name, count], i) => (
                            <Motion.div
                                key={name}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: i * 0.03, duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
                                className="flex flex-wrap items-center gap-x-2 gap-y-1"
                            >
                                <span className="min-w-[5rem] max-w-full text-[12px] font-readable text-ae-ink-2">{name}</span>
                                <div className="h-2 min-w-[6rem] flex-1 overflow-hidden rounded-full bg-ae-sunk">
                                    <Motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${(count / maxKill) * 100}%` }}
                                        transition={{ duration: 0.32, delay: i * 0.03, ease: [0.2, 0.8, 0.2, 1] }}
                                        className="h-full rounded-full bg-ae-threat/70"
                                    />
                                </div>
                                <span className="w-8 text-right font-fira text-[12px] tabular-nums text-ae-ink-2">{count}</span>
                            </Motion.div>
                        ))}
                    </div>
                </details>

                <details data-testid="stats-legacy-records" className="group">
                    <summary className="flex min-h-14 cursor-pointer list-none items-center gap-2 py-2 font-readable [&::-webkit-details-marker]:hidden">
                        <Sparkles size={14} aria-hidden="true" className="text-ae-exp" />
                        <span className="flex-1 text-[13px] font-bold text-ae-ink">계승 기록</span>
                        <span className="text-[12px] text-ae-ink-3">{MSG.STATS_ESSENCE_LADDER_RANK(player?.meta?.rank || 0)}</span>
                        <ChevronDown size={16} aria-hidden="true" className="text-ae-ink-3 transition-transform duration-200 ease-[cubic-bezier(.2,.8,.2,1)] group-open:rotate-180 motion-reduce:transition-none" />
                    </summary>
                    <div className="grid grid-cols-2 gap-2 pb-3 text-[12px] font-readable">
                        <div className="ae-well px-3 py-2.5">
                            <div className="text-[11px] text-ae-ink-3">계승 정수</div>
                            <div className="mt-1 font-fira text-[15px] font-bold tabular-nums text-ae-exp">{player?.meta?.essence || 0}</div>
                        </div>
                        <div className="ae-well px-3 py-2.5">
                            <div className="text-[11px] text-ae-ink-3">{MSG.STATS_ESSENCE_LADDER_LABEL}</div>
                            <div className="mt-1 font-fira text-[15px] font-bold tabular-nums text-ae-gold-text">{player?.meta?.rank || 0}</div>
                        </div>
                        <div className="ae-well px-3 py-2.5">
                            <div className="text-[11px] text-ae-ink-3">추가 공격력</div>
                            <div className="mt-1 font-fira text-[15px] font-bold tabular-nums text-ae-ink">+{player?.meta?.bonusAtk || 0}</div>
                        </div>
                        <div className="ae-well px-3 py-2.5">
                            <div className="text-[11px] text-ae-ink-3">추가 생명</div>
                            <div className="mt-1 font-fira text-[15px] font-bold tabular-nums text-ae-life">+{player?.meta?.bonusHp || 0}</div>
                        </div>
                        <div data-testid="stats-story-bonus" className="ae-well col-span-2 px-3 py-2.5">
                            <div className="text-[11px] text-ae-ink-3">{MSG.STATS_STORY_BONUS_LABEL}</div>
                            <div className="mt-1 font-bold text-ae-gold-text">{formatPermanentStatBonus(storyBonus) || MSG.STATS_PERMANENT_NONE}</div>
                        </div>
                        <div data-testid="stats-elite-titles" className="ae-well col-span-2 px-3 py-2.5">
                            <div className="text-[11px] text-ae-ink-3">{MSG.STATS_ELITE_TITLE_LABEL(eliteTitleTotal.count, ELITE_TITLE_MAPS.length)}</div>
                            <div className="mt-1 font-bold text-ae-gold-text">{formatPermanentStatBonus(eliteTitleTotal) || MSG.STATS_PERMANENT_NONE}</div>
                        </div>
                        <p data-testid="stats-meta-ramp" className="col-span-2 text-[12px] text-ae-ink-3">
                            {MSG.STATS_META_RAMP(Math.round(getMetaBonusRamp(player?.level) * 100), BALANCE.META_BONUS_FULL_LEVEL)}
                        </p>
                    </div>
                </details>
            </div>
        </div>
    );
};

export default StatsPanel;
