import {
    createContext,
    type ReactNode,
    useContext,
    useEffect,
    useRef,
} from 'react';

type PlatformBackHandler = () => boolean | void;
type RegisterPlatformBackHandler = (priority: number, handler: PlatformBackHandler) => () => void;

interface RegistryEntry {
    priority: number;
    order: number;
    handler: PlatformBackHandler;
}

export interface PlatformBackRegistry {
    register: RegisterPlatformBackHandler;
    handleBack: () => boolean;
}

// Registry factory is colocated with its provider so the context contract stays private.
// eslint-disable-next-line react-refresh/only-export-components
export const createPlatformBackRegistry = (): PlatformBackRegistry => {
    const entries = new Map<symbol, RegistryEntry>();
    let order = 0;

    return {
        register(priority, handler) {
            const token = Symbol('platform-back-handler');
            order += 1;
            entries.set(token, { priority, order, handler });
            return () => entries.delete(token);
        },
        handleBack() {
            const entry = [...entries.values()].sort((left, right) => (
                right.priority - left.priority || right.order - left.order
            ))[0];
            if (!entry) return false;
            return entry.handler() !== false;
        },
    };
};

const PlatformBackContext = createContext<RegisterPlatformBackHandler | null>(null);

export const PlatformBackProvider = ({
    registry,
    children,
}: {
    registry: PlatformBackRegistry;
    children: ReactNode;
}) => (
    <PlatformBackContext.Provider value={registry.register}>
        {children}
    </PlatformBackContext.Provider>
);

// eslint-disable-next-line react-refresh/only-export-components
export const usePlatformBackHandler = (
    enabled: boolean,
    handler: PlatformBackHandler,
    priority: number,
) => {
    const register = useContext(PlatformBackContext);
    const handlerRef = useRef(handler);
    useEffect(() => {
        handlerRef.current = handler;
    }, [handler]);

    useEffect(() => {
        if (!enabled || !register) return undefined;
        return register(priority, () => handlerRef.current());
    }, [enabled, priority, register]);
};
