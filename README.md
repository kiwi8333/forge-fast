# Forge Fast

An installable phone app (PWA) for intermittent fasting, from the makers of the
[Forge](https://kiwi8333.github.io/bodybuilding-app/) training app.

**Open it:** https://kiwi8333.github.io/forge-fast/
On your phone, open the link, then choose **Add to Home Screen** (iPhone: Share → Add to
Home Screen; Android/Chrome: ⋮ → Install app). It works offline.

## Features

- **Stage ring:** a 24-hour ring split into the body's fasting stages (blood sugar rising,
  falling and normal, fat burning, ketosis, deep fast), each in its own colour, with an
  ember that grows as the fast deepens
- **Plans:** 13:11, 14:10, 16:8, 18:6, 20:4, 23:1 (OMAD), custom (12–72 h) and open
- A burst, buzz and message at each new stage and when the goal is reached
- Tap or hold the ring to see when you reach each stage
- Edit the start time, end or cancel a fast
- **History:** streak, goals reached, longest and average fast, a 7-day chart and every
  fast coloured by the deepest stage it reached; swipe to delete with Undo
- Weight log
- **Backup and restore**, plus **import from a Forge backup** (fasts and weigh-ins are
  merged; nothing is overwritten or duplicated)

Everything stays on the phone; the app talks to no server.

## Development

```bash
npm install
npm run dev      # local dev server
npm test         # unit tests (fasting rules, state, backup and import, storage)
npm run lint
npm run build
npm run icons    # regenerate every icon from scripts/icon-art.mjs
```

Pushing to `main` runs lint, tests and the build, and deploys to GitHub Pages
(`.github/workflows/deploy.yml`).

*General guidance, not medical advice.*
