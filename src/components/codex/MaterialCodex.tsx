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
        <div data-testid="codex-materials" className="space-y-4">
            <div className="flex items-baseline justify-between gap-3">
                <div>
                    <h3 className="aether-type-title font-semibold text-slate-100">소재 기록</h3>
                    <p className="aether-type-meta mt-0.5 text-slate-400/76">획득한 소재와 다시 구할 수 있는 몬스터를 확인합니다</p>
                </div>
                <span className="aether-type-body shrink-0 text-[#dff7f5]">{discoveredMaterials.length}/{materials.length}</span>
            </div>

            {discoveredMaterials.length === 0 ? (
                <div className="border-y border-white/10 py-3">
                    <div className="aether-type-body font-semibold text-slate-100">첫 소재를 찾아보세요</div>
                    <div className="aether-type-meta mt-1 text-slate-400/76">{MSG.CODEX_MATERIAL_EMPTY_HINT}</div>
                </div>
            ) : (
                <div className="divide-y divide-white/8 border-y border-white/10">
                    {discoveredMaterials.map((material) => {
                        const sources = getMaterialCodexSources(material.name || '');
                        return (
                            <div key={material.name} className="flex min-h-16 items-center gap-3 py-2.5">
                                <ItemIcon item={material} size={32} showBorder className="opacity-95" />
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-baseline justify-between gap-3">
                                        <span className="truncate text-sm font-semibold text-slate-100">{material.name}</span>
                                        <span data-testid="codex-material-sell-price" className="text-[11px] text-[#d5b180]">{MSG.CODEX_MATERIAL_SELL_PRICE(getSellPrice(material))}</span>
                                    </div>
                                    <div data-testid="codex-material-sources" className="mt-1 line-clamp-2 text-[11px] text-slate-400/76">
                                        {MSG.CODEX_MATERIAL_SOURCES(sources.length > 0 ? sources.slice(0, 4).join(' · ') : MSG.CODEX_MATERIAL_SOURCE_SPECIAL)}
                                        {sources.length > 4 ? MSG.CODEX_MATERIAL_SOURCES_MORE(sources.length - 4) : ''}
                                    </div>
                                    {material.name === CONSTANTS.ENHANCE_MATERIAL_NAME && (
                                        <div data-testid="codex-material-late-source" className="mt-0.5 text-[11px] text-[#d5b180]/80">
                                            {MSG.CODEX_ENHANCE_MATERIAL_LATE_SOURCE(BALANCE.ENHANCE_MATERIAL_LATE_DROP_MIN_LEVEL)}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <div data-testid="codex-material-undiscovered" className="flex min-h-14 items-center gap-2 border-y border-white/10 py-3">
                <Leaf size={16} className="text-emerald-200" />
                <div>
                    <div className="aether-type-body text-slate-300">미발견 소재 {materials.length - discoveredMaterials.length}개</div>
                    <div className="aether-type-meta mt-0.5 text-slate-500">실제로 획득한 소재만 상세 기록을 엽니다</div>
                </div>
            </div>
        </div>
    );
};

export default MaterialCodex;
