import { getJobSkills } from './gameUtils';
import { getCombatSkillReadiness, type CombatSkillReadinessState } from './combatSkillReadiness';
import { hitsEnemyWeakness } from '../systems/skillPower';
import type { GameActions } from '../hooks/actionDeps';
import type { FullStats, Monster, Player } from '../types/index.js';

/**
 * 전투 기술 칸(2026-10 감사 CL-03) — 가진 기술을 모두 펼쳐 보인다.
 *
 * 이전 전투 화면은 고른 기술 하나와 이름 없는 순환 단추(앞으로만)뿐이라, 2 · 3차 직업의 기술 7 ~ 10개를 비교하려면 여러 번 돌려야
 * 했다(자연 플레이 판당 약 884번의 추가 입력). 규칙은 그대로다 — 기술 순서 · 고른 기술(`skillLoadout.selected`) · 재사용 대기 ·
 * 기력 판정은 전투 턴 해석(`combatActionTurn`)이 읽는 것과 같고, 칸마다 준비 상태는 고른 기술과 같은 `getCombatSkillReadiness`다.
 */
export interface CombatSkillTrayEntry {
    name: string;
    /** 지금 고른 기술인가(주 행동 '기술'이 쓰는 기술). */
    selected: boolean;
    state: CombatSkillReadinessState;
    canUse: boolean;
    /** 필요 기력. */
    cost: number;
    /** 남은 재사용 대기 턴(0이면 대기 없음). */
    cooldown: number;
    /** 고른 기술 줄과 같은 문구 — 칸의 접근성 이름이 쓴다. */
    detailLabel: string;
    /** 지금 적의 약점을 찌르는 기술인가(`hitsEnemyWeakness` — 엔진 · 전투 예고와 같은 판정). */
    weak: boolean;
}

/** 칸의 약점 표시가 보는 상대 — 전투 화면의 적과 실효 능력치(무기 원소). */
interface CombatSkillTrayTarget {
    enemy?: Pick<Monster, 'weakness'> | null;
    stats?: Pick<FullStats, 'elem'> | null;
}

const resolveSelectedIndex = (player: Player, count: number): number => {
    const raw = Number.isInteger(player.skillLoadout?.selected) ? (player.skillLoadout!.selected as number) : 0;
    return ((raw % count) + count) % count;
};

/**
 * 전투 기술 칸의 뷰 모델 — `getJobSkills` 순서 그대로. 같은 이름이 두 번 나오면 앞의 것만 둔다
 * (선택은 이름으로 하고 재사용 대기도 이름으로 세므로 뒤의 칸은 앞의 칸과 구별되지 않는다).
 * 칸을 누르면 곧바로 쓰므로 약점 표시는 고른 기술만 보는 전투 예고가 아니라 칸마다 있다.
 */
export const getCombatSkillTray = (player: Player, target: CombatSkillTrayTarget = {}): CombatSkillTrayEntry[] => {
    const skills = getJobSkills(player);
    if (skills.length === 0) return [];
    const selectedName = skills[resolveSelectedIndex(player, skills.length)]?.name;
    const seen = new Set<string>();
    return skills.flatMap((skill) => {
        const name = typeof skill.name === 'string' ? skill.name : '';
        if (!name || seen.has(name)) return [];
        seen.add(name);
        const cooldown = Math.max(0, Number(player.skillLoadout?.cooldowns?.[name]) || 0);
        const readiness = getCombatSkillReadiness({ player, selectedSkill: skill, skillCooldown: cooldown });
        return [{
            name,
            selected: name === selectedName,
            state: readiness.state,
            canUse: readiness.canUse,
            cost: readiness.cost,
            cooldown,
            detailLabel: readiness.detailLabel,
            weak: hitsEnemyWeakness(skill, target.enemy, target.stats),
        }];
    });
};

type TrayActions = Partial<Pick<GameActions, 'selectSkill' | 'combat'>>;

/**
 * 칸 하나를 누르면 그 기술을 고르고 곧바로 쓴다 — 고르기(`selectSkill` → `SET_PLAYER`)와 쓰기(`combat('skill')` →
 * `RESOLVE_COMBAT_ACTION`)는 같은 순서로 리듀서에 들어가므로 턴 해석이 방금 고른 기술을 읽는다. 쓸 수 없는 칸(재사용 대기 ·
 * 기력 부족)은 아무것도 보내지 않는다. 이미 고른 기술이면 고르기를 건너뛴다. 보냈으면 true.
 */
export const castTraySkill = (actions: TrayActions | null | undefined, entry: CombatSkillTrayEntry): boolean => {
    if (!entry.canUse || !actions?.combat || !actions.selectSkill) return false;
    if (!entry.selected) actions.selectSkill(entry.name);
    actions.combat('skill');
    return true;
};
