import { AT } from '../reducers/actionTypes';
import { RARITY_COLORS } from '../data/titles';
import SignalBadge from './SignalBadge';

/**
 * 유물 시너지 점수 계산 (0~100)
 * 현재 보유 유물과 새 유물의 effect 조합을 분석합니다.
 */
const SYNERGY_MAP = {
    // 공격 콤보
    double_strike: ['execute_bonus', 'combo_stack', 'armor_pen', 'ancient_power'],
    execute_bonus: ['double_strike', 'low_hp_atk', 'combo_stack'],
    combo_stack: ['double_strike', 'execute_bonus', 'ancient_power'],
    ancient_power: ['double_strike', 'combo_stack', 'execute_bonus'],
    low_hp_atk: ['execute_bonus', 'death_save', 'void_heart'],
    // 스킬/마법 콤보
    skill_lifesteal: ['skill_mult', 'free_skill', 'mp_regen_turn', 'crit_mp_regen'],
    skill_mult: ['skill_lifesteal', 'free_skill', 'mp_regen_turn'],
    free_skill: ['skill_mult', 'skill_lifesteal', 'mp_regen_turn', 'crit_mp_regen'],
    mp_regen_turn: ['skill_mult', 'skill_lifesteal', 'free_skill', 'crit_mp_regen'],
    crit_mp_regen: ['skill_mult', 'free_skill', 'mp_regen_turn', 'ancient_power'],
    // 방어/생존 콤보
    reflect: ['fortress', 'stone_skin', 'crit_block'],
    fortress: ['reflect', 'stone_skin', 'battle_start_heal'],
    death_save: ['void_heart', 'low_hp_atk', 'battle_start_heal'],
    void_heart: ['death_save', 'low_hp_atk'],
    // DoT 콤보
    dot_mult: ['armor_pen', 'execute_bonus'],
    // 탐색/범용
    gold_mult: ['drop_rate', 'boss_hunter'],
    drop_rate: ['gold_mult', 'boss_hunter', 'exp_mult'],
    boss_hunter: ['drop_rate', 'execute_bonus', 'double_strike'],
};

const getRelicSynergyScore = (newRelic, ownedRelics = []) => {
    if (!ownedRelics.length) return { score: 0, label: null, synergies: [] };
    const ownedEffects = ownedRelics.map(r => r.effect);
    const synergyEffects = SYNERGY_MAP[newRelic.effect] || [];
    const matches = ownedEffects.filter(e => synergyEffects.includes(e));
    // 또한 소유한 유물이 newRelic을 시너지로 언급하는지 체크
    ownedEffects.forEach(e => {
        if ((SYNERGY_MAP[e] || []).includes(newRelic.effect) && !matches.includes(e)) matches.push(e);
    });

    if (!matches.length) return { score: 0, label: null, synergies: [] };
    const score = Math.min(100, matches.length * 40);
    const label = score >= 80 ? '완벽한 시너지' : score >= 40 ? '좋은 시너지' : '약한 시너지';
    const synergyNames = ownedRelics.filter(r => matches.includes(r.effect)).map(r => r.name);
    return { score, label, synergies: synergyNames };
};

const RARITY_CARD = {
    common:    'border-white/10 bg-black/18 hover:border-white/16 hover:bg-white/[0.045]',
    uncommon:  'border-[#7dd4d8]/22 bg-[#7dd4d8]/10 hover:border-[#7dd4d8]/28 hover:bg-[#7dd4d8]/14',
    rare:      'border-[#9a8ac0]/24 bg-[#9a8ac0]/10 hover:border-[#9a8ac0]/32 hover:bg-[#9a8ac0]/14',
    epic:      'border-[#d5b180]/24 bg-[#d5b180]/10 hover:border-[#d5b180]/32 hover:bg-[#d5b180]/15',
    legendary: 'border-rose-300/22 bg-rose-400/10 hover:border-rose-300/30 hover:bg-rose-400/14',
};

const RARITY_LABEL = {
    common:    '일반',
    uncommon:  '고급',
    rare:      '희귀',
    epic:      '영웅',
    legendary: '전설',
};

const RARITY_BADGE_TONE = {
    common: 'neutral',
    uncommon: 'recommended',
    rare: 'resonance',
    epic: 'upgrade',
    legendary: 'danger',
};

/**
 * RelicChoicePanel — 유물 3지선다 선택 오버레이
 * `pendingRelics` 가 null 이 아닐 때 ControlPanel 위에 표시됨
 */
