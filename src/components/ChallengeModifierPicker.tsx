import { ChevronDown } from 'lucide-react';
import { BALANCE } from '../data/constants';
import { MSG } from '../data/messages';
import { getChallengeRewardPercent } from '../utils/challengeRules';
import type { AscensionRulePreview, AscensionRuleRerollView } from '../utils/ascensionRuleView';

interface ChallengeModifierPickerProps {
    /** data-testid 접두어 — 인트로는 `intro`(기존 e2e 계약), 계승 화면은 `ascension`. */
    testIdPrefix: string;
    selected: string[];
    slots: number;
    onToggle: (id: string) => void;
    /** 2026-10 Wave 89: 이 회차의 규칙 — 그 도전 조건은 잠겨 켜지고 슬롯을 쓰지 않으며 보상 배율에는 센다. */
    rule?: AscensionRulePreview | null;
    /** 2026-10 Wave 91: 선택형 규칙을 거절했는가 · 받아들임/거절 전환. 강제 규칙에는 쓰지 않는다. */
    ruleDeclined?: boolean;
    onToggleRule?: () => void;
    /** 2026-10 Wave 94: 계승할 때 보이는 회차 규칙 카드(패) · 카드 고르기. 고른 카드가 `rule`이다. */
    ruleOffer?: AscensionRulePreview[];
    onSelectRule?: (id: string) => void;
    /** 2026-10 Wave 95: 패 다시 뽑기(없으면 그리지 않는다) · 누르면 리듀서 전이를 부른다. */
    ruleReroll?: AscensionRuleRerollView | null;
    onRerollRule?: () => void;
}

/**
 * 도전 규칙 선택(2026-10 Wave 58) — 새 게임(인트로)과 계승 화면이 함께 쓴다. 계승은 인트로를 다시 거치지 않아
 * 계승 7단계 "도전 조건을 하나 더 선택 가능"을 고를 곳이 없었다(소유자 결정 "계승 화면에서 함께 고름").
 */
