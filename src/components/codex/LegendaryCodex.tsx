import { useMemo, useState, type CSSProperties } from 'react';
import { ChevronDown, Lock, Sparkles } from 'lucide-react';
import { DB } from '../../data/db';
import { SIGNATURE_ITEM_REGISTRY } from '../../data/signatureItems.js';
import { computeSignatureSetBonus, getSignatureSetDefinitions, getSignatureSetEquippedCounts } from '../../utils/signatureSetBonus.js';
import { getSignatureDropSources } from '../../utils/signatureDropSources.js';
import { getSignaturePityMultiplier, SIGNATURE_PITY } from '../../utils/signaturePity.js';
import { getDiscoveredSignatureNames } from '../../utils/signatureDiscovery.js';
import { getItemStatText } from '../../utils/equipmentUtils';
import { MSG } from '../../data/messages';
import ItemIcon from '../icons/ItemIcon.jsx';
import Chip from '../ui/Chip';
import type { Item, Player } from '../../types/index.js';

/**
 * 전설 도감 — dedicated signature art를 가진 20종 레전더리 아이템 컬렉션.
 *
 * 발견 상태는 계정 수집(`getDiscoveredSignatureNames` — 이번 여정 도감 + 지난 여정들의 장부, Wave 125)에서 읽어
 * 잠금/잠금해제 표시.
 */

/** signatureRegistry.json entries의 런타임 모양 — tone/category만 이 화면에서 읽는다(`artNote`는 그림 생성 지시문이다). */
interface SignatureMeta {
    spriteKey?: string;
    tier?: string;
    category?: string;
    tone?: string;
    setGroup?: string;
}

interface ToneAccent {
    /** 이 톤이 빌리는 색 토큰 — `--aether-<token>-rgb` 채널을 타일(`ab-tile`)의 `--ab-rar`로 넘긴다(감사 VD-06). */
    token: string;
    label: string;
}

/** signatureSets.json의 세트 정의 — getSignatureSetDefinitions()가 반환하는 SETS의 값 모양. */
interface SignatureSetBonusTier {
    atkMult?: number;
    defMult?: number;
    hpMult?: number;
    desc: string;
}

interface SignatureSetDef {
    name: string;
    tone: string;
    members: string[];
    bonuses: Record<string, SignatureSetBonusTier>;
}

export interface LegendaryEntry {
    item: Item;
    meta: SignatureMeta;
}

// cycle 358: steel 톤 제거 — signatureRegistry.json / signatureSets.json 어디에도
//   tone='steel' 엔트리 0건이라 unreachable. fallback은 DEFAULT_TONE_ACCENT (= holy).
const TONE_ACCENT: Record<string, ToneAccent> = Object.freeze({
    holy: { token: 'gold-hi', label: '빛' },
    fire: { token: 'rarity-legendary', label: '화염' },
    frost: { token: 'ether-hi', label: '냉기' },
    shadow: { token: 'rarity-epic', label: '어둠' },
    arcane: { token: 'exp', label: '비전' },
    nature: { token: 'good', label: '자연' },
    earth: { token: 'gold', label: '대지' },
    rust: { token: 'gold-lo', label: '광란' },
});

const CATEGORY_LABEL: Record<string, string> = Object.freeze({
    'unique-weapon': '고유 무기',
    'boss-drop': '보스 전리품',
    'set-core': '세트 핵심',
});

const DEFAULT_TONE_ACCENT = TONE_ACCENT.holy;

/** 타일의 테두리 · 광채 색을 톤 토큰으로 바꾼다 — 색 값은 index.css의 토큰이 소유한다. */
const toneStyle = (accent: ToneAccent): CSSProperties => ({ ['--ab-rar' as string]: `var(--aether-${accent.token}-rgb)` });

const buildEntries = (): LegendaryEntry[] => {
    const all = [
        ...(DB.ITEMS.weapons || []),
        ...(DB.ITEMS.armors || []),
    ];
    const byName = Object.fromEntries(all.map((item): [string, Item] => [String(item.name), item]));
    return (Object.entries(SIGNATURE_ITEM_REGISTRY) as Array<[string, SignatureMeta]>)
        .map(([name, meta]): LegendaryEntry | null => {
            const item = byName[name];
            if (!item) return null;
            return { item, meta };
        })
        .filter((entry): entry is LegendaryEntry => entry !== null);
};

