import { Leaf } from 'lucide-react';
import { DB } from '../../data/db';
import { BALANCE, CONSTANTS } from '../../data/constants';
import { MSG } from '../../data/messages';
import { getMaterialCodexSources } from '../../utils/codexDropSources';
import { getSellPrice } from '../../utils/equipmentUtils';
import ItemIcon from '../icons/ItemIcon';
import type { CodexCategory, CodexEntry } from '../../types/index.js';

interface MaterialCodexProps {
    codex?: Partial<Record<CodexCategory, Record<string, CodexEntry>>>;
}

const MaterialCodex = ({ codex = {} }: MaterialCodexProps) => {
    const materials = DB.ITEMS.materials || [];
    const materialCodex = codex.materials || {};
    const discoveredMaterials = materials.filter((material) => material.name && materialCodex[material.name]);

    return (
        <div data-testid="codex-materials" className="ab-stack">
            <div className="flex items-baseline justify-between gap-3 px-1">
                <div>
                    <h3 className="ab-section-title">{MSG.CODEX_MATERIAL_TITLE}</h3>
                    <p className="aether-type-meta mt-0.5 text-ae-ink-3">{MSG.CODEX_MATERIAL_DESC}</p>
                </div>
                <span className="aether-type-body shrink-0 font-fira tabular-nums text-ae-ether-hi">{discoveredMaterials.length}/{materials.length}</span>
            </div>

            {discoveredMaterials.length === 0 ? (
                <div className="ae-card is-quiet ab-card-pad">
                    <div className="aether-type-body font-semibold text-ae-ink">{MSG.CODEX_MATERIAL_EMPTY_TITLE}</div>
                    <div className="aether-type-meta mt-1 text-ae-ink-3">{MSG.CODEX_MATERIAL_EMPTY_HINT}</div>
                </div>
            ) : (
                <div className="ae-card ab-rows px-3.5">
                    {discoveredMaterials.map((material) => {
                        const sources = getMaterialCodexSources(material.name || '');
                        return (
                            <div key={material.name} className="flex min-h-16 items-center gap-3 py-2.5">
                                <ItemIcon item={material} size={32} showBorder className="opacity-95" />
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-baseline justify-between gap-3">
                                        <span className="aether-type-body min-w-0 font-semibold text-ae-ink">{material.name}</span>
                                        <span data-testid="codex-material-sell-price" className="aether-type-meta shrink-0 font-fira tabular-nums text-ae-gold-text">{MSG.CODEX_MATERIAL_SELL_PRICE(getSellPrice(material))}</span>
                                    </div>
                                    <div data-testid="codex-material-sources" className="aether-type-meta mt-1 text-ae-ink-3">
                                        {MSG.CODEX_MATERIAL_SOURCES(sources.length > 0 ? sources.slice(0, 4).join(' · ') : MSG.CODEX_MATERIAL_SOURCE_SPECIAL)}
                                        {sources.length > 4 ? MSG.CODEX_MATERIAL_SOURCES_MORE(sources.length - 4) : ''}
                                    </div>
                                    {material.name === CONSTANTS.ENHANCE_MATERIAL_NAME && (
                                        <div data-testid="codex-material-late-source" className="aether-type-meta mt-0.5 text-ae-gold-text">
                                            {MSG.CODEX_ENHANCE_MATERIAL_LATE_SOURCE(BALANCE.ENHANCE_MATERIAL_LATE_DROP_MIN_LEVEL)}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <div data-testid="codex-material-undiscovered" className="ab-tile is-undiscovered flex min-h-14 items-center gap-3 px-3.5 py-3">
                <Leaf size={16} className="shrink-0 text-ae-ink-3" aria-hidden="true" />
                <div>
                    <div className="aether-type-body text-ae-ink-2">{MSG.CODEX_MATERIAL_UNDISCOVERED(materials.length - discoveredMaterials.length)}</div>
                    <div className="aether-type-meta mt-0.5 text-ae-ink-3">{MSG.CODEX_MATERIAL_UNDISCOVERED_HINT}</div>
                </div>
            </div>
        </div>
    );
};

export default MaterialCodex;