const RelicChoicePanel = ({ pendingRelics, dispatch, player }) => {
    if (!pendingRelics || pendingRelics.length === 0) return null;

    const ownedRelics = player?.relics || [];

    const handleSelect = (relic) => {
        dispatch({ type: AT.ADD_RELIC, payload: relic });
    };

    const handleDecline = () => {
        dispatch({ type: AT.DECLINE_RELIC });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,8,12,0.84)_0%,rgba(7,10,15,0.92)_100%)] backdrop-blur-[12px]" />
            <div
                className="pointer-events-none absolute inset-0 opacity-70"
                style={{ backgroundImage: 'radial-gradient(circle at top left, rgba(213,177,128,0.12), transparent 30%), radial-gradient(circle at bottom right, rgba(125,212,216,0.08), transparent 24%)' }}
            />
            <div className="panel-noise aether-surface-strong relative mx-4 w-full max-w-3xl overflow-hidden rounded-[2rem] p-5 shadow-[0_34px_90px_rgba(1,6,14,0.6)] md:p-6">
                <div className="pointer-events-none absolute inset-0 opacity-60" style={{ backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.04), transparent 24%), radial-gradient(circle at top right, rgba(154,138,192,0.1), transparent 26%)' }} />

                <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                        <div className="text-[10px] font-fira uppercase tracking-[0.22em] text-slate-500">
                            Relic Archive
                        </div>
                        <h2 className="mt-1 text-[1.35rem] font-rajdhani font-bold tracking-[0.1em] text-[#f6e7c8]">
                            공명할 유물을 선택하세요
                        </h2>
                        <p className="mt-1 max-w-[32rem] text-[11px] font-fira leading-relaxed text-slate-300/76">
                            선택한 유물은 이번 런 동안 유지됩니다. 현재 보유 유물과의 시너지도 함께 참고할 수 있습니다.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        <SignalBadge tone="spotlight" size="sm">선택 1개</SignalBadge>
                        <SignalBadge tone="neutral" size="sm">보유 {ownedRelics.length}개</SignalBadge>
                    </div>
                </div>

                <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {pendingRelics.map((relic, index) => {
                        const synergy = getRelicSynergyScore(relic, ownedRelics);
                        const hasSynergy = synergy.score > 0;
                        return (
                        <button
                            key={relic.id}
                            data-testid={`relic-choice-${index}`}
                            onClick={() => handleSelect(relic)}
                            className={`
                                group flex min-h-[15rem] flex-col rounded-[1.35rem] border p-4 text-left
                                transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0
                                ${RARITY_CARD[relic.rarity] || RARITY_CARD.common}
                                ${hasSynergy ? 'shadow-[0_18px_34px_rgba(125,212,216,0.08)]' : 'shadow-[0_14px_26px_rgba(1,6,14,0.28)]'}
                            `}
                        >
                            <div className="flex items-start justify-between gap-2">
                                <SignalBadge tone={RARITY_BADGE_TONE[relic.rarity] || 'neutral'} size="sm">
                                    {RARITY_LABEL[relic.rarity] || relic.rarity}
                                </SignalBadge>
                                {hasSynergy && (
                                    <SignalBadge tone={synergy.score >= 80 ? 'success' : 'recommended'} size="sm">
                                        {synergy.label}
                                    </SignalBadge>
                                )}
                            </div>

                            <div className={`mt-4 text-[1.15rem] font-rajdhani font-bold leading-tight ${RARITY_COLORS[relic.rarity] || 'text-white'} group-hover:text-white`}>
                                {relic.name}
                            </div>

                            <div className="mt-2 text-[11px] font-fira leading-relaxed text-slate-200/82">
                                {relic.desc}
                            </div>

                            <div className="mt-auto pt-4">
                                {hasSynergy ? (
                                    <div className="rounded-[1rem] border border-white/8 bg-black/20 px-3 py-2.5 text-[10px] font-fira text-slate-300/82">
                                        <div className="uppercase tracking-[0.16em] text-slate-500">Linked Relics</div>
                                        <div className="mt-1 leading-relaxed text-[#dff7f5]">
                                            {synergy.synergies.join(' · ')}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="rounded-[1rem] border border-white/8 bg-black/16 px-3 py-2.5 text-[10px] font-fira text-slate-400/75">
                                        현재 보유 유물과 직접 공명하는 효과는 없습니다.
                                    </div>
                                )}
                            </div>
                        </button>
                    );})}
                </div>

                <div className="flex flex-col gap-3 border-t border-white/8 pt-4 text-center md:flex-row md:items-center md:justify-between">
                    <div className="text-[10px] font-fira leading-relaxed text-slate-400/72 md:text-left">
                        선택을 미루면 이번 기회는 지나갑니다. 유물이 부족한 빌드는 전투 후반 안정성이 크게 흔들릴 수 있습니다.
                    </div>
                    <button
                        data-testid="relic-choice-skip"
                        onClick={handleDecline}
                        className="min-h-[42px] rounded-full border border-white/8 bg-black/18 px-4 text-[10px] font-fira uppercase tracking-[0.18em] text-slate-300/76 transition-colors hover:bg-white/[0.04] hover:text-white"
                    >
                        이번 선택 건너뛰기
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RelicChoicePanel;
