import { useMemo, useState } from 'react';
import { ChevronDown, Compass, Crown, Target } from 'lucide-react';
import { DB } from '../../data/db';
import { getBossBrief, MONSTERS, type BossBrief } from '../../data/monsters';
import { MSG } from '../../data/messages';
import { getMonsterCodexDrops } from '../../utils/codexDropSources';
import MonsterIcon from '../icons/MonsterIcon';
import SkillTypeIcon from '../icons/SkillTypeIcon';
import Chip from '../ui/Chip';
import type { ElementKey, GameMap, Player } from '../../types/index.js';
import { withoutUndiscoveredSignatures } from '../../utils/signatureDiscovery';

interface MonsterCodexProps {
    player?: Player | null;
    /** 처음 펼쳐 둘 기록(처치한 몬스터 이름) — 정적 렌더 검증용, 기본은 모두 접힘. */
    initialSelectedMonster?: string | null;
}

const RESEARCH_STEPS = [
    { target: 10, label: MSG.CODEX_MONSTER_STEP_HP },
    { target: 50, label: MSG.CODEX_MONSTER_STEP_DEF },
    { target: 100, label: MSG.CODEX_MONSTER_STEP_ATK },
];

/** allMonsters가 생산하는 코덱스 엔트리 1건. */
interface MonsterCodexEntry {
    name: string;
    kills: number;
    encountered: boolean;
    drops: string[];
    location: string;
    bonuses: { hp: number; def: number; atk: number };
    weakness: ElementKey | null;
    resistance: ElementKey | null;
    isBoss: boolean;
    bossBrief: BossBrief | null;
}

const BRIEF_ROWS = [
    { key: 'signature', label: MSG.CODEX_MONSTER_BRIEF_LABELS.signature, tone: 'text-ae-threat' },
    { key: 'counterHint', label: MSG.CODEX_MONSTER_BRIEF_LABELS.counter, tone: 'text-ae-ether-hi' },
    { key: 'phaseHint', label: MSG.CODEX_MONSTER_BRIEF_LABELS.phase, tone: 'text-ae-exp' },
] as const;

const BossBriefBlock = ({ brief }: { brief: BossBrief }) => {
    const warnings = Array.isArray(brief.warningChips) ? brief.warningChips : [];
    const builds = Array.isArray(brief.recommendedBuilds) ? brief.recommendedBuilds : [];
    return (
        <div className="ae-well aether-type-meta mt-3 space-y-1.5 px-3 py-2.5 text-ae-ink-2">
            {BRIEF_ROWS.map((row) => (brief[row.key] ? (
                <div key={row.key}><strong className={row.tone}>{row.label}</strong> · {brief[row.key]}</div>
            ) : null))}
            {warnings.length > 0 && (
                <div><strong className="text-ae-threat">{MSG.CODEX_MONSTER_BRIEF_LABELS.warning}</strong> · {warnings.join(' · ')}</div>
            )}
            {builds.length > 0 && (
                <div><strong className="text-ae-good">{MSG.CODEX_MONSTER_BRIEF_LABELS.builds}</strong> · {builds.join(' · ')}</div>
            )}
        </div>
    );
};

