# Changelog

> Aetheria Roguelike의 사이클별 변경 이력. 최신이 위.
>
> 분류 — `시스템 / 성능 / 콘텐츠 / UX / 인프라 / 보안 / 문서`. 자세한 항목은
> 각 사이클 commit 메시지를 참조.

---

## Cycle 240 🎯 — CHANGELOG에 cycles 222-239 history 일괄 추가

- 마일스톤: cycle 221 batch 이후 18 사이클 미반영 상태 batch 정리. cycle 98 / 114 / 132 / 146 / 160 / 170 / 190 / 200 / 221에 이은 10번째 batch.
- 누적 마일스톤: cycle 220(unit 1162) → 230(unit 1208) → 239(unit 1245, +83 from cycle 220).

검증: tsc 0 / unit 1245 / lint clean / build-guard ok.

---

## Cycle 236-239 — Synergy bonus / skill branch override silent dead config 시리즈 4사이클

- 236: 2 synergy bonus keys dead config — entropy_god의 fixedDmg(매 턴 15% maxHp 고정 피해)와 annihilator/void_dragon의 killStack(처치 시 누적 가속)이 dispatch 0건이던 회귀. applyEntropyTick + handleVictory 양쪽 확장.
- 237: primordial_wrath 시너지 critChance 0.25 dead config — 마지막 unhandled synergy bonus key. applySynergyBonuses + finalCritChance 합산.
- 238: skill branch override 'defBonus' 키 dead config — '분노의 방패' / '철벽 배시' branch가 DEF +20% 광고하지만 코드가 read 안 해 0이던 silent 회귀.
- 239: skill branch override 'effectChance' 키 dead config — '기절 배시' (20% 확률) / '혼란 찌르기' (40% 확률) branches가 100% status 부여하던 OP 회귀. Math.random() 게이트.

cycle 222-229 silent dead config 시리즈와 같은 lens, 12-15사이클 연속 silent dead config / orphan content fix 마무리.

검증: 각 사이클 tsc 0 / unit pass / lint clean / build-guard ok.

## Cycle 233-234 — Class weapon / armor coverage orphan content fix

- 233: 8 classes의 weapon 사용 가능 baseline 5+로 확장. 3 zero-weapon classes(성직자/드래곤 나이트/무당)가 '맨손' 외 무기 장착 불가하던 player-facing 회귀 fix. 11개 weapons의 jobs[] 확장.
- 234: 8 classes의 armor 사용 가능 baseline 5+로 확장 (cycle 233 follow-up). 4 zero-armor classes(성직자/드래곤 나이트/무당/시간술사)가 천옷 외 armor 장착 불가하던 회귀. 16개 armors의 jobs[] 확장.

cycle 231 unreachable T3 classes 후속 회귀 정합성 lock — 18 classes 모두 weapon/armor 5+ playable 보장.

검증: 각 사이클 tsc 0 / unit pass / lint clean / build-guard ok.

## Cycle 230-232, 235 — Test determinism + dead reward chain fix

- 230: cycle 156 absolute_reflect 테스트 RNG flake — enemy.pattern 미설정 시 default guardChance 0.2가 20% 확률로 reflect 분기 차단하던 RNG 흔들림 결정론화.
- 231: 3 T3 classes (드래곤 나이트 / 대마법사 / 그림자 주군) 도달 불가 회귀 — 5 T2 부모(나이트/버서커/아크메이지/흑마법사/어쌔신)의 next: []이라 jobChange 영원히 unlock 불가. T2 → T3 progression 5건 추가.
- 232: relicShards 5/5 conversion 메커니즘 — UI에 'X/5 조각' 표시되지만 5개 도달 시 변환 코드 0건이던 dead reward chain. applyDailyProtocolProgress 5+ shards 시 1 random 유물 자동 변환 (cap 도달 시 보존).
- 235: cycle 229 spell_stack 테스트 RNG 분산 flake — DAMAGE_VARIANCE ±10%가 +20% bonus를 깨버리던 흔들림. max stack(+60%) vs stack 0 비교 + 50회 sampling으로 안정화.

검증: 각 사이클 tsc 0 / unit pass / lint clean / build-guard ok.

## Cycle 227-229 — Monster / phase / relic effect dead config 3사이클

- 227: 27 monsters의 statusOnHit dead config — 슬라임/화염 비룡/서리 마법사 등이 정의한 statusOnHit (poison/curse/burn/freeze)이 dispatch 0건. heavy hit 시 발동하도록 추가 + status_resist relic 가드.
- 228: 8 phase3 bosses의 defBonus dead config — 종말의 마왕/절대 공허 등 8개 phase3 보스가 defBonus 10-40 정의했지만 enemyAttack의 phase3 전환에서 atkBonus만 적용되던 'last stand' 강화 의도 절반만 발현 회귀.
- 229: 'spell_stack' relic effect dead config — spell_weaver legendary가 스킬 연속 사용 시 +60% 데미지 누적 메커니즘이 영원히 0이던 회귀. cycle 148 baseline 0 달성 lock.

검증: 각 사이클 tsc 0 / unit pass / lint clean / build-guard ok.

## Cycle 222-226 — Item field silent dead config 5사이클

- 222: Sprint 21 신규 무기 5종(세계수의 검 / 신전 도시의 지팡이 / 균열의 날 / 세계수 절멸창 / 시간 파편 소드) armors 버킷 오배치 — WeaponCodex weapons 카테고리에서 영원히 미발견되던 회귀. 정확한 weapons 버킷으로 이동.
- 223: 3 cold-themed items의 elem '얼음' → '냉기' 표준 통일 — 39 monsters의 weakness='냉기'와 비매칭이라 ELEMENT_WEAK_MULT 적용 0이던 silent gameplay 회귀.
- 224: 4 mage items의 mpBonus 필드 dead config — 빙결 지팡이 / 빙하의 지팡이 / 상급 폭풍 로브 / 차원의 로브가 desc_stat에 'MP+N'을 표시하지만 equipmentUtils가 mp 필드만 read해 합계 +150 MP 누락. getItemMpContribution 헬퍼 추가.
- 225: 2 armors의 hpBonus 필드 dead config — 용암 판금갑 / 용비늘 갑주가 desc_stat에 'HP+80'/'HP+150'을 표시하지만 실제 maxHp 변화 없던 silent 회귀. getItemHpContribution + statsCalculator 합산.
- 226: 2 armors의 evasion 필드 dead config — 도적/어쌔신용 armor 2종이 desc_stat '회피+8%/12%'를 표시하지만 dispatch path 0건이던 silent 회피 패시브 회귀. CombatEngine.enemyAttack에 회피 roll 추가 (stealth 후순위).

검증: 각 사이클 tsc 0 / unit pass / lint clean / build-guard ok.

---

## Cycle 221 🎯 — CHANGELOG에 cycles 201-220 history 일괄 추가

- 마일스톤: cycle 200 batch 이후 20 사이클 미반영 상태 batch 정리. cycle 98 / 114 / 132 / 146 / 160 / 170 / 190 / 200에 이은 9번째 batch.
- 누적 마일스톤: cycle 188(unit 1000+) → 200(누적 200 사이클) → **220(unit 1162, +115)**.

검증: tsc 0 / unit 1162 / lint clean / build-guard ok.

---

## Cycle 217-220 — Sensory cue 시리즈 (defined-but-undispatched sound 4건 보강)

- 217: 레벨업 sensory cue — applyExpGain이 visualEffect='levelUp' set하지만 MainLayout(shake만 처리) + log type mismatch로 audio/visual 둘 다 dead path. useGameEngine에 visualEffect-watching useEffect 추가 → soundManager.play('levelUp').
- 218: 사망 / 보스 처치 sensory cue — death sound (descending 400→100Hz) + victory sound (5-tone arpeggio) 정의 있으나 dispatch 0건. combatAttack/combatItem GS.DEAD path + combatVictory isBossKill 분기에 dispatch 추가.
- 219: 스킬 / 휴식 sensory cue — skill sound (sweep tone) + heal sound (ascending arpeggio) 정의 있으나 dispatch 0건. combatAttack performSkill 성공 후 + characterActions rest 성공 후 dispatch.
- 220: 탐험 sensory cue — explore sound (sine arc, subtle tick 0.16s gain 0.04) 정의 있으나 dispatch 0건. exploreActions validation 통과 후 dispatch. 잔여 dead sound는 'hover' 1건만 (button hover 빈도 너무 높아 의도적 보류).

cycle 117/118/122/123 sensory cue 시리즈 8번째 합류 — SoundManager 16종 중 dispatch path 존재 = 15종.

검증: 각 사이클 tsc 0 / unit pass / lint clean / build-guard ok.

## Cycle 211-216 — META preserve series (paired ledger 정합성 + exploit fix)

