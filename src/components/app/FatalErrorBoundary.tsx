import { Component, type ErrorInfo, type ReactNode } from 'react';

import {
    createSanitizedErrorReport,
    getRuntimeErrorReporter,
    readKnownRuntimeScriptFilenames,
    type ErrorReporter,
} from '../../platform/errorReporter';
import { getRuntimeProductEventCoordinator } from '../../platform/productEventCoordinator';
import { getRuntimeProductEventContext } from '../../platform/productEventContext';
import { MSG } from '../../data/messages';
import type { ProductEventContext, ProductEventFields, ProductEventName } from '../../platform/productEvents';

interface FatalEvent {
    name: ProductEventName;
    fields: ProductEventFields;
}

interface FatalErrorBoundaryProps {
    children: ReactNode;
    context?: ProductEventContext | null;
    reporter?: ErrorReporter;
    knownScriptFilenames?: readonly string[];
    onFatal?: (event: FatalEvent) => void;
}

interface FatalErrorBoundaryState {
    failed: boolean;
}

export class FatalErrorBoundary extends Component<FatalErrorBoundaryProps, FatalErrorBoundaryState> {
    state: FatalErrorBoundaryState = { failed: false };

    private reported = false;

    static getDerivedStateFromError(): FatalErrorBoundaryState {
        return { failed: true };
    }

    componentDidCatch(error: Error, _info: ErrorInfo): void {
        if (this.reported) return;
        this.reported = true;
        const context = this.props.context === undefined
            ? getRuntimeProductEventContext()
            : this.props.context;
        const reporter = this.props.reporter || getRuntimeErrorReporter();
        if (context) {
            reporter.capture(createSanitizedErrorReport({
                code: 'react_render_failure',
                source: 'boundary',
                cause: error,
                knownScriptFilenames: this.props.knownScriptFilenames ?? readKnownRuntimeScriptFilenames(),
            }, context));
        }
        const event: FatalEvent = {
            name: 'fatal_error_boundary',
            fields: { job: 'unknown', level: 1, outcome: 'caught' },
        };
        if (this.props.onFatal) this.props.onFatal(event);
        else getRuntimeProductEventCoordinator().trackAll([{
            receipt: 'fatal-error-boundary',
            ...event,
        }]);
    }

    render(): ReactNode {
        if (!this.state.failed) return this.props.children;
        return (
            <main className="flex min-h-dvh items-center justify-center bg-ae-void p-6 text-center text-ae-ink">
                <section role="alert" className="ae-sheet max-w-sm rounded-ae-xl p-5">
                    <h1 className="font-readable text-lg font-bold text-ae-ink">{MSG.SHELL_FATAL_TITLE}</h1>
                    <p className="mt-2 font-readable text-sm leading-relaxed text-ae-ink-2">
                        {MSG.SHELL_FATAL_BODY}
                    </p>
                </section>
            </main>
        );
    }
}
