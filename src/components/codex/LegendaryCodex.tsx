import { useMemo, useState } from 'react';
import { ChevronDown, Lock, Sparkles } from 'lucide-react';
import { DB } from '../../data/db';
import { SIGNATURE_ITEM_REGISTRY } from '../../data/signatureItems.js';
import { computeSignatureSetBonus, getSignatureSetDefinitions, getSignatureSetEquippedCounts } from '../../utils/signatureSetBonus.js';
import { getSignatureDropSources } from '../../utils/signatureDropSources.js';
import { getSignaturePityMultiplier, SIGNATURE_PITY } from '../../utils/signaturePity.js';
import { getDiscoveredSignatureNames } from '../../utils/signatureDiscovery.js';
import { getItemStatText } from '../../utils/equipmentUtils';
import ItemIcon from '../icons/ItemIcon.jsx';
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
    border: string;
    glow: string;
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
    holy: { border: 'rgba(246,231,162,0.6)', glow: 'rgba(246,231,162,0.18)', label: '빛' },
    fire: { border: 'rgba(255,180,138,0.6)', glow: 'rgba(255,180,138,0.18)', label: '화염' },
    frost: { border: 'rgba(204,232,245,0.55)', glow: 'rgba(204,232,245,0.16)', label: '냉기' },
    shadow: { border: 'rgba(199,164,240,0.6)', glow: 'rgba(199,164,240,0.18)', label: '어둠' },
    arcane: { border: 'rgba(192,176,232,0.6)', glow: 'rgba(192,176,232,0.18)', label: '비전' },
    nature: { border: 'rgba(168,208,160,0.55)', glow: 'rgba(168,208,160,0.16)', label: '자연' },
    earth: { border: 'rgba(216,184,120,0.5)', glow: 'rgba(216,184,120,0.14)', label: '대지' },
    rust: { border: 'rgba(217,165,108,0.5)', glow: 'rgba(217,165,108,0.14)', label: '광란' },
});

const CATEGORY_LABEL: Record<string, string> = Object.freeze({
    'unique-weapon': '고유 무기',
    'boss-drop': '보스 전리품',
    'set-core': '세트 핵심',
});

