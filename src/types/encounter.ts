export type BoundedEncounterHpBand = 'critical' | 'strained' | 'healthy';

export interface BoundedEncounterCost {
    hp?: number;
    mp?: number;
    gold?: number;
}

export interface BoundedEncounterBuff {
    atk?: number;
    def?: number;
    turn: number;
    name: string;
}

export interface BoundedEncounterOutcome {
    result: string;
    hp?: number;
    mp?: number;
    gold?: number;
    item?: string;
    buff?: BoundedEncounterBuff;
}

export interface BoundedEncounterChoice {
    id: string;
    label: string;
    tradeoff: string;
    cost?: BoundedEncounterCost;
    outcome: BoundedEncounterOutcome;
}

export interface BoundedEncounter {
    id: string;
    version: 1;
    region: string;
    family: string;
    situation: string;
    eligibility: {
        lineage?: string[];
        hpBand?: BoundedEncounterHpBand;
        requiresSignature?: boolean;
        previousBoss?: string;
    };
    choices: BoundedEncounterChoice[];
}

export interface BoundedEncounterContext {
    region: string;
    jobLineage: string[];
    hp: number;
    maxHp: number;
    signatureNames: string[];
    bossNames: string[];
    receiptKeys: string[];
}
