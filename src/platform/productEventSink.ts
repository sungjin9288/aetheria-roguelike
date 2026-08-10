import {
    buildProductEvent,
    type ProductEvent,
    type ProductEventContext,
    type ProductEventFields,
    type ProductEventName,
} from './productEvents';

export interface ProductEventSink {
    send(event: ProductEvent): Promise<void>;
}

export const NOOP_PRODUCT_EVENT_SINK: ProductEventSink = {
    send: async () => undefined,
};

export const createProductEventClient = ({
    context,
    sink = NOOP_PRODUCT_EVENT_SINK,
    onError = () => undefined,
    now = () => Date.now(),
}: {
    context: ProductEventContext;
    sink?: ProductEventSink;
    onError?: (reasonCode: 'event_validation_failure' | 'transport_failure') => void;
    now?: () => number;
}) => ({
    track(name: ProductEventName, fields: ProductEventFields): void {
        void Promise.resolve()
            .then(() => buildProductEvent(name, fields, context, now()))
            .then((event) => Promise.resolve()
                .then(() => sink.send(event))
                .catch(() => onError('transport_failure')))
            .catch(() => onError('event_validation_failure'));
    },
});
