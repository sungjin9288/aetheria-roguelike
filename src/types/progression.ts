export interface ProgressionProfileRef {
    id: string;
    version: number;
}

export interface ProgressionProfile extends ProgressionProfileRef {
    expMultiplier: number;
    lootMultiplier: number;
    eventMultiplier: number;
}

export type ProgressionAxis = 'exp' | 'loot' | 'event';
