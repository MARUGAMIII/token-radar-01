# token-radar-01

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/marugamiii/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/marugamiii/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token Radar (radar-2) ranks every standalone pre-token protocol in the sealed DefiLlama snapshot by an implied token value, and shows how to farm each one. The board covers all 40 watchlist protocols plus every further rankable pre-token protocol below the $50M floor — 178 rows in all.

The value model is one function of the snapshot's own figures, the same for every row: the category multiple is the market's own price per dollar of TVL (the median market-cap-to-TVL ratio of the traded protocols in that category, five comps or more, else the whole market's median), times a growth multiplier from seven-day TVL change, a maturity multiplier from how long the protocol has run with no token, and a breadth multiplier for reach across chains. Wrapped, staked and bridged products, exchanges and versioned pools are excluded. Live-token protocols are set aside with their market caps, never mixed into the ranking. Every row carries a six-step farm plan with costs and times, derived from the protocol's own category, chains, TVL and age.

## Run it

```sh
mkdir -p out
MAKEFUN_OUTPUT_DIR=out node main.ts --input path/to/snapshot.json
```

Node.js 22.18 or later, standard library only. The snapshot is the sealed `input/snapshot.json` from the competition kit. The run writes `out/board.json`, `out/data.js`, `out/dashboard/`, `out/screenshots/` and `out/dossier.json`, and is deterministic: two runs write the same bytes.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
