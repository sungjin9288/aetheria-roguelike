import MonsterIcon from '../icons/MonsterIcon';
import type { EnemyRank } from '../../utils/enemyRank';
import type { Monster } from '../../types/index.js';

/**
 * 몬스터 그림은 160px 원본이다 — 80px는 정확히 절반(정수 배율)이라 2배 화면에서 원본 화소와 1 : 1로 맞고,
 * `pixelated`(`.aether-monster-art img`)로 그린다. 이전 46px는 0.29배라 화소가 뭉개졌다(2026-10 감사 VD-02).
 */
const ENEMY_PORTRAIT_ART_PX = 80;

/** 보스 뒤 정적 마법진의 눈금 각도(30° 간격 12개) — 움직이지 않는다. 모션 감소 설정이면 그리지 않는다(index.css `w3:combat`). */
const MAGIC_CIRCLE_TICKS = Array.from({ length: 12 }, (_, index) => index * 30);

/** 보스 뒤 정적 마법진 — 두 겹 원 · 눈금 · 여섯 꼭짓점 별. 색은 CSS(금빛 토큰)가 정한다. */
const BossMagicCircle = () => (
  <svg className="ae-enemy-magic-circle" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
    <circle cx="50" cy="50" r="47" />
    <circle cx="50" cy="50" r="38" />
    {MAGIC_CIRCLE_TICKS.map((angle) => (
      <line key={angle} x1="50" y1="3" x2="50" y2="9" transform={`rotate(${angle} 50 50)`} />
    ))}
    <polygon points="50,14 81,68 19,68" />
    <polygon points="50,86 19,32 81,32" />
  </svg>
);

interface EnemyPortraitProps {
  enemy: Monster;
  rank: EnemyRank;
}

/**
 * 교전 카드의 적 초상(2026-10 에테르 유리) — 작은 무대 한 칸: 안쪽 비네트 위에 정수 배율 화소 그림과 발밑 그림자.
 * 테두리 무게는 적의 무게(`data-enemy-rank` — 일반 < 정예 < 우두머리 < 보스)가 정하고, 보스 뒤에는 정적 마법진이 있다.
 */
const EnemyPortrait = ({ enemy, rank }: EnemyPortraitProps) => (
  <div
    data-testid="enemy-portrait"
    data-enemy-rank={rank}
    aria-hidden="true"
    className="ae-enemy-portrait relative flex h-[88px] w-[88px] shrink-0 items-center justify-center rounded-ae-md"
  >
    {rank === 'boss' && <BossMagicCircle />}
    <span className="ae-enemy-ground" aria-hidden="true" />
    {/* 그림은 종(baseName)으로 찾는다 — 표시 이름은 접두어 · 층 태그 · "…의 망령"(Wave 70) 같은 장식을 얹는다. */}
    <MonsterIcon name={enemy.baseName || enemy.name || ''} discovered isBoss={Boolean(enemy.isBoss)} size={ENEMY_PORTRAIT_ART_PX} />
  </div>
);

export default EnemyPortrait;