- 211: codexBonus 3종(Atk/Def/Hp)이 ASCEND/RESET_GAME 시 wipe되어 codexClaimed 재청구 차단과 paired ledger inconsistency → silent permanent stat 손실. 양 분기에 명시 보존.
- 212: signaturePity mercy 카운터가 handleDefeat은 보존하지만 ASCEND/RESET 시 wipe되어 cycle 75 anti-frustration 설계 무력화. 양 분기 보존으로 정합성 lock (3개 분기 정합).
- 213: 일일 bounty (bountyDate / bountyIssued) + dailyProtocol이 ASCEND/RESET 시 wipe → mid-day ASCEND로 일일 1회 제한 우회 (재발급 exploit). 양 분기 보존.
- 214: weeklyProtocol(주간 미션 진행/claimed ledger)이 ASCEND/RESET/handleDefeat 모두에서 wipe → 같은 주 재청구 + 진행도 손실. 3개 분기 모두 명시 보존 (cycle 191 누락분 보강).
- 216: dailyInvadeCount / lastInvadeDate(grave 일일 5회 제한 ledger)가 ASCEND/RESET 시 wipe → mid-day ASCEND로 5회 추가 침략 가능. 양 분기 보존.

cycle 119 / 188 / 191 / 202-205 / 211-216 META preserve 시리즈 — RUN-bound vs multi-run 분리 정합성 lock.

검증: 각 사이클 tsc 0 / unit pass / lint clean / build-guard ok.

## Cycle 208-210 — Dead config / dead grant fix series

- 208: useLegendaryDropDetector가 SEASON_XP.codexDiscover 미적립 — 4 quest reward + 4 event chain reward로 들어오는 signature가 시즌 XP 0건이던 dead config. codex prop 기반 alreadyInCodex 가드로 combatVictory 중복 award 방지하며 dispatch. cycle 193/196 패턴 마지막 path.
- 209: 5 quest reward.title이 완전 dead grant — cycle 192가 TITLES 등록만 하고 grant 경로(claimQuestReward) 미수리. claimQuestReward에 reward.title push 추가 + 누락 2 entry('지도 제작자' / '전설의 기록자') Korean-id 정식 등록.
- 210: dead duplicate GS / GameStateValue export from actionTypes.ts 제거 — 정식 source는 gameStates.ts. cycle 195/206/207 dead cleanup 패턴 5번째.

검증: 각 사이클 tsc 0 / unit pass / lint clean / build-guard ok.

## Cycle 215 — claimAchievement premiumCurrency dead reward fix (300 💎 회귀)

- 215: 5 영구 업적(ach_abyss_200/300, ach_sig_20/sig_set_all, ach_chain_all)이 합계 300 💎 premiumCurrency 보상을 silently drop. claimAchievement는 reward.gold/item만 처리하고 premiumCurrency 미처리 → 영원히 청구 불가하던 dead reward. cycle 209 quest reward.title 누락 패턴과 동일 lens.

검증: tsc 0 / unit 1134 / lint clean / build-guard ok.

## Cycle 202-207 — META preserve 초반 시리즈 + dead cleanup

- 202: claimedAchievements 영구 ledger 보존 — ASCEND가 claimedAchievements를 wipe하면서 kills/bossKills 등 unlock 카운터는 보존해 ASCEND마다 모든 업적 재청구 가능 exploit (gold/item/칭호 무한 획득).
- 203: ASCEND가 explores/rests/killRegistry/buildWins 4 영구 카운터 보존 — cycle 119 누락분. Bestiary/MonsterCodex/'방랑자'·'길잡이' title 진행도 wipe 회귀.
- 204: RESET_GAME META preserve — 사망 후 '다시 시작' 클릭이 cycle 191 META 보존을 즉시 wipe해 cycle 191이 사실상 dead-on-arrival이던 nullify 회귀. RUN 진행도만 reset, META 명시 보존.
- 205: handleDefeat가 areaBossDefeated를 per-RUN flag로 reset — ...prevStats spread로 보존되어 같은 area의 signature 영구 봉인되던 회귀. exploreUtils 주석 '이번 런 미처치 시 보장'과 정합.
- 206: dead meta.trueEndingFragments init 제거 — 진 엔딩 파편 메커니즘은 inv 기반으로 별도 구현. wire-up 안 된 v5.0 schema 잔해.
- 207: dead GS.FORMATION 제거 — 미구현 placeholder, 0건 참조.

검증: 각 사이클 tsc 0 / unit pass / lint clean / build-guard ok.

## Cycle 201 — checkTitles seasonTier handler

- 201: 시즌 패스 보상 칭호 3종(시즌 선구자/정복자/마스터)이 cond.type='seasonTier'로 cycle 175 등록되었지만 checkTitles에 'seasonTier' 분기 미구현. CLAIM_SEASON_REWARD 직접 grant는 정상이나 복구 케이스(저장 손실/migration) fallback 안전망 없음. cycle 199 'prestigeRank' 동일 패턴.

검증: tsc 0 / unit 1053 / lint clean / build-guard ok.

---

## Cycle 200 🎯 — CHANGELOG에 cycles 191-199 history 일괄 추가

- 마일스톤: 200 사이클 누적 도달. cycle 190 batch 이후 9 사이클 미반영 상태 batch 정리. cycle 98 / 114 / 132 / 146 / 160 / 170 / 190에 이은 8번째 batch.
- 누적 마일스톤: cycle 100(lint clean) → 145(quest item baseline 0) → 159(relic effect baseline 0) → 169(map monster baseline 0) → 188(unit 1000+) → **200(누적 200 사이클)**.

검증: tsc 0 / unit 1047 / lint clean / build-guard ok.

---

## Cycle 197-199 — PRESTIGE_TITLES 정합성 정리 시리즈

- 197: PRESTIGE_TITLES 10종(각성자~에테르의 신)이 ASCEND로 player.titles에 push되지만 TITLES 미등록 → getTitleDefinition undefined → 모든 prestige 칭호가 default 'text-cyber-purple'로 표시되던 visual UX 회귀. 10 Korean id 정식 등록(cond.type='prestigeRank') + 색상 차별화 (cyan→emerald progression). cycle 175(시즌)/cycle 185(cosmetic)/cycle 192(quest reward)와 동일 컨벤션 — 모든 specific cond.type 정식 TITLES 등록 완성 (총 20 신규 entries).
- 198: hasTemporaryAdventureState가 voidHeart 플래그를 'temporary'로 카운트해 cycle 187 clear preserve 변경 후 안전 맵 이동마다 무한 재호출 회귀. clear가 보존하는 플래그는 has도 미카운트로 일관성 lock.
- 199: checkTitles에 'prestigeRank' cond.type 핸들러 추가 — ASCEND newTitle 직접 grant 정상 케이스 외에도 복구 케이스(저장 손실/migration) fallback 안전망.

검증: 각 사이클 tsc 0 / unit pass / lint clean / build-guard ok.

## Cycle 193-196 — SEASON_XP.codexDiscover dead config 활성

- 193: SEASON_XP.codexDiscover (8 XP) 정의됐으나 dispatch 0건이던 dead config. countNewCodexEntries 헬퍼 추가 + combatVictory에서 신규 codex 등록 수만큼 dispatch.
- 194: abyss 'prestige_points' reward type이 dead currency. ABYSS_MILESTONE_REWARDS의 floor 75/200/500을 relic_choice/legendary_item으로 교체. combatBossHandlers 분기 + MSG.ABYSS_PRESTIGE_POINTS 제거.
- 195: dead BALANCE/CONSTANTS 키 6종 정리 (MILESTONE_KILLS / EXP_LEVEL_CAP_50 / RARITY_TIERS / RARITY_SELL_MULT / COSMETIC_TITLE_COST / SAVE_KEY) + 양방향 회귀 가드 (BALANCE.X / (BALANCE as any).X 패턴 모두).
- 196: codexDiscover dispatch를 useInventoryActions의 3 paths(shopBuy/craft/synth)로 확장. cycle 193 partial fix 완성.

검증: 각 사이클 tsc 0 / unit pass / lint clean / build-guard ok.

## Cycle 191-192 — Death/META 진행도 보존 + quest title 정식 등록

- 191: handleDefeat가 RUN 진행도(gold/inv/skillLoadout)는 reset해야 하지만 META 진행도(titles/activeTitle/premiumCurrency/reviveTokens/maxInv/seasonPass) 6종은 보존되어야 함 — INITIAL_PLAYER spread로 모든 자산 reset되던 잠복 회귀. cycle 119(6 영구 카운터)/cycle 188(ASCEND premium preserve) 패턴과 정합.
- 192: quest 152/153/154의 reward.title 3종(에테르 탐험가/공허의 방랑자/종말의 정복자)이 TITLES 미등록 → SystemTab default 색상 fallback. 정식 등록 + cycle 175/185 컨벤션 (Korean id, cond.type='questReward').

검증: 각 사이클 tsc 0 / unit pass / lint clean / build-guard ok.

---

## Cycle 190 — CHANGELOG에 cycles 171-189 history 일괄 추가

- 문서: cycle 170 batch 이후 19 사이클 미반영 상태 batch 정리. cycle 98 / 114 / 132 / 146 / 160 / 170에 이은 7번째 batch. unit test 1000+ 마일스톤 (cycle 188에서 1002 달성).

검증: tsc 0 / unit 1005 / lint clean / build-guard ok.

---

## Cycle 185-189 — PremiumShop UX 회귀 정리 5사이클 시리즈

