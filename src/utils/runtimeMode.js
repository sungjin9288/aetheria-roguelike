export const isSmokeRuntime = () => {
    if (typeof window === 'undefined') return false;

    try {
        return new URLSearchParams(window.location.search).get('smoke') === '1';
    } catch {
        return false;
    }
};
