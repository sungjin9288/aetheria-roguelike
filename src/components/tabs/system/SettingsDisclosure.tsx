import type { ReactNode } from 'react';
import { ChevronDown, type LucideIcon } from 'lucide-react';

export type DisclosureTone = 'neutral' | 'ether' | 'gold' | 'exp' | 'good' | 'threat';

interface SettingsDisclosureProps {
    testId: string;
    icon: LucideIcon;
    title: string;
    summary: string;
    tone?: DisclosureTone;
    children: ReactNode;
}

/** 설정 화면의 접힌 묶음 — 제목줄은 아이콘 우물 + 제목 · 한 줄 설명 + 꺾쇠, 본문은 구분선 아래에 펼친다. */
const SettingsDisclosure = ({ testId, icon: Icon, title, summary, tone = 'neutral', children }: SettingsDisclosureProps) => (
    <details data-testid={testId}>
        <summary className="ab-summary">
            <span className={`ab-icon-well ${tone === 'neutral' ? '' : `is-${tone}`}`} aria-hidden="true">
                <Icon size={16} />
            </span>
            <span className="min-w-0 flex-1">
                <span className="block font-readable aether-type-strong text-ae-ink">{title}</span>
                <span className="mt-0.5 block font-readable aether-type-meta text-ae-ink-3">{summary}</span>
            </span>
            <ChevronDown size={16} className="ab-chevron" aria-hidden="true" />
        </summary>
        <div className="pb-3 pt-1">{children}</div>
    </details>
);

export default SettingsDisclosure;