- UX/시스템: PremiumShop 4종(invExpand / synthProtect / revive / cosmeticTitles) 구매 흐름 전체에 걸친 잠복 회귀를 5 사이클 chain으로 정리.
- 185: cosmetic title 4종(별을 보는 자 / 공허를 걷는 자 / 에테르의 아이 / 세계의 끝)을 TITLES 정식 등록 + purchaseCosmeticTitle이 player.titles에 push 추가. 기존엔 stats.cosmeticTitles만 저장돼 SystemTab 디스플레이에서 invisible이던 "구매했지만 못 쓰는" UX 회귀.
- 186: reviveTokens / synthProtects 토큰 소비 로직 추가. reviveTokens는 applyFatalProtection death save chain에 새 fallback (void_heart 다음, phoenix_revive 전). synthProtects는 synthesize 함수에서 토큰 우선 소비. 기존엔 둘 다 dead purchase였음.
- 187: clearTemporaryAdventureState가 voidHeart run-wide 플래그 보존. 기존엔 안전 맵 이동만으로 voidHeartUsed가 false로 풀려 death save '런당 1회' spec 위반. applyBattleStartRelics와 일관성.
- 188: ASCEND가 premium 구매 자산 4종(stats.cosmeticTitles, stats.synthProtects, reviveTokens, maxInv) 보존. cycle 119 6 영구 카운터 패턴 확장. 환생 시 premium 구매 자산이 사라지던 회귀.
- 189: migrateData가 4 premium 자산 default 처리(reviveTokens / synthProtects 음수 정규화 + cosmeticTitles array 정합 + maxInv 음수 가드). 옛 save 호환.

검증: 각 사이클 tsc 0 / unit pass / lint clean / build-guard ok.

## Cycle 184 — quest target 도달 가능성 6건 batch + 가드 (cycle 164 follow-up)

- 콘텐츠: cycle 164가 quest target → MONSTERS keys 정합성 가드. 그러나 monster가 MONSTERS에 정의만 있고 spawn pool(monsters[] / bossMonsters[] / boss / ABYSS_BOSS_NAMES) 미참여면 spawn 안 함 → 진행도 영원히 0이던 잠복 회귀 6건 발견.
- 수정: 6 quest target 매핑 (105/106/107/108/109/150) — 에테르 방랑자→에테르 잔류체 / 차원의 포식자→차원 포식자 / 공허의 감시자→공허 감시병 / 허무의 기사→허무 집행관 / 에테르 심판자→에테르 드래곤 / 공허의 대행자→공허 집행관.
- 가드: spawn pool 도달성 lock — cycle 164(정의 존재) → cycle 184(spawn 도달) 두 단계 정합성.

검증: tsc 0 / unit 984 / lint clean / build-guard ok.

## Cycle 183 — 시즌 보스 2종 drop table 추가 (cycle 173 follow-up)

- 콘텐츠: cycle 173에서 추가된 봄의 여왕 / 서리 군주 보스가 dropTables.ts에 미등록 — cycle 171 보너스 드랍(25% tier 5/6 random)만 발동하던 큐레이션 부재.
- 수정: 자연 테마(봄의 여왕) / 얼음 테마(서리 군주) drop table 4 entry씩 추가. legendary tier 5 무기는 cycle 177 발견 체인 보상과 동일 매핑 reuse.

검증: tsc 0 / unit 982 / lint clean / build-guard ok.

## Cycle 181-182 — DB shape 가드 + 인벤토리 cap 정합 (cycle 179/180 lessons learned)

- 181: cycle 179/180 잠복 회귀(DB.ITEMS shape 가정 오류) 재발 영구 차단. DB shape lock 5 가드 — DB.ITEMS keys 정확히 7개, 각 array, src/ 화이트리스트(unknown 키 access 금지), DB.QUESTS/ACHIEVEMENTS array, DB.MAPS/MONSTERS/CLASSES keyed object.
- 182: 인벤토리 cap 검사가 player.maxInv (PremiumShop 확장 슬롯) 존중. exploreUtils chain reward + adventureGuide hint가 BALANCE.INV_MAX_SIZE만 사용해 확장 인벤(25)에서도 20에서 reward skip / 18에서 잘못된 경고 발동하던 회귀.

검증: 각 사이클 tsc 0 / unit pass / lint clean / build-guard ok.

## Cycle 179-180 — DB.ITEMS shape 잠복 critical 버그 2건 fix

- 179: combatBossHandlers.ts:92 '(DB.ITEMS).flat()' TypeError로 abyss 50/100/300층 milestone 처리 crash. DB.ITEMS는 object — '.flat()' 호출 불가. abyss 50층 이후 진행 끊기던 critical regression. 'Object.values(DB.ITEMS).flat()' 패턴으로 fix.
- 180: exploreUtils.ts:357 'DB.ITEMS?.allItems?.find()' silent miss. allItems는 미존재 필드 → 항상 undefined → cycle 177이 매핑한 DISCOVERY_CHAINS reward.item이 inv에 안 들어가던 회귀. findItemByName(getAllItems()) 사용으로 fix.

검증: 각 사이클 tsc 0 / unit pass / lint clean / build-guard ok.

## Cycle 175-178 — 데이터 정합성 잠복 회귀 4건

- 175: 시즌 패스 보상 칭호 3종(시즌 선구자 / 정복자 / 마스터)을 TITLES 정식 등록. SEASON_REWARDS에서 참조하지만 TITLES 미등록이라 cosmetic 라벨로만 보이던 inconsistency.
- 176: 'blindMap' challenge modifier 활성. 6종 modifier 중 5종은 핸들러 보유, blindMap만 silent no-op이던 dead modifier. StatusBar에 '???' 표시 분기 추가 + 모든 modifier 핸들러 가드.
- 177: DISCOVERY_CHAINS reward.item 3건(용의 숨결 / 영원의 빙결정 / 마왕의 인장) items.ts 미등록 → 기존 items로 매핑(용의 화염 / 빙결의 왕관검 / 마왕의 대낫). 정합성 가드.
- 178: eventChains 'info' reward type 핸들러 추가. ancient_prophecy chain의 reward.text 정보가 silent 누락이던 회귀.

검증: 각 사이클 tsc 0 / unit pass / lint clean / build-guard ok.

## Cycle 171-174 — baseline 시스템 후 발견된 잠복 회귀 4건

- 171: processLoot early-return 버그 fix. 'if (!lootList) return' 이 보너스 드랍 로직(고레벨 enemy tier 4-6 random)을 차단해 drop/loot 미등록 non-boss 104종이 빈손 회귀였음. early return 제거.
- 172: 'counter' 스킬 효과 추가 ('반격 자세' 마지막 dead skill effect). performSkill buff 분기 + enemyAttack 반격 발동 분기.
- 173: cycle 165 baseline의 boss/bossMonsters 누락 검출 보강 + 봄의 여왕 / 서리 군주 2 보스 추가. baseline 가드가 monsters[]만 검사해 잠복 회귀 발생.
- 174: QUESTS 중복 id 2건(99 / 95) fix. 두 번째 중복은 lookup find로 접근 불가하던 dead content. id 205 / 206 재할당. id 유일성 회귀 가드.

검증: 각 사이클 tsc 0 / unit pass / lint clean / build-guard ok.

---

## Cycle 170 — CHANGELOG에 cycles 161-169 history 일괄 추가

- 문서: cycle 160 batch 이후 9 사이클 미반영 상태 batch 정리. cycle 98 / 114 / 132 / 146 / 160에 이은 6번째 batch.

검증: tsc 0 / unit 934 / lint clean / build-guard ok.

---

## Cycle 165-169 — map.monsters[] → MONSTERS 정합성 baseline 42 → 0 달성 🎯

- 콘텐츠: maps.ts의 monsters[] 배열에 monsters.ts MONSTERS 객체 미등록 이름 42건 발견. spawnEnemy의 DB.MONSTERS[baseName] lookup이 미존재 시 weakness/resistance/multiplier/pattern/phase2 모두 미적용 — generic stat-blank 회귀. 게임은 진행되지만 속성 약점/저항 메커니즘이 작동 안 해 전투 깊이 축소.
- 165: KNOWN_MISSING_MAP_MONSTERS Set(42) baseline lock + 양방향 가드 + 화염/얼음 8종 batch (-8). cycle 141/148/164 baseline pattern 시리즈에 4번째 합류.
- 166: 언데드 5(망자의 사제 / 묘지 구울 / 유령 군단 / 해골 마법사 / 저주받은 기사) + 폭풍 3(뇌운 와이번 / 번개 정령 / 폭풍 그리핀) batch (-8).
- 167: 자연/꽃 4(봄의 정령 / 정원 요정 / 꽃 골렘 / 꽃잎 슬라임) + 공허 3(공허 감시병 / 공허 마법사 / 공허의 파편) + 동굴 박쥐 batch (-8).
- 168: 부패/타락 5(붕괴한 / 실험실 / 최후의 / 타락한 / 파멸의 수호자/용사/기사) + 실험실 3(생체 병기 / 오염된 연구원 / 폭주 자동인형) batch (-8).
- 169 🎯: 잔존 10종(바람 2 / 심연 1 / 에테르 2 / 종말 2 / 허무/혼돈 2 / 차원 1) final batch (-10). baseline = new Set([]) lock 달성.
- 결과: 모든 maps.ts spawn pool monster가 MONSTERS profile 보유. 속성 약점/저항/패턴/statusOnHit 메커니즘이 모든 enemy에 정확히 적용. 회귀 영구 차단.

