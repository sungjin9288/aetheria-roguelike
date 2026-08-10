import { getRuntimeProductEventContext } from './productEventContext';
import {
    createProductEventClient,
    NOOP_PRODUCT_EVENT_SINK,
    type ProductEventSink,
} from './productEventSink';
import type { ProductEventFields, ProductEventName } from './productEvents';

export interface ProductEventEmission {
    receipt: string;
    name: ProductEventName;
    fields: ProductEventFields;
}

interface ProductEventClientLike {
    track(name: ProductEventName, fields: ProductEventFields): void;
}

export const createProductEventCoordinator = (client: ProductEventClientLike | null) => {
    const receipts = new Set<string>();
    return {
        trackAll(emissions: readonly ProductEventEmission[]): void {
            if (!client) return;
            for (const emission of emissions) {
                if (receipts.has(emission.receipt)) continue;
                receipts.add(emission.receipt);
                client.track(emission.name, emission.fields);
            }
        },
    };
};

let runtimeCoordinator: ReturnType<typeof createProductEventCoordinator> | null = null;

export const getRuntimeProductEventCoordinator = (
    sink: ProductEventSink = NOOP_PRODUCT_EVENT_SINK,
) => {
    if (runtimeCoordinator) return runtimeCoordinator;
    const context = getRuntimeProductEventContext();
    runtimeCoordinator = createProductEventCoordinator(context
        ? createProductEventClient({ context, sink })
        : null);
    return runtimeCoordinator;
};

export const trackRuntimeProductEvent = (emission: ProductEventEmission): void => {
    getRuntimeProductEventCoordinator().trackAll([emission]);
};
