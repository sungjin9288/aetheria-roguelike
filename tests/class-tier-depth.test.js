import test from 'node:test';
import assert from 'node:assert/strict';

import { CLASSES } from '../src/data/classes.js';

/**
 * Wave 14 F4 (2026-09-19) — `tier`는 무엇을 가리키는가.
 *
 * 감사 결과: `tier`는 "사다리의 칸"을 자처하지만 실제로는 **직업 그래프에서 `모험가`로부터의
 * BFS 깊이**다. 18개 중 17개가 그렇게 매겨져 있고, 성직자 하나만 `tier: 1`인데 깊이 2다
 * (`모험가 → 마법사 → 성직자`). 라벨이 가리키는 것과 어긋난 자리는 조용히 자란다 —
 * Wave 12의 맵 선언 레벨 ↔ 경로 게이트 괴리, Wave 14 F2의 체인 완주 게이트 오측정과 같은 형태다.
 *
 * **왜 성직자를 `tier: 2`로 고치지 않았는가** — 고치면 되는 한 글자가 아니었다. §18의
 * "`tier`를 읽는 곳" census(프로덕션 1곳 = `ClassIcon`의 `TIER_COLORS[tier]`, 테스트 1곳 =
 * `skill-branch-parity`)가 세 번째 독자를 빠뜨렸다: `scripts/artCatalog.mjs`의
 * `normalizeClasses`가 클래스를 `{ name, tier }`로 정규화해 아트 카탈로그 **identity 해시**에
 * 넣는다. 실측 — `tier` 한 글자를 고치면 `catalogSha256`이
 *   c15c4e6fc7ad99e37c616cc4303821fe3ce58238d2f5d98d667c5b0cb83c3ad0 →
 *   2ef481ad6abf7ecf03cacf3ebbb95eb1770cb53d62cc349c0f12fb47853d3e5f
 * 로 움직이고 유닛 테스트 70개가 빨개진다. 그 값을 박고 있는 파일이 **82개**이고 그중 71개가
 * `scripts/art_sources/**`의 아트 생산 provenance 배치 기록이다 — "이 아트는 어느 카탈로그에
 * 대해 생산됐다"는 **이력**이라 새 해시로 덮는 것은 증빙 갱신이 아니라 기록의 위조다.
 * (`reqLv`는 identity 행에 없으므로 F4의 `reqLv` 변경은 이 해시를 건드리지 않는다 — 실측.)
 *
 * 그래서 이 파일은 불변식을 **지금 참인 형태로** 고정한다: `tier == 깊이`가 17/18이고 예외는
 * 정확히 성직자 하나다. 예외 집합은 **늘어날 수 없다**(줄어들면, 즉 성직자를 고치면, 아래
 * 단언이 그것을 알려주고 이 파일은 18/18로 조여진다). 진짜 수정은 아트 identity에서 `tier`를
 * 빼는 것이다 — 아트는 직업의 사다리 칸에 따라 달라지지 않는다.
 *
 * `tier`가 **비용 밴드가 아니라 위상 라벨**이라는 것도 같이 고정한다(§18 기각 1의 실측):
 * 접근 비용 축(`cost.gates.jobs`)은 `reqLv`만 읽는다. 그래서 `tier`가 `reqLv`와 단조여야 할
 * 이유는 없고, 실제로 시간술사(tier 3 / reqLv 25)가 팔라딘(tier 3 / reqLv 45)보다 얕다.
 */

const ROOT_JOB = '모험가';

/**
 * `tier`가 깊이와 어긋나 있다고 **알려진** 직업. 이 집합은 늘리지 말 것 —
 * 늘리려면 새 어긋남을 만든 것이고, 줄이려면(= 고쳤다면) 아트 카탈로그 identity 재고정이
 * 같은 커밋에 있어야 한다.
 */
const KNOWN_TIER_DEPTH_DIVERGENCE = Object.freeze(['성직자']);

/** `next` 간선만 따라가는 BFS. 도달 불가 직업은 결과에 아예 나타나지 않는다. */
const depthFromRoot = () => {
    const depths = new Map([[ROOT_JOB, 0]]);
    let frontier = [ROOT_JOB];
    while (frontier.length > 0) {
        const nextFrontier = [];
        for (const job of frontier) {
            for (const child of CLASSES[job]?.next ?? []) {
                if (depths.has(child)) continue;
                depths.set(child, depths.get(job) + 1);
                nextFrontier.push(child);
            }
        }
        frontier = nextFrontier;
    }
    return depths;
};

