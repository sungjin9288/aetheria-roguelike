import { ChevronDown } from 'lucide-react';
import { BALANCE } from '../data/constants';

const CHALLENGE_REWARD_TEXT = ['', '+20% 보상', '+50% 보상', '+100% 보상', '+150% 보상'];

interface ChallengeModifierPickerProps {
    /** data-testid 접두어 — 인트로는 `intro`(기존 e2e 계약), 계승 화면은 `ascension`. */
    testIdPrefix: string;
    selected: string[];
    slots: number;
    onToggle: (id: string) => void;
}

/**
 * 도전 규칙 선택(2026-10 Wave 58) — 새 게임(인트로)과 계승 화면이 함께 쓴다. 계승은 인트로를 다시 거치지 않아
 * 계승 7단계 "도전 조건을 하나 더 선택 가능"을 고를 곳이 없었다(소유자 결정 "계승 화면에서 함께 고름").
 */
const ChallengeModifierPicker = ({ testIdPrefix, selected, slots, onToggle }: ChallengeModifierPickerProps) => (
    <details
        data-testid={`${testIdPrefix}-challenge-settings`}
        className="group mt-3 border-y border-white/10 py-1 text-left"
    >
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 font-readable [&::-webkit-details-marker]:hidden">
            <span className="text-xs text-slate-300">
                도전 규칙 <span className="text-slate-500">선택</span>
            </span>
            <span className="flex items-center gap-2 text-xs text-slate-400">
                <span aria-live="polite">{selected.length}/{slots}</span>
                <ChevronDown size={16} className="transition-transform group-open:rotate-180" aria-hidden="true" />
            </span>
        </summary>
        <div className="pb-2 pt-1">
            <div className="mb-2 flex items-center justify-between gap-3 font-readable text-xs text-slate-400">
                <span>더 어려운 규칙에는 더 큰 보상이 따릅니다.</span>
                {selected.length > 0 && (
                    <span className="shrink-0 text-[#d5b180]">
                        {CHALLENGE_REWARD_TEXT[selected.length]}
                    </span>
                )}
            </div>
            <div className="grid grid-cols-2 gap-2">
                {BALANCE.CHALLENGE_MODIFIERS.map((modifier: { id: string; label: string; desc: string }) => {
                    const isSelected = selected.includes(modifier.id);

                    return (
                        <button
                            key={modifier.id}
                            type="button"
                            data-testid={`${testIdPrefix}-challenge-${modifier.id}`}
                            aria-pressed={isSelected}
                            onClick={() => onToggle(modifier.id)}
                            className={`min-h-[4.75rem] rounded-md border px-3 py-2 text-left transition-colors ${
                                isSelected
                                    ? 'border-[rgba(213,177,128,0.6)] bg-[rgba(213,177,128,0.14)] text-[#f6e7c8]'
                                    : 'border-white/20 bg-[rgba(10,17,25,0.9)] text-slate-300 hover:border-white/30'
                            }`}
                        >
                            <span className="block font-rajdhani text-sm font-bold">{modifier.label}</span>
                            <span className="mt-1 block font-readable text-xs leading-snug text-slate-400">
                                {modifier.desc}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    </details>
);

export default ChallengeModifierPicker;
