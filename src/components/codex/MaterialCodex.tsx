import { useMemo } from 'react';
import { Lock, Eye } from 'lucide-react';
import { DB } from '../../data/db';
import { LOOT_TABLE } from '../../data/loot';
import ItemIcon from '../icons/ItemIcon';

interface MaterialCodexProps { codex?: any }

const MaterialCodex = ({ codex }: MaterialCodexProps) => {
    const materials = DB.ITEMS.materials || [];
    const matCodex = codex?.materials || {};
    const discovered = Object.keys(matCodex).length;

    // 각 소재의 획득처 계산
    const matSources = useMemo(() => {
        const sources: Record<string, string[]> = {};
        for (const [monster, drops] of Object.entries(LOOT_TABLE) as Array<[string, string[]]>) {
            for (const itemName of drops) {
                if (!sources[itemName]) sources[itemName] = [];
                sources[itemName].push(monster);
            }
        }
        return sources;
    }, []);

    return (
        <div className="space-y-2">
            <div className="text-[10px] font-fira text-slate-500">
                {discovered}/{materials.length} 소재 발견
            </div>

            <div className="space-y-1.5 max-h-[45dvh] overflow-y-auto custom-scrollbar">
                {materials.map((mat: any) => {
                    const found = !!matCodex[mat.name];
                    const sources = matSources[mat.name] || [];

                    return (
                        <div
                            key={mat.name}
                            className={`p-2.5 rounded-[0.95rem] border text-xs transition-all
                                ${found
                                    ? 'bg-black/18 border-white/8'
                                    : 'bg-black/10 border-white/6 opacity-25'
                                }`}
                        >
                            <div className="flex items-center gap-2">
                                <ItemIcon item={found ? mat : { type: 'mat', name: '미확인 소재' }} size={28} showBorder className="opacity-95" />
                                {found
                                    ? <Eye size={12} className="text-amber-300 shrink-0" />
                                    : <Lock size={12} className="text-slate-600 shrink-0" />
                                }
                                <span className={`font-rajdhani font-bold truncate ${found ? 'text-white' : 'text-slate-600'}`}>
                                    {found ? mat.name : '???'}
                                </span>
                                {found && (
                                    <span className="ml-auto text-[10px] font-fira text-amber-200">골드 {mat.price}</span>
                                )}
                            </div>
                            {found && sources.length > 0 && (
                                <div className="mt-1 text-[9px] font-fira text-slate-500 pl-5 truncate">
                                    획득처: {sources.slice(0, 4).join(', ')}{sources.length > 4 ? ` +${sources.length - 4}` : ''}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default MaterialCodex;
