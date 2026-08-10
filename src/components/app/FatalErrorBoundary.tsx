import { Component, type ErrorInfo, type ReactNode } from 'react';

import {
    createSanitizedErrorReport,
    getRuntimeErrorReporter,
    readKnownRuntimeScriptFilenames,
    type ErrorReporter,
} from '../../platform/errorReporter';
import { getRuntimeProductEventCoordinator } from '../../platform/productEventCoordinator';
import { getRuntimeProductEventContext } from '../../platform/productEventContext';
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
            <main className="flex min-h-dvh items-center justify-center bg-slate-950 p-6 text-center text-slate-100">
                <section role="alert" className="max-w-sm rounded-2xl border border-rose-300/20 bg-slate-900 p-5">
                    <h1 className="font-readable text-lg font-bold">게임 화면을 불러오지 못했습니다</h1>
                    <p className="mt-2 font-readable text-sm leading-relaxed text-slate-300">
                        앱을 다시 열어 주세요. 같은 문제가 계속되면 고객센터에 알려 주세요.
                    </p>
                </section>
            </main>
        );
    }
}
