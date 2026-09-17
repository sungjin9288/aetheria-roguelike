# Loot level authority — read-only finding

## Finding and boundary

Library-only reward activation is deferred. Production spawn uses `exp = 10 + level * 10 + depth * 4`; normal bonus loot reconstructs level with `(exp - 10) / 5`. Thus a normal level36 creature becomes inferred72 and rolls Tier6, whose default equipment requirement is75. This mismatch extends beyond the library. Whether the old divisor intentionally encoded reward difficulty is not established; changing it globally without a reward-curve design would be unsafe.

Owner ran production `getReachableMaps`, `spawnEnemy`, `processLoot`, and `canEquip` in one isolated Node process. No DB mutation, game save, candidate activation, source edit or network. Each reachable map's normal species with neither enriched nor legacy table was forced individually into its own existing map context; spawn RNG0.5, loot RNG0, clock1, empty relic/meta/stats, arcmage job. Boss results were excluded. The successful loot roll is a **rolled-item probe**, not reducer admission, natural drop distribution, combat viability or real play.

| Player level | Map/species rows returning loot | First rolled item rejected for level |
| --- | ---: | ---: |
| 28 | 2 | 2 |
| 45 | 45 | 43 |
| 60 | 60 | 58 |
| 62 | 73 | 71 |
| 75 | 97 | 0 |

Rows are map/species pairs, not necessarily unique monsters. We inspect the first forced item, not all RNG outcomes. At28, outpost sentinel/corroded machine soldier are level18/exp190 → Tier4, requiring45. At45, lava turtle, volcanic spirit, magma slime, fire wyvern and ash golem are among level36/exp370 → Tier6 examples. Job compatibility is separate: level rejection0 at75 does not imply every item is equipable by every job.

## Reproduce

From repository root, run `node --import tsx --input-type=module` with this stdin script. It only prints results:

```js
import {DB} from './src/data/db.ts';
import {CONSTANTS} from './src/data/constants.ts';
import {DROP_TABLES} from './src/data/dropTables.ts';
import {LOOT_TABLE} from './src/data/loot.ts';
import {getReachableMaps} from './src/utils/mapAccess.ts';
import {spawnEnemy} from './src/utils/exploreUtils.ts';
import {processLoot} from './src/systems/CombatEngine.loot.ts';
import {canEquip} from './src/utils/equipmentValidation.ts';
for (const level of [28,45,60,62,75]) {
  const rows=[];
  for (const loc of getReachableMaps(DB.MAPS,CONSTANTS.START_LOCATION,level)) {
    const map=DB.MAPS[loc];
    for (const name of map.monsters || []) {
      if (DROP_TABLES[name] || LOOT_TABLE[name]) continue;
      const player={level,job:'아크메이지',loc,relics:[],meta:{},stats:{}};
      const enemy=spawnEnemy({...map,monsters:[name],boss:false,bossMonsters:[]},player,[],{addLog(){}},{rng:()=>0.5}).mStats;
      if (enemy.isBoss) continue;
      const result=processLoot(enemy,player,1,()=>0,()=>1);
      if (result.items.length) rows.push({loc,name,enemyLevel:enemy.level,exp:enemy.exp,tier:result.items[0].tier,levelBlocked:canEquip(result.items[0],player,{}).reason==='level'});
    }
  }
  console.log(JSON.stringify({level,nonTableRows:rows.length,levelBlockedRows:rows.filter(x=>x.levelBlocked).length,examples:rows.filter(x=>x.levelBlocked).slice(0,6)}));
}
```

## Next action

Follow-up source audit: normal prefixes and elites multiply EXP after assigning enemy.level; bosses/abyss add further reward scaling. Consequently EXP is not a stable encounter-level authority. Existing inline `inferLevelAndBonusTier` mirror assertions do not test spawn integration even though this test file already imports production processLoot. DB/SIGNATURE registry count: Tier5 has45 equipment entries/23 signatures, Tier6 has20/2. This changes the next action: a tier-only pool substitution must account for rare acquisition, not just canEquip. Proposed bounded contract is `2026-09-09-aetheria-normal-loot-tier-contract.md`; not activated.

1. Determine normal-enemy reward-level authority and intended bonus tier thresholds together. Merely changing divisor5→10 leaves the old tier thresholds/minimums semantically unverified; do not do that as a one-line fix.
2. Separate normal, elite, boss, prestige-guaranteed and abyss paths. Keep signature/pity/drop-count/chance and unrelated enriched tables fixed unless a reviewed design explicitly changes them.
3. Design an appropriate level-band equipment curve with useful present and future rewards; do not cap everything to player level or guarantee upgrades. Compare actual production receipts at checkpoints for all18 jobs and regional shared species, then internal play.
4. Only after the shared contract is resolved decide whether library specialization adds value. The previously proposed two-species Tier5 override could mask this broader issue and is not ready for approval/activation.

Native Goal is active on this continuation. No update_goal call; full objective remains unmet. Latest full/native regional24 is unchanged. Source pins from the preceding design are preserved; `git diff --check` and tracked-native drift checks are required for docs closeout, not another full build.
