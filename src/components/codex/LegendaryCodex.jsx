import React, { useMemo, useState } from 'react';
import { Lock, Sparkles } from 'lucide-react';
import { DB } from '../../data/db';
import { SIGNATURE_ITEM_REGISTRY } from '../../data/signatureItems.js';
import { getSignatureSetDefinitions } from '../../utils/signatureSetBonus.js';
import ItemIcon from '../icons/ItemIcon.jsx';

/**
 * 전설 도감 — dedicated signature art를 가진 20종 레전더리 아이템 컬렉션.
 *
 * 발견 상태는 player.stats.codex.{weapons|armors|shields}에서 읽어와서
 * family codex와 동일한 룰로 잠금/잠금해제 표시.
 */

const TONE_ACCENT = Object.freeze({
    holy: { border: 'rgba(246,231,162,0.6)', glow: 'rgba(246,231,162,0.18)', label: '빛' },
    fire: { border: 'rgba(255,180,138,0.6)', glow: 'rgba(255,180,138,0.18)', label: '화염' },
    frost: { border: 'rgba(204,232,245,0.55)', glow: 'rgba(204,232,245,0.16)', label: '냉기' },
    shadow: { border: 'rgba(199,164,240,0.6)', glow: 'rgba(199,164,240,0.18)', label: '어둠' },
    arcane: { border: 'rgba(192,176,232,0.6)', glow: 'rgba(192,176,232,0.18)', label: '비전' },
    nature: { border: 'rgba(168,208,160,0.55)', glow: 'rgba(168,208,160,0.16)', label: '자연' },
    earth: { border: 'rgba(216,184,120,0.5)', glow: 'rgba(216,184,120,0.14)', label: '대지' },
    steel: { border: 'rgba(230,236,244,0.5)', glow: 'rgba(230,236,244,0.14)', label: '강철' },
    rust: { border: 'rgba(217,165,108,0.5)', glow: 'rgba(217,165,108,0.14)', label: '광란' },
});

const CATEGORY_LABEL = Object.freeze({
    'unique-weapon': 'UNIQUE',
    'boss-drop': 'BOSS DROP',
    'set-core': 'SET CORE',
});

const DEFAULT_TONE_ACCENT = TONE_ACCENT.holy;

const resolveDiscoveryBucket = (item) => {
    if (item.type === 'weapon') return 'weapons';
    if (item.type === 'shield') return 'shields';
    if (item.type === 'armor') return 'armors';
    return null;
};

const buildEntries = () => {
    const all = [
        ...(DB.ITEMS.weapons || []),
        ...(DB.ITEMS.armors || []),
    ];
    const byName = Object.fromEntries(all.map((item) => [item.name, item]));
    return Object.entries(SIGNATURE_ITEM_REGISTRY)
        .map(([name, meta]) => {
            const item = byName[name];
            if (!item) return null;
            return { item, meta };
        })
        .filter(Boolean);
};