/**
 * 2026-10 Wave 134(원장 §147): 고른 전설의 상세 — 능력치는 장비 화면과 같은 변환기(`getItemStatText`)를 읽는다. 데이터의
 * `desc_stat`("ATK+200(빛)")을 그대로 그리던 동안 한손 무기는 실제 공격력(+88)의 두 배가 넘는 수를, 양손 무기는 실제(+341)보다
 * 작은 수를 영어 약어로 보였다. 레지스트리의 `artNote`는 그림 생성 지시문(아트 파이프라인이 읽는다)이라 그리지 않는다.
 */
export const LegendaryCodexDetail = ({ entry }: { entry: LegendaryEntry }) => {
    const accent = TONE_ACCENT[entry.meta.tone ?? ''] || DEFAULT_TONE_ACCENT;
    const statText = getItemStatText(entry.item);
    const sources = getSignatureDropSources(entry.item.name);
    return (
        <div data-testid="legendary-codex-detail" className="ab-tile p-3.5" style={toneStyle(accent)}>
            <div className="flex items-start gap-3">
                <ItemIcon item={entry.item} size={48} hideSignatureBadge />
                <div className="min-w-0 flex-1">
                    <div className="aether-type-body font-display font-bold text-ae-ink">{entry.item.name}</div>
                    <div className="aether-type-meta mt-0.5 text-ae-gold-text">
                        {CATEGORY_LABEL[entry.meta.category ?? ''] || MSG.CODEX_LEGEND_FALLBACK_CATEGORY}
                        <span className="mx-1 text-ae-ink-3">·</span>
                        {accent.label}
                        {statText ? (
                            <>
                                <span className="mx-1 text-ae-ink-3">·</span>
                                <span data-testid="legendary-codex-detail-stat" className="text-ae-ink-2">{statText}</span>
                            </>
                        ) : null}
                    </div>
                    {entry.item.desc && (
                        <div className="aether-type-meta mt-1.5 text-ae-ink-2">
                            {entry.item.desc}
                        </div>
                    )}
                    {sources.length > 0 && (
                        <div className="mt-2 border-t border-ae-ink/7 pt-2">
                            <div className="aether-type-meta mb-1 text-ae-ink-3">
                                {MSG.CODEX_LEGEND_SOURCES_TITLE}
                            </div>
                            <div className="flex flex-wrap gap-1">
                                {sources.map(({ monster, rate }) => (
                                    <Chip key={monster} tone="gold">
                                        <span className="text-ae-ink">{monster}</span>
                                        <span className="font-fira tabular-nums">{MSG.CODEX_LEGEND_SOURCE_RATE(Math.max(1, Math.round(rate * 100)))}</span>
                                    </Chip>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

interface LegendaryCodexProps {
    player?: Player | null;
}

const LegendaryCodex = ({ player }: LegendaryCodexProps) => {
    const [selected, setSelected] = useState<string | null>(null);
    // 2026-10 Wave 125: 전설 각인 수집은 계정 단위다 — 이번 여정 도감 + 지난 여정들의 장부(`getDiscoveredSignatureNames`).
    const discoveredNames = useMemo(() => new Set(player ? getDiscoveredSignatureNames(player) : []), [player]);
    const entries = useMemo(() => buildEntries(), []);
    const discoveredCount = entries.filter((entry) => discoveredNames.has(entry.item.name ?? '')).length;

    const pity = Math.max(0, Number(player?.stats?.signaturePity) || 0);
    const pityMult = getSignaturePityMultiplier(pity);
    const pityActive = pityMult > 1;
    const pityPct = pityActive ? Math.round((pityMult - 1) * 100) : 0;
    const pityRemaining = pityActive ? 0 : Math.max(0, SIGNATURE_PITY.THRESHOLD - pity);
    const pityCapped = pityMult >= SIGNATURE_PITY.CAP;

    const selectedEntry = selected
        ? entries.find((entry) => entry.item.name === selected)
        : null;

    const equippedCounts = useMemo(() => getSignatureSetEquippedCounts(player?.equip), [player?.equip]);
    const activeSet = useMemo(() => computeSignatureSetBonus(player?.equip).activeSet, [player?.equip]);

    const setSummary = useMemo(() => {
        const sets = getSignatureSetDefinitions() as Record<string, SignatureSetDef>;
        return Object.entries(sets).map(([key, def]) => {
            const discovered = def.members.filter((memberName: string) => discoveredNames.has(memberName)).length;
            // 2026-10 Wave 58: 장착 수와 발동 단계는 엔진 계산 그대로다(2H 가중치 · 접두어 사본 포함, 발동은 가장 많이 낀 세트 하나).
            const equipped = equippedCounts[key] || 0;
            const activeBonus = activeSet?.key === key ? def.bonuses[String(activeSet.tier)] : undefined;
            return { key, def, total: def.members.length, discovered, equipped, activeBonus };
        });
    }, [discoveredNames, equippedCounts, activeSet]);

    const pityLine = pityActive
        ? (pityCapped ? MSG.CODEX_LEGEND_PITY_CAPPED : MSG.CODEX_LEGEND_PITY_ACTIVE(pity))
        : (pity > 0
            ? MSG.CODEX_LEGEND_PITY_LOADING(pity, SIGNATURE_PITY.THRESHOLD, pityRemaining)
            : MSG.CODEX_LEGEND_PITY_IDLE(SIGNATURE_PITY.THRESHOLD));

    return (
        <div data-testid="codex-legendary" className="ab-stack">
            <div className="flex items-baseline justify-between gap-3 px-1">
                <div>
                    <h3 className="ab-section-title">{MSG.CODEX_LEGEND_TITLE}</h3>
                    <p className="aether-type-meta mt-0.5 text-ae-ink-3">{MSG.CODEX_LEGEND_DESC}</p>
                </div>
                <div className="aether-type-body shrink-0 font-fira tabular-nums text-ae-gold-text">{discoveredCount}/{entries.length}</div>
            </div>

            {/* Pity resonance status — 2026-10 Wave 103: 첫 각인을 얻은 뒤에만(보스 처치로 쌓인다는 규칙도 획득처다). */}
            {discoveredCount > 0 && (
            <div
                data-testid="legendary-codex-pity-status"
                data-pity={pity}
                data-pity-mult={pityMult}
                className={`flex min-h-14 items-center justify-between gap-2 px-3.5 py-2 ${pityActive ? 'ab-mission' : 'ae-well'}`}
            >
                <div className="flex min-w-0 items-center gap-1.5">
                    <Sparkles size={14} className={`shrink-0 ${pityActive ? 'text-ae-gold-text' : 'text-ae-ink-3'}`} aria-hidden="true" />
                    <span className="aether-type-body shrink-0 font-semibold text-ae-ink">
                        {MSG.CODEX_LEGEND_PITY_TITLE}
                    </span>
                    <span className="aether-type-meta min-w-0 text-ae-ink-3">{pityLine}</span>
                </div>
                <span className={`aether-type-body shrink-0 font-fira font-semibold tabular-nums ${pityActive ? 'text-ae-gold-text' : 'text-ae-ink-3'}`}>
                    {MSG.CODEX_LEGEND_PITY_PCT(pityActive ? pityPct : 0)}
                </span>
            </div>
            )}

            <div className="ae-card ab-rows px-3.5">
                {setSummary.length > 0 && (
                    <details data-testid="legendary-codex-sets" className="group">
                        <summary className="ab-summary min-h-14">
                            <span className="ab-icon-well is-gold" aria-hidden="true"><Sparkles size={16} /></span>
                            <span className="aether-type-body flex-1 font-semibold text-ae-ink">{MSG.CODEX_LEGEND_SETS_TITLE}</span>
                            <span className="aether-type-meta font-fira tabular-nums text-ae-ink-3">{MSG.CODEX_PANEL_COUNT(setSummary.length)}</span>
                            <ChevronDown size={16} className="ab-chevron" aria-hidden="true" />
                        </summary>
                        <div className="grid grid-cols-1 gap-1.5 pb-3">
                            {setSummary.map(({ key, def, total, discovered, equipped, activeBonus }) => {
                                const isActive = Boolean(activeBonus);
                                return (
                                    <div
                                        key={key}
                                        className={`flex min-h-14 flex-col justify-center gap-0.5 px-3 py-2 ${isActive ? 'ab-tile' : 'ab-tile is-undiscovered'}`}
                                        style={isActive ? toneStyle(TONE_ACCENT[def.tone] || DEFAULT_TONE_ACCENT) : undefined}
                                    >
                                        <div className="aether-type-meta flex items-center justify-between gap-3">
                                            <span className="font-semibold text-ae-ink">{def.name}</span>
                                            <span className={`shrink-0 font-fira tabular-nums ${isActive ? 'text-ae-gold-text' : 'text-ae-ink-3'}`}>
                                                {MSG.CODEX_LEGEND_SET_STATUS(equipped, discovered, total)}
                                            </span>
                                        </div>
                                        {activeBonus && (
                                            <div className="aether-type-meta text-ae-gold-text">
                                                {activeBonus.desc}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </details>
                )}

                {/* 2026-10 Wave 103 (소유자 결정 §107.6): 발견 0개일 때 어디서 얻는지 안내하던 칸을 없앴다 — 획득처는 플레이어가 알아낸다. */}

                <details data-testid="legendary-codex-collection" className="group">
                    <summary className="ab-summary min-h-14">
                        <span className="ab-icon-well is-gold" aria-hidden="true"><Sparkles size={16} /></span>
                        <span className="aether-type-body flex-1 font-semibold text-ae-ink">{MSG.CODEX_LEGEND_COLLECTION_TITLE}</span>
                        <span className="aether-type-meta font-fira tabular-nums text-ae-ink-3">{discoveredCount}/{entries.length}</span>
                        <ChevronDown size={16} className="ab-chevron" aria-hidden="true" />
                    </summary>
                    <div className="grid grid-cols-2 gap-1.5 pb-3">
                    {entries.map(({ item, meta }) => {
                        const found = discoveredNames.has(item.name ?? '');
                        const accent = TONE_ACCENT[meta.tone ?? ''] || DEFAULT_TONE_ACCENT;
                        const isSelected = selected === item.name;

                        if (!found) {
                            return (
                                <div key={item.name} role="img" aria-label={MSG.CODEX_LEGEND_UNDISCOVERED} className="ab-tile is-undiscovered flex min-h-16 items-center gap-1.5 p-2.5">
                                    <Lock size={12} className="shrink-0" aria-hidden="true" />
                                    <div className="aether-type-meta font-semibold">{MSG.CODEX_LEGEND_UNDISCOVERED}</div>
                                </div>
                            );
                        }
                        return (
                            <button
                                key={item.name}
                                type="button"
                                aria-pressed={isSelected}
                                onClick={() => setSelected(isSelected ? null : item.name ?? null)}
                                className="ab-tile min-h-16 p-2.5 text-left"
                                style={toneStyle(accent)}
                                aria-label={item.name}
                            >
                                <div className="flex items-start gap-1.5">
                                    <ItemIcon item={item} size={28} hideSignatureBadge />
                                    <div className="min-w-0">
                                        {/* 통합 수용 7차(원장 §149): 이름은 말줄임 대신 줄을 넘긴다 — 375 · 390px의 두 칸 격자에서
                                            '신전 도시의 지팡이' · '에테르 거인의 대검'이 잘렸다(Wave 67 규칙). */}
                                        <div className="aether-type-body font-semibold leading-tight text-ae-ink">{item.name}</div>
                                        <div className="aether-type-meta mt-0.5 text-ae-gold-text">
                                            {CATEGORY_LABEL[meta.category ?? ''] || MSG.CODEX_LEGEND_FALLBACK_CATEGORY} · {accent.label}
                                        </div>
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                    </div>
                </details>
            </div>

            {/* Detail */}
            {selectedEntry && <LegendaryCodexDetail entry={selectedEntry} />}
        </div>
    );
};

export default LegendaryCodex;
