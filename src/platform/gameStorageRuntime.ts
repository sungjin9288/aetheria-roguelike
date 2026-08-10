import { createRuntimeGameStorage, type GameStorage } from './gameStorage';
import { getRuntimeEnvironment } from './runtimeEnvironment';

let runtimeGameStorage: GameStorage | null = null;

export const getRuntimeGameStorage = (): GameStorage => {
    if (!runtimeGameStorage) {
        runtimeGameStorage = createRuntimeGameStorage({
            environment: getRuntimeEnvironment(),
            saveVersion: 1,
        });
    }
    return runtimeGameStorage;
};
