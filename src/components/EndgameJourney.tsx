import { MSG } from '../data/messages';
import { getEndgameJourney } from '../utils/endgameJourney';
import type { Player } from '../types/player';

const EndgameJourney = ({ player }: { player: Player }) => {
    const journey = getEndgameJourney(player);
    if (!journey) return null;
    return (
        <section data-testid="endgame-journey" className="ae-well ae-choice-rule mb-4 px-3.5 py-3.5 font-readable">
            <h2 className="aether-type-strong font-semibold text-ae-gold-text">{journey.completed ? MSG.ENDGAME_JOURNEY_COMPLETE_TITLE : MSG.ENDGAME_JOURNEY_TITLE}</h2>
            {!journey.completed && (
                <>
                    <p className="aether-type-body mt-2 leading-6 text-ae-ink-2">{MSG.ENDGAME_JOURNEY_SCOPE}</p>
                    <p data-testid="endgame-journey-shards" className="aether-type-body mt-3 leading-6 text-ae-ink">{MSG.ENDGAME_JOURNEY_SHARDS(journey.shards, journey.requiredShards)}</p>
                </>
            )}
            <p data-testid="endgame-journey-action" className="aether-type-body mt-3 leading-6 text-ae-ether-hi">{journey.action}</p>
            {!journey.completed && <p className="aether-type-meta mt-2 leading-5 text-ae-ink-3">{MSG.ENDGAME_JOURNEY_PRESERVED}</p>}
        </section>
    );
};

export default EndgameJourney;
