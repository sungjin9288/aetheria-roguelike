import { setDoc, doc, serverTimestamp } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { BALANCE } from '../data/constants';
import { MSG } from '../data/messages.js';
import type { AiCallOutcome } from '../platform/aiEventPolicy';

// 시그니처는 firebase/firestore 의 실제 함수에서 `typeof` 로 가져온다 — 테스트가
// 주입하는 모킹 구현도 이 형태만 만족하면 된다(createCloudAutosave.ts와 같은 패턴).
type FirestoreOperations = {
    doc?: typeof doc;
    setDoc?: typeof setDoc;
    serverTimestamp?: typeof serverTimestamp;
};

/** 정산 내역 — 기록된 결과만 키로 존재한다(0은 적지 않는다). */
type OutcomeTally = Partial<Record<AiCallOutcome, number>>;

/**
 * localStorage에 저장되는 하루치 레코드.
 * `used`는 **디스패치 건수**(프록시로 실제 나간 요청 수)이고, `outcomes`는 그 디스패치들이
 * 어떻게 끝났는지다. 구형 레코드에는 `outcomes`가 없으므로 선택 필드다 — 세이브 봉투가
 * 아니라 파생 카운터라서 `DATA_VERSION`과 무관하다(없으면 빈 집계로 시작한다).
 */
interface QuotaRecord {
    date: string;
    used: number;
    outcomes: OutcomeTally;
}

/**
 * 관측용 정산 요약. "50건을 썼는데 그중 몇 건이 이야기가 됐는가"가 이 타입의 존재 이유다
 * (Wave 12 D3 — 그 전에는 그 수가 어디에도 남지 않았다).
 */
export interface AiCallLedger {
    readonly date: string;
    /** 오늘 프록시로 나간 요청 수 = 한도 게이트가 세는 값(`used`). */
    readonly dispatched: number;
    /** 결과가 실제로 채택된 호출 수. */
    readonly adopted: number;
    /** 나갔지만 채택되지 못한 호출 수(= 정산된 것 − 채택된 것). */
    readonly unadopted: number;
    /** 아직 정산이 기록되지 않은 호출 수 — 정상 흐름에서는 0(진행 중이거나 기록 유실). */
    readonly unsettled: number;
    readonly byOutcome: OutcomeTally;
}

const asRecord = (raw: unknown): Record<string, unknown> | null => (
    raw !== null && typeof raw === 'object' ? (raw as Record<string, unknown>) : null
);

/** 저장된 카운터는 신뢰 경계 밖이다 — 음수/NaN/문자열은 0으로 접는다. */
const toCount = (raw: unknown): number => {
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? Math.trunc(value) : 0;
};

const normalizeOutcomes = (raw: unknown): OutcomeTally => {
    const record = asRecord(raw);
    if (!record) return {};
    const tally: OutcomeTally = {};
    for (const key of Object.keys(record)) {
        const count = toCount(record[key]);
        if (count > 0) tally[key as AiCallOutcome] = count;
    }
    return tally;
};

const sumTally = (tally: OutcomeTally): number => (
    Object.values(tally).reduce((total: number, count: number) => total + count, 0)
);

const describeError = (error: unknown): string => (
    error instanceof Error ? error.message : String(error)
);

/**
 * 규칙 거부인가(네트워크 실패가 아니라). `firestore.rules`가 아직 안 넓혀진 배포 창에서만
 * 관측되는 신호다 — SDK 경로에 따라 `permission-denied` / `firestore/permission-denied`.
 */
const isRulesRejection = (error: unknown): boolean => {
    const code = asRecord(error)?.code;
    return typeof code === 'string' && code.endsWith('permission-denied');
};

/** rules가 `hasAll`로 요구하는 4키 — 구버전 클라이언트가 영원히 쓰는 모양이기도 하다. */
interface LegacyQuotaDocument {
    date: string;
    used: number;
    limit: number;
    updatedAt: unknown;
}

/** 넓힌 모양 — 위 4키 + 정산 2키(`unsettled`는 도출된다, 아래 주석 참조). */
interface QuotaDocument extends LegacyQuotaDocument {
    adopted: number;
    unadopted: number;
}