const MonsterCodexDetail = ({ monster }: { monster: MonsterCodexEntry }) => (
    <div data-testid={`codex-monster-detail-${monster.name}`} className="ae-well mx-1 mb-2 px-3 py-3">
        <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
                <MonsterIcon name={monster.name} discovered isBoss={monster.isBoss} size={32} />
                <div className="aether-type-body min-w-0 font-semibold text-ae-ink">{monster.name}</div>
            </div>
            <span className="aether-type-meta shrink-0 font-fira tabular-nums text-ae-ink-3">{MSG.MONSTER_KILL_COUNT(monster.kills)}</span>
        </div>

        <div className="aether-type-meta mt-3 text-ae-ink-2">{MSG.CODEX_MONSTER_LOCATION(monster.location || MSG.CODEX_MONSTER_LOCATION_UNKNOWN)}</div>
        {(monster.weakness || monster.resistance) && (
            <div className="mt-2 flex flex-wrap gap-1.5">
                {monster.weakness && (
                    <Chip tone="good" icon={<SkillTypeIcon type={monster.weakness} size={12} />}>
                        {MSG.MONSTER_WEAKNESS} {monster.weakness}
                    </Chip>
                )}
                {monster.resistance && (
                    <Chip tone="gold" icon={<SkillTypeIcon type={monster.resistance} size={12} />}>
                        {MSG.MONSTER_RESISTANCE} {monster.resistance}
                    </Chip>
                )}
            </div>
        )}

        {monster.drops.length > 0 && (
            <div data-testid="codex-monster-drops" className="mt-3">
                <div className="aether-type-meta text-ae-ink-3">{MSG.CODEX_MONSTER_DROPS_LABEL}</div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                    {monster.drops.map((drop: string) => (
                        <Chip key={drop} data-testid="codex-monster-drop" tone="gold">{drop}</Chip>
                    ))}
                </div>
            </div>
        )}

        {monster.bossBrief && <BossBriefBlock brief={monster.bossBrief} />}

        <div className="aether-type-meta mt-3 space-y-1">
            <div className="text-ae-ink-3">{MSG.CODEX_MONSTER_RESEARCH_TITLE}</div>
            {RESEARCH_STEPS.map((step) => {
                const done = monster.kills >= step.target;
                return (
                    <div key={step.target} className={done ? 'text-ae-good' : 'text-ae-ink-3'}>
                        {MSG.CODEX_MONSTER_RESEARCH_ROW(step.target, step.label, done)}
                    </div>
                );
            })}
        </div>
    </div>
);

