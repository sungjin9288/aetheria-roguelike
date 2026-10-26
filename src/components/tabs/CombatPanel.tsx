import { useState } from 'react';
import { Sword, Zap, ArrowRight, Sparkles, Backpack, TriangleAlert, Skull, ChevronsDown, Flame } from 'lucide-react';
import { motion as Motion } from 'framer-motion';
import { buildCombatView, type CombatSignalTone } from '../../utils/combatView';
import CombatSkillTray from '../combat/CombatSkillTray';
import CombatVitalsStrip from '../combat/CombatVitalsStrip';
import ActionButton, { type ActionButtonVariant } from '../ui/ActionButton';
import Chip, { type ChipTone } from '../ui/Chip';
import { MSG } from '../../data/messages.js';
import type { EnemyDotId, FullStats, Item, Player, Monster, StatusId } from '../../types/index.js';
import type { GameActions } from '../../hooks/actionDeps';
import type { LucideIcon } from 'lucide-react';

// 감사 A11Y-06: 전투 행동 영역의 화면 낭독기 제목(눈에 보이는 배치는 그대로).
const COMBAT_ACTIONS_HEADING_ID = 'combat-actions-heading';

/**
 * CombatPanel이 실제로 호출하는 액션만 좁혀 받는다 (공격 / 기술 / 아이템 / 기술 칸).
 * 2026-10 감사 CL-03: 이름 없는 순환 단추(`cycleSkill`) 대신 기술 칸이 `selectSkill`로 고르고 곧바로 쓴다 —
 * `cycleSkill`은 명령 처리기(QA 테스트 API)에만 남는다.
 */
type CombatPanelActions = Pick<GameActions, 'combat' | 'combatUseItem' | 'useItem' | 'selectSkill' | 'getSelectedSkill'>;

// cycle 485: 컴팩트/조밀 모드 props 인터페이스 제거 — cycle 457이 callsite 명시
//   false 제거 후 caller 0건. cascade로 14 ternary + 1 const + 1 conditional UI
//   블록 일괄 정리. cycle 471-482 cascade 패턴 + cycle 457 paired completion.
interface CombatPanelProps {
    player: Player;
    actions?: CombatPanelActions;
    enemy?: Monster | null;
    stats?: FullStats | null;
    isAiThinking?: boolean;
    mobile?: boolean;
    /** App의 `useDamageFlash` 상태 — 내 생명 · 기력 막대가 맞은 순간 번쩍인다(2026-10 감사 VD-02 · GF-05). */
    damageFlash?: boolean;
    healFlash?: boolean;
}

type CombatActionKey = 'attack' | 'skill' | 'item' | 'escape';

interface CombatActionButton {
  key: CombatActionKey;
  label: string;
  mobileLabel: string;
  icon: LucideIcon;
  /** 2026-10 에테르 유리: 공격만 금빛 주 행동(화면당 하나), 기술 · 아이템은 유리, 도주는 낮은 위험(ghost). */
  variant: ActionButtonVariant;
  className: string;
}

// cycle 416: tag / detail 출력 dead 정리 — render는 icon/key/variant/className/
//   mobileLabel/label만 read.
const ACTION_BUTTONS: CombatActionButton[] = [
  {
    key: 'attack',
    label: MSG.COMBAT_ACTION_ATTACK,
    mobileLabel: MSG.COMBAT_ACTION_ATTACK,
    icon: Sword,
    variant: 'primary',
    className: 'ae-combat-action-attack',
  },
  {
    key: 'skill',
    label: MSG.COMBAT_ACTION_SKILL,
    mobileLabel: MSG.COMBAT_ACTION_SKILL,
    icon: Zap,
    variant: 'glass',
    className: 'ae-combat-action-skill',
  },
  {
    key: 'item',
    label: MSG.COMBAT_ACTION_ITEM,
    mobileLabel: MSG.COMBAT_ACTION_ITEM,
    icon: Backpack,
    variant: 'glass',
    className: 'ae-combat-action-item',
  },
  {
    key: 'escape',
    label: MSG.COMBAT_ACTION_ESCAPE,
    mobileLabel: MSG.COMBAT_ACTION_ESCAPE,
    icon: ArrowRight,
    variant: 'ghost',
    className: 'ae-combat-action-escape',
  },
];