// --- TOKEN QUOTA MANAGER (v3.6) ---
// Limits AI calls per user per day to control costs.
//
// W12-D3 — **이 미터가 세는 것은 디스패치**(프록시로 나간 요청)이지 채택된 결과가 아니다.
//   게이트(`canMakeAICall`)가 막는 것이 디스패치이므로 미터도 디스패치를 세야 게이트가
//   실제로 조인다. 서버의 `checkRateLimit`(functions/api/ai-proxy.js:52-65)은 uid+IP에
//   60초 40건 버킷일 뿐 일일 한도가 아니고 isolate별 인메모리라, 하루 비용의 유일한
//   상한이 여기다 — 과소 집계는 그 상한을 무력화한다.
//   `recordCall()`은 디스패치 직전에 1건을 쓰고, `recordOutcome()`은 그 1건이 어떻게
//   끝났는지를 같은 레코드에 적는다(진실 원천 1곳).
/**
 * W19-K1 — 저장소 읽기는 신뢰 경계다.
 *   `localStorage.getItem` + `JSON.parse`에는 가드가 없었고, 그 예외가 실제로
 *   `AI_SERVICE.generateEvent`의 reject가 됐다(파손된 값 / 저장소 없는 런타임 /
 *   쿠키 차단). 여기서 값으로 접고, 실패 여부(`ok`)를 판정자에게 넘긴다.
 */
const readQuota = (): { ok: boolean; record: QuotaRecord } => {
    const today = new Date().toDateString();
    const emptyDay: QuotaRecord = { date: today, used: 0, outcomes: {} };
    try {
        const stored = localStorage.getItem(TokenQuotaManager.QUOTA_KEY);
        if (stored) {
            const data = asRecord(JSON.parse(stored));
            // Reset if new day
            if (data && data.date === today) {
                return { ok: true, record: { date: today, used: toCount(data.used), outcomes: normalizeOutcomes(data.outcomes) } };
            }
        }
        return { ok: true, record: emptyDay };
    } catch {
        return { ok: false, record: emptyDay };
    }
};

/** 마지막 쓰기가 성공했는가. false면 미터를 못 적는 상태이므로 게이트를 닫는다. */
let quotaWriteHealthy = true;