const DEFAULT_TONE_ACCENT = TONE_ACCENT.holy;

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
        <div
            data-testid="legendary-codex-detail"
            className="rounded-lg p-3 text-[11px]"
            style={{
                border: `1px solid ${accent.border}`,
                background: `linear-gradient(180deg, rgba(20,24,30,0.95) 0%, rgba(10,12,16,1) 100%)`,
            }}
        >
            <div className="flex items-start gap-3">
                <ItemIcon item={entry.item} size={48} hideSignatureBadge />
                <div className="min-w-0 flex-1">
                    <div className="font-rajdhani font-bold text-white text-[13px]">{entry.item.name}</div>
                    <div className="mt-0.5 text-[11px] text-amber-200/80">
                        {CATEGORY_LABEL[entry.meta.category ?? ''] || '전설'}
                        <span className="mx-1 text-slate-600">·</span>
                        {accent.label}
                        {statText ? (
                            <>
                                <span className="mx-1 text-slate-600">·</span>
                                <span data-testid="legendary-codex-detail-stat" className="text-slate-300">{statText}</span>
                            </>
                        ) : null}
                    </div>
                    {entry.item.desc && (
                        <div className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
                            {entry.item.desc}
                        </div>
                    )}
                    {sources.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-white/5">
                            <div className="mb-1 text-[11px] text-slate-500">
                                획득처
                            </div>
                            <div className="flex flex-wrap gap-1">
                                {sources.map(({ monster, rate }) => (
                                    <span
                                        key={monster}
                                        className="inline-flex min-h-7 items-center gap-1 rounded-lg border border-amber-300/25 bg-amber-300/5 px-2 text-[11px] text-amber-100/90"
                                    >
                                        <span className="text-slate-200">{monster}</span>
                                        <span className="text-amber-300/80">{Math.max(1, Math.round(rate * 100))}%</span>
                                    </span>
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

    return (
        <div data-testid="codex-legendary" className="space-y-4">
            <div className="flex items-baseline justify-between gap-3">
                <div>
                    <h3 className="aether-type-title font-semibold text-slate-100">전설 수집</h3>
                    <p className="aether-type-meta mt-0.5 text-slate-400/76">발견한 전설 각인과 세트 장비를 기록합니다</p>
                </div>
                <div className="aether-type-body shrink-0 text-amber-200">{discoveredCount}/{entries.length}</div>
            </div>

            {/* Pity resonance status — 2026-10 Wave 103: 첫 각인을 얻은 뒤에만(보스 처치로 쌓인다는 규칙도 획득처다). */}
            {discoveredCount > 0 && (
            <div
                data-testid="legendary-codex-pity-status"
                data-pity={pity}
                data-pity-mult={pityMult}
                className="flex min-h-14 items-center justify-between gap-2 rounded-lg px-3 py-2"
                style={{
                    border: `1px solid ${pityActive ? 'rgba(246,231,162,0.42)' : 'rgba(255,255,255,0.08)'}`,
                    background: pityActive
                        ? 'radial-gradient(circle at 22% 40%, rgba(246,231,162,0.14), transparent 54%), linear-gradient(180deg, rgba(20,24,30,0.95) 0%, rgba(10,12,16,1) 100%)'
                        : 'linear-gradient(180deg, rgba(14,17,22,0.9) 0%, rgba(8,10,14,1) 100%)',
                }}
            >
                <div className="flex items-center gap-1.5 min-w-0">
                    <Sparkles size={11} className={pityActive ? 'text-amber-300' : 'text-slate-500'} />
                    <span className="text-sm font-semibold" style={{ color: pityActive ? '#f6e7a2' : '#c8cdd6' }}>
                        각인 공명
                    </span>
                    <span className="truncate text-[11px] text-slate-400/80">
                        {pityActive
                            ? (pityCapped ? '상한 도달' : `보스 ${pity}회 누적`)
                            : (pity > 0
                                ? `적재 ${pity}/${SIGNATURE_PITY.THRESHOLD} · 임계까지 ${pityRemaining}회`
                                : `보스 ${SIGNATURE_PITY.THRESHOLD}회 연속 무획득 시 배율 상승`)}
                    </span>
                </div>
                <span
                    className="shrink-0 text-sm font-semibold"
                    style={{ color: pityActive ? '#f6e7a2' : '#6b7280' }}
                >
                    {pityActive ? `+${pityPct}%` : '+0%'}
                </span>
            </div>
            )}

            {setSummary.length > 0 && (
                <details data-testid="legendary-codex-sets" className="group border-y border-white/10">
                    <summary className="flex min-h-14 cursor-pointer list-none items-center gap-2 py-3 [&::-webkit-details-marker]:hidden">
                        <Sparkles size={16} className="text-amber-200" />
                        <span className="aether-type-body flex-1 font-semibold text-slate-100">전설 세트</span>
                        <span className="aether-type-meta text-slate-400/76">{setSummary.length}개</span>
                        <ChevronDown size={16} className="text-slate-500 transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="grid grid-cols-1 gap-1.5 pb-3">
                        {setSummary.map(({ key, def, total, discovered, equipped, activeBonus }) => {
                            const accent = TONE_ACCENT[def.tone] || DEFAULT_TONE_ACCENT;
                            const isActive = Boolean(activeBonus);
                            return (
                                <div
                                    key={key}
                                    className="flex min-h-14 flex-col justify-center gap-0.5 rounded-lg px-3 py-2"
                                    style={{
                                        border: `1px solid ${isActive ? accent.border : 'rgba(255,255,255,0.08)'}`,
                                        background: isActive
                                            ? `radial-gradient(circle at 18% 40%, ${accent.glow}, transparent 50%), linear-gradient(180deg, rgba(20,24,30,0.95) 0%, rgba(10,12,16,1) 100%)`
                                            : 'linear-gradient(180deg, rgba(14,17,22,0.9) 0%, rgba(8,10,14,1) 100%)',
                                    }}
                                >
                                    <div className="flex items-center justify-between gap-3 text-[11px]">
                                        <span className="font-semibold text-white">{def.name}</span>
                                        <span className={isActive ? 'text-amber-200' : 'text-slate-500'}>
                                            {equipped > 0 ? `장착 ${equipped}` : '미장착'} · 수집 {discovered}/{total}
                                        </span>
                                    </div>
                                    {activeBonus && (
                                        <div className="text-[11px] text-amber-200/90">
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

            <details data-testid="legendary-codex-collection" className="group border-y border-white/10">
                <summary className="flex min-h-14 cursor-pointer list-none items-center gap-2 py-3 [&::-webkit-details-marker]:hidden">
                    <Sparkles size={16} className="text-amber-200" />
                    <span className="aether-type-body flex-1 font-semibold text-slate-100">전설 장비 기록</span>
                    <span className="aether-type-meta text-slate-400/76">{discoveredCount}/{entries.length}</span>
                    <ChevronDown size={16} className="text-slate-500 transition-transform group-open:rotate-180" />
                </summary>
                <div className="grid grid-cols-2 gap-1.5 pb-3">
                {entries.map(({ item, meta }) => {
                    const found = discoveredNames.has(item.name ?? '');
                    const accent = TONE_ACCENT[meta.tone ?? ''] || DEFAULT_TONE_ACCENT;
                    const isSelected = selected === item.name;

                    return (
                        <button
                            key={item.name}
                            type="button"
                            onClick={() => found && setSelected(isSelected ? null : item.name ?? null)}
                            className={`relative min-h-16 rounded-lg p-2.5 text-left text-[11px] transition-all ${found ? 'hover:brightness-125' : 'cursor-default'} ${isSelected ? 'ring-1 ring-amber-300/60' : ''}`}
                            style={{
                                border: `1px solid ${found ? accent.border : 'rgba(255,255,255,0.08)'}`,
                                background: found
                                    ? `radial-gradient(circle at 30% 24%, ${accent.glow}, transparent 46%), linear-gradient(180deg, rgba(20,24,30,0.95) 0%, rgba(8,10,14,1) 100%)`
                                    : 'linear-gradient(180deg, rgba(12,14,18,0.9) 0%, rgba(6,7,10,1) 100%)',
                            }}
                            aria-label={found ? item.name : '미발견 전설'}
                        >
                            {found ? (
                                <div className="flex items-start gap-1.5">
                                    <ItemIcon item={item} size={28} hideSignatureBadge />
                                    <div className="min-w-0">
                                        <div className="truncate text-sm font-semibold text-white">{item.name}</div>
                                        <div className="mt-0.5 text-[11px] text-amber-200/80">
                                            {CATEGORY_LABEL[meta.category ?? ''] || '전설'} · {accent.label}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center gap-1.5">
                                    <Lock size={12} className="text-slate-600" />
                                    <div className="text-[11px] font-semibold text-slate-500">미발견 전설</div>
                                </div>
                            )}
                        </button>
                    );
                })}
                </div>
            </details>

            {/* Detail */}
            {selectedEntry && <LegendaryCodexDetail entry={selectedEntry} />}
        </div>
    );
};

export default LegendaryCodex;