/** 신호 칩의 의미 → 칩 색 · 아이콘. 위협 칩은 정보만이다(추천 없음 — Wave 88 · 111). */
const SIGNAL_PRESENTATION: Record<CombatSignalTone, { tone: ChipTone; icon: LucideIcon; className: string }> = {
  threat: { tone: 'threat', icon: TriangleAlert, className: '' },
  boss: { tone: 'threat', icon: Skull, className: 'ae-combat-signal-boss' },
  ready: { tone: 'gold', icon: Flame, className: '' },
  building: { tone: 'neutral', icon: Flame, className: '' },
};

/** 소모품 종류 → 이름 글자색(토큰). 바탕은 모두 같은 우물 층이다. */
const CONSUMABLE_TONE: Record<string, string> = {
  hp: 'text-ae-life',
  mp: 'text-ae-will',
  cure: 'text-ae-good',
  buff: 'text-ae-exp',
};

/** 적에게 걸린 약화(기절 · 저주 · 실명 · 공포 · 지속 피해) — 남은 턴과 함께. 라벨은 MSG 상태 이상 표다. */
const getEnemyDebuffs = (enemy: Monster): string[] => {
  const debuffs: string[] = [];
  const timed: Array<[StatusId, number | undefined]> = [
    ['stun', enemy.stunnedTurns], // 기절
    ['curse', enemy.cursedTurns], // 저주
    ['blind', enemy.blindTurns], // 실명
    ['fear', enemy.fearTurns], // 공포
  ];
  for (const [status, turns] of timed) {
    if ((turns || 0) > 0) debuffs.push(MSG.ENEMY_DOT_CHIP_TURNS(MSG.STATUS_LABELS[status], turns as number));
  }
  // 2026-09 Wave 6 X2: MSG.DOT_LABELS(공유 테이블) — dots는 poison/burn/bleed만 담는다(독/화상/출혈).
  const dots: string[] = Array.isArray(enemy?.dots) ? enemy.dots : [];
  for (const dot of dots) {
    const label = MSG.DOT_LABELS[dot as StatusId];
    // 2026-10 Wave 55: 지속 턴이 있는 지속 피해(출혈베기 · 영혼 소환 "3턴간")는 남은 턴을 함께 보인다.
    const dotTurns = enemy?.dotTurns?.[dot as EnemyDotId];
    if (label) debuffs.push(dotTurns ? MSG.ENEMY_DOT_CHIP_TURNS(label, dotTurns) : label);
  }
  return debuffs;
};

// cycle 575: enemy / stats / mobile 3 defaults batch 제거 — 1 production caller
//   (ControlPanel) 6 props 모두 명시 전달이라 도달 불가.
/**
 * 전투 조작판(2026-10 에테르 유리) — 한 장의 유리 카드 안에 내 생명 · 기력 → 신호 칩(위협 · 약화 · 전설 각인) →
 * 판단 요약 세 칸 → 행동 2 × 2(공격 = 금빛 주 행동) → 기술 칸 → 보스 카드 순서다. 넓은 칸(데스크톱 가운데 열)에서는
 * 행동이 한 줄 독(dock)으로 늘어선다(index.css `w3:combat`의 컨테이너 쿼리).
 */