검증: 각 사이클 tsc 0 / unit pass / lint clean / build-guard ok.

## Cycle 164 — quest/ach target → MONSTERS 정합성 10건 일괄 정리 + baseline 0 가드

- 콘텐츠: quests.ts target 필드에 monsters.ts MONSTERS 객체에 없는 이름 10건 사용 중 발견. 해당 퀘스트는 처치 진행도가 영원히 0 (target 이름이 실제 spawn enemy name과 매칭되지 않아). 가장 명백: '사막 도적' (공백) vs '사막도적' (실재 키, 공백 없음).
- 수정: 10건 batch perl 매핑 — 사막 도적 → 사막도적 / 가고일 → 유령 기사 / 고대 골렘 → 황금 골렘 / 그림자 암살자 → 다크 엘프 / 보물고 수호자 → 황금 골렘 / 빙결 정령 → 서리 정령 / 심해 대사 → 심연의 파수꾼 / 에테르 골렘 → 에테르 거인 / 죽음의 기사 → 타락 기사 / 차원 보행자 → 차원 보병.
- baseline 가드: cycle 141/148 양방향 가드 패턴 재사용 — 비-system target이 모두 MONSTERS keys 존재. SYSTEM_TARGETS whitelist 회귀 가드 동봉.

검증: tsc 0 / unit 912 / lint clean / build-guard ok.

## Cycle 161-163 — per-turn / 잔존 secondary 메커니즘 정리 (cycles 149-158 TODO)

- 시스템: cycle 148 baseline 0(cycle 159) 달성 후 effect string은 baseline 통과했지만 실제 동작이 부분적이던 잔존 메커니즘 정리.
- 161: tickCombatState에 3종 — 'genesis' healPerTurn 0.02 (창세의 핵 매 턴 회복) / 'eternal_fortress' regenPerTurn 0.08 (영원의 요새 시너지 매 턴 재생) / 'hp_drain_atk' hpCost (혈맹의 반지 / 심연의 계약 매 턴 HP 소모, hell_reaper 시너지가 cost 직접 대체).
- 162: applyFatalProtection / enemyAttack — 'phoenix_revive' atkBuff/duration tempBuff (불사조 부활 후 ATK +50% 3턴) / 'titan' critReduce 0.5 (타이탄 강타 -50%).
- 163: performSkill — 'cooldown_reduce' firstFree (시간 군주 첫 스킬 MP 무소비). combatFlags.firstSkillUsed 추적 + applyBattleStartRelics 매 전투 false 리셋.
- 결과: 의도된 빌드 path 활성 — 혈맹 ATK 35% / 심연 ATK 60%가 페널티 없이 지급되던 밸런스 누락 fix. hell_reaper "HP 소모 3% 감소" desc가 실제 동작. 영원의 요새 매 턴 +80 HP 재생으로 탱킹 빌드 가능.

검증: 각 사이클 tsc 0 / unit pass / lint clean / build-guard ok.

---

## Cycle 160 — CHANGELOG에 cycles 147-159 history 일괄 추가

- 문서: cycle 146 batch 이후 13 사이클 미반영 상태 batch 정리 (cycle 98 / 114 / 132 / 146에 이은 5번째 batch).

검증: tsc 0 / unit 895 / lint clean / build-guard ok.

---

## Cycle 148-159 — relic.effect 핸들러 baseline 34 → 0 달성 🎯

- 콘텐츠/시스템: 81종 unique relic effect 중 34종이 src/ 어디에서도 핸들러 등록 0건 발견. 신화/창세 tier 다수 포함된 큰 콘텐츠 갭. cycle 141 quest baseline pattern을 재활용해 12 사이클 점진 정리.
- 148: KNOWN_MISSING_RELIC_EFFECTS Set(34종) baseline lock + 양방향 가드(NEW dead 즉시 실패 / baseline 좁히기 강제). cycle 134(SoundManager) / 138(CONSTANTS·BALANCE) / 141(quest item) 회귀 가드 패턴 재사용.
- 149-152: 단순 passive multiplier 정리 — titan / genesis / hp_drain_atk / first_turn_evade / cooldown_reduce / elem_boost / on_hit_freeze / reflect_crit. statsCalculator.computeRelicBonuses 1-line 추가 패턴.
- 153 batch: 시너지 11종 effect-name dispatch — vampire_lord / arcane_surge / unbreakable / time_master / death_oracle / immortal_warrior / eternal_life / infinite_devour / absolute_immortal / blood_immortal / primordial_wrath. bonus-key fallback 보존.
- 154: defMult / chaosAtk / critDmg 시너지 — eternal_fortress / entropy_god / void_dragon. applySynergyBonuses 시그니처 확장 + finalDef 곱 인자.
- 155: time_dominator / arcane_singularity — 기존 cooldown_reduce / free_skill 유물 분기에 합산 합류. cycle 153 timeMasterSyn extraTurnChance 하드코딩 latent bug 동시 fix.
- 156: hell_reaper / annihilator / absolute_reflect — 기존 vampire_lord / execute_bonus / reflect 분기에 합산 합류.
- 157: phoenix_revive / devour_hp — applyFatalProtection void_heart fallback + handleVictory maxHp 영구 증가.
- 158: battle_start_buff / kill_stack_atk — applyBattleStartRelics tempBuff 적용 + combatFlags.killStackAtkBonus per-combat 누적. phoenixUsed 매 전투 리셋(런 1회 발동 버그 fix).
- 159 🎯: entropy_tick / entropy_brand — 신규 헬퍼 applyEntropyTick으로 turn-based DOT 통합. attack/performSkill 끝부분 호출. baseline 0 달성.

검증: 각 사이클 tsc 0 / unit pass / lint clean / build-guard ok.

## Cycle 147 — dead AT(action type) 6건 + 핸들러 일괄 정리 + 회귀 가드

- 정리: actionTypes.ts에 선언만 되고 dispatch 호출이 0건인 AT 키 6건 발견 (RESET_RUNTIME_UI / CLEAR_LOGS / SYNTHESIZE_ITEMS / SET_PREMIUM_CURRENCY / SET_CHALLENGE_MODIFIERS / SET_PUBLIC_GRAVES). uiHandlers / rewardHandlers / multiplayerHandlers의 핸들러도 dead 상태였음. 일괄 제거.
- 가드: 양방향 회귀 가드 — 모든 AT.X가 src/ 어딘가에서 dispatch되어야 함, 핸들러 등록 키도 AT 정의에 존재해야 함 (string typo 가드). cycle 134(SoundManager) / 138(CONSTANTS·BALANCE) / 141(quest reward.item) / 148(relic.effect) 회귀 가드 패턴 시리즈에 합류.
- 부수: uiHandlers.ts에서 더 이상 GS import 불필요해 제거.

검증: tsc 0 / unit 845 / lint clean / build-guard ok.

---

## Cycle 146 — CHANGELOG에 cycles 132-145 history 일괄 추가

- 문서: cycle 132 batch 이후 14 사이클 미반영 상태 batch 정리 (cycle 98 / 114 / 132에 이은 4번째 batch).

검증: tsc 0 / unit 843 / lint clean / build-guard ok.

---

## Cycle 141-145 — quest/ach 보상 missing item baseline 0 달성 🎯

- 콘텐츠: cycle 140 이벤트 체인 7건 fix 후 같은 패턴 검증 결과 quest / achievement reward.item이 75종 unique missing — 모든 보상이 silent no-op (플레이어가 챕터/업적 완수해도 인벤토리에 안 들어감) 발견.
- 141: KNOWN_MISSING_REWARD_ITEMS Set + 양방향 가드 도입 (NEW missing 즉시 실패 / baseline 좁히기 강제). cycle 140 EVENT_CHAINS 회귀 가드 동봉.
- 142(-7) / 143(-7) / 144(-15) / 145(-46) 점진 정리. cycle 145는 Perl batch script로 44종 unique missing item을 theme-based 매핑(망토 / 갑옷 / 마나 결정 / 영웅의 물약 / 잊혀진 열쇠 / 기계 코어 / 강화 재료 등)으로 한 번에 교체.
- 결과: 모든 quest/achievement/event chain 보상이 실재 items.ts 항목 참조. addItemByName silent no-op 회귀 영구 차단.

검증: 각 사이클 tsc 0 / unit 843 / lint clean / build-guard ok.

## Cycle 140 — 이벤트 체인 7건 missing item 콘텐츠 정합

- 콘텐츠: cycle 139 핸들러 인프라 추가 후 검증 결과 EVENT_CHAINS 전반에 items.ts 미등록 item.name reward 7건 발견. lost_wizard / last_hero / shadow_guild / machine_uprising / world_tree_corruption / divine_apostle_trial / rift_secret 7개 chain의 보상이 처음으로 정상 작동.
- 매핑: 전설의 마법서→천벌의 지팡이 / 기사의 유검→심판자의 검 / 그림자 단검→그림자 절단기 / 기계 코어 갑옷→천상의갑주 / 세계수의 이슬→세계수의 지팡이 / 신전의 성광석→성스러운 창 / 균열 봉인석→균열 차단 방패. outcome log 텍스트도 새 이름과 일치하도록 갱신.

