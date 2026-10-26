import { useEffect, useRef } from 'react';
import { Hourglass, Zap } from 'lucide-react';
import { MSG } from '../../data/messages.js';
import { castTraySkill, type CombatSkillTrayEntry } from '../../utils/combatSkillTray';
import type { GameActions } from '../../hooks/actionDeps';

interface CombatSkillTrayProps {
  entries: CombatSkillTrayEntry[];
  actions?: Partial<Pick<GameActions, 'selectSkill' | 'combat'>>;
  isAiThinking?: boolean;
}

const chipTone = (entry: CombatSkillTrayEntry): string => {
  // 고른 칸은 에테르 테두리 · 옅은 에테르 바탕(정보 · 진행 색), 나머지는 우물 층. 회색 테두리 대신 톤 + 테두리 빛이다.
  if (entry.selected) return 'is-selected text-ae-ink';
  return 'text-ae-ink';
};

/** 칸 오른쪽의 짧은 상태 — 대기 중이면 남은 턴, 아니면 필요 기력(모자라면 붉게). 자세한 문구는 접근성 이름이 말한다. */
const ChipState = ({ entry }: { entry: CombatSkillTrayEntry }) => {
  if (entry.state === 'cooldown') {
    return (
      <span className="aether-type-label inline-flex items-center gap-0.5 font-readable tabular-nums text-ae-gold-text">
        <Hourglass size={10} aria-hidden="true" />
        {MSG.COMBAT_SKILL_CHIP_COOLDOWN(entry.cooldown)}
      </span>
    );
  }
  const short = entry.state === 'energy';
  return (
    <span className={`aether-type-label inline-flex items-center gap-0.5 font-readable tabular-nums ${short ? 'text-ae-threat' : 'text-ae-will'}`}>
      <Zap size={10} aria-hidden="true" />
      {entry.cost}
    </span>
  );
};

/** 칸의 접근성 이름 — 기술 이름 · 준비 상태, 약점을 찌르면 그것도. */
const chipLabel = (entry: CombatSkillTrayEntry): string =>
  [entry.name, entry.detailLabel, entry.weak ? MSG.COMBAT_SKILL_CHIP_WEAK : null].filter(Boolean).join(' · ');

/**
 * 고른 기술 칸이 줄 안에 보이게 가로로만 옮긴다 — `scrollIntoView`는 화면 전체를 세로로 움직일 수 있다.
 * 줄에 스크롤 스냅을 두지 않는다: 스냅이 이 위치를 가까운 칸 시작으로 다시 맞추면 고른 칸의 오른쪽이 잘린다.
 */
const revealChip = (rail: HTMLElement, name: string) => {
  const chip = [...rail.querySelectorAll<HTMLElement>('[data-testid="combat-skill-chip"]')]
    .find((node) => node.dataset.skillName === name);
  if (!chip) return;
  const left = chip.offsetLeft;
  const right = left + chip.offsetWidth;
  if (left < rail.scrollLeft) rail.scrollLeft = left;
  else if (right > rail.scrollLeft + rail.clientWidth) rail.scrollLeft = right - rail.clientWidth;
};

/**
 * 전투 기술 칸(2026-10 감사 CL-03) — 가진 기술이 모두 칸으로 보이고, 칸을 누르면 그 기술을 고르고 곧바로 쓴다.
 * 주 행동 '기술'은 지금 고른 기술(마지막으로 쓴 기술)을 다시 쓴다.
 *
 * 칸은 한 줄이고 넘치면 그 줄만 가로로 민다(이름 위 · 기력 아래, 이름은 줄이지 않는다). 세 칸씩 줄을 넘겨 쌓던 첫 구현은
 * 기술 10개(팔라딘)에서 247px였다 — 375 × 667에서 기술 칸 전체와 보스전의 '도주'가 첫 화면 밖으로 밀렸고 전투 기록이
 * 142px로 줄었다. 한 줄은 기술 수와 상관없이 같은 높이다. 고른 기술 칸은 줄 안에 보이게 옮긴다.
 *
 * 고르기만 하는 단추가 없으므로 약점 표시는 칸마다 있다 — 전투 예고의 '… 약점'은 고른 기술(마지막으로 쓴 기술)만 본다.
 *
 * 누르면 쓰는 단추라 켜고 끄는 단추(`aria-pressed`)가 아니다 — 고른 기술은 `aria-current`로 알린다.
 */
const CombatSkillTray = ({ entries, actions, isAiThinking }: CombatSkillTrayProps) => {
  const railRef = useRef<HTMLDivElement>(null);
  const selected = entries.find((entry) => entry.selected) ?? entries[0];
  const selectedName = selected?.name ?? null;

  useEffect(() => {
    if (railRef.current && selectedName) revealChip(railRef.current, selectedName);
  }, [selectedName]);

  if (!selected) return null;
  return (
    <section
      data-testid="combat-skill-tray"
      aria-label={MSG.COMBAT_SKILL_TRAY_ARIA}
      className="ae-well aether-combat-skill-tray rounded-ae-sm px-2.5 py-2"
    >
      <div className="aether-type-meta flex min-w-0 flex-wrap items-baseline gap-x-1.5 font-readable">
        <span className="ae-eyebrow shrink-0">{MSG.COMBAT_SKILL_READY_LABEL}</span>
        <span
          id="combat-skill-readiness"
          data-testid="combat-skill-readiness"
          data-skill-state={selected.state}
          className="min-w-0 font-semibold text-ae-ink"
        >
          {selected.name} · {selected.detailLabel}
        </span>
      </div>
      <div
        ref={railRef}
        data-testid="combat-skill-rail"
        className="custom-scrollbar relative mt-1.5 flex gap-1.5 overflow-x-auto overscroll-x-contain"
      >
        {entries.map((entry) => (
          <button
            key={entry.name}
            type="button"
            data-testid="combat-skill-chip"
            data-skill-name={entry.name}
            data-skill-state={entry.state}
            data-skill-weak={entry.weak ? 'true' : undefined}
            aria-current={entry.selected ? 'true' : undefined}
            aria-label={chipLabel(entry)}
            title={chipLabel(entry)}
            disabled={isAiThinking || !entry.canUse}
            onClick={() => castTraySkill(actions, entry)}
            className={`aether-combat-skill-chip ae-combat-skill-chip flex min-h-11 min-w-11 shrink-0 flex-col items-start justify-center gap-0.5 rounded-ae-sm px-2.5 py-1 text-left disabled:opacity-50 ${chipTone(entry)}`}
          >
            <span className="aether-type-body whitespace-nowrap font-readable font-semibold leading-tight">{entry.name}</span>
            <span className="inline-flex items-center gap-1.5">
              <ChipState entry={entry} />
              {entry.weak && (
                <span data-testid="combat-skill-chip-weak" className="aether-type-label whitespace-nowrap font-readable font-semibold text-ae-good">
                  {MSG.COMBAT_SKILL_CHIP_WEAK}
                </span>
              )}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
};

export default CombatSkillTray;
