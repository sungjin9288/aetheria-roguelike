import { useState } from 'react';
import { Footprints, Gem, MessageCircle, Moon, Swords, type LucideIcon } from 'lucide-react';
import { DB } from '../../data/db';
import { MSG } from '../../data/messages';
import { useOverlayDialog } from '../../hooks/useOverlayDialog';
import { getFieldTraitEffects, getFieldTraitOffer } from '../../systems/fieldTrait';
import type { FieldMapTrait } from '../../types/fieldMap';
import type { Player } from '../../types/player';
import ActionButton from '../ui/ActionButton';
import ChoiceCard, { ChoiceCardLine } from '../ui/ChoiceCard';

interface FieldTraitPanelProps {
    player: Player;
    onChoose: (seq: number, trait: FieldMapTrait) => void;
}

const TRAIT_ICON: Readonly<Record<FieldMapTrait, LucideIcon>> = {
    plain: Footprints,
    elite: Swords,
    chest: Gem,
    event: MessageCircle,
    quiet: Moon,
};

/**
 * FieldTraitPanel — 2026-11 지도 갈래(docs/PRE_PLAYTEST_FEATURES_2026-11.md §1).
 *
 * 이번 여정에서 클리어한 지역의 새 지도 입구에서 뜬다. 패 · 수치는 `systems/fieldTrait.ts`, 고를 수 있는지는 리듀서
 * (`AT.FIELD_CHOOSE_TRAIT`)가 소유한다 — 이 화면은 그리기와 고른 성격 전달만 한다. 기본 선택이 없고 권하지 않는다.
 * 카드를 누르면 고르고 금빛 단추 하나가 확정한다. 닫기 · Escape는 보통 지도다.
 */
const FieldTraitPanel = ({ player, onChoose }: FieldTraitPanelProps) => {
    const field = player.fieldMap;
    const mapData = field ? DB.MAPS[field.loc] : null;
    const [selection, setSelection] = useState<{ seq: number; trait: FieldMapTrait } | null>(null);
    const skip = () => { if (field) onChoose(field.seq, 'plain'); };
    const dialog = useOverlayDialog({ label: MSG.FIELD_TRAIT_ARIA, onEscape: skip });
    if (!field || !mapData) return null;
    const selected = selection?.seq === field.seq ? selection.trait : null;

    return (
        <div {...dialog} className="fixed inset-0 z-50 flex items-end justify-center px-2 pt-[max(var(--aether-safe-area-top),0.5rem)] pb-[max(var(--aether-safe-area-bottom),0.5rem)] sm:items-center sm:px-4">
            <div className="ae-scrim" aria-hidden="true" />
            <div
                data-testid="field-trait-panel"
                className="ae-sheet relative mx-auto flex max-h-[calc(100dvh-1rem)] w-full max-w-xl flex-col overflow-hidden px-3.5 pb-3.5 pt-4 sm:px-5 sm:pb-5 lg:max-w-3xl"
            >
                <div className="mb-3 shrink-0">
                    <div className="ae-eyebrow">{MSG.FIELD_TRAIT_EYEBROW}</div>
                    <h2 className="mt-1 aether-type-heading text-ae-ink">{MSG.FIELD_TRAIT_TITLE}</h2>
                    <p className="mt-1 aether-type-body font-readable text-ae-ink-2">{MSG.FIELD_TRAIT_BODY}</p>
                </div>

                <div data-testid="field-trait-options" className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain">
                    <div className="grid gap-2 lg:grid-cols-3">
                        {getFieldTraitOffer(player, field, mapData).map((trait) => {
                            const Icon = TRAIT_ICON[trait];
                            const effects = getFieldTraitEffects(trait);
                            const cost = MSG.FIELD_TRAIT_COST_LINE(MSG.FIELD_TRAIT_COST[trait](effects));
                            return (
                                <ChoiceCard
                                    key={trait}
                                    data-testid={`field-trait-card-${trait}`}
                                    aria-pressed={selected === trait}
                                    onClick={() => setSelection({ seq: field.seq, trait })}
                                    stackOnDesktop
                                    emphasis={selected === trait ? 'selected' : null}
                                    dimmed={selected !== null && selected !== trait}
                                    icon={<span className="ae-choice-card-well"><Icon size={18} strokeWidth={2} /></span>}
                                    title={MSG.FIELD_TRAIT_NAME[trait]}
                                    effect={MSG.FIELD_TRAIT_GAIN_LINE(MSG.FIELD_TRAIT_GAIN[trait](effects))}
                                    // 치르는 것이 없는 카드(보통 지도)는 위험 색으로 그리지 않는다.
                                    lines={trait === 'plain' ? <ChoiceCardLine>{cost}</ChoiceCardLine> : null}
                                    cost={trait === 'plain' ? null : cost}
                                />
                            );
                        })}
                    </div>
                </div>

                <div className="mt-3 grid shrink-0 gap-2">
                    <ActionButton
                        variant="primary"
                        data-testid="field-trait-confirm"
                        disabled={selected === null}
                        onClick={() => { if (selected) onChoose(field.seq, selected); }}
                        label={MSG.FIELD_TRAIT_CONFIRM}
                        className="w-full"
                    />
                    <ActionButton
                        variant="ghost"
                        data-testid="field-trait-skip"
                        onClick={skip}
                        label={MSG.FIELD_TRAIT_SKIP}
                        className="w-full"
                    />
                </div>
            </div>
        </div>
    );
};

export default FieldTraitPanel;