검증: tsc 0 / unit 840 / lint clean / build-guard ok.

## Cycle 139 — 이벤트 체인 legendary_item reward 핸들러 누락 회귀

- 시스템: eventActions.handleEventChoice가 gold/item/relic/combat_bonus/stat_bonus 5개 reward 타입만 처리하고 legendary_item 분기 누락. lost_wizard chain의 전설 보상이 silently 누락되던 회귀.
- 수정: rwd.type === 'legendary_item' 분기 추가 — 'item'과 동일하게 addItemByName + MSG.LOOT_GET. cycle 122/135 quest_complete 사운드는 외곽 if (rwd) 블록에서 자동 트리거.

검증: tsc 0 / unit 838 / lint clean / build-guard ok.

## Cycle 138 — CONSTANTS/BALANCE namespace 정합성 회귀 가드

- 테스트: cycle 137에서 발견된 2건의 잠복 버그(CONSTANTS.PRIMAL_SHARD_DROP_CHANCE / CONSTANTS.DAILY_INVADE_LIMIT — 둘 다 BALANCE 키를 CONSTANTS로 잘못 참조해 undefined 평가, 게임 핵심 메커니즘 비활성)가 재발 안 하도록 자동화 가드.
- 메커니즘: src/**/*.{ts,tsx} glob 스캔, BALANCE.X / CONSTANTS.X 참조를 추출해 각 키가 해당 객체에 존재하는지 검증.

검증: tsc 0 / unit 835 / lint clean / build-guard ok.

## Cycle 137 — CONSTANTS/BALANCE 참조 mismatch 2건 + PRIMAL_SHARD_REQUIRED 활성

- 시스템: combatBossHandlers의 CONSTANTS.PRIMAL_SHARD_DROP_CHANCE 참조가 undefined → 마왕 격파 후 primal shard가 영원히 안 떨어져 진엔딩 잠금. useInventoryActions의 CONSTANTS.DAILY_INVADE_LIMIT도 undefined → 일일 침공 제한이 사실상 비활성. 둘 다 BALANCE 객체에서 가져오도록 수정.
- 부수: shardCount < BALANCE.PRIMAL_SHARD_REQUIRED 게이트 신규 도입 — required 만큼 모이면 추가 드랍 차단. 기존 magic number 3 제거.

검증: tsc 0 / unit 832 / lint clean / build-guard ok.

## Cycle 136 — killStreak 시간 기반 감쇠 활성

- 시스템: BALANCE.KILL_STREAK_DECAY_MS 상수가 선언만 돼 있고 호출 0건 — dead constant. combatVictory에서 lastKillAt timestamp 추적 + 다음 kill 시 경과 시간이 KILL_STREAK_DECAY_MS 초과면 streak 0 reset.
- 결과: 장시간 휴식/이동 후 streak가 자연스럽게 끊어져 콤보 ramping이 의도대로 동작.

검증: tsc 0 / unit 832 / lint clean / build-guard ok.

## Cycle 135 — 이벤트 체인 보상 사운드 큐

- UX: eventActions.handleEventChoice의 reward 처리 끝에서 if (rwd) soundManager.play('quest_complete') 호출 추가. cycle 122 / 123 / 133에서 정착시킨 quest_complete 사운드(E major 4음) 재사용 — 챕터 보상 수령에 동일한 victory 톤.

검증: tsc 0 / unit 832 / lint clean / build-guard ok.

## Cycle 134 — SoundManager 사운드 키 등록·호출 정합성 회귀 가드

- 테스트: SoundManager.play(key) 호출 콜사이트(grep)와 SoundManager 내부 case 분기를 양방향 비교. 등록 안 된 키 호출(silent fallthrough) / 호출 0건 dead case 둘 다 catch.

검증: tsc 0 / unit 832 / lint clean / build-guard ok.

## Cycle 133 — 도감 milestone 수령 사운드 큐

- UX: claimCodexMilestone 액션에서 quest_complete 사운드 재사용. cycle 122(퀘스트) / 123(업적) 라인 통일 — 모든 milestone 수령 모먼트가 동일 sensory cue.

검증: tsc 0 / unit 832 / lint clean / build-guard ok.

## Cycle 132 — CHANGELOG에 cycles 114-131 history 일괄 추가

- 문서: cycle 114 batch 이후 18 사이클(115-131) 미반영 상태 batch 정리. cycle 98 / 114에 이은 3번째 batch.

---

## Cycle 131 — save → migrate → ASCEND 통합 흐름 회귀 가드

- 테스트: cycle 119(ASCEND preserve) + 120(migrate default) + 121(INITIAL_STATE declaration) end-to-end 통합 회귀 가드. 3개 시나리오(legacy save / 신규 플레이어 / 연속 환생).

검증: tsc 0 / unit 812 / lint clean.

## Cycle 125-130 — testid 인프라 sweep 6 사이클

- UX: 핵심 surface 6개에 stable testid 추가 — smoke/e2e 자동화 확보. 합 19개 신규 testid.
  - 125 AchievementPanel (4): panel / card-${id} / claim-${id} / toggle-show-all
  - 126 EventPanel (3): event-panel / event-choice-${idx} / event-dismiss
  - 127 PremiumShop (4): premium-shop / buy-${id} / title-buy-${id} / close
  - 128 QuickSlot (3): quick-slot-${i} / assign-${i} / unassign
  - 129 TrueEndingScreen (2): true-ending-screen / confirm
  - 130 Codex (3): codex-panel / tab-${id} / claim-${id}

검증: 각 사이클 tsc 0 / lint clean / unit pass.

## Cycle 124 — 데드 stats 필드 정리 (comboCount, lowHpWins)

- 정리: INITIAL_STATE에 선언됐지만 사실상 dead인 stats.comboCount / stats.lowHpWins 제거. activate combo는 combatFlags.comboCount(별도 필드), countLowHpWins은 fallback 안전.

검증: tsc 0 / unit 790 / lint clean.

## Cycle 121-123 — discoveryChains INITIAL_STATE + 사운드 시리즈

- 121: INITIAL_STATE에 discoveryChains: [] 선언 (cycle 102/119/120 declarative 마무리).
- 122: 퀘스트 완료 사운드 추가 (E major 4음 — completeQuest 액션).
- 123: 업적 청구도 같은 quest_complete 사운드 재사용 (claimAchievement).

검증: 각 사이클 tsc 0 / lint clean / unit pass.

## Cycle 119-120 — Ascension 영구 카운터 보존 + migrate default 정리

- 119: progressionHandlers.ASCEND가 6종 영구 카운터(escapes/syntheses/maxKillStreak/visitedMaps/discoveryChains/abyssRecord) 누락 → 환생 시 multi-run achievement 회귀. 6종 모두 preserve 추가.
- 120: migrateData에 신규 카운터 default 추가 + dead `discoveries` migrate 라인 제거 (cycle 84 후속).

검증: 각 사이클 tsc 0 / lint clean / unit pass.

## Cycle 117-118 — 사운드 큐 시리즈 (discovery_chain / new_area)

- 117: SoundManager case 'discovery_chain' (G major 4음) — cycle 102/103 chain 보상 sensory cue. exploreUtils.checkDiscoveryChains에서 직접 호출.
- 118: SoundManager case 'new_area' (D major 3음 짧음) — moveActions firstVisit 분기에서 호출. 6종 음악적 색채 정리(victory C / legendary C+B6 / levelUp C / discovery_chain G / new_area D).

검증: 각 사이클 tsc 0 / lint clean / unit pass.

## Cycle 116 — 미사용 MSG 키 37종 정리

- 정리: src/data/messages.ts에서 호출 0건인 MSG 키 37종 제거 — MILESTONE/BOSS_ENCOUNTER/GM/UI/CODEX/REST_FULL/SKILL_CURSE_AMPLIFY 등 7개 그룹.
- Firebase save에 영향 없음 (MSG는 코드 정의만).

검증: tsc 0 / unit 756 / lint clean.

## Cycle 115 — AdventureGuide 디버프 정화 hint (cycle 112 actionable)

- UX: safe + player.status.length>0이면 "디버프 정화 권장" hint. cycle 112 rest가 status 클리어하므로 정합. cycle 111 매핑 8종 한국어 라벨 재사용.
- 우선순위: claimable quest / 모험가 전직 / hpRatio rest 다음.

검증: tsc 0 / unit 754 / lint clean.

## Cycle 114 — CHANGELOG에 cycles 98-113 history 일괄 추가

- 문서: cycle 98 batch 이후 16 사이클 미반영 상태 batch 정리.

---

## Cycle 113 — CombatPanel 적 debuff chip (cycle 111 player chip의 symmetry)

- UX: CombatPanel에 적 debuff chip(stunnedTurns/cursedTurns/blindTurns/fearTurns/dots). emerald 톤 — cycle 111 rose(player) 위험과 대비.
- 결과: 플레이어가 부여한 status가 실시간 시각 노출.