export const TokenQuotaManager = {
    get DAILY_LIMIT() { return BALANCE.DAILY_AI_LIMIT; },
    QUOTA_KEY: 'aetheria_ai_quota',

    /**
     * 오늘의 레코드. 읽기에 실패해도 **던지지 않는다** — 던지면 그 예외가
     * `canMakeAICall` → `decideRequest` → `generateEvent`를 타고 올라가 호출자의
     * `await`를 reject시킨다(Wave 19 K1 실측: `explore()`가 준비 중 상태를 굳힌 채
     * 죽었다). 실패는 값으로 표현하고, 판정은 `canMakeAICall`이 한다.
     */
    getQuotaData(): QuotaRecord {
        return readQuota().record;
    },

    /**
     * W19-K1 — **fail-closed**. 못 세면 보내지 않는다.
     *   이 미터가 하루 비용의 유일한 상한이므로(위 W12-D3 주석), 읽기 실패나 쓰기
     *   실패는 "한도를 모른다"가 아니라 "한도를 강제할 수 없다"다. 그 상태에서
     *   디스패치를 허용하면 파손된 저장소 하나가 상한을 통째로 무력화한다.
     *   실패 시 폴백 이벤트 풀로 접히므로 플레이어에게는 오프라인과 같은 경험이다.
     */
    canMakeAICall() {
        const { ok, record } = readQuota();
        if (!ok || !quotaWriteHealthy) return false;
        return record.used < this.DAILY_LIMIT;
    },

    // cycle 326: getRemainingCalls 메서드 제거 — 외부/내부 호출 0건이던 dead method.

    /** 디스패치 1건 기록. 응답을 보기 **전에** 부른다 — 미터는 결과가 아니라 비용을 센다. */
    recordCall() {
        const quota = this.getQuotaData();
        this.writeQuota({ ...quota, used: quota.used + 1 });
    },

    /**
     * 디스패치된 호출 1건의 정산 기록. `used`는 건드리지 않는다 — 비용은 이미 청구됐고
     * 여기서 적는 것은 "그 1건이 이야기가 됐는가"뿐이다.
     */
    recordOutcome(outcome: AiCallOutcome) {
        const quota = this.getQuotaData();
        const outcomes: OutcomeTally = { ...quota.outcomes };
        outcomes[outcome] = (outcomes[outcome] ?? 0) + 1;
        this.writeQuota({ ...quota, outcomes });
    },

    /** 쓰기 실패(사설 모드 QuotaExceededError · 쿠키 차단 SecurityError)도 던지지 않는다 —
     *  대신 미터가 고장났다는 사실을 남겨 다음 게이트가 닫히게 한다. */
    writeQuota(record: QuotaRecord) {
        try {
            localStorage.setItem(this.QUOTA_KEY, JSON.stringify(record));
            quotaWriteHealthy = true;
        } catch {
            quotaWriteHealthy = false;
        }
    },

    /**
     * 오늘의 정산 요약. 저장소가 없거나(테스트/비브라우저) 레코드가 깨졌으면 `null` —
     * 이 값은 안내 문구용 파생치라 읽기 실패가 AI 경로를 막아서는 안 된다.
     */
    getCallLedger(): AiCallLedger | null {
        try {
            const { ok, record: quota } = readQuota();
            if (!ok) return null;
            const settled = sumTally(quota.outcomes);
            const adopted = quota.outcomes.adopted ?? 0;
            return {
                date: quota.date,
                dispatched: quota.used,
                adopted,
                unadopted: settled - adopted,
                unsettled: Math.max(0, quota.used - settled),
                byOutcome: quota.outcomes,
            };
        } catch {
            return null;
        }
    },

    /**
     * 한도 소진 안내. 채택되지 못한 호출이 하나라도 있으면 그 사실을 **플레이어가 보는
     * 유일한 자리**에 싣는다 — 폴백 이벤트에 붙는 `fallbackMessage`가 이 문자열이다.
     * 미터가 디스패치를 세게 된 이상 "50을 썼는데 AI 이벤트는 거의 못 봤다"가 가능해졌고,
     * 그 차이를 숫자로 말하지 않으면 안내가 거짓말이 된다.
     */
    getExhaustedMessage() {
        const ledger = this.getCallLedger();
        if (!ledger || ledger.unadopted <= 0) return MSG.AI_QUOTA_EXHAUSTED;
        return MSG.AI_QUOTA_EXHAUSTED_LEDGER(ledger.adopted, ledger.dispatched);
    },

    // Sync quota to Firestore for cross-device tracking
    //
    // W13-E4: 페이로드는 `getCallLedger()`의 미러다 — 4키(date/used/limit/updatedAt)에
    //   정산 2키(`adopted`/`unadopted`)가 붙어 6키다. `unsettled`는 **싣지 않는다**:
    //   정산이 기록될수록 감소하므로 `firestore.rules`의 단조 규칙을 걸 수 없고, 걸지
    //   않으면 롤백 쓰기가 정산을 되감는다. 소비자는 규칙이 보장하는
    //   `unsettled = used - adopted - unadopted >= 0`으로 도출한다.
    //   `byOutcome`(미채택 4종 분해)은 중첩 맵 단조성이 필요해 여기서 멈췄다 —
    //   "50 중 몇 건이 이야기가 됐는가"는 두 카운터로 답해진다.
    //
    //   **배포 순서는 rules 먼저다.** 규칙의 `hasOnly`만 넓혔으므로 신규 rules는 구버전
    //   클라이언트(4키)를 그대로 받지만, 구버전 rules는 6키를 거부한다. 같은 커밋이어도
    //   배포는 두 파이프라인이라(.github/workflows/deploy.yml은 hosting만 올린다) 그 창이
    //   실제로 존재하므로, 거부되면 **이번 호출 안에서 4키로 한 번 접는다** — 그 창에서
    //   `used` 미러링까지 같이 죽지 않게. 상태를 안 들고 있으므로 rules가 올라간 순간
    //   다음 동기화부터 저절로 6키로 돌아온다.
    async syncToFirestore(uid: string, db: Firestore | null, firestoreOperations: FirestoreOperations = {}) {
        if (!uid || !db) return;
        try {
            const ledger = this.getCallLedger();
            // 읽기 실패(저장소 없음/레코드 파손)는 미러링할 것이 없다는 뜻이다 — 던지지 않는다.
            if (!ledger) return;
            const makeDoc = firestoreOperations.doc || doc;
            const writeDoc = firestoreOperations.setDoc || setDoc;
            const makeServerTimestamp = firestoreOperations.serverTimestamp || serverTimestamp;
            const reference = makeDoc(db, 'artifacts', 'aetheria-rpg', 'users', uid, 'quota', 'daily-ai');

            // 규칙 불변식 `adopted + unadopted <= used`에 맞춰 클램프한다. 파손된 로컬
            // 레코드(정산이 디스패치보다 많음)를 그대로 올리면 그 유저의 미러링이 날짜가
            // 바뀔 때까지 조용히 전부 거부된다 — 원장의 `unsettled`가 이미 같은 클램프다.
            const used = ledger.dispatched;
            const adopted = Math.min(ledger.adopted, used);
            const unadopted = Math.min(ledger.unadopted, used - adopted);
            const legacy: LegacyQuotaDocument = {
                date: ledger.date,
                used,
                limit: this.DAILY_LIMIT,
                updatedAt: makeServerTimestamp(),
            };
            const payload: QuotaDocument = { ...legacy, adopted, unadopted };

            try {
                await writeDoc(reference, payload, { merge: true });
            } catch (e: unknown) {
                if (!isRulesRejection(e)) throw e;
                console.warn(
                    'Quota settlement mirroring rejected — deploy firestore.rules, falling back to legacy keys:',
                    describeError(e),
                );
                await writeDoc(reference, legacy, { merge: true });
            }
        } catch (e: unknown) {
            console.warn('Quota sync failed:', describeError(e));
        }
    }
};
