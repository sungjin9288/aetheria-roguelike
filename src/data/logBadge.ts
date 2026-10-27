/**
 * 적이 자기 차례에 한 행동의 기록 종류(소유자 결정 D25 2026-10-26, 감사 GF-07) — 타격 · 강타 · 브레스 · 방어 자세 · 회복 · 기절 ·
 * 반격 · 하수인 타격 · 도주 실패 추격. 기록 창은 '적 행동' 배지로 내 행동과 가른다 — 예전에는 강타 · 브레스 · 반격이 'critical'
 * ('치명타' 배지), 일반 타격 · 방어 자세가 'warning'('주의' — 진짜 경고와 구분되지 않았다)이었다.
 * 줄 수 · 문구 · 난수 소비는 그대로다 — 종류 이름만 다르다(자연 플레이 드라이버 · 기록 id 불변).
 */
export const ENEMY_ACTION_LOG_TYPE = 'enemy';
/** 그 가운데 강한 한 방(강타 · 브레스 · 방어 자세 반격) — 배지는 같은 '적 행동'이고 줄만 굵게 그린다. 예전 'critical'의 정보를 잃지 않는다. */
export const ENEMY_HEAVY_LOG_TYPE = 'enemy-heavy';
const ENEMY_LOG_TYPES: ReadonlySet<string> = new Set([ENEMY_ACTION_LOG_TYPE, ENEMY_HEAVY_LOG_TYPE]);
export const isEnemyActionLogType = (type: string | null | undefined): boolean => ENEMY_LOG_TYPES.has(String(type ?? ''));

/**
 * 기록 줄 머리의 배지 종류 — 표시 계층의 분류다(기록 종류 · 줄 수 · 문구는 그대로).
 * 얻은 줄을 가르는 낱말이 한글이라 한국어 하드코딩 래칫 밖인 `src/data`에 둔다(`koreanParticles.ts`와 같은 이유).
 *
 * 소유자 결정 D26(2026-10-26): 'success' 종류는 실제로 무언가를 얻은 줄(전리품 · 보상 · 구매 · 제작 · 재화 +N …)만 '획득'이고,
 * 나머지 성공 줄('[그림자 망토] … 회피했습니다!', '시작의 마을에 도착했습니다.', 장착 · 전직 · 휴식 …)은 '안내'다.
 * 'success'를 쓰는 생산자가 90곳이 넘고 얻은 줄과 아닌 줄이 섞여 있어 생산자마다 종류를 바꾸는 대신 여기서 가른다 —
 * `tests/log-badge-kind-contract.test.js`가 실제 MSG 문구 전수(얻은 줄 · 아닌 줄)로 되돌리기를 잡는다.
 * D25: 적의 행동(`ENEMY_ACTION_LOG_TYPE` · `ENEMY_HEAVY_LOG_TYPE`)은 자기 배지('적 행동')다.
 */
export type LogBadgeKind =
    | 'combat'
    | 'critical'
    | 'enemy'
    | 'story'
    | 'system'
    | 'success'
    | 'event'
    | 'warning'
    | 'error'
    | 'legendary';

// 실제로 무언가를 얻은 줄의 표지. 낱말은 MSG 문구에서 왔다 — 전리품: · 획득 · 보상 · 얻었습니다 · 구매 완료 · 제작 완료 · 합성 성공 ·
//   보급 지급 · 유물 교체(내려놓고 새 유물을 얻는다).
const ACQUISITION_WORDS = ['전리품', '획득', '보상', '얻었', '구매 완료', '제작 완료', '합성 성공', '지급', '유물 교체'] as const;
// 표지 낱말이 있어도 얻은 물건이 아닌 줄 — 물약을 써서 "강화 효과를 얻었습니다", 시즌 완주의 "다음 시즌 보상 규모 ×N".
const NOT_ACQUISITION_PHRASES = ['효과를 얻었', '보상 규모'] as const;
// 재화가 늘어난 줄(승리 · 판매 · 원정 완료 · 크리스탈) — "공격력 +10%"(강화) · "골드 -50"(지출)은 아니다.
const CURRENCY_GAIN_RE = /(골드|경험|정수|크리스탈|크리스털)\s*\+\s*\d/;

export const isAcquisitionLogText = (text: string | null | undefined): boolean => {
    const value = String(text ?? '');
    if (NOT_ACQUISITION_PHRASES.some((phrase) => value.includes(phrase))) return false;
    return ACQUISITION_WORDS.some((word) => value.includes(word)) || CURRENCY_GAIN_RE.test(value);
};

const DIRECT_KINDS: ReadonlySet<string> = new Set([
    'combat', 'critical', 'story', 'system', 'event', 'warning', 'error', 'legendary',
]);

/** 기록 줄의 배지 종류. 배지가 없는 종류(loading · info · heal …)는 null. */
export const getLogBadgeKind = (log: { readonly type?: string | null; readonly text?: string | null }): LogBadgeKind | null => {
    const type = String(log.type ?? '');
    if (isEnemyActionLogType(type)) return 'enemy';
    if (type === 'success') return isAcquisitionLogText(log.text) ? 'success' : 'system';
    return DIRECT_KINDS.has(type) ? type as LogBadgeKind : null;
};