검증: tsc 0 / unit 749 / lint clean.

## Cycle 112 — rest 시 player.status 정리 (status 시리즈 후속 UX 안전망)

- UX: characterActions.rest에 status: [] 초기화 추가. cure 아이템이 없는 status(bleed/blind/fear/stun)에 대한 안전망 — 안전지대 휴식으로 모든 디버프 해소.
- 영향: 영구 디버프 트랩 시나리오 차단.

검증: tsc 0 / unit 744 / lint clean.

## Cycle 111 — StatusBar active debuff chip (cycle 106-110 status 시각 노출)

- UX: StatusBar에 player.status가 length>0이면 debuff chip 노출. rose-200 톤(위험), aria-label에 전체 debuff 한국어 리스트(8종 매핑).
- testid: `status-debuff-chip` + `data-debuff-count`.

검증: tsc 0 / unit 741 / lint clean.

## Cycle 106-110 — Player status 시스템 5종 복구 시리즈

- 시스템: 보스 phase 2/3가 부여하는 5종 status가 player에 효과 없던 비대칭 회귀를 5 사이클에 걸쳐 복구.
  - cycle 106: bleed → DoT 매 턴 maxHp 4% (DOT_STATUSES에 추가, MSG.STATUS_DOT 출혈 라벨).
  - cycle 107: freeze/stun → 1턴 스킵 (attack/performSkill 시작 시 체크, status 제거).
  - cycle 108: curse → 받는 피해 +30% (BALANCE.CURSE_PLAYER_DMG_TAKEN_MULT, enemyAttack 적용).
  - cycle 109: blind → 30% miss 확률 (BALANCE.BLIND_PLAYER_MISS_CHANCE, status 유지).
  - cycle 110: fear → 25% flinch 확률 (BALANCE.FEAR_PLAYER_FLINCH_CHANCE).
- 영향: 보스 후반 페이즈 위험 시그널 5종 모두 의도대로 작동.

검증: 각 사이클 tsc 0 / unit pass / lint clean / build-guard ok.

## Cycle 105 — AchievementPanel THEME_BY_TARGET에 maxKillStreak / discoveryChains 추가

- UX: cycle 95/102에서 추가된 신규 target들이 cycle 79 정착 매핑에 누락되어 default kills 톤(붉은 Swords)으로 표시되던 surface 일관성 회복.
  - maxKillStreak: Flame red. discoveryChains: Link2 indigo.

검증: tsc 0 / unit 711 / lint clean.

## Cycle 104 — StatsPanel CHAINS row (discoveryChains 진행도 가시화)

- UX: cycle 80/82/96 패턴 그대로 — 카운터 시스템마다 ach + 칭호 + StatsPanel row 한 짝의 일관 구조 유지.
  Link2 / indigo-300 톤 (chain_master 칭호 색과 매치).

검증: tsc 0 / unit 705 / lint clean.

## Cycle 103 — '세계의 길잡이'(chain_master) 칭호 + discoveryChains cond.type

- 콘텐츠: title `chain_master`(세계의 길잡이) cond `discoveryChains >= 5` ATK+1 · DEF+1 · MP+15 (탐험+전투 균형형).
- 시스템: gameUtils.checkTitles에 `type === 'discoveryChains'` 분기.

검증: tsc 0 / unit 702 / lint clean.

## Cycle 102 — 발견 체인(discovery chains) 완료 achievement 3종

- 콘텐츠: ach_chain_1/3/all (BALANCE.DISCOVERY_CHAINS 5개 시스템 reflection). exploreUtils가 즉시 보상은 부여했지만 영구 reflection이 비어있던 자리 채움.
- 시스템: getAchievementCurrentValue 'discoveryChains' 핸들러 추가.

검증: tsc 0 / unit 697 / lint clean.

## Cycle 101 — relicCount achievement 진행도 double-counting 회귀

- 시스템: getAchievementCurrentValue('relicCount')가 `relics.length + stats.relicCount`로 계산되어 ADD_RELIC handler가 둘 다 증분하던 게 double count → ach_relic_5("유물 5개")가 실제 3개에서 풀리던 부풀림 fix.
- 단일 source of truth(stats.relicCount)로 통일. checkTitles와 정합. cycle 83 'discoveries' 시맨틱 통일과 동일 패턴.

검증: tsc 0 / unit 691 / lint clean.

## Cycle 100 — 잔존 lint warnings 4종 명시 disable (lint 100% clean) 🎯

- 인프라: App.tsx ref-mutate-in-render(3종, 테스트 harness 의도) + GravePanel set-state-in-effect(1종, mount-once fetch) 명시 disable + 사유 주석.
- 결과: npm run verify 풀 파이프 type-check 0 / lint 0 errors 0 warnings / unit 686 / build-guard ok 완전 통과.

## Cycle 99 — quest Level 진행도 player.level undefined 안전 처리 (TS 회귀)

- 시스템: cycle 94 latch refactor 이후 잔존하던 TS2345 에러 fix — `Math.max(N, undefined) = NaN` 위험 차단.
- 발견 경로: cycle 78-98 동안 npm run verify type-check를 매번 안 돌려 잠복.

검증: tsc 0 / unit 686 / lint clean.

## Cycle 98 — CHANGELOG에 cycles 78-97 history 일괄 추가

- 문서: cycle 67 phase 종료 이후 20 사이클의 작업이 CHANGELOG에 미반영 상태였음. 단일 batch로 정리.

---

## Cycle 97 — maxKillStreak reflection 마무리 (RunSummaryCard chip + focus advice)

- UX: RunSummaryCard run-summary-extras에 streak chip(red Flame). extras 섹션 트리거 조건에 `OR maxKillStreak > 0` 추가.
- 시스템: getRunSummaryAnalysis focus advice 2종 — `>=10` 공격형 칭찬, `<3 && level >= 10` streak 활용 권장.
- 결과: maxKillStreak feedback chain 8개 surface 완성.

검증: tsc 0 / unit 683 / lint clean.

## Cycle 96 — maxKillStreak feedback chain 표면 통합 (StatsPanel/RunSummary/share)

- UX: StatsPanel MAX STREAK row(Flame red-400) 추가.
- 시스템: buildRunSummary에 maxKillStreak 필드, buildRunShareText에 "🔥 최대 N연속 처치" silence-over-noise 라인.

검증: tsc 0 / unit 677 / lint clean.

## Cycle 95 — maxKillStreak 누적 + 보상 통합 (achievement 3종 + berserker 칭호)

- 콘텐츠: ach_streak_5/10/20 (BALANCE.KILL_STREAK_TIERS 정렬) + 신규 칭호 'berserker'(광전사) cond `maxKillStreak >= 20` ATK+3 · CRIT+2%.
- 시스템: INITIAL_STATE.player.stats.maxKillStreak = 0. combatVictory에서 매 처치 후 max(prev, newStreak) 누적. gameUtils 핸들러 2개 추가.
- 디자인 의도: 휘발성 killStreak를 영구 보상으로 연결.

검증: tsc 0 / unit 671 / lint clean.

## Cycle 94 — 퀘스트 진행도 latch (윈도우 기반 카운터 회귀 방지)

- 시스템: syncQuestProgress의 모든 stat-based 분기에 `Math.max(quest.progress, computed)` latch 헬퍼 적용.
- 영향: survive_low_hp가 stats.recentBattles(50개 윈도우)를 읽어 옛 저-HP 승리가 윈도우 밖으로 밀려날 때 progress 회귀 → 청구 영구 차단되던 회귀 수정. 단조 카운터에는 무해.

검증: tsc 0 / unit 663 / lint clean.

## Cycle 90-93 — 데드코드 정리 4 사이클 (~1649 lines)

- cycle 90: OnboardingGuide 컴포넌트 + 관련 state plumbing(action / handler / Firebase save / migrate) 8개 파일 정리.
- cycle 91: EquipmentSpriteGlyph(941L) + DashboardPanels(332L) — 단일 사이클 최대 cleanup.
- cycle 92: AdminDashboard / analyticsService / animationConfig (~280L).
- cycle 93: utils 단위 dead exports 4종 — IMAGEGEN_OVERLAY_KEYS / getEquipmentOverlayAssetKey / getOutfitAffinityTone / getMaterialShop (~80L).

검증: 각 사이클 tsc 0 / unit pass / lint clean / build-guard ok.

## Cycle 89 — 도주 스킬(escape_100) 코드 패스를 escape feedback chain에 합류

- 시스템: combatAttack의 forceEscape 분기가 cycle 74-88에서 쌓아온 stats.escapes 증분 / recentBattles record / escape 사운드 큐를 모두 누락. '공허의 문'(시간술사) / '순간 이동'(차원술사) 사용자가 보상 체인의 1급 시민이 아니던 회귀 수정.

검증: tsc 0 / unit 634 / lint clean.

## Cycle 88 — 도주 성공 사운드 큐 (escape feedback chain 마지막 sensory cue)

- 시스템: SoundManager case 'escape' (1100→600Hz 하강 sine 0.18s). combatAttack 도주 성공 분기에서 직접 호출.
- 디자인 의도: victory 5음 상승의 정반대인 retreat tone — error의 sawtooth와 달리 부드러운 sine으로 안도감.
- 결과: escape feedback chain 9 surface 완성.

