# Facility System Data (`data/facilities/`)

## Overview

This directory defines the **facility types, production mechanics, grid systems, and upgrade progression**. Facilities are the primary means of production and are where workers generate resources.

## File Dictionary

| File | Purpose |
|------|---------|
| `facility.csv` | Defines the 8 facility types available in the game (Lodge, Farm, Mine, etc.) |
| `facilityUpgrade.csv` | Defines upgrade levels for each facility with requirements |
| `productUpgrade.csv` | Defines production-specific upgrade data: grid dimensions, production areas, and storage slots for production facilities |
| `stashUpgrade.csv` | Defines stash capacity progression across upgrade levels |
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
**Purpose:** Defines upgrade progression for each facility (1-5 levels typically), with requirements for unlocking each level.

**Columns:**
- `facility_id` - Which facility this upgrade applies to
- `level` - Upgrade level
- `requirements` - JSON array of items/quantities needed to unlock this level

**Example Analysis (Farm Facility):**

| Level | Requirements |
|-------|--------------|
| 1 | Lodge Level 1 |
| 2 | 2x Bread |
| 3 | 8x Bread |
| 4 | 8x Bread |
| 5 | 16x Bread |

**Note:** Production-specific upgrade data (grid dimensions and production areas) is now defined in `productUpgrade.csv`. Storage slots for production facilities are also in `productUpgrade.csv`, while stash storage capacity is defined in `stashUpgrade.csv`.

---

### `productUpgrade.csv`
**Purpose:** Defines production-specific upgrade data for production facilities (Farm, Mine, Ranch, Fishery). Contains grid dimensions, available production areas, and facility storage.

**Columns:**
- `facility_id` - Which production facility this upgrade applies to (farm, mine, ranch, fishery)
- `level` - Upgrade level
- `grid` - Grid height in rows (e.g., 5 = 5 rows, 6 columns fixed)
- `productAreas` - JSON object mapping production area IDs to their availability (-1 = unlimited slots)
- `storageSlots` - Number of inventory slots for this facility at this level

**Example Data (Farm):**

| Level | Grid | Production Areas | Storage |
|-------|------|------------------|---------|
| 1 | 5 | 6 types available | 10 slots |
| 2 | 6 | 7 types available | 15 slots |
| 3 | 7 | 8 types available | 20 slots |
| 4 | 8 | 9 types available | 25 slots |
| 5 | 9 | 9 types available | 30 slots |

**Design:** Grid expands vertically (more rows), unlocking new production area types progressively, while facility storage increases for intermediate item buffering.

---

### `stashUpgrade.csv`
**Purpose:** Defines stash (player inventory) capacity at each upgrade level.

**Columns:**
- `level` - Stash upgrade level
- `capacity` - Total inventory slots available at this level

**Example Data:**

| Level | Capacity |
|-------|----------|
| 1 | 20 slots |
| 2 | 25 slots |
| 3 | 35 slots |
| 4 | 50 slots |
| 5 | 65 slots |

**Usage:** Read by `dataLoader.getStashCapacity(level)` when initializing or upgrading stash.

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

### Adding a New Production Facility Type

1. **Add to** `facility.csv`:
   ```csv
   windmill,Windmill,product
   ```

2. **Add upgrade levels to** `facilityUpgrade.csv`:
   ```csv
   windmill,1,"[{""type"":""facility"",""param1"":""lodge"",""param2"":1}]"
   windmill,2,"[{""type"":""item"",""param1"":""gold"",""param2"":100}]"
   ```

3. **Add production-specific upgrade data to** `productUpgrade.csv`:
   ```csv
   windmill,1,5,"{""windmill_basic"":-1}",10
   windmill,2,6,"{""windmill_basic"":-1,""windmill_medium"":-1}",15
   ```

4. **Add production areas to** `productArea.csv`:
   ```csv
   windmill_basic,2,2,"{""itemId"":""flour"",""itemProductCount"":1}",10,2,"[{""statId"":""str"",""rate"":2}]"
   ```

5. **Add base production to** `production.csv`:
   ```csv
   windmill,flour,1,10000
   ```

6. **Run** `BuildData.bat`

### Expanding Production Facility Capabilities

1. **Add new level to** `facilityUpgrade.csv` with requirements
2. **Add production data to** `productUpgrade.csv` with grid size and available production areas
3. **Add new production areas to** `productArea.csv` if needed
4. **Run** `BuildData.bat`

### Adjusting Stash Capacity

1. **Edit** `stashUpgrade.csv` to change capacity at each level
2. **Run** `BuildData.bat`

### Adjusting Production Efficiency

1. **Edit** `production.csv` to change `base_output` or `production_interval_ms`
2. **Or edit** `productArea.csv` to change individual area output
3. **Run** `BuildData.bat`

## Integration Points

- **Facility Management:** `core/facilityStorageManager.js` manages facility storage
- **Stash Management:** `core/stashManager.js` uses `dataLoader.getStashCapacity(level)` for stash upgrades
- **Grid System:** `systems/productGridSystem.js` handles grid placement logic; reads grid dimensions from `dataLoader.getGridDimensions(facilityId, level)`
- **Grid UI:** `ui/productGridUI.js` renders and handles drag-drop
- **Production:** `systems/productionSystem.js` calculates output
- **Data Access:**
  - Upgrade requirements: `dataLoader.getUpgradeCost(facilityId, level)`
  - Production facility storage: Read from `upgradeTree[facilityId][level].storageSlots`
  - Grid dimensions: `dataLoader.getGridDimensions(facilityId, level)`
  - Stash capacity: `dataLoader.getStashCapacity(level)`
  - Production areas: `dataLoader.getAvailableProductAreas(facilityId, level)`
- **Build Pipeline:** Auto-generated into `data/gameData.js` by `BuildData.bat`
  - `facilityUpgrade.csv` and `productUpgrade.csv` are merged into `gameData.upgradeTree`
  - `stashUpgrade.csv` is loaded into `gameData.stashUpgrades`

## Design Patterns

- **Modular Production:** productArea.csv allows multiple production methods per facility
- **Progressive Unlocking:** Upgrades unlock new production areas, creating progression goals
- **Worker Specialization:** requiredStat system allows for worker specialization (strong vs intelligent)
- **Scalable Grid:** Grid size increases with upgrades, allowing larger facilities
- **Stat Balancing:** Production requirements use stat weights to encourage varied worker types

## Grid System Notes

- Grid size defined in `productUpgrade.csv` (`grid` column = height in rows, width fixed at 6 columns)
- Production areas placed on grids via drag-drop UI
- Grid collision detection prevents overlapping placement
- Each production area occupies gridX × gridY space
- Accessed via `dataLoader.getGridDimensions(facilityId, level)` which returns `{x: 6, y: gridHeight}`
- See [FEATURE_PRODUCT_GRID.md](../../docs/FEATURE_PRODUCT_GRID.md) for detailed grid implementation
