import { BALANCE } from '../data/constants';
import { PRESTIGE_TITLES } from '../data/titles';

/**
 * AscensionScreen — 에테르 환생 확인 풀스크린 (v4.0)
 * gameState === 'ascension' 일 때 App.jsx에서 렌더링
 */
const AscensionScreen = ({ player, actions }) => {
    const meta = player.meta || {};
    const currentRank = meta.prestigeRank || 0;
    const nextRank = currentRank + 1;
    const nextTitle = PRESTIGE_TITLES[Math.min(nextRank - 1, PRESTIGE_TITLES.length - 1)];

    const bonusAtk  = (meta.bonusAtk  || 0) + BALANCE.PRESTIGE_ATK_BONUS;
    const bonusHp   = (meta.bonusHp   || 0) + BALANCE.PRESTIGE_HP_BONUS;
    const bonusMp   = (meta.bonusMp   || 0) + BALANCE.PRESTIGE_MP_BONUS;

    const statRows = [
        { label: '영구 ATK 보너스', before: `+${meta.bonusAtk || 0}`, after: `+${bonusAtk}`, color: 'text-red-400' },
        { label: '영구 HP 보너스',  before: `+${meta.bonusHp  || 0}`, after: `+${bonusHp}`,  color: 'text-green-400' },
        { label: '영구 MP 보너스',  before: `+${meta.bonusMp  || 0}`, after: `+${bonusMp}`,  color: 'text-blue-400' },
        { label: '에센스',          before: `${meta.essence || 0}`,   after: `${(meta.essence || 0) + 200}`, color: 'text-purple-400' },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90">
            {/* 글로우 배경 */}
            <div className="absolute inset-0 bg-gradient-to-b from-purple-950/30 via-transparent to-blue-950/30 pointer-events-none" />

            <div className="relative w-full max-w-lg mx-4 bg-gray-950 border border-purple-600/70 rounded-2xl p-8 shadow-2xl shadow-purple-900/60">
                {/* 헤더 */}
                <div className="text-center mb-6">
                    <div className="text-purple-400 text-xs tracking-[0.3em] uppercase mb-2">
                        ⚡ Ether Ascension ⚡
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-1">
                        에테르 환생
                    </h1>
                    <p className="text-sm text-gray-400">
                        마왕을 쓰러뜨린 당신은 새로운 차원의 힘을 얻었습니다.
                    </p>
                </div>

                {/* 칭호 미리보기 */}
                <div className="bg-purple-950/50 border border-purple-700/50 rounded-lg p-4 mb-6 text-center">
                    <div className="text-xs text-gray-400 mb-1">환생 {nextRank}회 — 획득 칭호</div>
                    <div className="text-xl font-bold text-purple-300">
                        [{nextTitle}]
                    </div>
                </div>

                {/* 스탯 비교 테이블 */}
                <div className="mb-6">
                    <div className="text-xs text-gray-500 uppercase tracking-wider mb-3">영구 보너스 변화</div>
                    <div className="space-y-2">
                        {statRows.map((row) => (
                            <div key={row.label} className="flex items-center justify-between text-sm">
                                <span className="text-gray-400">{row.label}</span>
                                <div className="flex items-center gap-3">
                                    <span className="text-gray-500">{row.before}</span>
                                    <span className="text-gray-600">→</span>
                                    <span className={`font-bold ${row.color}`}>{row.after}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 경고 */}
                <div className="bg-red-950/40 border border-red-700/40 rounded-lg p-3 mb-6">
                    <p className="text-xs text-red-300 text-center">
                        ⚠️ 환생 시 레벨, 인벤토리, 유물이 초기화됩니다.<br />
                        영구 보너스와 칭호, 누적 통계는 유지됩니다.
                    </p>
                </div>

                {/* 버튼 */}
                <div className="flex gap-3">
                    <button
                        onClick={() => actions.cancelAscension()}
                        className="flex-1 py-3 rounded-lg border border-gray-600 text-gray-300 text-sm font-medium hover:bg-gray-800 transition-colors"
                    >
                        계속 플레이
                    </button>
                    <button
                        onClick={() => actions.confirmAscension()}
                        className="flex-1 py-3 rounded-lg bg-purple-700 hover:bg-purple-600 text-white text-sm font-bold transition-colors shadow-lg shadow-purple-900/50"
                    >
                        ⚡ 에테르 환생
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AscensionScreen;
