import { MSG } from '../data/messages';
import { getEndgameJourney } from '../utils/endgameJourney';
import type { Player } from '../types/player';

const EndgameJourney = ({ player }: { player: Player }) => {
    const journey = getEndgameJourney(player);
    if (!journey) return null;
    return (
        <section data-testid="endgame-journey" className="mb-4 border-y border-[#d5b180]/25 py-4 font-readable">
            <h2 className="text-sm font-semibold text-[#d5b180]">{journey.completed ? MSG.ENDGAME_JOURNEY_COMPLETE_TITLE : MSG.ENDGAME_JOURNEY_TITLE}</h2>
            {!journey.completed && (
                <>
                    <p className="mt-2 text-sm leading-6 text-slate-300">{MSG.ENDGAME_JOURNEY_SCOPE}</p>
                    <p className="mt-3 text-sm leading-6 text-white">{MSG.ENDGAME_JOURNEY_RANK(journey.rank, journey.requiredRank)}</p>
                    <p className="text-sm leading-6 text-white">{MSG.ENDGAME_JOURNEY_SHARDS(journey.shards, journey.requiredShards)}</p>
                </>
            )}
            <p data-testid="endgame-journey-action" className="mt-3 text-sm leading-6 text-[#b9f1ec]">{journey.action}</p>
            {!journey.completed && <p className="mt-2 text-xs leading-5 text-slate-400">{MSG.ENDGAME_JOURNEY_PRESERVED}</p>}
        </section>
    );
};

export default EndgameJourney;