const MonsterCodex = ({ player, initialSelectedMonster = null }: MonsterCodexProps) => {
    const [selectedMonster, setSelectedMonster] = useState<string | null>(initialSelectedMonster);

    const allMonsters = useMemo<MonsterCodexEntry[]>(() => {
        const registry = player?.stats?.killRegistry || {};
        const collectMapEncounters = (map: GameMap): string[] => [
            ...(Array.isArray(map?.monsters) ? map.monsters : []),
            ...(Array.isArray(map?.bossMonsters) ? map.bossMonsters : []),
            ...(typeof map?.boss === 'string' ? [map.boss] : []),
        ];
        const monsters = new Set<string>();
        for (const map of Object.values(DB.MAPS)) {
            collectMapEncounters(map).forEach((name) => monsters.add(name));
        }

        return [...monsters].map((name) => {
            const kills = registry[name] || 0;
            const monsterMeta = MONSTERS[name] || {};
            return {
                name,
                kills,
                encountered: kills > 0,
                // 2026-10 Wave 103: 아직 도감에 없는 전설 각인은 전리품 칩에 보이지 않는다.
                drops: withoutUndiscoveredSignatures(getMonsterCodexDrops(name), player),
                location: Object.entries(DB.MAPS)
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
                bossBrief: getBossBrief(name),
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
        .filter((entry): entry is { monster: MonsterCodexEntry; step: typeof RESEARCH_STEPS[number]; remaining: number } => entry !== null)
        .sort((left, right) => left.remaining - right.remaining)
        .slice(0, 3);

    const earnedBonuses = allMonsters.reduce((totalBonus, monster) => ({
        hp: totalBonus.hp + monster.bonuses.hp,
        atk: totalBonus.atk + monster.bonuses.atk,
        def: totalBonus.def + monster.bonuses.def,
    }), { hp: 0, atk: 0, def: 0 });

    const renderGroup = (label: string, monsters: MonsterCodexEntry[], icon: typeof Compass) => {
        if (monsters.length === 0) return null;
        const Icon = icon;
        return (
            <details data-testid={`codex-monster-group-${label}`} className="group">
                <summary className="ab-summary min-h-14">
                    <span className="ab-icon-well" aria-hidden="true">
                        <Icon size={16} />
                    </span>
                    <span className="aether-type-body flex-1 font-semibold text-ae-ink">{label}</span>
                    <span className="aether-type-meta font-fira tabular-nums text-ae-ink-3">{MSG.CODEX_MONSTER_GROUP_COUNT(monsters.length)}</span>
                    <ChevronDown size={16} className="ab-chevron" aria-hidden="true" />
                </summary>
                <div className="ab-rows pb-2">
                    {monsters.map((monster) => {
                        const selected = selectedMonster === monster.name;
                        return (
                            <div key={monster.name}>
                                <button
                                    type="button"
                                    aria-expanded={selected}
                                    onClick={() => setSelectedMonster(selected ? null : monster.name)}
                                    className="ab-link-row flex min-h-14 w-full items-center gap-2 px-2 text-left"
                                >
                                    <MonsterIcon name={monster.name} discovered isBoss={monster.isBoss} size={28} />
                                    <span className="aether-type-body min-w-0 flex-1 font-semibold text-ae-ink">{monster.name}</span>
                                    {monster.weakness && <SkillTypeIcon type={monster.weakness} size={13} />}
                                    <span className="aether-type-meta shrink-0 font-fira tabular-nums text-ae-ink-3">{MSG.CODEX_MONSTER_LIST_KILLS(monster.kills)}</span>
                                </button>
                                {selected && <MonsterCodexDetail monster={monster} />}
                            </div>
                        );
                    })}
                </div>
            </details>
        );
    };

    return (
        <div data-testid="codex-monsters" className="ab-stack">
            <div className="flex items-baseline justify-between gap-3 px-1">
                <div>
                    <h3 className="ab-section-title">{MSG.CODEX_MONSTER_TITLE}</h3>
                    <p className="aether-type-meta mt-0.5 text-ae-ink-3">{MSG.CODEX_MONSTER_HEADER_HINT}</p>
                </div>
                <span className="aether-type-body shrink-0 font-fira tabular-nums text-ae-ether-hi">{encountered.length}/{total}</span>
            </div>

            <div className="ae-well grid grid-cols-3 py-2 text-center">
                <div><div className="aether-type-meta text-ae-ink-3">{MSG.CODEX_MONSTER_BONUS_LABELS.hp}</div><div className="aether-type-body font-fira font-semibold tabular-nums text-ae-life">+{earnedBonuses.hp}</div></div>
                <div className="border-x border-ae-ink/7"><div className="aether-type-meta text-ae-ink-3">{MSG.CODEX_MONSTER_BONUS_LABELS.atk}</div><div className="aether-type-body font-fira font-semibold tabular-nums text-ae-threat">+{earnedBonuses.atk}</div></div>
                <div><div className="aether-type-meta text-ae-ink-3">{MSG.CODEX_MONSTER_BONUS_LABELS.def}</div><div className="aether-type-body font-fira font-semibold tabular-nums text-ae-will">+{earnedBonuses.def}</div></div>
            </div>

            {researchGoals.length > 0 ? (
                <section data-testid="codex-monster-research-goals" className="ae-card ab-card-pad">
                    <div className="flex items-center gap-2">
                        <Target size={16} className="text-ae-threat" aria-hidden="true" />
                        <h4 className="ab-section-title">{MSG.CODEX_MONSTER_NEXT_TITLE}</h4>
                    </div>
                    <div className="ab-rows mt-2">
                        {researchGoals.map(({ monster, step, remaining }) => (
                            <div key={monster.name} className="py-2.5">
                                <div className="flex items-baseline justify-between gap-3">
                                    <span className="aether-type-body font-semibold text-ae-ink">{monster.name}</span>
                                    <span className="aether-type-body shrink-0 font-fira tabular-nums text-ae-ether-hi">{monster.kills}/{step.target}</span>
                                </div>
                                <div className="aether-type-meta mt-1 text-ae-ink-3">{MSG.CODEX_MONSTER_RESEARCH_REMAINING(step.label, remaining)}</div>
                            </div>
                        ))}
                    </div>
                </section>
            ) : (
                <div data-testid="codex-monster-research-goals" className="ae-card is-quiet ab-card-pad">
                    <div className="aether-type-body font-semibold text-ae-ink">{MSG.CODEX_MONSTER_EMPTY_TITLE}</div>
                    <div className="aether-type-meta mt-1 text-ae-ink-3">{MSG.CODEX_MONSTER_EMPTY_HINT}</div>
                </div>
            )}

            {encountered.length > 0 && (
                <div className="ae-card ab-rows px-3.5">
                    {renderGroup(MSG.CODEX_MONSTER_GROUP_REGULAR, regularMonsters, Compass)}
                    {renderGroup(MSG.CODEX_MONSTER_GROUP_BOSS, bosses, Crown)}
                </div>
            )}

            <div data-testid="codex-monster-undiscovered" className="ab-tile is-undiscovered px-3.5 py-3">
                <div className="aether-type-body text-ae-ink-2">{MSG.CODEX_MONSTER_UNDISCOVERED(total - encountered.length)}</div>
                <div className="aether-type-meta mt-1 text-ae-ink-3">{MSG.CODEX_MONSTER_UNDISCOVERED_HINT}</div>
            </div>
        </div>
    );
};

export default MonsterCodex;
