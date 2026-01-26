# Worker System Data (`data/workers/`)

## Overview

This directory contains all configuration for the worker system, including **rarity grades, leveling progression, worker names, and hiring mechanics**. Workers are the core resource that players manage to generate production and income.

## File Dictionary

| File | Purpose |
|------|---------|
| `workerGrade.csv` | Defines worker rarity grades (Common, Uncommon, Rare, Epic, Legendary) with level caps and gold rewards |
| `workerLevel.csv` | Defines experience requirements for each worker level (1-100) |
| `workerName.csv` | Pool of randomly selectable worker names |
| `workerUpgrade.csv` | Hiring upgrade progression affecting worker hiring mechanics (max pending, arrival interval, grade weights) |

## Detailed File Descriptions

### `workerGrade.csv`
**Purpose:** Defines the 5 rarity grades for workers and their progression characteristics.

**Columns:**
- `id` - Grade identifier (common, uncommon, rare, epic, legendary)
- `name` - Display name
- `maxLevel` - Maximum level a worker of this grade can reach
- `baseGold` - Base gold reward per level progression for this grade
- `levelGold` - Additional gold reward per level for this grade

**Data:**
```
Grade        Max Level  Base Gold  Level Gold  (Purpose)
Common       10         20         10          (Basic workers, quick leveling)
Uncommon     20         50         20          (Mid-tier workers)
Rare         30         100        30          (Advanced workers)
Epic         50         200        50          (Powerful workers)
Legendary    100        500        100         (Ultimate workers with high level cap)
```

**Usage:** Worker grade determines max progression, income rewards, and rarity in hiring pools.

---

### `workerLevel.csv`
**Purpose:** Defines cumulative experience requirements for each level (1-100).

**Columns:**
- `level` - Worker level (1-100)
- `expRequired` - Total experience points needed to reach this level

**Pattern:** Experience requirement increases by 400 exp per level (starting from 600 at level 2):
- Level 1: 0 exp (starting level)
- Level 2: 600 exp
- Level 3: 1,200 exp
- ...
- Level 100: 39,600 exp

**Usage:** `workerSystem.js` compares worker experience to these thresholds for leveling up.

---

### `workerName.csv`
**Purpose:** Pool of random names assigned to newly hired workers.

**Columns:**
- `name` - Worker name

**Data:** Contains diverse names like "John Smith", "Emma Johnson", "Michael Williams", "Sarah Brown", etc.

**Usage:** When hiring a new worker, randomly select from this pool to create unique identities for each worker.

---

### `workerUpgrade.csv`
**Purpose:** Defines hiring system progression through 5 upgrade levels. Affects how many workers can be pending hiring, arrival interval, and the quality of hired workers.

**Columns:**
- `level` - Upgrade level (1-5)
- `maxPending` - Maximum workers that can be in the hiring queue
- `arrivalInterval` - Time in milliseconds between worker arrivals in queue
- `gradeWeight` - JSON array defining probability distribution of grades for newly hired workers

**Data Analysis:**

| Level | Max Pending | Arrival (ms) | Grade Distribution |
|-------|-------------|-------------|-------------------|
| 1 | 3 | 30,000 | 75% Common, 25% Uncommon |
| 2 | 5 | 25,000 | 62.5% Common, 25% Uncommon, 12.5% Rare |
| 3 | 7 | 20,000 | Balanced Common/Uncommon/Rare, 8% Epic |
| 4 | 10 | 15,000 | More Uncommon/Rare/Epic, reduced Common |
| 5 | 15 | 10,000 | Weighted toward Rare/Epic/Legendary |

**Usage:** As players upgrade the hiring system, they can queue more workers simultaneously, receive them faster, and get higher-grade workers.

## How to Modify

### Adding a New Worker Grade

1. **Add row to** `workerGrade.csv`:
   ```csv
   mythic,Mythic,150,750,150
   ```

2. **Update** `workerUpgrade.csv` to include the new grade in hiring pools:
   ```csv
   5,15,10000,"[{""grade"":""rare"",""weight"":6},{""grade"":""epic"",""weight"":4},{""grade"":""mythic"",""weight"":1}]"
   ```

3. **Run** `BuildData.bat` to rebuild

### Adjusting Level Progression

1. **Edit** `workerLevel.csv` to change experience requirements
2. **Run** `BuildData.bat`

### Adding Worker Names

1. **Add rows to** `workerName.csv`:
   ```csv
   name
   Alice Cooper
   Bob Dylan
   ```

2. **Run** `BuildData.bat`

## Integration Points

- **Worker System:** `systems/workerSystem.js` uses grades and levels for progression
- **Data Access:** Values accessed via `gameData.workerGrade`, `gameData.workerLevel`, `gameData.workerName`, `gameData.workerUpgrade`
- **Build Pipeline:** Auto-generated into `data/gameData.js` by `BuildData.bat`

## Design Patterns

- **Grade System:** Uses rarity tiers (Common → Legendary) to provide long-term progression goals
- **Exponential Growth:** Experience requirements increase progressively to support level 1-100 scale
- **Hiring Progression:** Upgrade system creates gameplay loop (upgrade → hire better workers → earn more → upgrade again)
- **Quality Distribution:** JSON-based weighted random selection ensures realistic grade distribution at each upgrade level
