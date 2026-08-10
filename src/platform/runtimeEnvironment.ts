import { Capacitor } from '@capacitor/core';
import { Environment } from '@apps-in-toss/web-framework';

export type RuntimeEnvironment = 'web' | 'capacitor' | 'toss' | 'sandbox';

interface RuntimeEnvironmentSignals {
    nativePlatform: boolean;
    platformTarget?: string | null;
    operationalEnvironment?: string | null;
}

export const resolveRuntimeEnvironment = ({
    nativePlatform,
    platformTarget,
    operationalEnvironment,
}: RuntimeEnvironmentSignals): RuntimeEnvironment => {
    if (nativePlatform) return 'capacitor';
    if (platformTarget !== 'toss') return 'web';
    return operationalEnvironment === 'sandbox' ? 'sandbox' : 'toss';
};

export const readTossOperationalEnvironment = (
    platformTarget?: string | null,
    readEnvironment: () => string = () => Environment.environment,
): string | null => {
    if (platformTarget !== 'toss') return null;
    try {
        return readEnvironment();
    } catch {
        return null;
    }
};

export const getRuntimeEnvironment = (
    operationalEnvironment?: string | null,
): RuntimeEnvironment => {
    const platformTarget = import.meta.env?.VITE_PLATFORM_TARGET;
    return resolveRuntimeEnvironment({
        nativePlatform: Capacitor.isNativePlatform(),
        platformTarget,
        operationalEnvironment: operationalEnvironment
            ?? readTossOperationalEnvironment(platformTarget),
    });
};

export const allowsServiceWorker = (environment: RuntimeEnvironment): boolean => (
    environment === 'web'
);
