import { AT } from '../reducers/actionTypes';
import { RARITY_COLORS } from '../data/titles';

/** 희귀도 배경 색상 */
const RARITY_BG = {
    common:    'border-slate-500 bg-slate-900/80',
    uncommon:  'border-cyan-500 bg-cyan-950/80',
    rare:      'border-purple-500 bg-purple-950/80',
    epic:      'border-yellow-500 bg-yellow-950/80',
    legendary: 'border-red-500 bg-red-950/80 shadow-red-500/30 shadow-lg',
};

const RARITY_LABEL = {
    common:    '일반',
    uncommon:  '고급',
    rare:      '희귀',
    epic:      '영웅',
    legendary: '전설',
};

/**
 * RelicChoicePanel — 유물 3지선다 선택 오버레이
 * `pendingRelics` 가 null 이 아닐 때 ControlPanel 위에 표시됨
 */
const RelicChoicePanel = ({ pendingRelics, dispatch }) => {
    if (!pendingRelics || pendingRelics.length === 0) return null;

    const handleSelect = (relic) => {
        dispatch({ type: AT.ADD_RELIC, payload: relic });
    };

    const handleDecline = () => {
        dispatch({ type: AT.DECLINE_RELIC });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm">
            <div className="w-full max-w-2xl mx-4 bg-gray-950 border border-purple-700/60 rounded-xl p-6 shadow-2xl shadow-purple-900/40">
                {/* 헤더 */}
                <div className="text-center mb-6">
                    <div className="text-purple-400 text-xs tracking-widest uppercase mb-1">
                        ✦ 고대 유물 발견 ✦
                    </div>
                    <h2 className="text-lg font-bold text-white">
                        유물을 하나 선택하세요
                    </h2>
                    <p className="text-xs text-gray-400 mt-1">
                        선택한 유물은 이번 런에서 지속됩니다. 사망 또는 리셋 시 소멸.
                    </p>
                </div>

                {/* 유물 카드 3장 */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                    {pendingRelics.map((relic, index) => (
                        <button
                            key={relic.id}
                            data-testid={`relic-choice-${index}`}
                            onClick={() => handleSelect(relic)}
                            className={`
                                flex flex-col items-center text-center p-4 rounded-lg border-2 cursor-pointer
                                transition-all duration-150 hover:scale-105 hover:brightness-110 active:scale-100
                                ${RARITY_BG[relic.rarity] || RARITY_BG.common}
                            `}
                        >
                            {/* 희귀도 배지 */}
                            <span className={`text-xs font-bold tracking-widest uppercase mb-2 ${RARITY_COLORS[relic.rarity] || 'text-slate-300'}`}>
                                {RARITY_LABEL[relic.rarity] || relic.rarity}
                            </span>

                            {/* 유물명 */}
                            <span className={`text-base font-bold mb-3 ${RARITY_COLORS[relic.rarity] || 'text-white'}`}>
                                {relic.name}
                            </span>

                            {/* 효과 설명 */}
                            <span className="text-xs text-gray-300 leading-relaxed">
                                {relic.desc}
                            </span>
                        </button>
                    ))}
                </div>

                {/* 건너뛰기 */}
                <div className="text-center">
                    <button
                        data-testid="relic-choice-skip"
                        onClick={handleDecline}
                        className="text-xs text-gray-500 hover:text-gray-300 transition-colors underline"
                    >
                        건너뛰기 (유물을 선택하지 않음)
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RelicChoicePanel;
