import assert from 'node:assert/strict';
import test from 'node:test';

import { createProductEventCoordinator } from '../src/platform/productEventCoordinator.ts';
import {
    collectProductTelemetryTransitions,
    createProductTelemetrySnapshot,
} from '../src/hooks/useProductTelemetry.ts';

const baseState = {
    bootStage: 'data',
    gameState: 'idle',
    enemy: null,
    currentEvent: null,
    combatTurn: 0,
    combatReceipt: null,
    player: {
        name: '',
        job: '모험가',
        level: 1,
        loc: '시작의 마을',
        stats: { kills: 0, bossKills: 0 },
        activeExpedition: null,
        lastExpeditionSummary: null,
    },
};

const snapshot = (patch = {}) => createProductTelemetrySnapshot({
    ...baseState,
    ...patch,
    player: { ...baseState.player, ...(patch.player || {}) },
});

test('accepted state transitions emit the ordered first-session funnel without PII payloads', () => {
    const ready = snapshot({ bootStage: 'ready' });
    const created = snapshot({ bootStage: 'ready', player: { name: '비공개 닉네임', job: '전사' } });
    const mission = snapshot({
        bootStage: 'ready', gameState: 'quest_board',
        player: { name: '비공개 닉네임', job: '전사' },
    });
    const moved = snapshot({
        bootStage: 'ready',
        player: {
            name: '비공개 닉네임', job: '전사', loc: '고요한 숲',
            activeExpedition: { id: 'exp-1', startedAt: 100, explores: 0 },
        },
    });
    const explored = snapshot({
        bootStage: 'ready', gameState: 'event', currentEvent: { id: 'private-event' },
        player: {
            name: '비공개 닉네임', job: '전사', loc: '고요한 숲',
            activeExpedition: { id: 'exp-1', startedAt: 100, explores: 1 },
        },
    });

    const emissions = [
        ...collectProductTelemetryTransitions(snapshot(), ready),
        ...collectProductTelemetryTransitions(ready, created),
        ...collectProductTelemetryTransitions(created, mission),
        ...collectProductTelemetryTransitions(mission, moved),
        ...collectProductTelemetryTransitions(moved, explored),
    ];
    assert.deepEqual(emissions.map(({ name, fields }) => [name, fields.outcome]), [
        ['boot', 'ready'],
        ['character_created', 'success'],
        ['mission_open', 'success'],
        ['first_action', 'mission_open'],
        ['move', 'success'],
        ['first_action', 'move'],
        ['explore', 'event'],
        ['first_action', 'explore'],
    ]);
    assert.equal(JSON.stringify(emissions).includes('비공개 닉네임'), false);
    assert.equal(JSON.stringify(emissions).includes('private-event'), false);
    assert.equal(JSON.stringify(emissions).includes('고요한 숲'), false);
});

test('combat and safe return use accepted receipt authority and reducer replay emits nothing', () => {
    const expeditionPlayer = {
        name: 'player', job: '전사',
        activeExpedition: { id: 'exp-2', startedAt: 200, explores: 1 },
    };
    const idle = snapshot({
        bootStage: 'ready',
        player: expeditionPlayer,
    });
    const combat = snapshot({
        bootStage: 'ready', gameState: 'combat', combatTurn: 0,
        enemy: { id: 'secret-enemy', isBoss: true },
        player: expeditionPlayer,
    });
    const victory = snapshot({
        bootStage: 'ready', gameState: 'idle',
        combatReceipt: { key: 'receipt-1', kind: 'victory' },
        player: { ...expeditionPlayer, stats: { kills: 1, bossKills: 1 } },
    });
    const returned = snapshot({
        bootStage: 'ready', gameState: 'idle',
        combatReceipt: { key: 'receipt-1', kind: 'victory' },
        player: {
            ...expeditionPlayer,
            stats: { kills: 1, bossKills: 1 },
            activeExpedition: null,
            lastExpeditionSummary: { id: 'exp-2', returnReason: 'safe_return' },
        },
    });

    assert.deepEqual(collectProductTelemetryTransitions(idle, combat).map((entry) => [entry.name, entry.fields.outcome]), [
        ['combat_start', 'boss'],
    ]);
    assert.deepEqual(collectProductTelemetryTransitions(combat, victory).map((entry) => [entry.name, entry.fields.outcome]), [
        ['combat_end', 'victory'],
    ]);
    assert.deepEqual(collectProductTelemetryTransitions(victory, returned).map((entry) => [entry.name, entry.fields.outcome]), [
        ['safe_expedition_return', 'success'],
    ]);
    assert.deepEqual(collectProductTelemetryTransitions(returned, returned), []);
});

test('coordinator dedupes StrictMode and repeated receipt emissions while preserving first action once', () => {
    const tracked = [];
    const coordinator = createProductEventCoordinator({
        track: (name, fields) => tracked.push([name, fields.outcome]),
    });
    const emissions = [
        { receipt: 'boot', name: 'boot', fields: { job: 'unknown', level: 1, outcome: 'ready' } },
        { receipt: 'boot', name: 'boot', fields: { job: 'unknown', level: 1, outcome: 'ready' } },
        { receipt: 'first-action', name: 'first_action', fields: { job: '전사', level: 1, outcome: 'move' } },
        { receipt: 'first-action', name: 'first_action', fields: { job: '전사', level: 1, outcome: 'explore' } },
    ];

    coordinator.trackAll(emissions);
    assert.deepEqual(tracked, [['boot', 'ready'], ['first_action', 'move']]);
});
