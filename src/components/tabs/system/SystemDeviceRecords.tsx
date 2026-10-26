import { useCallback, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { exportToJson } from '../../../utils/fileUtils';
import { clearErrorReports, readErrorReports } from '../../../platform/localErrorReportStore';
import { readProductEvents, clearProductEvents, didProductEventWriteFail } from '../../../platform/localProductEventStore';
import { getRuntimeProductEventContext } from '../../../platform/productEventContext';
import { MSG } from '../../../data/messages';
import ActionButton from '../../ui/ActionButton';
import type { SystemNotice } from './SystemFeedbackForm';

interface SystemDeviceRecordsProps {
    onNotice: (notice: SystemNotice) => void;
}

/**
 * 기기에 남는 기록 두 가지 — 오류 리포트 링버퍼(E1)와 로컬 활동 기록(Q6).
 * 내보내기 · 복사 · 지우기는 실패를 성공으로 알리지 않는다.
 */
const SystemDeviceRecords = ({ onNotice }: SystemDeviceRecordsProps) => {
    const [errorReports, setErrorReports] = useState(() => readErrorReports());
    const lastErrorReport = errorReports[errorReports.length - 1] || null;
    const [productEvents, setProductEvents] = useState(() => readProductEvents());
    const [productEventWriteFailed, setProductEventWriteFailed] = useState(didProductEventWriteFail);
    const productEventsActive = getRuntimeProductEventContext() !== null;

    const handleClearErrorReports = useCallback(() => {
        clearErrorReports();
        setErrorReports([]);
        onNotice({ type: 'success', text: MSG.ERROR_REPORT_CLEARED });
    }, [onNotice]);

    const refreshProductEvents = () => {
        setProductEvents(readProductEvents());
        setProductEventWriteFailed(didProductEventWriteFail());
    };
    const handleExportProductEvents = () => {
        const latest = readProductEvents();
        setProductEvents(latest);
        try {
            if (latest.status !== 'ready') throw new Error('Local records unavailable');
            exportToJson(`aetheria_activity_${Date.now()}.json`, { version: 1, events: latest.events });
            onNotice({ type: 'success', text: MSG.PRODUCT_EVENTS_EXPORTED });
        } catch {
            onNotice({ type: 'error', text: MSG.PRODUCT_EVENTS_EXPORT_FAILED });
        }
    };
    const handleCopyProductEvents = async () => {
        const latest = readProductEvents();
        setProductEvents(latest);
        try {
            if (latest.status !== 'ready') throw new Error('Local records unavailable');
            await navigator.clipboard.writeText(JSON.stringify({ version: 1, events: latest.events }, null, 2));
            onNotice({ type: 'success', text: MSG.PRODUCT_EVENTS_COPIED });
        } catch {
            onNotice({ type: 'error', text: MSG.PRODUCT_EVENTS_EXPORT_FAILED });
        }
    };
    const handleClearProductEvents = () => {
        const cleared = clearProductEvents();
        refreshProductEvents();
        onNotice({ type: cleared ? 'success' : 'error', text: cleared
            ? MSG.PRODUCT_EVENTS_CLEARED : MSG.PRODUCT_EVENTS_CLEAR_FAILED });
    };

    return (
        <>
            <div className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0 flex-1 font-readable aether-type-meta text-ae-ink-2">
                    <div>{MSG.ERROR_REPORT_COUNT(errorReports.length)}</div>
                    <div className="mt-0.5 text-ae-ink-3">
                        {lastErrorReport
                            ? MSG.ERROR_REPORT_LAST(
                                lastErrorReport.report.code,
                                new Date(lastErrorReport.capturedAt).toLocaleString('ko-KR'),
                            )
                            : MSG.ERROR_REPORT_EMPTY}
                    </div>
                </div>
                <ActionButton
                    variant="ghost"
                    data-testid="system-clear-error-reports"
                    icon={<Trash2 size={15} />}
                    label={MSG.ERROR_REPORT_CLEAR_BUTTON}
                    onClick={handleClearErrorReports}
                    disabled={errorReports.length === 0}
                    className="shrink-0"
                />
            </div>

            <section
                data-testid="system-product-events"
                onFocus={refreshProductEvents}
                className="ae-well space-y-1 p-3 font-readable aether-type-meta leading-relaxed text-ae-ink-2"
            >
                <h4 className="aether-type-body font-bold text-ae-ink">{MSG.PRODUCT_EVENTS_TITLE}</h4>
                <p>{MSG.PRODUCT_EVENTS_DESCRIPTION}</p>
                <p data-testid="system-product-events-mode">{productEventsActive
                    ? MSG.PRODUCT_EVENTS_ACTIVE : MSG.PRODUCT_EVENTS_INACTIVE}</p>
                {productEventWriteFailed && <p role="alert" className="text-ae-threat">{MSG.PRODUCT_EVENTS_WRITE_FAILED}</p>}
                <p role="status" data-testid="system-product-events-status" className="text-ae-ink">{productEvents.status === 'ready'
                    ? MSG.PRODUCT_EVENTS_COUNT(productEvents.events.length)
                    : productEvents.status === 'invalid' ? MSG.PRODUCT_EVENTS_INVALID : MSG.PRODUCT_EVENTS_UNAVAILABLE}</p>
                <div className="grid grid-cols-2 gap-2 pt-2">
                    <ActionButton data-testid="system-export-product-events" label={MSG.PRODUCT_EVENTS_EXPORT} onClick={handleExportProductEvents} />
                    <ActionButton data-testid="system-copy-product-events" label={MSG.PRODUCT_EVENTS_COPY} onClick={handleCopyProductEvents} />
                    <ActionButton variant="ghost" data-testid="system-clear-product-events" label={MSG.PRODUCT_EVENTS_CLEAR} onClick={handleClearProductEvents} className="col-span-2" />
                </div>
            </section>
        </>
    );
};

export default SystemDeviceRecords;
