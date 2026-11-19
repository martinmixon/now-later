# Now & Later

A phone to-do app (installable PWA) with Personal and Work tabs. Pinned tasks sit in **Now**; everything else waits in **Later**. Checking a task moves it to the Completed area (✓ button, top right), where tasks can be restored or deleted.

Each task can hold notes plus linked emails and web links. An email can be linked by pasting its web link (Gmail/Outlook on the web) or by saving a Gmail search (e.g. `from:dana subject:invoice`). On Android, once installed, the app appears in the Share menu: sharing a link or selected text from another app creates a new task with it attached.

Tasks are stored on the device only (localStorage). Use the ⋮ menu to export or import a JSON backup.

Live: https://martinmixon.github.io/now-later/

## Files
- `docs/` — the whole app, served by GitHub Pages (`main` branch, `/docs`).
- When changing app files, bump `VERSION` in `docs/service-worker.js` so installed copies update.
