const HOUR = 60 * 60 * 1_000;
const D1_START = 24 * HOUR;
const D1_END = 48 * HOUR;
const D7_START = 168 * HOUR;
const D7_END = 192 * HOUR;

const EVENT_OUTCOMES = {
    boot: new Set(['ready', 'offline']),
    character_created: new Set(['success']),
    move: new Set(['success']),
    combat_start: new Set(['normal', 'boss']),
    safe_expedition_return: new Set(['success']),
};

const compareOrder = (left, right) => (
    left.receivedAt - right.receivedAt || left.serverSequence - right.serverSequence
);

const isAfter = (event, previous) => compareOrder(event, previous) > 0;

const firstAcceptedEventAfter = (events, name, previous) => events.find((event) => (
    event.name === name
    && EVENT_OUTCOMES[name].has(event.outcome)
    && isAfter(event, previous)
));

const inWindow = (value, start, end) => value >= start && value < end;

export const aggregateProductFunnel = (rawEvents, { releaseId }) => {
    const events = (Array.isArray(rawEvents) ? rawEvents : [])
        .filter((event) => event?.releaseId === releaseId);
    if (events.some((event) => (
        typeof event.cohortId !== 'string'
        || !event.cohortId.trim()
        || !Number.isFinite(event.receivedAt)
        || typeof event.sessionId !== 'string'
        || !event.sessionId.trim()
    ))) {
        return { ok: false, reason: 'identity_authority_missing' };
    }
    if (events.some((event) => !Number.isSafeInteger(event.serverSequence) || event.serverSequence < 0)) {
        return { ok: false, reason: 'event_order_authority_missing' };
    }

    const byCohort = new Map();
    const orderKeysByCohort = new Map();
    for (const event of events) {
        const cohortId = event.cohortId.trim();
        if (!byCohort.has(cohortId)) byCohort.set(cohortId, []);
        if (!orderKeysByCohort.has(cohortId)) orderKeysByCohort.set(cohortId, new Set());
        const orderKey = `${event.receivedAt}:${event.serverSequence}`;
        const orderKeys = orderKeysByCohort.get(cohortId);
        if (orderKeys.has(orderKey)) {
            return { ok: false, reason: 'event_order_authority_missing' };
        }
        orderKeys.add(orderKey);
        byCohort.get(cohortId).push(event);
    }

    const counts = {
        boot: 0,
        characterCreated: 0,
        firstMove: 0,
        firstCombat: 0,
        safeReturn: 0,
        d1: 0,
        d7: 0,
    };

    for (const cohortEvents of byCohort.values()) {
        cohortEvents.sort(compareOrder);
        const boot = cohortEvents.find((event) => (
            event.name === 'boot' && EVENT_OUTCOMES.boot.has(event.outcome)
        ));
        if (!boot) continue;
        counts.boot += 1;

        const created = firstAcceptedEventAfter(cohortEvents, 'character_created', boot);
        if (created) counts.characterCreated += 1;
        const moved = created
            ? firstAcceptedEventAfter(cohortEvents, 'move', created)
            : null;
        if (moved) counts.firstMove += 1;
        const combat = moved
            ? firstAcceptedEventAfter(cohortEvents, 'combat_start', moved)
            : null;
        if (combat) counts.firstCombat += 1;
        const returned = combat
            ? firstAcceptedEventAfter(cohortEvents, 'safe_expedition_return', combat)
            : null;
        if (returned) counts.safeReturn += 1;

        const elapsedBoots = cohortEvents
            .filter((event) => (
                event.name === 'boot'
                && EVENT_OUTCOMES.boot.has(event.outcome)
                && event.sessionId !== boot.sessionId
            ))
            .map((event) => event.receivedAt - boot.receivedAt);
        if (elapsedBoots.some((elapsed) => inWindow(elapsed, D1_START, D1_END))) counts.d1 += 1;
        if (elapsedBoots.some((elapsed) => inWindow(elapsed, D7_START, D7_END))) counts.d7 += 1;
    }

    const denominator = counts.boot;
    const rate = (count) => denominator === 0 ? 0 : count / denominator;
    return {
        ok: true,
        releaseId,
        sampleSize: denominator,
        directionalRetention: denominator < 100,
        counts,
        rates: {
            characterCreated: rate(counts.characterCreated),
            firstMove: rate(counts.firstMove),
            firstCombat: rate(counts.firstCombat),
            safeReturn: rate(counts.safeReturn),
            d1: rate(counts.d1),
            d7: rate(counts.d7),
        },
    };
};