const divergentJobs = () => {
    const depths = depthFromRoot();
    return Object.keys(CLASSES).filter((job) => CLASSES[job].tier !== depths.get(job));
};

test('직업 그래프는 모험가 하나를 뿌리로 18개 전부를 덮는다', () => {
    const depths = depthFromRoot();
    const jobs = Object.keys(CLASSES);

    assert.equal(jobs.length, 18);
    assert.equal(depths.size, 18, `그래프에서 도달 불가한 직업이 있다: ${
        jobs.filter((job) => !depths.has(job)).join(', ') || '(없음)'}`);
    assert.equal(CLASSES[ROOT_JOB].tier, 0);
    assert.equal(depths.get(ROOT_JOB), 0);

    // 깊이 분포를 고정한다 — 직업을 다른 부모에 옮겨 붙이면 여기가 먼저 깨진다.
    const byDepth = new Map();
    for (const job of jobs) byDepth.set(depths.get(job), (byDepth.get(depths.get(job)) ?? 0) + 1);
    assert.deepEqual(
        [...byDepth].toSorted((left, right) => left[0] - right[0]),
        [[0, 1], [1, 3], [2, 8], [3, 6]],
    );
});

test('tier는 모험가로부터의 BFS 깊이다 — 알려진 예외 하나를 빼고', () => {
    const depths = depthFromRoot();

    // 이것이 불변식이다: 어긋난 집합이 **정확히** 알려진 목록이어야 한다.
    // 새 직업이나 재배치가 어긋남을 하나 더 만들면 여기서 잡힌다.
    assert.deepEqual(divergentJobs().toSorted(), [...KNOWN_TIER_DEPTH_DIVERGENCE].toSorted());
    assert.equal(divergentJobs().length, 1);

    for (const job of Object.keys(CLASSES)) {
        if (KNOWN_TIER_DEPTH_DIVERGENCE.includes(job)) continue;
        assert.equal(CLASSES[job].tier, depths.get(job), `${job}의 tier가 깊이와 다르다`);
    }
});

test('알려진 예외는 성직자 하나이고, 그 모양까지 고정한다', () => {
    const depths = depthFromRoot();

    assert.equal(CLASSES[ROOT_JOB].next.includes('성직자'), false);
    assert.equal(CLASSES['마법사'].next.includes('성직자'), true);
    assert.equal(depths.get('성직자'), 2);
    // 선언된 라벨은 아직 1이다 — 고치는 커밋은 아트 카탈로그 identity(`catalogSha256`,
    // 82개 파일)를 같이 들고 와야 하고, 그때 `KNOWN_TIER_DEPTH_DIVERGENCE`를 비우면 된다.
    assert.equal(CLASSES['성직자'].tier, 1);

    // `tier: 2`가 되는 순간 `skill-branch-parity.test.js`의 "tier ≥ 2 ⇒ 분기 스킬 2개 이상"
    // 의무가 성직자에게도 걸린다 — 지금 이미 충족한다('신성 광선' · '기적의 손길').
    assert.equal(Object.keys(CLASSES['성직자'].skillBranches ?? {}).length >= 2, true);
});

test('첫 되돌릴 수 없는 분기는 세 뿌리에서 같은 모양이다', () => {
    // 직업 변경은 되돌릴 수 없다(`characterActions.jobChange`는 `current.next.includes`만 본다).
    // 그래서 "몇 레벨에 후속이 열리는가"는 세 뿌리에서 같아야 한다 — 한 뿌리만 일찍 열리면
    // 그 선택지는 정보 없이 집게 되는 함정이 된다(성직자 `reqLv: 5`가 정확히 그랬다).
    const openSuccessorsAt = (job, level) => (CLASSES[job].next ?? [])
        .filter((child) => (CLASSES[child].reqLv ?? 1) <= level);

    for (const root of CLASSES[ROOT_JOB].next) {
        assert.equal(CLASSES[root].reqLv, 5, `${root}는 Lv5 뿌리여야 한다`);
        assert.deepEqual(openSuccessorsAt(root, 5), [], `Lv5에서 ${root}의 후속이 열려 있다`);
        assert.deepEqual(openSuccessorsAt(root, 11), [], `Lv11에서 ${root}의 후속이 열려 있다`);
    }

    // Lv12에서 마법사가 처음으로 **진짜 2택**을 받는다(성직자 · 무당).
    assert.deepEqual(openSuccessorsAt('마법사', 12).toSorted(), ['무당', '성직자']);
    assert.deepEqual(openSuccessorsAt('전사', 12), []);
    assert.deepEqual(openSuccessorsAt('도적', 12), []);
});
