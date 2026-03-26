import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { RELICS } from '../data/relics';
import { TRAIT_DEFINITIONS } from '../data/traits';
import { getRunBuildProfile } from '../utils/runProfile';

/** 아키타입별 추천 유물 효과 목록 (우선순위 순) */
const BUILD_RELIC_HINTS = {
    crusher:  ['double_strike', 'execute_bonus', 'ancient_power', 'combo_stack', 'low_hp_atk'],
    dual:     ['double_strike', 'combo_stack', 'execute_bonus', 'armor_pen', 'ancient_power'],
    fortress: ['fortress', 'reflect', 'stone_skin', 'battle_start_heal', 'crit_block'],
    arcane:   ['skill_mult', 'free_skill', 'mp_regen_turn', 'skill_lifesteal', 'crit_mp_regen'],
    explorer: ['drop_rate', 'gold_mult', 'event_chance', 'boss_hunter', 'exp_mult'],
    risk:     ['low_hp_atk', 'execute_bonus', 'ancient_power', 'death_save', 'double_strike'],
    status:   ['dot_mult', 'armor_pen', 'execute_bonus', 'skill_mult', 'ancient_power'],
    balanced: ['battle_start_heal', 'stone_skin', 'gold_mult', 'exp_mult', 'ancient_power'],
};

const RARITY_COLOR = {
    common:    'text-slate-400',
    uncommon:  'text-cyan-400',
    rare:      'text-purple-400',
    epic:      'text-yellow-400',
    legendary: 'text-red-400',
};

const RARITY_LABEL = {
    common: '일반', uncommon: '고급', rare: '희귀', epic: '영웅', legendary: '전설',
};

const getRecommendedRelics = (primaryId, ownedRelicEffects) => {
    const hints = BUILD_RELIC_HINTS[primaryId] || BUILD_RELIC_HINTS.balanced;
    const owned = new Set(ownedRelicEffects);
    // Filter relics matching hint effects, not already owned
    const candidates = hints
        .flatMap((effect) => RELICS.filter((r) => r.effect === effect && !owned.has(r.effect)))
        .filter((r, idx, arr) => arr.findIndex((x) => x.id === r.id) === idx); // dedupe
    return candidates.slice(0, 4);
};

/**
 * BuildAdvicePanel — 현재 빌드 아키타입 기반 유물 + 스킬 추천
 * 맵 탭 하단에 배치됩니다.
 */
const BuildAdvicePanel = ({ player, compact = false }) => {
    const [open, setOpen] = useState(false);

    const profile = useMemo(() => getRunBuildProfile(player || {}), [player]);
    const primaryId = profile?.primary?.id || 'balanced';
    const trait = TRAIT_DEFINITIONS[primaryId] || TRAIT_DEFINITIONS.balanced;
    const ownedEffects = (player?.relics || []).map((r) => r.effect);
    const recommended = useMemo(
        () => getRecommendedRelics(primaryId, ownedEffects),
        [primaryId, ownedEffects]
    );

    return (
        <div className="bg-black/18 border border-white/8 rounded-[1rem] overflow-hidden">
            {/* 헤더 토글 */}
            <button
                onClick={() => setOpen((o) => !o)}
                className={`w-full flex items-center justify-between font-fira text-slate-400/76 hover:text-slate-200 hover:bg-white/[0.03] transition-colors ${compact ? 'px-2 py-1.5 text-[10px]' : 'px-3 py-2.5 text-xs'}`}
            >
                <span className={`flex items-center ${compact ? 'gap-1.5 tracking-[0.14em]' : 'gap-2 tracking-widest'} uppercase`}>
                    <span className={trait.accent}>◈</span>
                    {compact ? 'Build' : '빌드 조언 —'} <span className={`font-bold ${trait.accent}`}>{trait.title}</span>
                </span>
                {compact && !open ? (
                    <span className="text-[9px] text-slate-500">열기</span>
                ) : open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>

            {open && (
                <div className={`border-t border-white/8 ${compact ? 'space-y-2 px-2 pb-2' : 'space-y-3 px-3 pb-3'}`}>
                    {/* 아키타입 요약 */}
                    <div className={`mt-2 rounded-[0.95rem] border ${compact ? 'px-2 py-1.25' : 'px-3 py-2'} ${trait.chipClass}`}>
                        <div className="text-[10px] uppercase tracking-widest opacity-60 mb-0.5">현재 아키타입</div>
                        <div className={`font-bold ${compact ? 'text-[13px]' : 'text-sm'}`}>{trait.name} — {trait.title}</div>
                        <div className="text-[10px] opacity-75 mt-0.5">{compact ? trait.passiveLabel : trait.desc}</div>
                        {!compact && <div className="text-[10px] opacity-60 mt-1">패시브: {trait.passiveLabel}</div>}
                    </div>

                    {/* 성향 스킬 */}
                    {trait.skill && (
                        <div>
                            <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">성향 스킬</div>
                            <div className={`rounded-[0.95rem] border border-[#9a8ac0]/20 bg-[#9a8ac0]/10 ${compact ? 'px-2 py-1.25' : 'px-3 py-2'}`}>
                                <div className="flex items-center justify-between gap-2 mb-0.5">
                                    <span className={`${compact ? 'text-[13px]' : 'text-sm'} font-bold text-[#e3dcff]`}>{trait.skill.name}</span>
                                    <span className="text-[10px] text-slate-400/72">MP {trait.skill.mp} · CD {trait.skill.cooldown}</span>
                                </div>
                                {!compact && <div className="text-[10px] text-slate-300/76">{trait.skill.desc}</div>}
                            </div>
                        </div>
                    )}

                    {/* 추천 유물 */}
                    <div>
                        <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">추천 유물 (미보유)</div>
                        {recommended.length === 0 ? (
                            <div className="text-[10px] text-slate-500 italic">이 빌드와 맞는 유물을 모두 보유 중입니다.</div>
                        ) : (
                            <div className={compact ? 'space-y-1' : 'space-y-1.5'}>
                                {recommended.map((relic) => (
                                    <div key={relic.id} className={`rounded-[0.95rem] border border-white/8 bg-black/18 ${compact ? 'px-2 py-1.25' : 'px-2.5 py-2'}`}>
                                        <div className="flex items-center justify-between gap-2">
                                            <span className={`text-xs font-bold ${RARITY_COLOR[relic.rarity] || 'text-slate-300'}`}>{relic.name}</span>
                                            <span className={`text-[9px] font-fira ${RARITY_COLOR[relic.rarity] || 'text-slate-400'}`}>{RARITY_LABEL[relic.rarity]}</span>
                                        </div>
                                        {!compact && <div className="text-[10px] text-slate-400/72 mt-0.5">{relic.desc}</div>}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* 보스 공략 팁 */}
                    <div className={`rounded-[0.95rem] border border-[#d5b180]/20 bg-[#d5b180]/10 ${compact ? 'px-2 py-1.25' : 'px-2.5 py-2'}`}>
                        <div className="text-[10px] text-[#f6e7c8]/68 uppercase tracking-wider mb-0.5">보스 전략</div>
                        <div className="text-[10px] text-[#f6e7c8]/86">{trait.bossDirective}</div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BuildAdvicePanel;
