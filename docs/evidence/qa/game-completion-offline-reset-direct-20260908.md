# Offline return and reset — 2026-09-08

Separate QA dev server60900 on127.0.0.1:4173, fresh isolated browser contexts at390×844. No production save, dist, native package or gameplay code changes.

## Offline return

`output/s5-offline-return.mjs`, session98055 exit0; log `/tmp/aetheria-s5-offline-return.log`.

Created character through UI in `toss-first-five` QA namespace, disconnected browser network, departed, explored, chose an event option and returned through map controls. Debrief showed combat0/explore1, EXP25/gold100, fullHP178 and no new item. Waited for the same summary ID in local storage, restored network, reloaded and verified the same ID/location. No page error or horizontal overflow.

Owner opened `output/playwright/s5-offline-return-390x844.png` and `output/playwright/s5-offline-return-restored-390x844.png`. Both show the same readable debrief and reward action.

This proves offline continuation and local save, followed by **online reload**. It does not prove a cold offline application launch, networked Firebase recovery, combat while offline, natural long-term growth or a Toss device session.

## Reset cancel and confirm

`output/s5-reset-direct.mjs`, final session74763 exit0; log `/tmp/aetheria-s5-reset-direct-stable.log`.

Existing isolated `system-settings` fixture supplied rank2/essence220. Opened equipment console→settings→restart through real controls. Confirmation focused the confirm action. Cancel preserved the full existing ascension snapshot. Reopened confirmation and confirmed: intro visible, persistent game status hidden, empty active name, rank2/essence220 preserved, overflowfalse.

Owner opened stable screenshots `output/playwright/s5-reset-confirmation-stable-390x844.png` and `output/playwright/s5-reset-new-journey-stable-390x844.png`. The reset explanation and both actions fit inside the screen. Earlier screenshots without `stable` caught transition opacity and are not final readability proof. Final capture waited for all ancestors of the relevant action to reach opacity≥0.99; no animation bypass.

This confirms the listed reset preservation fields, not every permanent statistic. Quota, full-inventory, actual background/foreground and current-device visual checks remain separate S5 work.