const ChallengeModifierPicker = ({ testIdPrefix, selected, slots, onToggle, rule = null, ruleDeclined = false, onToggleRule, ruleOffer = [], onSelectRule, ruleReroll = null, onRerollRule }: ChallengeModifierPickerProps) => {
    const declined = Boolean(rule?.optional && ruleDeclined);
    // 2026-10 Wave 105: 겹친 규칙은 잠긴 칸이 둘이다.
    const lockedIds = rule && !declined ? rule.lockedIds : [];
    const picked = selected.filter((id) => !lockedIds.includes(id));
    const rewardCount = picked.length + lockedIds.length;
    return (
        <>
            {ruleOffer.length > 1 && (
                // 2026-10 Wave 94: 회차 규칙 카드 — 아직 정복하지 않은 규칙에서 뽑은 패에서 한 장을 고른다.
                <div data-testid={`${testIdPrefix}-rule-offer`} className="mt-3 font-readable">
                    <span className="block text-xs font-bold text-orange-200">{MSG.ASCENSION_RULE_OFFER_TITLE}</span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-slate-400">{MSG.ASCENSION_RULE_OFFER_HINT}</span>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                        {ruleOffer.map((card) => {
                            const isPicked = card.id === rule?.id;
                            return (
                                <button
                                    key={card.id}
                                    type="button"
                                    data-testid={`${testIdPrefix}-rule-card-${card.id}`}
                                    aria-pressed={isPicked}
                                    onClick={() => onSelectRule?.(card.id)}
                                    className={`min-h-[4.5rem] rounded-md border px-2 py-2 text-left transition-colors ${
                                        isPicked
                                            ? 'border-[rgba(240,170,110,0.7)] bg-[rgba(240,170,110,0.16)] text-orange-50'
                                            : 'border-white/20 bg-[rgba(10,17,25,0.9)] text-slate-300 hover:border-white/30'
                                    }`}
                                >
                                    <span className="block text-xs font-bold leading-snug">{card.name}</span>
                                    <span className="mt-1 block text-[11px] leading-snug text-slate-400">{card.twist}</span>
                                    {card.optional && <span className="mt-1 block text-[11px] leading-snug text-orange-200">{MSG.ASCENSION_RULE_CARD_OPTIONAL}</span>}
                                </button>
                            );
                        })}
                    </div>
                    {ruleReroll && (
                        // 2026-10 Wave 95: 다시 뽑기 — 첫 번째는 무료, 그 뒤는 넘어가는 정수 사다리를 보이는 그대로 내려놓는다.
                        <div className="mt-2 flex items-center justify-between gap-3">
                            <span data-testid={`${testIdPrefix}-rule-reroll-count`} className="text-[11px] leading-snug text-slate-400">{ruleReroll.countLabel}</span>
                            <button
                                type="button"
                                data-testid={`${testIdPrefix}-rule-reroll`}
                                disabled={!ruleReroll.available}
                                onClick={() => onRerollRule?.()}
                                className={`min-h-11 min-w-0 rounded-md border px-3 text-left text-xs font-bold disabled:cursor-not-allowed disabled:opacity-60 ${
                                    ruleReroll.free
                                        ? 'border-[rgba(240,170,110,0.6)] bg-[rgba(240,170,110,0.12)] text-orange-100'
                                        : 'border-rose-300/40 bg-rose-300/[0.08] text-rose-100'
                                }`}
                            >
                                {ruleReroll.label}
                            </button>
                        </div>
                    )}
                </div>
            )}
            {rule && (
                <div data-testid={`${testIdPrefix}-ascension-rule`} className="mt-3 rounded-md border border-[rgba(240,170,110,0.4)] bg-[rgba(240,170,110,0.08)] px-3 py-2 font-readable">
                    <span className="block text-xs font-bold text-orange-200">{MSG.ASCENSION_RULE_NEXT(rule.name)}</span>
                    <span className="mt-1 block text-xs leading-snug text-slate-300">
                        {declined ? MSG.ASCENSION_RULE_DECLINED_DETAIL : rule.detail}
                    </span>
                    {rule.optional && (
                        <div className="mt-2 flex items-center justify-between gap-3">
                            <span className="text-[11px] leading-snug text-slate-400">{MSG.ASCENSION_RULE_OPTIONAL_HINT}</span>
                            <button
                                type="button"
                                data-testid={`${testIdPrefix}-ascension-rule-toggle`}
                                aria-pressed={!declined}
                                onClick={() => onToggleRule?.()}
                                className={`min-h-11 shrink-0 rounded-md border px-3 text-xs font-bold ${
                                    declined
                                        ? 'border-white/20 bg-[rgba(10,17,25,0.9)] text-slate-300'
                                        : 'border-[rgba(240,170,110,0.6)] bg-[rgba(240,170,110,0.16)] text-orange-100'
                                }`}
                            >
                                {declined ? MSG.ASCENSION_RULE_DECLINED : MSG.ASCENSION_RULE_ACCEPTED}
                            </button>
                        </div>
                    )}
                    {rule.outlook && (
                        // 2026-10 Wave 92: 두 선택의 측정 차이를 숫자로만 보인다 — 지금 고른 쪽을 밝게, 판단은 플레이어 몫(Wave 88 위협 줄과 같은 원칙).
                        <div data-testid={`${testIdPrefix}-ascension-rule-outlook`} className="mt-2 border-t border-white/10 pt-2 text-[11px] leading-snug">
                            <span data-testid={`${testIdPrefix}-ascension-rule-outlook-accepted`} className={`block ${declined ? 'text-slate-400' : 'text-orange-100'}`}>
                                {rule.outlook.accepted}
                            </span>
                            <span data-testid={`${testIdPrefix}-ascension-rule-outlook-declined`} className={`block ${declined ? 'text-orange-100' : 'text-slate-400'}`}>
                                {rule.outlook.declined}
                            </span>
                            <span className="mt-0.5 block text-slate-500">{rule.outlook.source}</span>
                        </div>
                    )}
                </div>
            )}
            <details
                data-testid={`${testIdPrefix}-challenge-settings`}
                className="group mt-3 border-y border-white/10 py-1 text-left"
            >
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 font-readable [&::-webkit-details-marker]:hidden">
                    <span className="text-xs text-slate-300">
                        {MSG.CHALLENGE_PICKER_TITLE} <span className="text-slate-500">{MSG.CHALLENGE_PICKER_SELECT}</span>
                    </span>
                    <span className="flex items-center gap-2 text-xs text-slate-400">
                        <span aria-live="polite">{picked.length}/{slots}</span>
                        <ChevronDown size={16} className="transition-transform group-open:rotate-180" aria-hidden="true" />
                    </span>
                </summary>
                <div className="pb-2 pt-1">
                    <div className="mb-2 flex items-center justify-between gap-3 font-readable text-xs text-slate-400">
                        <span>{MSG.CHALLENGE_PICKER_HINT}</span>
                        {rewardCount > 0 && (
                            // 2026-10 Wave 62 (원장 §61.4 C1): 엔진이 곱하는 표(`BALANCE.CHALLENGE_REWARD_MULT_BY_COUNT`)에서 그린다 — 화면이 따로
                            //   든 "+20% / +50% / +100% / +150%"와 엔진의 ×1 / ×1 / ×1.5 / ×2가 달랐다.
                            <span data-testid={`${testIdPrefix}-challenge-reward`} className="shrink-0 text-[#d5b180]">
                                {MSG.CHALLENGE_PICKER_REWARD(getChallengeRewardPercent(rewardCount))}
                            </span>
                        )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        {BALANCE.CHALLENGE_MODIFIERS.map((modifier: { id: string; label: string; desc: string }) => {
                            const isLocked = lockedIds.includes(modifier.id);
                            const isSelected = isLocked || picked.includes(modifier.id);

                            return (
                                <button
                                    key={modifier.id}
                                    type="button"
                                    data-testid={`${testIdPrefix}-challenge-${modifier.id}`}
                                    aria-pressed={isSelected}
                                    aria-disabled={isLocked || undefined}
                                    onClick={() => { if (!isLocked) onToggle(modifier.id); }}
                                    className={`min-h-[4.75rem] rounded-md border px-3 py-2 text-left transition-colors ${
                                        isSelected
                                            ? 'border-[rgba(213,177,128,0.6)] bg-[rgba(213,177,128,0.14)] text-[#f6e7c8]'
                                            : 'border-white/20 bg-[rgba(10,17,25,0.9)] text-slate-300 hover:border-white/30'
                                    }`}
                                >
                                    <span className="block font-rajdhani text-sm font-bold">
                                        {modifier.label}
                                        {isLocked && <span className="ml-1.5 text-[11px] font-readable text-orange-200">{MSG.ASCENSION_RULE_LOCKED}</span>}
                                    </span>
                                    <span className="mt-1 block font-readable text-xs leading-snug text-slate-400">
                                        {modifier.desc}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </details>
        </>
    );
};

export default ChallengeModifierPicker;
