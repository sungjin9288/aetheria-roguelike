# Equipment image-failure fallback review

## Execution

Used production ItemIcon, EquipmentAvatarPreview, AvatarEquipmentOverlay, CSS and exact DB items in a controlled390×844 component harness. No game code, original image or normal save edits. Scripts: `output/s5-item-fallback.html` and `output/s5-item-fallback.mjs`;14789 exit0, `/tmp/aetheria-s5-item-fallback.log`.

Five exact primary PNG requests were aborted in a separate browser context: 성검 에테르니아(1H), 대지의 심판(2H), 차원 방패 이지스(shield), 천공 성전(focus), 세계수의 로브(robe). Each was rendered at32/46/96px. All15 switched to the actual avatar-preview fallback and their fallback images loaded; five blocked paths were asserted, horizontal overflowfalse. No DOM artwork replacement or manually-triggered image error event.

Owner viewed `output/playwright/s5-item-normal-390x844.png` and `output/playwright/s5-item-fallback-390x844.png`.

## Visual judgement and limits

Normal icons have distinct sword, long two-hand blade, shield, book and robe silhouettes. Failure fallback is a deliberately different composition: character base plus equipment overlays, not equivalent item-only art. At96px the large figure and overlays are visible; at32px weapon/book details become subordinate to the character. Weapon tips may be cropped by the preview stage, so this is not proof of uncropped standalone item art. Labels in this harness remain readable; no empty fallback tile was observed.

This proves the actual rendering path for these five representative items, not every229-item failure combination or total-network failure. Fallback base/overlay images were available; exhausting every sprite candidate remains untested. Do not label the fallback as normal equipped-character synthesis or as equal-fidelity primary artwork. No new fallback design was implemented.