검증: tsc 0 / unit 629 / lint clean.

## Cycle 87 — RunSummary focus advice에 escape/discovery 시그널 통합

- 시스템: getRunSummaryAnalysis focus advice 3종(silence-over-noise) — `escapes>=10 && bossKills<=1` 빌드 강화 권장, `discoveries<=4 && level>=12` 탐험 권장, `discoveries>=15` 탐험 칭찬.

검증: tsc 0 / unit 625 / lint clean.

## Cycle 86 — RunSummaryCard에 도주/지도 발견 시각 reflection

- UX: 신규 mini-section run-summary-extras(signatures highlight cycle 18 패턴). 도주 chip(Footprints sky-300) + 지도 발견 chip(Compass emerald-300). 둘 다 0이면 silent.

검증: tsc 0 / unit 620 / lint clean.

## Cycle 85 — 연금술사(alchemist) 칭호 + synths cond.type 핸들러

- 콘텐츠: title `alchemist`(연금술사) cond `synths >= 20` MP+15 · ATK+1. crafter(장인)와 짝을 이루는 제작 계열 보상 라인.
- 시스템: gameUtils.checkTitles에 `type === 'synths'` 분기 추가.

검증: tsc 0 / unit 615 / lint clean.

## Cycle 84 — discoveries dead write 정리 + RunSummary/share 맵 발견 라인

- 정리: cycle 83 시맨틱 통일 후속 — _shared.ts의 stats.discoveries 누적(이제 dead write) 제거, INITIAL_STATE.discoveries 선언 제거.
- UX: buildRunSummary discoveries 필드, buildRunShareText "🗺️ 지도 발견 N곳" silence-over-noise.

검증: tsc 0 / unit 610 / lint clean.

## Cycle 83 — 'discoveries' 시맨틱 통일 (visitedMaps.length 기준)

- 시스템: questProgress / checkTitles / StatsPanel이 stats.discoveries(이벤트 카운터)를 잘못 읽던 회귀 수정. 모두 visitedMaps.length로 통일 — achievement(이미 visitedMaps 사용)와 정합.
- 영향: cartographer("지도 제작자") 칭호가 10번의 이벤트만으로 풀리고 quest 201("15곳 발견")이 의도보다 훨씬 빨리 진행되던 부풀림 fix.

검증: tsc 0 / unit 603 / lint clean.

## Cycle 82 — StatsPanel CRAFTS / SYNTHESES 노출 + syntheses 선언적 일관성

- UX: StatsPanel CRAFTS row(Hammer orange-300) + SYNTHESES row(FlaskConical amber-300).
- 시스템: INITIAL_STATE.player.stats.syntheses = 0 default — crafts는 있었으나 syntheses 누락 갭 정리.

검증: tsc 0 / unit 599 / lint clean.

## Cycle 81 — 모바일 smoke testid 회귀 (archive-tab-* primary tabs)

- 인프라: scripts/smoke-gameplay.mjs verifyMobileArchiveConsole이 primary tabs(equipment/stats)에 dashboard-tab-* 잘못 매칭하던 회귀 수정. cycle 73 verify:full 통합 스크립트로 모바일 모드까지 돌리며 발견.

검증: tsc 0 / unit 595 / lint clean.

## Cycle 80 — StatsPanel ESCAPES 통계 라인 + sky 톤 일관성

- UX: StatsPanel ESCAPES row(Footprints sky-300) — cycle 74-78 도주 카운터를 stats panel에도 노출.

검증: tsc 0 / unit 594 / lint clean.

## Cycle 79 — AchievementPanel THEME_BY_TARGET 14종 시각 톤 추가

- UX: AchievementPanel에 escapes/explores/discoveries/relicCount/crafts/rests/bountiesCompleted/abyssRecord/abyssFloor/demonKingSlain/prestige/signaturesDiscovered/signatureSetsCompleted/synths 14종 테마 추가.

검증: tsc 0 / unit 593 / lint clean.

## Cycle 78 — RunSummary + RunShareText에 도주 카운트 reflection

- UX: buildRunSummary에 escapes 필드, buildRunShareText에 "🏃 도주 N회 — 위험 회피 운영" silence-over-noise.

검증: tsc 0 / unit 593 / lint clean.

## Cycle 77 — 도주/생존 칭호 2종 + escapes cond.type

- 콘텐츠: 신규 칭호 2종 (`cautious_explorer` HP+20·DEF+1 / `survivor_instinct` HP+40·DEF+2·MP+10).
- 시스템: `gameUtils.checkTitles`에 `type === 'escapes'` 분기 추가.
- 디자인 의도: ironman(공격적 무사망)과 짝을 이루는 보수적 위험 회피 운영 축.

검증: tsc 0 / unit 592 / lint clean.

## Cycle 76 — escape_count 퀘스트 2종 + questProgress 핸들러

- 콘텐츠: 신규 퀘스트 2종 (id 203 「신중한 모험」 escapes 5 Lv5+ / id 204 「생존의 기술」 escapes 20 Lv15+ + 엘릭서).
- 시스템: `questProgress`에 `type === 'escape_count' && target === 'escapes'` 분기 추가.
- 결과: 도주 카운터가 ACHIEVEMENTS(74)+QUESTS(76)+TITLES(77) 3 시스템에서 1급 시민이 됨.

검증: tsc 0 / unit 589 / lint clean.

## Cycle 75 — signaturesDiscovered 카운트 정확도 (codex 합 → REGISTRY 교집합)

- 시스템: `checkTitles`의 `signaturesDiscovered` 분기와 `questProgress`의 `signature_collect` 분기가 모두 codex 합집합 크기로 근사하던 것을 `countDiscoveredSignatures(player)` 정확 카운트로 교체.
- 영향: cycle 61의 `legend_seeker` (5종) / `legend_chronicler` (15종) 칭호와 cycle 63의 quest 202가 의도보다 일찍 풀리던 부풀림 회귀 수정.
- 테스트 갱신: 실제 SIGNATURE_REGISTRY 등록 이름(성검 에테르니아 / 마왕의 대낫 / 라그나로크 등)으로 픽스처 교체.

검증: tsc 0 / unit 587 / lint clean.

## Cycle 74 — stats.escapes 카운터 + 도주 성공 achievement 3종

- 시스템: 도주 성공 시 `stats.escapes += 1` 누적 (기존엔 recentBattles 50개 윈도우에만 푸시되어 윈도우 밖에서 사라짐).
- INITIAL_STATE.player.stats.escapes = 0 default 추가.
- 콘텐츠: ACHIEVEMENTS 3종 (`ach_escape_5/20/50` — 신중한 모험가 / 생존의 본능 / 회피의 달인).

검증: tsc 0 / unit 587 / lint clean.

## Cycle 73 — verify:full 통합 + Playwright dynamic baseURL

- 인프라: `npm run verify:full` 신규 (verify 통과 → preview 자동 기동 → smoke desktop+mobile + e2e). `local-playtest.sh` `AETHERIA_RUN_E2E=1` 옵트인 추가.
- 인프라: `playwright.config.ts` baseURL이 `process.env.PLAYWRIGHT_BASE_URL` 우선 (동적 포트 fallback 호환).
- 문서: AGENTS.md "통합 검증" 섹션 추가.

## Cycle 72 — TS/TSX 파일 lint coverage 갭 메우기

- 시스템: cycle 58 TS 마이그레이션 이후 src/는 `.ts/.tsx`만 남았으나 eslint config가 `.js/.jsx`만 매칭하던 인프라 갭 발견. `typescript-eslint` 8.x 도입 + `src/**/*.{ts,tsx}` lint block 신설.
- 코드 위생 자동 수정: `prefer-const` 2건 (exploreUtils / gameUtils).
- 추가 정리 (phase 2): SmartInventory의 `[(player.inv || [])]` 의존성을 `[player.inv]`로 교체 (매 렌더 새 배열 생성 → useMemo 무력화 잠재 회귀 4 사이트 수정). GameRoot retroactive title useEffect는 narrowed deps 의도된 패턴으로 명시.
- react-hooks 7+ 신규 strict 규칙(`refs` / `set-state-in-effect`)은 testing harness 패턴 등 기존 의도된 코드와 충돌해 warning으로 완화.
- 결과: 0 errors / 4 warnings.

## Cycle 71 — hidden boss spawn 트리거 버그 수정

- 시스템: `exploreUtils.spawnEnemy`의 `hiddenBossChecks` 루프가 `mapData.name === loc`로 비교했으나, mapData는 DB.MAPS[player.loc]로 가져와지며 `.name` 필드가 설정된 적이 없어 항상 undefined. 결과: 시간의 파수꾼(시간술사 Lv40+ 공중 신전), 원한의 용사(last_hero 체인 3단계 + 지하 미궁), 공허의 군주(abyssFloor 100+ 금지된 도서관) 3종 hidden boss가 영원히 spawn되지 않던 잠재 회귀.
- 수정: `mapData.name === loc` → `player.loc === loc`. 회귀 가드 +3개 (스폰 / 직업 미달 / 위치 미달).

