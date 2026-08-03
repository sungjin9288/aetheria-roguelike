import { useMemo, useState } from 'react';
import { ChevronDown, Compass, Crown, Target } from 'lucide-react';
import { DB } from '../../data/db';
import { LOOT_TABLE } from '../../data/loot';
import { BOSS_BRIEFS, MONSTERS } from '../../data/monsters';
import { MSG } from '../../data/messages';
import MonsterIcon from '../icons/MonsterIcon';
import SkillTypeIcon from '../icons/SkillTypeIcon';
import type { Player } from '../../types/index.js';

interface MonsterCodexProps {
    player?: Player | null;
}

const RESEARCH_STEPS = [
    { target: 10, label: '최대 생명 +5' },
    { target: 50, label: '방어력 +1' },
    { target: 100, label: '공격력 +1' },
];

const MonsterCodex = ({ player }: MonsterCodexProps) => {
    const [selectedMonster, setSelectedMonster] = useState<string | null>(null);

    const allMonsters = useMemo(() => {
        const registry = player?.stats?.killRegistry || {};
        const collectMapEncounters = (map: any): string[] => [
            ...(Array.isArray(map?.monsters) ? map.monsters : []),
            ...(Array.isArray(map?.bossMonsters) ? map.bossMonsters : []),
            ...(typeof map?.boss === 'string' ? [map.boss] : []),
        ];
        const monsters = new Set<string>();
        for (const map of Object.values(DB.MAPS) as any[]) {
            collectMapEncounters(map).forEach((name) => monsters.add(name));
        }

        return [...monsters].map((name) => {
            const kills = registry[name] || 0;
            const monsterMeta = (MONSTERS as any)[name] || {};
            return {
                name,
                kills,
                encountered: kills > 0,
                drops: (LOOT_TABLE as any)[name] || [],
                location: (Object.entries(DB.MAPS) as Array<[string, any]>)
                    .filter(([, map]) => collectMapEncounters(map).includes(name))
                    .map(([location]) => location)
                    .join(', '),
                bonuses: {
                    hp: kills >= 10 ? 5 : 0,
                    def: kills >= 50 ? 1 : 0,
                    atk: kills >= 100 ? 1 : 0,
                },
                weakness: monsterMeta.weakness || null,
                resistance: monsterMeta.resistance || null,
                isBoss: Boolean(monsterMeta.isBoss),
                bossBrief: (BOSS_BRIEFS as any)[name] || null,
            };
        });
    }, [player]);

    const encountered = allMonsters.filter((monster) => monster.encountered);
    const regularMonsters = encountered.filter((monster) => !monster.isBoss);
    const bosses = encountered.filter((monster) => monster.isBoss);
    const total = allMonsters.length;
    const researchGoals = encountered
        .map((monster) => {
            const step = RESEARCH_STEPS.find((entry) => monster.kills < entry.target);
            return step ? { monster, step, remaining: step.target - monster.kills } : null;
        })
        .filter(Boolean)
        .sort((left: any, right: any) => left.remaining - right.remaining)
        .slice(0, 3) as Array<{ monster: any; step: typeof RESEARCH_STEPS[number]; remaining: number }>;

    const earnedBonuses = allMonsters.reduce((totalBonus, monster) => ({
        hp: totalBonus.hp + monster.bonuses.hp,
        atk: totalBonus.atk + monster.bonuses.atk,
        def: totalBonus.def + monster.bonuses.def,
    }), { hp: 0, atk: 0, def: 0 });

    const renderDetail = (monster: any) => (
        <div data-testid={`codex-monster-detail-${monster.name}`} className="border-t border-white/8 px-2 py-3">
            <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                    <MonsterIcon name={monster.name} discovered isBoss={monster.isBoss} size={32} />
                    <div className="truncate text-sm font-semibold text-rose-100">{monster.name}</div>
                </div>
                <span className="text-[11px] text-slate-400">{MSG.MONSTER_KILL_COUNT(monster.kills)}</span>
            </div>

            <div className="mt-3 text-[11px] text-slate-300/76">출현 지역 · {monster.location || '아직 확인되지 않음'}</div>
            {(monster.weakness || monster.resistance) && (
                <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                    {monster.weakness && (
                        <span className="inline-flex min-h-7 items-center gap-1 rounded-lg border border-emerald-300/25 bg-emerald-300/10 px-2 text-emerald-100">
                            <SkillTypeIcon type={monster.weakness} size={12} />
                            {MSG.MONSTER_WEAKNESS} {monster.weakness}
                        </span>
                    )}
                    {monster.resistance && (
                        <span className="inline-flex min-h-7 items-center gap-1 rounded-lg border border-[#d5b180]/22 bg-[#d5b180]/10 px-2 text-[#f6e7c8]">
                            <SkillTypeIcon type={monster.resistance} size={12} />
                            {MSG.MONSTER_RESISTANCE} {monster.resistance}
                        </span>
                    )}
                </div>
            )}

            {monster.drops.length > 0 && (
                <div className="mt-3">
                    <div className="text-[11px] text-slate-400">획득 가능 아이템</div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                        {monster.drops.map((drop: string) => (
                            <span key={drop} className="rounded-lg border border-white/8 bg-white/[0.03] px-2 py-1 text-[11px] text-[#f6e7c8]">
                                {drop}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {monster.bossBrief && (
                <div className="mt-3 space-y-1.5 border-y border-rose-300/20 bg-rose-400/[0.06] px-2.5 py-2.5 text-[11px] text-slate-300">
                    {monster.bossBrief.signature && <div><strong className="text-rose-200">기믹</strong> · {monster.bossBrief.signature}</div>}
                    {monster.bossBrief.counterHint && <div><strong className="text-[#dff7f5]">대응</strong> · {monster.bossBrief.counterHint}</div>}
                    {monster.bossBrief.phaseHint && <div><strong className="text-[#d9d0f3]">페이즈</strong> · {monster.bossBrief.phaseHint}</div>}
                    {Array.isArray(monster.bossBrief.warningChips) && monster.bossBrief.warningChips.length > 0 && (
                        <div><strong className="text-rose-200">위협</strong> · {monster.bossBrief.warningChips.join(' · ')}</div>
                    )}
                    {Array.isArray(monster.bossBrief.recommendedBuilds) && monster.bossBrief.recommendedBuilds.length > 0 && (
                        <div><strong className="text-emerald-200">추천</strong> · {monster.bossBrief.recommendedBuilds.join(' · ')}</div>
                    )}
                </div>
            )}

            <div className="mt-3 space-y-1 text-[11px]">
                <div className="text-slate-400">연구 보너스</div>
                {RESEARCH_STEPS.map((step) => (
                    <div key={step.target} className={monster.kills >= step.target ? 'text-emerald-200' : 'text-slate-500'}>
                        {step.target}회 처치 · {step.label}{monster.kills >= step.target ? ' · 달성' : ''}
                    </div>
                ))}
            </div>
        </div>
    );

    const renderGroup = (label: string, monsters: any[], icon: typeof Compass) => {
        if (monsters.length === 0) return null;
        const Icon = icon;
        return (
            <details data-testid={`codex-monster-group-${label}`} className="group border-b border-white/10">
                <summary className="flex min-h-14 cursor-pointer list-none items-center gap-2 py-3 [&::-webkit-details-marker]:hidden">
                    <Icon size={16} className="text-slate-400" />
                    <span className="aether-type-body flex-1 font-semibold text-slate-100">{label}</span>
                    <span className="aether-type-meta text-slate-400/76">{monsters.length}종</span>
                    <ChevronDown size={16} className="text-slate-500 transition-transform group-open:rotate-180" />
                </summary>
                <div className="divide-y divide-white/8 pb-2">
                    {monsters.map((monster) => {
                        const selected = selectedMonster === monster.name;
                        return (
                            <div key={monster.name}>
                                <button
                                    type="button"
                                    onClick={() => setSelectedMonster(selected ? null : monster.name)}
                                    className="flex min-h-14 w-full items-center gap-2 px-2 text-left transition-colors hover:bg-white/[0.03]"
                                >
                                    <MonsterIcon name={monster.name} discovered isBoss={monster.isBoss} size={28} />
                                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-100">{monster.name}</span>
                                    {monster.weakness && <SkillTypeIcon type={monster.weakness} size={13} />}
                                    <span className="text-[11px] text-slate-400">{monster.kills}회</span>
                                </button>
                                {selected && renderDetail(monster)}
                            </div>
                        );
                    })}
                </div>
            </details>
        );
    };

    return (
        <div data-testid="codex-monsters" className="space-y-4">
            <div className="flex items-baseline justify-between gap-3">
                <div>
                    <h3 className="aether-type-title font-semibold text-slate-100">몬스터 연구</h3>
                    <p className="aether-type-meta mt-0.5 text-slate-400/76">조우한 생물만 이름과 전투 정보가 기록됩니다</p>
                </div>
                <span className="aether-type-body shrink-0 text-[#dff7f5]">{encountered.length}/{total}</span>
            </div>

            <div className="grid grid-cols-3 divide-x divide-white/8 border-y border-white/10 py-2 text-center">
                <div><div className="text-[11px] text-slate-400">생명</div><div className="text-sm font-semibold text-emerald-200">+{earnedBonuses.hp}</div></div>
                <div><div className="text-[11px] text-slate-400">공격력</div><div className="text-sm font-semibold text-rose-200">+{earnedBonuses.atk}</div></div>
                <div><div className="text-[11px] text-slate-400">방어력</div><div className="text-sm font-semibold text-sky-200">+{earnedBonuses.def}</div></div>
            </div>

            {researchGoals.length > 0 ? (
                <section data-testid="codex-monster-research-goals">
                    <div className="flex items-center gap-2">
                        <Target size={16} className="text-rose-200" />
                        <h4 className="aether-type-title font-semibold text-slate-100">다음 연구 목표</h4>
                    </div>
                    <div className="mt-2 divide-y divide-white/8">
                        {researchGoals.map(({ monster, step, remaining }) => (
                            <div key={monster.name} className="py-2.5">
                                <div className="flex items-baseline justify-between gap-3">
                                    <span className="aether-type-body font-semibold text-slate-100">{monster.name}</span>
                                    <span className="aether-type-body text-[#dff7f5]">{monster.kills}/{step.target}</span>
                                </div>
                                <div className="aether-type-meta mt-1 text-slate-400/76">{step.label} · {remaining}회 남음</div>
                            </div>
                        ))}
                    </div>
                </section>
            ) : (
                <div data-testid="codex-monster-research-goals" className="border-y border-white/10 py-3">
                    <div className="aether-type-body font-semibold text-slate-100">첫 연구를 시작하세요</div>
                    <div className="aether-type-meta mt-1 text-slate-400/76">탐험 중 몬스터를 처음 처치하면 출현 지역과 약점, 전리품 정보가 열립니다</div>
                </div>
            )}

            <div className="border-t border-white/10">
                {renderGroup('발견한 몬스터', regularMonsters, Compass)}
                {renderGroup('발견한 보스', bosses, Crown)}
            </div>

            <div data-testid="codex-monster-undiscovered" className="border-y border-white/10 py-3">
                <div className="aether-type-body text-slate-300">미발견 기록 {total - encountered.length}종</div>
                <div className="aether-type-meta mt-1 text-slate-500">이름 없는 칸을 나열하지 않고 실제 조우할 때 새 기록을 엽니다</div>
            </div>
        </div>
    );
};

export default MonsterCodex;