const LegendaryCodex = ({ player }) => {
    const [selected, setSelected] = useState(null);
    const codex = useMemo(() => player?.stats?.codex || {}, [player?.stats?.codex]);
    const entries = useMemo(() => buildEntries(), []);
    const discoveredCount = entries.filter((entry) => {
        const bucket = resolveDiscoveryBucket(entry.item);
        return bucket && codex[bucket]?.[entry.item.name];
    }).length;

    const selectedEntry = selected
        ? entries.find((entry) => entry.item.name === selected)
        : null;

    const setSummary = useMemo(() => {
        const sets = getSignatureSetDefinitions();
        return Object.entries(sets).map(([key, def]) => {
            const discovered = def.members.filter((memberName) => {
                const entry = entries.find((e) => e.item.name === memberName);
                if (!entry) return false;
                const bucket = resolveDiscoveryBucket(entry.item);
                return bucket && codex[bucket]?.[entry.item.name];
            }).length;
            const equipped = def.members.filter((memberName) => {
                const equip = player?.equip;
                return equip?.weapon?.name === memberName
                    || equip?.armor?.name === memberName
                    || equip?.offhand?.name === memberName;
            }).length;
            return { key, def, total: def.members.length, discovered, equipped };
        });
    }, [codex, entries, player?.equip]);

    return (
        <div className="space-y-2">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[9px] font-fira text-slate-400 uppercase tracking-wider">
                    <Sparkles size={11} className="text-amber-300" />
                    Legendary Collection
                </div>
                <div className="text-[9px] font-fira text-amber-200">
                    {discoveredCount}/{entries.length}
                </div>
            </div>

            {/* Set summary */}
            {setSummary.length > 0 && (
                <div className="space-y-1.5">
                    <div className="text-[9px] font-fira text-slate-500 uppercase tracking-wider">Sets</div>
                    <div className="grid grid-cols-1 gap-1.5">
                        {setSummary.map(({ key, def, total, discovered, equipped }) => {
                            const accent = TONE_ACCENT[def.tone] || DEFAULT_TONE_ACCENT;
                            const activeBonus = equipped >= 2
                                ? def.bonuses[String([...Object.keys(def.bonuses)].map(Number).filter((n) => n <= equipped).sort((a, b) => b - a)[0])]
                                : null;
                            return (
                                <div
                                    key={key}
                                    className="rounded-lg px-2.5 py-1.5 flex flex-col gap-0.5"
                                    style={{
                                        border: `1px solid ${equipped >= 2 ? accent.border : 'rgba(255,255,255,0.08)'}`,
                                        background: equipped >= 2
                                            ? `radial-gradient(circle at 18% 40%, ${accent.glow}, transparent 50%), linear-gradient(180deg, rgba(20,24,30,0.95) 0%, rgba(10,12,16,1) 100%)`
                                            : 'linear-gradient(180deg, rgba(14,17,22,0.9) 0%, rgba(8,10,14,1) 100%)',
                                    }}
                                >
                                    <div className="flex items-center justify-between text-[10px] font-fira">
                                        <span className="font-rajdhani font-bold text-white text-[11px]">{def.name}</span>
                                        <span className={equipped >= 2 ? 'text-amber-200' : 'text-slate-500'}>
                                            {equipped > 0 ? `장착 ${equipped}` : '미장착'} · 수집 {discovered}/{total}
                                        </span>
                                    </div>
                                    {activeBonus && (
                                        <div className="text-[9px] font-fira text-amber-200/90">
                                            {activeBonus.desc}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Grid */}
            <div className="grid grid-cols-3 gap-1.5 max-h-[45vh] overflow-y-auto custom-scrollbar">
                {entries.map(({ item, meta }) => {
                    const bucket = resolveDiscoveryBucket(item);
                    const found = bucket ? Boolean(codex[bucket]?.[item.name]) : false;
                    const accent = TONE_ACCENT[meta.tone] || DEFAULT_TONE_ACCENT;
                    const isSelected = selected === item.name;

                    return (
                        <button
                            key={item.name}
                            type="button"
                            onClick={() => found && setSelected(isSelected ? null : item.name)}
                            className={`relative p-2 rounded-lg text-left transition-all text-[10px] ${found ? 'hover:brightness-125' : 'opacity-30 cursor-default'} ${isSelected ? 'ring-1 ring-amber-300/60' : ''}`}
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
                                        <div className="font-rajdhani font-bold text-white truncate text-[10px]">{item.name}</div>
                                        <div className="text-[8px] font-fira text-amber-200/80 mt-0.5 tracking-wider">
                                            {CATEGORY_LABEL[meta.category] || 'LEGEND'} · {accent.label}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center gap-1.5">
                                    <Lock size={12} className="text-slate-600" />
                                    <div className="font-rajdhani font-bold text-slate-600 text-[10px]">???</div>
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Detail */}
            {selectedEntry && (
                <div
                    className="rounded-lg p-3 text-[11px]"
                    style={{
                        border: `1px solid ${(TONE_ACCENT[selectedEntry.meta.tone] || DEFAULT_TONE_ACCENT).border}`,
                        background: `linear-gradient(180deg, rgba(20,24,30,0.95) 0%, rgba(10,12,16,1) 100%)`,
                    }}
                >
                    <div className="flex items-start gap-3">
                        <ItemIcon item={selectedEntry.item} size={48} hideSignatureBadge />
                        <div className="min-w-0 flex-1">
                            <div className="font-rajdhani font-bold text-white text-[13px]">{selectedEntry.item.name}</div>
                            <div className="text-[9px] font-fira text-amber-200/80 tracking-wider mt-0.5">
                                {CATEGORY_LABEL[selectedEntry.meta.category] || 'LEGEND'}
                                <span className="mx-1 text-slate-600">·</span>
                                {(TONE_ACCENT[selectedEntry.meta.tone] || DEFAULT_TONE_ACCENT).label}
                                {selectedEntry.item.desc_stat ? (
                                    <>
                                        <span className="mx-1 text-slate-600">·</span>
                                        <span className="text-slate-300">{selectedEntry.item.desc_stat}</span>
                                    </>
                                ) : null}
                            </div>
                            {selectedEntry.item.desc && (
                                <div className="text-[10px] font-fira text-slate-400 mt-1.5 leading-relaxed">
                                    {selectedEntry.item.desc}
                                </div>
                            )}
                            <div className="text-[9px] font-fira text-slate-500 mt-1.5 italic">
                                {selectedEntry.meta.artNote}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LegendaryCodex;