const CombatPanel = ({ player, actions, enemy, stats, isAiThinking, mobile, damageFlash, healFlash }: CombatPanelProps) => {
  const [itemsOpen, setItemsOpen] = useState(false);
  const selectedSkill = actions?.getSelectedSkill ? actions.getSelectedSkill() : null;
  const skillCooldown = selectedSkill ? player.skillLoadout?.cooldowns?.[selectedSkill.name ?? ''] || 0 : 0;
  // 전투 파생 데이터(전술 프로파일·텔레그래프·콤보·전투 예보) — 계산은 buildCombatView로 분리, 여기서는 렌더링만 한다.
  const combatView = buildCombatView({ player, enemy, stats, selectedSkill, skillCooldown, mobile });
  const {
    tacticalProfile,
    signatureDropCandidates,
    primarySignatureDrop,
    combatForecast,
    combatForecastCells,
    mobileCombatSignals,
    skillReadiness,
    skillTray,
    combatConsumables,
  } = combatView;
  const enemyDebuffs = enemy ? getEnemyDebuffs(enemy) : [];
  const hasSignals = mobileCombatSignals.length > 0 || enemyDebuffs.length > 0 || Boolean(primarySignatureDrop);

  const handleAction = (key: CombatActionKey) => {
    if (key === 'item') {
      setItemsOpen((open) => !open);
      return;
    }
    actions?.combat(key);
  };

  const handleConsumableUse = (item: Item) => {
    if (actions?.combatUseItem) {
      actions.combatUseItem(item);
      return;
    }
    actions?.useItem?.(item);
  };

  return (
    <>
    <h2 id={COMBAT_ACTIONS_HEADING_ID} className="sr-only">{MSG.A11Y_COMBAT_ACTIONS_HEADING}</h2>
    <Motion.div
      role="region"
      aria-labelledby={COMBAT_ACTIONS_HEADING_ID}
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      data-testid="combat-focus-panel"
      className={`ae-combat-deck relative z-10 w-full space-y-2.5 ${mobile ? 'ae-card p-3' : 'mt-2.5'}`}
    >
      <CombatVitalsStrip
        hp={Math.max(0, player.hp || 0)}
        maxHp={Math.max(1, stats?.maxHp || player.maxHp || 1)}
        mp={Math.max(0, player.mp || 0)}
        maxMp={Math.max(1, stats?.maxMp || player.maxMp || 1)}
        damageFlash={damageFlash}
        healFlash={healFlash}
      />

      {/* 2026-10 감사 CL-06: 보스에서도 그린다 — 위협 칩(가장 센 한 방)이 첫 신호다. 정보만이다(Wave 88 · 111).
          적 약화(cycle 113)와 전설 각인(도감에 오른 것만 — Wave 103)이 같은 줄에 칩으로 이어진다. */}
      {hasSignals && (
        <div className="flex flex-wrap items-center gap-1.5" aria-label={MSG.COMBAT_SIGNALS_ARIA} role="group">
          {mobileCombatSignals.map((signal) => {
            if (!signal) return null;
            const presentation = SIGNAL_PRESENTATION[signal.tone];
            const Icon = presentation.icon;
            return (
              <Chip
                key={signal.key}
                data-testid={`combat-signal-${signal.key}`}
                tone={presentation.tone}
                icon={<Icon size={13} strokeWidth={2.2} />}
                className={`ae-combat-signal ${presentation.className}`}
              >
                {signal.text}
              </Chip>
            );
          })}
          {enemyDebuffs.length > 0 && (
            <Chip
              data-testid="combat-enemy-debuff-chip"
              data-enemy-debuff-count={enemyDebuffs.length}
              tone="good"
              icon={<ChevronsDown size={13} strokeWidth={2.2} />}
              className="ae-combat-signal"
              aria-label={MSG.ENEMY_DEBUFF_ARIA(enemyDebuffs.join(', '))}
            >
              <span className="text-ae-ink-2">{MSG.ENEMY_DEBUFF_LABEL}</span>
              <span>{enemyDebuffs[0]}{enemyDebuffs.length > 1 ? ` +${enemyDebuffs.length - 1}` : ''}</span>
            </Chip>
          )}
          {primarySignatureDrop && (
            <span
              data-testid="combat-signature-drop-hint"
              className="ae-chip ae-combat-signal ae-combat-signature-hint"
            >
              <Sparkles size={13} strokeWidth={2.2} aria-hidden="true" className="shrink-0" />
              <span>{MSG.COMBAT_SIGNATURE_HINT_LABEL}</span>
              <span className="font-semibold text-ae-ink">
                {primarySignatureDrop.name}
                {signatureDropCandidates.length > 1 ? ` ${MSG.COMBAT_SIGNATURE_HINT_MORE(signatureDropCandidates.length - 1)}` : ''}
              </span>
            </span>
          )}
        </div>
      )}

      {combatForecast && (
        <section
          data-testid="combat-forecast-strip"
          data-forecast-tone={combatForecast.tone}
          aria-label={MSG.COMBAT_FORECAST_ARIA}
          className="ae-combat-forecast grid grid-cols-3 gap-1.5"
        >
          {combatForecastCells.map((cell) => (
            <div key={cell.label} className="ae-well ae-combat-forecast-cell min-w-0 rounded-ae-sm px-2.5 py-1.5">
              <div data-testid="combat-forecast-label" className="ae-eyebrow font-readable">{cell.label}</div>
              <div data-testid="combat-forecast-value" className="aether-type-body mt-0.5 font-readable font-bold leading-snug text-ae-ink">
                {cell.value}
              </div>
            </div>
          ))}
        </section>
      )}

      <div className="ae-combat-actions grid grid-cols-2 gap-2">
        {ACTION_BUTTONS.map((action) => {
          const Icon = action.icon;
          const isDisabled = isAiThinking
            || (action.key === 'skill' && !skillReadiness.canUse)
            || (action.key === 'item' && combatConsumables.length === 0);
          const actionLabel = action.key === 'skill'
            ? skillReadiness.buttonLabel
            : action.mobileLabel || action.label;

          return (
            <ActionButton
              key={action.key}
              variant={action.variant}
              data-testid={`combat-action-${action.key}`}
              aria-expanded={action.key === 'item' ? itemsOpen : undefined}
              aria-describedby={action.key === 'skill' && selectedSkill ? 'combat-skill-readiness' : undefined}
              title={action.key === 'skill' && !skillReadiness.canUse ? skillReadiness.buttonLabel : undefined}
              disabled={isDisabled}
              onClick={() => handleAction(action.key)}
              className={`ae-combat-action min-w-0 justify-start px-2.5 ${action.className}`}
              icon={(
                <span className="aether-combat-action-icon ae-combat-action-icon">
                  <Icon size={18} strokeWidth={2.1} />
                </span>
              )}
              label={<span className="ae-combat-action-label min-w-0 text-left font-readable">{actionLabel}</span>}
            />
          );
        })}
      </div>

      {combatConsumables.length > 0 && (!mobile || itemsOpen) && (
        <div className="space-y-1.5">
          <div className="ae-eyebrow px-1 font-readable">{MSG.COMBAT_CONSUMABLES_HEADING}</div>
          <div className={`grid gap-1.5 ${mobile ? 'grid-cols-2' : 'grid-cols-3'}`}>
            {combatConsumables.map((item) => (
              <Motion.button
                key={`${item.type}:${item.name}`}
                type="button"
                data-testid={`combat-consumable-${item.id}`}
                whileTap={{ scale: 0.97 }}
                disabled={isAiThinking}
                onClick={() => handleConsumableUse(item)}
                className="ae-well ae-combat-consumable min-h-11 rounded-ae-sm px-3 py-2 text-left disabled:opacity-50"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className={`aether-type-body font-readable font-bold ${CONSUMABLE_TONE[item.type ?? ''] || 'text-ae-ink'}`}>{item.name}</span>
                  {item.count > 1 && (
                    <span className="ae-chip shrink-0 font-fira tabular-nums">
                      x{item.count}
                    </span>
                  )}
                </div>
                <div className="aether-type-meta mt-0.5 font-fira text-ae-ink-2">
                  {item.label}
                </div>
              </Motion.button>
            ))}
          </div>
        </div>
      )}

      <CombatSkillTray entries={skillTray} actions={actions} isAiThinking={isAiThinking} />

      {/* 2026-10 감사 검토: 보스 기믹 · 공략 요령 카드는 행동 단추 · 기술 칸 아래다 — 위에 두면 375 × 667 보스전에서 '도주'와
          기술 칸이 첫 화면 밖으로 밀렸다(행동은 매 차례, 카드는 처음 한 번 읽는다). 보스 위협 칩은 위의 신호 줄에 그대로 있다.
          cycle 269: tacticalProfile.signature(보스 mechanic) / counterHint(대응). */}
      {enemy?.isBoss && (tacticalProfile?.signature || tacticalProfile?.counterHint) && (
        <div className="ae-combat-boss-cards grid grid-cols-2 gap-1.5">
          {tacticalProfile?.signature && (
            <div
              data-testid="combat-boss-signature"
              className="ae-well ae-combat-boss-card min-w-0 rounded-ae-sm px-2.5 py-2 font-readable"
            >
              <div className="aether-type-label font-bold text-ae-threat">{MSG.COMBAT_BOSS_SIGNATURE_LABEL}</div>
              <div className="aether-type-body mt-0.5 text-ae-ink-2" title={tacticalProfile.signature}>
                {tacticalProfile.signature}
              </div>
            </div>
          )}
          {tacticalProfile?.counterHint && (
            <div
              data-testid="combat-boss-counter"
              className="ae-well ae-combat-boss-card min-w-0 rounded-ae-sm px-2.5 py-2 font-readable"
            >
              {/* 2026-10 감사 CL-09: 판단 요약 칸의 '권장 대응'과 다른 말이라 이름도 다르다. */}
              <div className="aether-type-label font-bold text-ae-good">{MSG.COMBAT_BOSS_CLUE_LABEL}</div>
              <div className="aether-type-body mt-0.5 text-ae-ink-2" title={tacticalProfile.counterHint}>
                {tacticalProfile.counterHint}
              </div>
            </div>
          )}
        </div>
      )}
    </Motion.div>
    </>
  );
};

export default CombatPanel;
