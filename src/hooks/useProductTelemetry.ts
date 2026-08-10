import { useEffect, useRef } from 'react';

import { GS } from '../reducers/gameStates';
import {
    getRuntimeProductEventCoordinator,
    type ProductEventEmission,
} from '../platform/productEventCoordinator';
import { normalizeProductEventJob } from '../platform/productEvents';

interface ProductTelemetrySnapshot {
    bootStage: string;
    syncStatus: string;
    hasCharacter: boolean;
    job: string;
    level: number;
    gameState: string;
    location: string;
    activeExpeditionId: string | null;
    activeExpeditionStartedAt: number;
    expeditionExplores: number;
    kills: number;
    bossKills: number;
    enemyKey: string | null;
    enemyIsBoss: boolean;
    combatTurn: number;
    combatReceiptKey: string | null;
    combatReceiptKind: string | null;
    hasEvent: boolean;
    summaryId: string | null;
    summaryReturnReason: string | null;
}

const asCount = (value: unknown): number => {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : 0;
};

export const createProductTelemetrySnapshot = (state: any): ProductTelemetrySnapshot => {
    const player = state?.player || {};
    const hasCharacter = Boolean(String(player.name || '').trim());
    const expedition = player.activeExpedition;
    const summary = player.lastExpeditionSummary;
    const enemy = state?.enemy;
    const combatReceipt = state?.combatReceipt;
    return {
        bootStage: String(state?.bootStage || ''),
        syncStatus: String(state?.syncStatus || ''),
        hasCharacter,
        job: hasCharacter ? normalizeProductEventJob(player.job) : 'unknown',
        level: asCount(player.level) || 1,
        gameState: String(state?.gameState || ''),
        location: String(player.loc || ''),
        activeExpeditionId: expedition?.id ? String(expedition.id) : null,
        activeExpeditionStartedAt: asCount(expedition?.startedAt),
        expeditionExplores: asCount(expedition?.explores),
        kills: asCount(player.stats?.kills),
        bossKills: asCount(player.stats?.bossKills),
        enemyKey: enemy ? String(enemy.id || enemy.baseName || enemy.name || 'enemy') : null,
        enemyIsBoss: enemy?.isBoss === true,
        combatTurn: asCount(state?.combatTurn),
        combatReceiptKey: combatReceipt?.key ? String(combatReceipt.key) : null,
        combatReceiptKind: combatReceipt?.kind ? String(combatReceipt.kind) : null,
        hasEvent: Boolean(state?.currentEvent),
        summaryId: summary?.id ? String(summary.id) : null,
        summaryReturnReason: summary?.returnReason ? String(summary.returnReason) : null,
    };
};

const fieldsFor = (
    snapshot: ProductTelemetrySnapshot,
    outcome: string,
) => ({ job: snapshot.job, level: snapshot.level, outcome });

const receiptFor = (label: string, ...parts: unknown[]): string => {
    const source = parts.map((part) => String(part ?? '')).join('\u001f');
    let hash = 2_166_136_261;
    for (let index = 0; index < source.length; index += 1) {
        hash ^= source.charCodeAt(index);
        hash = Math.imul(hash, 16_777_619);
    }
    return `${label}:${(hash >>> 0).toString(16).padStart(8, '0')}`;
};

export const collectProductTelemetryTransitions = (
    previous: ProductTelemetrySnapshot,
    current: ProductTelemetrySnapshot,
): ProductEventEmission[] => {
    const emissions: ProductEventEmission[] = [];
    const emit = (entry: ProductEventEmission) => emissions.push(entry);

    if (previous.bootStage !== 'ready' && current.bootStage === 'ready') {
        emit({
            receipt: 'boot',
            name: 'boot',
            fields: fieldsFor(current, current.syncStatus === 'offline' ? 'offline' : 'ready'),
        });
    }
    if (!previous.hasCharacter && current.hasCharacter) {
        emit({
            receipt: 'character-created',
            name: 'character_created',
            fields: fieldsFor(current, 'success'),
        });
    }
    if (previous.gameState !== GS.QUEST_BOARD && current.gameState === GS.QUEST_BOARD) {
        emit({ receipt: 'mission-open', name: 'mission_open', fields: fieldsFor(current, 'success') });
        emit({ receipt: 'first-action', name: 'first_action', fields: fieldsFor(current, 'mission_open') });
    }
    if (previous.location !== current.location && current.hasCharacter) {
        emit({
            receipt: receiptFor(
                'move',
                current.activeExpeditionId,
                current.activeExpeditionStartedAt,
                current.location,
                current.expeditionExplores,
                current.kills,
            ),
            name: 'move',
            fields: fieldsFor(current, 'success'),
        });
        emit({ receipt: 'first-action', name: 'first_action', fields: fieldsFor(current, 'move') });
    }
    if (current.expeditionExplores > previous.expeditionExplores) {
        const outcome = current.gameState === GS.COMBAT
            ? 'combat'
            : current.hasEvent || current.gameState === GS.EVENT
                ? 'event'
                : 'nothing';
        emit({
            receipt: receiptFor('explore', current.activeExpeditionId, current.expeditionExplores),
            name: 'explore',
            fields: fieldsFor(current, outcome),
        });
        emit({ receipt: 'first-action', name: 'first_action', fields: fieldsFor(current, 'explore') });
    }
    if (previous.gameState !== GS.COMBAT && current.gameState === GS.COMBAT && current.enemyKey) {
        emit({
            receipt: receiptFor(
                'combat-start',
                current.activeExpeditionId,
                current.kills,
                current.bossKills,
                current.combatTurn,
                current.enemyKey,
            ),
            name: 'combat_start',
            fields: fieldsFor(current, current.enemyIsBoss ? 'boss' : 'normal'),
        });
    }
    if (previous.gameState === GS.COMBAT && current.gameState !== GS.COMBAT && current.combatReceiptKey) {
        const outcome = current.combatReceiptKind === 'victory'
            ? 'victory'
            : current.combatReceiptKind === 'defeat'
                ? 'defeat'
                : current.combatReceiptKind === 'escape'
                    ? 'escaped'
                    : 'interrupted';
        emit({
            receipt: receiptFor('combat-end', current.combatReceiptKey),
            name: 'combat_end',
            fields: fieldsFor(current, outcome),
        });
    }
    if (
        current.summaryId
        && current.summaryId !== previous.summaryId
        && current.summaryReturnReason === 'safe_return'
    ) {
        emit({
            receipt: receiptFor('safe-return', current.summaryId),
            name: 'safe_expedition_return',
            fields: fieldsFor(current, 'success'),
        });
    }

    return emissions;
};

export const useProductTelemetry = (state: any): void => {
    const current = createProductTelemetrySnapshot(state);
    const previousRef = useRef(current);
    useEffect(() => {
        getRuntimeProductEventCoordinator().trackAll(
            collectProductTelemetryTransitions(previousRef.current, current),
        );
        previousRef.current = current;
    });
};