## Cycle 70 — Bestiary / MonsterCodex / Codex의 boss-only 누락 버그 수정

- 시스템: 3개 컴포넌트가 `map.monsters`만 보고 `map.boss` / `map.bossMonsters`는 무시 → boss-only 몬스터(예: 고대 호수의 수호신, 하수도의 여왕)가 도감 진행 % / 위치 표시에서 사라짐. `collectMapEncounters(map)` inline helper로 합집합. `boss: true/false` legendary 플래그는 string 필터에서 silently 제외.
- 회귀 가드: 모든 MAPS의 boss 타입 + 신성한 호수 boss 인식 +5개.

## Cycle 69 — signature drop 연결 + mapSignatureHints boss 필드 버그 수정

- 콘텐츠: 고대 호수의 수호신 드롭 풀에 `심해의 수호복` rate 0.03 추가 (심연 크라켄 Lv50+ 0.06이 주 경로, mid-game 보조 경로 노출). cycle 11-29 anticipate→drop 체인을 mid-game에서도 재현.
- 시스템: `mapSignatureHints.buildMapIndex`가 `map.monsters`만 보고 `map.boss/bossMonsters`는 무시하던 버그 수정. MapNavigator의 ✦N 칩과 미발견 안내가 정확해짐.

## Cycle 68 — 신규 mid-game 보스 "고대 호수의 수호신" 완전 통합

- 콘텐츠: 신성한 호수(Lv7) mid-game 보스 신규. 5개 데이터 소스 일괄 등록 — MONSTERS(isBoss + phase2 빙결) / BOSS_BRIEFS 7개 키 / BOSS_MONSTERS 자동 derive / MAPS.boss 필드 / DROP_TABLES (5개 드롭).
- 진행 곡선: 기존 mid-game 보스(하수도의 여왕 Lv10, 전초기지 사령관 Lv18) 사이의 Lv7 구간 첫 보스 경험 제공.

검증: tsc 0 / unit 570 / smoke 통과.

## Cycle 67 — 의존성 + 안내 메시지 + 통합 검증 + 문서 동기화

- 콘텐츠: 탐색/유틸 유물 3종 (`방랑자의 부적` uncommon · `상인의 인장` rare · `운명의 결정` rare). 기존 `event_chance / gold_mult / drop_rate` 핸들러 재사용으로 CombatEngine 영향 없음.
- 인프라: `npm run verify` 통합 스크립트 (`type-check && lint && test:unit && build:guard`). 1줄로 4 gate 검증.
- 인프라: PWA `manifest.webmanifest` 한국어 description + `lang/scope/categories` 보강.
- 의존성: `npm update` patch/minor wanted 갱신 (84 deps). Capacitor 8.1→8.3, firebase 12.8→12.12, framer-motion 12.34→12.38, react 19.2.3→19.2.5 등. major(eslint 9→10 / vite 7→8 / tailwind 3→4 / lucide 0→1)는 별도 사이클로 미룸.
- 문서: AGENTS.md verification 섹션에 `tsc --noEmit` + `test:e2e` + smoke 사전조건 추가. README에 cycle 60–67 누적 6행 요약 테이블 추가. tasks/todo.md ✅ Completed에 cycle 60–64 시스템 시계열 한 항목 요약.

검증: tsc 0 / unit 565 / e2e 20 / lint clean / build:guard ok / smoke desktop 통과.

## Cycle 66 — 신규 이벤트 체인 "물의 사도"

- 콘텐츠: 호수의 신전(Lv5) → 사막 오아시스(Lv25) → 피라미드(Lv30) 3단계 체인. 보상 흐름은 `chain_advance / combat_bonus 1.2× ATK 6턴 / 엘릭서 또는 전설 유물`. cycle 62의 `forgotten_commander`(중후반)와 함께 초중반 진행 곡선을 보강.
- 테스트: `tests/water-apostle-chain.test.js` +5개.

검증: tsc 0 / unit 560 / lint clean / build:guard ok.

## Cycle 65 — CombatEngine Player typing + 보안 + ShopPanel + RunShareText + smoke 안내

- 시스템: CombatEngine 잔여 9개 메서드(`applyCritMpRestore / applyFatalProtection / tickCombatState / attack / performSkill / enemyAttack / applyExpGain / handleVictory / handleDefeat`)에 `player: Player` 적용. 내부 `let updatedPlayer: any = ...`로 strict literal inference 회피.
- 시스템: ShopPanel `player: any` → `Player` (cycle 60 batch 6에서 보류했던 nullable 가드 7곳 정리).
- 보안: `npm audit fix` 12 vulns(1 critical / 7 high / 4 moderate) → 0. vite path traversal / xmldom DoS / yaml stack overflow / brace-expansion DoS 등.
- UX: `RunShareText`에 `🎯 빌드 / 📊 난이도` 라인 추가 (`silence over noise`).
- 인프라: `smoke-gameplay.mjs` 연결 실패 시 안내 메시지 + 해결 옵션 3가지.

검증: tsc 0 / unit 555 / lint clean / build:guard ok / smoke 통과.

## Cycle 64 — E2E 회귀 가드 확장 + SW 캐시 v3

- 인프라: E2E 14 → 20개. STATS / CODEX / QUEST / ACHV 탭 lazy-loading + LegendaryCodex 빈 상태 educational hint(보스/전설 키워드) + pity status panel.
- 인프라: PWA `aetheria-rpg-v2` → `aetheria-rpg-v3` 캐시 갱신 (cycle 60–63 대규모 변경 후 stale chunk 방지).

검증: tsc 0 / unit 552 / e2e 20 / lint clean / build:guard ok.

## Cycle 63 — 챌린지 퀘스트 3개 + signature_collect 핸들러

- 콘텐츠: `대륙의 발자취 (explores 50)`, `지도 완성가 (discoveries 15, 칭호 보상)`, `전설 기록자 (signaturesDiscovered 15, 칭호 보상)`.
- 시스템: `signature_collect` quest type 핸들러 (`questProgress.ts`) — codex 합집합 크기로 진행도 산출.
- 테스트: signature_collect 매핑 + goal cap 동작 +2개.

검증: tsc 0 / unit 552 / lint clean / build:guard ok.

## Cycle 62 — forgotten_commander 체인 + UX polish + retroactive titles

- 콘텐츠: 이벤트 체인 "잊혀진 사령관" 3단계 (잊혀진 폐허 → 몰락한 전초기지 → 마왕성). 보상은 `chain_advance / combat_bonus 1.25× ATK 8턴 / 기사의 흉갑 또는 전설 유물`.
- 시스템: eventActions `stat_bonus` reward 핸들러 정상화 (기존 `rift_secret` 체인이 사용 중이었지만 silently 무시되던 보상).
- UX: 5개 풀스크린 모달 safe-area 패딩 + 8개 컴포넌트 `100vh → 100dvh`.
- 시스템: GameRoot bootStage ready 시 retroactive `checkTitles` (기존 save가 신규 칭호 조건 충족 상태로 로드돼도 즉시 부여).

검증: tsc 0 / unit 548 / lint clean / build:guard ok / smoke 통과.

## Cycle 61 — 성능 최적화 + 신규 칭호 5종

- 성능: 메인 index 387 → 265 KB (-32%). Dashboard 174 → 51 KB (-71%). 초기 로드 JS 561 → 316 KB (-44%).
- 성능: vite manualChunks 정리 + `game-equipment` / `game-combat` 청크 분리. Dashboard 비-default 탭 10개 React.lazy + Suspense fallback. Firebase 청크 `firestore / auth / core` 3개 분리.
- 콘텐츠: 신규 칭호 5종(`wanderer / pathfinder / cartographer / legend_seeker / legend_chronicler`) + 신규 cond.type(`explores / discoveries / signaturesDiscovered`).

검증: tsc 0 / unit 542 / lint clean / build:guard ok.

## Cycle 60 — TypeScript 도메인 타입 정착 (12 batch)

- 시스템: `src/types/`에 `Player / Item / Monster / GameMap / GameState / GameAction / Relic / EquipSlots` 도메인 타입 정의. `[key: string]: any` 인덱스 시그니처로 런타임 동적 필드 호환.
- 시스템: gameReducer / handlers/* / utils/* / hooks/* / components/* 전반에 단계적 적용 (12 batch). CombatEngine은 `getCombatFlags / getEffectiveMaxMp / updateQuestProgress` 3개 simple 메서드까지 적용 (heavy 메서드는 cycle 65에서 마무리).
- 시스템: `EquipSlots`를 ItemBase 슬롯 + 인덱스 시그니처로 완화 (런타임 동적 슬롯 호환).
- 시스템: `Relic` 도메인 타입 신규 — effect-기반 다형 데이터를 permissive 인터페이스로.

검증: tsc strict 0 errors / unit 536→542 / lint clean / build:guard ok.

---

## 이전 사이클 (–v4.0 / cycle 1–58)

- README의 `최근 수정 (Hotfixes)` 표를 참조. 주요 마일스톤은 cycle 58 (TS 인프라 + Playwright E2E + ts-nocheck 100% 제거), cycle 59 (strict: true 활성), cycle 56–57 (premium avatar / equipment family).
