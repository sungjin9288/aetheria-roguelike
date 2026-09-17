export interface GameCapabilities {
    publicGraveInvasion: boolean;
}

export const PRODUCTION_GAME_CAPABILITIES: Readonly<GameCapabilities> = Object.freeze({
    publicGraveInvasion: false,
});
