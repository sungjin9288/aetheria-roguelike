import { useMemo } from 'react';
import { Leaf } from 'lucide-react';
import { DB } from '../../data/db';
import { LOOT_TABLE } from '../../data/loot';
import ItemIcon from '../icons/ItemIcon';

interface MaterialCodexProps {
    codex?: any;
}

const MaterialCodex = ({ codex = {} }: MaterialCodexProps) => {
    const materials = DB.ITEMS.materials || [];
    const materialCodex = codex.materials || {};
    const discoveredMaterials = materials.filter((material: any) => materialCodex[material.name]);

    const materialSources = useMemo(() => {
        const sources: Record<string, string[]> = {};
        for (const [monster, drops] of Object.entries(LOOT_TABLE) as Array<[string, string[]]>) {
            for (const itemName of drops) {
                sources[itemName] = [...(sources[itemName] || []), monster];
            }
        }
        return sources;
    }, []);

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
                    <div className="aether-type-meta mt-1 text-slate-400/76">몬스터 전리품이나 상점에서 소재를 얻으면 이름과 획득처가 기록됩니다</div>
                </div>
            ) : (
                <div className="divide-y divide-white/8 border-y border-white/10">
                    {discoveredMaterials.map((material: any) => {
                        const sources = materialSources[material.name] || [];
                        return (
                            <div key={material.name} className="flex min-h-16 items-center gap-3 py-2.5">
                                <ItemIcon item={material} size={32} showBorder className="opacity-95" />
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-baseline justify-between gap-3">
                                        <span className="truncate text-sm font-semibold text-slate-100">{material.name}</span>
                                        <span className="text-[11px] text-[#d5b180]">골드 {material.price}</span>
                                    </div>
                                    <div className="mt-1 line-clamp-2 text-[11px] text-slate-400/76">
                                        획득처: {sources.length > 0 ? sources.slice(0, 4).join(' · ') : '탐험과 상점에서 확인'}
                                        {sources.length > 4 ? ` 외 ${sources.length - 4}곳` : ''}
                                    </div>
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
