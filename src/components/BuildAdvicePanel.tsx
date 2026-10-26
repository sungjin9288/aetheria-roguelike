import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Compass } from 'lucide-react';
import { MSG } from '../data/messages';
import { RELICS } from '../data/relics';
import { TRAIT_DEFINITIONS } from '../data/traits';
import { getRunBuildProfile } from '../utils/runProfile';
import { getRecommendedRelicsForBuild } from '../utils/relicBuildFit';
import type { FullStats, Player } from '../types/index.js';

// cycle 478: 컴팩트 prop 인터페이스 제거 — cycle 471이 Dashboard callsite 전달
//   제거 후 caller 0건. cascade로 19 ternary 가지 정리 (cycle 472-477 paired).
interface BuildAdvicePanelProps {
    player?: Player | null;
    stats?: FullStats | null;
}

/**
 * 현재 성장 방향에 맞는 유물과 기술을 추천합니다.
 * 맵 탭 하단에 배치됩니다.
 */
// cycle 452: 컴팩트 default 제거 — Dashboard 호출자가 명시 전달이라 도달 불가.
const BuildAdvicePanel = ({ player, stats }: BuildAdvicePanelProps) => {
    const [open, setOpen] = useState(false);

    const profile = useMemo(
        () => stats?.buildProfile || getRunBuildProfile(player || {}, stats || {}),
        [player, stats]
    );
    const primaryId = profile?.primary?.id || 'balanced';
    const trait = TRAIT_DEFINITIONS[primaryId] || TRAIT_DEFINITIONS.balanced;
    const ownedEffects = (player?.relics || []).map((r) => r.effect);
    const recommended = useMemo(
        () => getRecommendedRelicsForBuild(RELICS, primaryId, ownedEffects, 4),
        [primaryId, ownedEffects]
    );

    return (
        <div className="ae-card is-quiet overflow-hidden">
            {/* 헤더 토글 */}
            <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpen((o) => !o)}
                className="flex min-h-11 w-full items-center justify-between gap-2 px-3 py-2.5 text-left font-readable text-[13px] text-ae-ink-2 transition-colors duration-[110ms] ease-[cubic-bezier(.2,.8,.2,1)] hover:bg-ae-s3/60 hover:text-ae-ink motion-reduce:transition-none"
            >
                <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                    <Compass size={14} aria-hidden="true" className={`shrink-0 ${trait.accent}`} />
                    성장 조언 — <span className={`font-bold ${trait.accent}`}>{trait.title}</span>
                </span>
                {open ? <ChevronUp size={14} aria-hidden="true" className="shrink-0" /> : <ChevronDown size={14} aria-hidden="true" className="shrink-0" />}
            </button>

            {open && (
                <div className="space-y-3 border-t border-ae-ink/10 px-3 pb-3">
                    {/* 성장 성향 요약 */}
                    <div className={`mt-3 rounded-ae-md border px-3 py-2.5 ${trait.chipClass}`}>
                        <div className="mb-0.5 text-[11px] opacity-75">현재 성장 성향</div>
                        <div className="font-bold text-sm">{trait.name} — {trait.title}</div>
                        <div className="mt-0.5 text-[12px] opacity-85">{trait.desc}</div>
                        <div className="mt-1 text-[12px] opacity-75">패시브: {trait.passiveLabel}</div>
                    </div>

                    {/* 성향 기술 */}
                    {trait.skill && (
                        <div>
                            <div className="ae-eyebrow mb-1.5">성향 기술</div>
                            <div className="ae-well px-3 py-2.5">
                                <div className="mb-0.5 flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
                                    <span className="text-sm font-bold text-ae-ink">{trait.skill.name}</span>
                                    <span className="text-[12px] text-ae-ink-3">기력 <span className="font-fira tabular-nums">{trait.skill.mp}</span> · 재사용 <span className="font-fira tabular-nums">{trait.skill.cooldown}</span>턴</span>
                                </div>
                                <div className="text-[12px] text-ae-ink-2">{trait.skill.desc}</div>
                            </div>
                        </div>
                    )}

                    {/* 추천 유물 */}
                    <div>
                        <div className="ae-eyebrow mb-1.5">아직 얻지 못한 추천 유물</div>
                        {/* 2026-10 Wave 103 (소유자 결정 §107.6 "미보유 이름만 숨김"): 아직 얻지 못한 유물의 이름 · 효과는 보이지 않는다 — 수만. */}
                        <div data-testid="build-advice-unowned-relics" className="text-[12px] text-ae-ink-3">
                            {recommended.length === 0 ? MSG.BUILD_ADVICE_UNOWNED_RELICS_NONE : MSG.BUILD_ADVICE_UNOWNED_RELICS(recommended.length)}
                        </div>
                    </div>

                    {/* 보스 공략 팁 */}
                    <div className="ae-well px-3 py-2.5">
                        <div className="ae-eyebrow mb-0.5 text-ae-gold-text">보스 전략</div>
                        <div className="text-[12px] text-ae-ink-2">{trait.bossDirective}</div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BuildAdvicePanel;
