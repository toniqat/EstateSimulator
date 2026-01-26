# Facility System Data (`data/facilities/`)

## Overview

This directory defines the **facility types, production mechanics, grid systems, and upgrade progression**. Facilities are the primary means of production and are where workers generate resources.

## File Dictionary

| File | Purpose |
|------|---------|
| `facility.csv` | Defines the 8 facility types available in the game (Lodge, Farm, Mine, etc.) |
| `facilityUpgrade.csv` | Defines upgrade levels for each facility, requirements, and grid dimensions |
| `productArea.csv` | Defines individual production areas (grid placeable units) within facilities with dimensions and output |
| `production.csv` | Defines base production output and intervals for each facility type |

## Detailed File Descriptions

### `facility.csv`
**Purpose:** Defines the core facility types that can be built and upgraded.

**Columns:**
- `id` - Facility identifier
- `name` - Display name
- `type` - Facility category (emply=employment, product=production, process=crafting, trade=trading, stash=storage)

**Data:**
```
ID          Name                  Type        Purpose
lodge       Worker's Lodge        emply       Hire and manage workers
farm        Farm                  product     Produce wheat
mine        Mine                 product     Produce ore
ranch       Ranch                product     Produce meat
fishery     Fishery              product     Produce fish
processing  Processing Plant     process     Craft raw materials into finished goods
trading     Trading Post         trade       Exchange items for gold
stash       Stash                stash       Store inventory
```

**Usage:** Foundation for all facility mechanics; referenced by upgrades and production systems.

---

### `facilityUpgrade.csv`
**Purpose:** Defines upgrade progression for each facility (1-5 levels typically), with requirements, grid expansion, and available production areas.

**Columns:**
- `facility_id` - Which facility this upgrade applies to
- `level` - Upgrade level
- `requirements` - JSON array of items/quantities needed to unlock this level
- `Grid` - Grid size (e.g., 5 = 5x5 grid for placing production areas)
- `productAreas` - JSON object mapping production area IDs to their availability (-1 = unlimited slots)
- `storageSlots` - Number of inventory slots at this upgrade level

**Example Analysis (Farm Facility):**

| Level | Requirements | Grid | Production Areas | Storage |
|-------|--------------|------|------------------|---------|
| 1 | 2 Bread | 5 | 6 types | 10 slots |
| 2 | 2 Bread | 6 | 7 types | 15 slots |
| 3 | 8 Bread | 7 | 8 types | 20 slots |
| 4 | 8 Bread | 8 | 9 types | 25 slots |

**Upgrade Pattern:** Each level increases grid size, unlocks more production area types, and expands storage.

---

### `productArea.csv`
**Purpose:** Defines individual production units (placeable on facility grids) with their dimensions, output, worker requirements, and stat demands.

**Columns:**
- `id` - Production area identifier
- `gridX` - Width on grid (1-4 units typically)
- `gridY` - Height on grid (1-4 units typically)
- `productItem` - JSON object with itemId and itemProductCount
- `cooltime` - Production interval in seconds (10 = 10 sec per production)
- `workers` - Number of workers required to operate this area
- `requiredStat` - JSON array of worker stat requirements (strength, intelligence, etc.)

**Example Data:**

```
Area ID          Grid  Output    Workers  Cooltime  Stat Requirement
farm_basic       2x2   1 wheat   1        10s       Str:3, Int:1
farm_medium1     3x2   1 wheat   3        10s       Str:3, Int:1
farm_advanced1   4x4   1 wheat   3        10s       Str:3, Int:1
farm_advanced3   4x2   2 wheat   2        10s       Str:3, Int:1 (highest output)
mine_basic       2x2   1 ore     2        10s       Str:4
mine_advanced    4x4   3 ore     4        8s        Str:4
```

**Design:** Larger grid areas require more workers but produce more output. Cooltime affects production speed.

---

### `production.csv`
**Purpose:** Defines base production output for each facility type (simplified production without grid placement).

**Columns:**
- `facility_id` - Which facility type
- `output_item_id` - What item is produced
- `base_output` - Quantity produced per interval
- `production_interval_ms` - Time between production events in milliseconds

**Data:**
```
Facility  Output Item  Base Output  Interval
farm      wheat        1            10,000 ms (10 seconds)
mine      ore          1            10,000 ms
ranch     meat         1            10,000 ms
fishery   fish         1            10,000 ms
```

**Usage:** Used by `productionSystem.js` for basic production calculation when grid system isn't active.

## How to Modify

### Adding a New Facility Type

1. **Add to** `facility.csv`:
   ```csv
   windmill,Windmill,product
   ```

2. **Add upgrade levels to** `facilityUpgrade.csv`:
   ```csv
   windmill,1,"[{""itemId"":""gold"",""count"":1000}]",5,"{""windmill_basic"":-1}",10
   ```

3. **Add production areas to** `productArea.csv`:
   ```csv
   windmill_basic,2,2,"{""itemId"":""flour"",""itemProductCount"":1}",10,2,"[{""statId"":""str"",""rate"":2}]"
   ```

4. **Add base production to** `production.csv`:
   ```csv
   windmill,flour,1,10000
   ```

5. **Run** `BuildData.bat`

### Expanding a Facility

1. **Edit** `facilityUpgrade.csv` to add new levels
2. **Edit** `productArea.csv` to add new production area types
3. **Run** `BuildData.bat`

### Adjusting Production Efficiency

1. **Edit** `production.csv` to change `base_output` or `production_interval_ms`
2. **Or edit** `productArea.csv` to change individual area output
3. **Run** `BuildData.bat`

## Integration Points

- **Facility Management:** `core/facilityStorageManager.js` manages facility storage
- **Grid System:** `systems/productGridSystem.js` handles grid placement logic
- **Grid UI:** `ui/productGridUI.js` renders and handles drag-drop
- **Production:** `systems/productionSystem.js` calculates output
- **Data Access:** Values accessed via `gameData.facility`, `gameData.facilityUpgrade`, `gameData.productArea`, `gameData.production`
- **Build Pipeline:** Auto-generated into `data/gameData.js` by `BuildData.bat`

## Design Patterns

- **Modular Production:** productArea.csv allows multiple production methods per facility
- **Progressive Unlocking:** Upgrades unlock new production areas, creating progression goals
- **Worker Specialization:** requiredStat system allows for worker specialization (strong vs intelligent)
- **Scalable Grid:** Grid size increases with upgrades, allowing larger facilities
- **Stat Balancing:** Production requirements use stat weights to encourage varied worker types

## Grid System Notes

- Grid size defined in `facilityUpgrade.csv` (Grid column)
- Production areas placed on grids via drag-drop UI
- Grid collision detection prevents overlapping placement
- Each production area occupies gridX × gridY space
- See [GRID_SYSTEM.md](../GRID_SYSTEM.md) for detailed grid implementation
