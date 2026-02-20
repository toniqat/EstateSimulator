# Upgrade System

## Overview

The Upgrade System manages facility progression across 8 facility types (Lodge, Farm, Mine, Ranch, Fishery, Processing, Trading, Stash). Each facility can upgrade through 5 levels, with each upgrade requiring cost validation, unlocking new features, and scaling facility capabilities. This system is central to long-term gameplay progression.

## Architecture

### Core Components

#### **systems/upgradeSystem.js**
Upgrade validation and application:
- Upgrade cost validation (gold + items)
- Facility level updates
- Grid dimension changes (for product facilities)
- Unlock event triggers
- State persistence of facility levels

#### **systems/upgradeStatistics.js**
Before/After modal comparison:
- Calculates facility stats before upgrade
- Calculates facility stats after upgrade
- Generates comparison display for player confirmation
- Helps players understand upgrade value

#### **Data Files**
- `data/facilities/facilityUpgrade.csv` - Upgrade costs and progression (5 levels per facility)
- `data/facilities/facility.csv` - Facility type definitions and roles
- `data/items/item.csv` - Item requirements validation

## Data Flow

```
facilityUpgrade.csv + gameState (current levels)
    ↓
upgradeSystem.js (validate & apply)
    ├→ Reads current facility level
    ├→ Calculates next level requirements
    ├→ Validates cost against stash & gold
    └→ Applies upgrade changes
    ↓
gameState.js (facility levels)
    ├→ Updates facility level
    ├→ Triggers cascading updates
    └→ Persists changes
    ↓
productGridSystem.js (grid resize)
    └→ Re-initializes grid with new dimensions
```

## Facility Types & Upgrades

### 8 Facility Types

| Facility | Role | Upgrade Path | Max Level |
|----------|------|---|---|
| **Lodge** | Worker hiring and capacity | Increases worker slots | 5 |
| **Farm** | Wheat production | Expands grid (10x10 → larger) | 5 |
| **Mine** | Ore production | Expands grid | 5 |
| **Ranch** | Wool/meat production | Expands grid | 5 |
| **Fishery** | Fish/kelp production | Expands grid | 5 |
| **Processing** | Recipe unlocking and crafting | Unlocks new recipes | 5 |
| **Trading Post** | Order queue and gold generation | Improves order frequency | 5 |
| **Stash** | Inventory capacity | Increases stash slots | 5 |

### Upgrade Progression Per Facility

Each facility follows a 5-level progression with specific benefits:

**Example: Farm Facility Upgrades**

| Level | Cost | Grid Size | Max Areas | New Features |
|---|---|---|---|---|
| 1 | Free | 6×10 | 60 | Base farm (10 production areas) |
| 2 | 500g + 20 ore | 6×15 | 90 | +30 area slots, +10 production areas |
| 3 | 1500g + 50 ore | 6×20 | 120 | +30 area slots, +10 production areas |
| 4 | 3500g + 100 steel | 6×25 | 150 | +30 area slots, +10 production areas |
| 5 | 7000g + 200 steel | 6×30 | 180 | +30 area slots, +10 production areas |

### Grid Dimensions

Production facilities (Farm, Mine, Ranch, Fishery) have grid dimensions from `facilityUpgrade.csv`:

```javascript
{
  facilityId: "farm",
  level: 2,
  gridX: 6,      // Width in columns (fixed)
  gridY: 15,     // Height in rows (increases per level)
  maxAreas: 90   // 6 × 15 = 90 cells (minus reserved)
}
```

**Grid Scaling Pattern:**
- Width (gridX): Fixed at 6 columns
- Height (gridY): Increases per level (10 → 15 → 20 → 25 → 30)
- Total capacity increases by ~50% per level
- Scales total placeable areas as player progresses

### Upgrade Costs & Requirements

Upgrade requirements use a polymorphic structure that supports both item costs and facility-level prerequisites. Requirements are defined in `facilityUpgrade.csv` and follow a flexible JSON schema.

**Requirement Types:**

1. **Item Requirements** (consumed on upgrade):
   - `type: "item"` - Item resource requirement
   - `param1`: itemId (e.g., "gold", "ore", "steel")
   - `param2`: quantity required (e.g., 500)
   - **Action**: Validate player has quantity, consume items on successful upgrade

2. **Facility Requirements** (not consumed, only checked):
   - `type: "facility"` - Facility level prerequisite
   - `param1`: facilityId (e.g., "stash", "farm")
   - `param2`: minimum required level (e.g., 2)
   - **Action**: Validate target facility has reached this level (prerequisite gate)

3. **Worker Requirements** (not consumed, only checked):
   - `type: "worker"` - Worker inventory requirement (by grade or total)
   - `param1`: gradeId or wildcard
     - **Specific Grade** (e.g., "common", "uncommon", "rare", "epic", "legendary") - counts only workers of that grade
     - **Wildcard** (`"all"` or `""` empty string) - counts total workers regardless of grade
   - `param2`: minimum count required (e.g., 6 or 10)
   - **Action**: Validate player owns this count of workers (prerequisite gate)
   - **Dynamic Validation**: Checked in real-time; if workers are dismissed/expelled, requirement immediately becomes unsatisfied
   - **Validation during BuildData**: Specific grades are validated against valid grade IDs; wildcards are always valid

#### Worker Requirement: Grade-Specific vs. Wildcard

The system supports two modes for worker requirements:

**Grade-Specific (Exact Match):**
```json
{"type":"worker","param1":"rare","param2":3}
```
- Counts ONLY workers with the "rare" grade
- Ignores workers of other grades (common, uncommon, epic, legendary)
- Example: If player has [5 common, 2 rare, 1 epic], this requirement checks only the 2 rare workers
- **Data Validation:** The grade ID "rare" must be valid in `workerGrade.csv` or BuildData will error

**Wildcard (Total Count):**
```json
{"type":"worker","param1":"all","param2":10}
```
or
```json
{"type":"worker","param1":"","param2":10}
```
- Counts ALL workers regardless of grade
- Empty string (`""`) and `"all"` are equivalent
- Example: If player has [5 common, 2 rare, 1 epic], this requirement checks all 8 workers
- **Data Validation:** Wildcard values always pass validation (no grade ID lookup)

**Example Requirements JSON:**
```javascript
// Item only
[
  { type: "item", param1: "gold", param2: 500 },
  { type: "item", param1: "ore", param2: 20 }
]

// Mixed with facility and specific-grade worker requirements
[
  { type: "facility", param1: "stash", param2: 2 },   // Stash must be level 2+ (prerequisite)
  { type: "worker", param1: "common", param2: 6 },    // AND must own 6 common workers (prerequisite)
  { type: "item", param1: "gold", param2: 1000 },     // AND costs 1000 gold (consumed)
  { type: "item", param1: "steel", param2: 50 }       // AND costs 50 steel (consumed)
]

// Worker requirement with specific grade
[
  { type: "worker", param1: "uncommon", param2: 4 }   // Requires 4 uncommon workers
]

// Worker requirement with wildcard (total count, any grade)
[
  { type: "worker", param1: "all", param2: 10 }       // Requires 10 workers (any grade)
]

// Another wildcard variant (empty string also works)
[
  { type: "worker", param1: "", param2: 8 }           // Requires 8 workers (any grade)
]
```

**Cost Scaling Pattern:**
- Item costs scale exponentially per level
- Gold costs represent primary resource sink
- Multiple item types create progression gates

**Example Progression:**
- Level 1→2: 500 gold + 20 ore (early game, ore abundant)
- Level 2→3: 1500 gold + 50 ore
- Level 3→4: 3500 gold + 100 steel (later game, ore insufficient)
- Level 4→5: 7000 gold + 200 steel (late game, high cost)

## Upgrade Mechanics

### Upgrade Validation

Before applying upgrade, system validates all requirements:

**Validation Steps:**
1. **Facility Exists**: Target facility must be initialized
2. **Not Max Level**: Facility level < 5
3. **All Requirements Satisfied**:
   - **Item Requirements**: Stash contains required quantities
   - **Facility Requirements**: Target facility has reached required level

**Validation Logic (CRITICAL ORDER):**
```javascript
if (!facilityExists) return "Facility not found"
if (currentLevel >= 5) return "Already at max level"

// STEP 1: Check FACILITY-LEVEL prerequisites FIRST (non-negotiable gates)
for (req of facilityRequirements) {
  if (gameState.facilities[req.param1].level < req.param2)
    return req.param1 + " must be level " + req.param2
}

// STEP 2: Check WORKER requirements (owned workers must meet count requirement)
for (req of workerRequirements) {
  // Wildcard support: "" or "all" = count all workers regardless of grade
  let workerCount
  if (req.param1 === "" || req.param1 === "all") {
    workerCount = gameState.workers.length  // Total workers
  } else {
    workerCount = gameState.workers.filter(w => w.grade === req.param1).length  // Specific grade
  }
  if (workerCount < req.param2)
    return "Need " + req.param2 + " workers"  // Omit grade for clarity
}

// STEP 3: Then check ITEM requirements (only if facility & worker prerequisites are met)
for (req of itemRequirements) {
  if (stash[req.param1] < req.param2)
    return "Missing " + req.param1
}

// All requirements satisfied - upgrade can proceed
```

**Requirement Resolution:**
- **Facility** requirements are checked FIRST (hard prerequisites that cannot be bypassed)
- **Worker** requirements are checked SECOND (inventory-based gates, checked dynamically in real-time)
- **Item** requirements are checked THIRD (resources to consume on upgrade)
- All types must be satisfied for upgrade button to turn green
- **Item** requirements will be consumed on successful upgrade
- **Facility** and **Worker** requirements are NOT consumed (only validated as prerequisites)

### Upgrade Application

On successful validation:

1. **Consume Item Requirements Only**:
   - Items with `type: "item"` are removed from stash (param1=itemId, param2=quantity)
   - Facility requirements with `type: "facility"` are NOT consumed (only validated as prerequisites)
   - Worker requirements with `type: "worker"` are NOT consumed (only validated as prerequisites)
   - Gold is treated as an item requirement

2. **Update Facility Level**:
   - gameState.facilities[facilityId].level = nextLevel

3. **Trigger Cascading Updates**:
   - Production facilities: Re-initialize grid with new dimensions
   - Worker lodge: Update worker capacity limits
   - Trading post: Update order queue size and arrival speed
   - Stash: Increase inventory slots
   - Processing: Unlock new recipes
   - Storage facilities: Increase per-facility storage

4. **Persist State**:
   - Updated facility levels saved to localStorage via gameState

### Level-Up Effects

Each facility type responds to level-ups differently:

**Farm/Mine/Ranch/Fishery:**
- Grid dimensions expand (gridX fixed, gridY increases)
- New production areas become placeable
- Storage capacity increases (if has storage)

**Lodge:**
- Max worker capacity increases: (level × 10) + 5
  - Level 1: 15 workers
  - Level 2: 25 workers
  - Level 3: 35 workers
  - Level 4: 45 workers
  - Level 5: 55 workers
- Worker spawn interval decreases (faster arrivals)

**Processing:**
- New recipes unlock per level
- Example: Level 1 (2 recipes) → Level 5 (10+ recipes)

**Trading Post:**
- Order queue capacity increases
- Order arrival interval decreases (faster new orders)
- Higher-quality orders appear (epic orders at high levels)

**Stash:**
- Inventory slots increase per level
- Example: Level 1 (30 slots) → Level 5 (100+ slots)

## Integration with Game Systems

### GameLoopManager
- Calls `requestUpgrade(facilityId, targetLevel)` on player action
- Checks if upgrade is valid before application

### ProductGridSystem
- On facility upgrade, calls `reinitializeGrid(facilityId, newLevel)`
- Updates grid dimensions from upgraded facility
- Preserves existing placements when possible

### StashManager
- Validates stash has required items
- Removes items on successful upgrade
- Updates stash capacity on stash facility upgrade

### UpgradeStatistics
- Generates before/after comparison data
- Displays in modal for player confirmation

### GameState
Stores facility progression:
```javascript
{
  facilityLevels: {
    lodge: 2,
    farm: 3,
    mine: 1,
    ranch: 1,
    fishery: 1,
    processing: 2,
    trading: 1,
    stash: 3
  },
  facilities: {
    farm: {
      level: 3,
      gridX: 6,
      gridY: 20,
      storageCapacity: 40
    },
    // ... per-facility data
  }
}
```

## Key Methods

### upgradeSystem.js

**Polymorphic Requirement Handling:**
- `_normalizeRequirements(requirements)` - Handle legacy {value: [...]} wrapping
- `_checkRequirement(requirement)` - Validate single requirement (item, facility, or worker type)
- `_countWorkersByGrade(gradeId)` - Count owned workers of a specific grade
- `_getWorkerGradeName(gradeId)` - Get display name for worker grade

**Main Methods:**
- `canUpgrade(facilityId)` - Check if all requirements satisfied, return details on failure
- `getUpgradeCostDetails(facilityId)` - Get costs (items) and conditions (facilities, workers) for modal display
- `upgradeFacility(facilityId)` - Execute upgrade: consume item requirements only, check facility & worker requirements
- `getUpgradeCost(facilityId, level)` - Get raw upgrade data from dataLoader

### upgradeStatistics.js
- `getBeforeStats(facilityId, level)` - Current stats at level
- `getAfterStats(facilityId, level)` - Stats after upgrade
- `getComparison(facilityId)` - Side-by-side comparison

### dataLoader.js
- `getUpgrade(facilityId, level)` - Upgrade details
- `getUpgrades(facilityId)` - All 5 upgrade levels for facility
- `getFacility(facilityId)` - Base facility info

## Workflow Example: Lodge Upgrade Path

1. **Start Game:**
   - Lodge at level 1
   - Can hire 15 workers total
   - Worker spawn interval: 30 seconds

2. **Early Progression:**
   - Players farm wheat and mine ore
   - Accumulate 500 gold + 20 ore
   - Decide to upgrade lodge to level 2

3. **Initiate Upgrade:**
   - Player clicks "Upgrade to Level 2" on lodge UI
   - System validates: ✓ Has 500 gold, ✓ Has 20 ore
   - Modal shows: "15 workers → 25 workers, gain 10 capacity"

4. **Apply Upgrade:**
   - 500 gold deducted
   - 20 ore deducted
   - Lodge level updated to 2
   - Can now hire up to 25 workers

5. **Enjoy New Capacity:**
   - Hire 10 more workers (up to 25 total)
   - Worker spawn interval still 30 seconds (no change at this level)
   - Higher total worker capacity enables better production

6. **Late Game Upgrades:**
   - Lodge level 5: 55 worker capacity, faster spawn interval
   - Can manage large workforce with strategic assignment
   - Major bottleneck removal for endgame production

## Advanced Features

### Cascading Unlocks
- Upgrading farm unlocks new production areas (tied to facilityLevel)
- Processing facility level gates recipe availability
- All unlocks are level-based (no separate unlock items)

### Partial Progress Display
- Modal shows exact cost, current items, items needed
- Clear indication of what's missing for next upgrade
- Helps player plan resource gathering

### Reversible State
- Upgrades are permanent (no downgrade option)
- Player strategy revolves around upgrade order
- Different paths create different playstyles

## Performance Considerations

- **Upgrade Lookup**: O(1) from facilityUpgrade data
- **Cost Validation**: O(itemCount) where itemCount typically 1-2
- **Grid Reinit**: O(w×h) for grid dimensions, but happens rarely (5 times per facility)
- **Level Tracking**: Simple integer per facility (8 integers total)

## Data Structure Reference

### facilityUpgrade.csv Schema

The CSV file uses polymorphic JSON requirements that are parsed at build time and stored in `gameData.js`:

**CSV Columns:**
| Column | Type | Description |
|--------|------|-------------|
| facility_id | string | Facility identifier (lowercase) |
| level | integer | Upgrade level (1-5) |
| requirements | JSON | Polymorphic requirement array |
| Grid | integer | Grid height (width fixed at 6) |
| productAreas | JSON | Available production area types |
| storageSlots | integer | Inventory capacity at this level |

**CSV Example Row:**
```csv
farm,3,"[{""type"":""item"",""param1"":""ore"",""param2"":50}]",7,"{""farm_basic"":-1,""farm_medium"":-1}",20
```

**Parsed Result:**
```javascript
{
  facility_id: "farm",
  level: 3,
  requirements: [
    { type: "item", param1: "ore", param2: 50 }
  ],
  Grid: 7,
  productAreas: { farm_basic: -1, farm_medium: -1 },
  storageSlots: 20
}
```

### Facility Upgrade Definition (In-Memory)
```javascript
{
  facilityId: "farm",
  level: 3,
  requirements: [
    { type: "item", param1: "gold", param2: 1500 },
    { type: "item", param1: "ore", param2: 50 }
  ],
  Grid: 7,
  gridX: 6,
  gridY: 20,
  productAreas: {
    farm_basic: -1,
    farm_medium: -1
  },
  storageSlots: 20
}
```

### Upgrade Statistics
```javascript
{
  facilityId: "farm",
  currentLevel: 2,
  nextLevel: 3,
  before: {
    gridY: 15,
    totalSlots: 90,
    storageCapacity: 30
  },
  after: {
    gridY: 20,
    totalSlots: 120,
    storageCapacity: 40
  },
  cost: {
    gold: 1500,
    items: [
      { itemId: "ore", quantity: 50 }
    ]
  },
  canAfford: true
}
```

### Facility State
```javascript
{
  lodge: { level: 2, maxWorkers: 25, capacity: 25, hired: 18 },
  farm: { level: 3, gridX: 6, gridY: 20, gridZones: 90 },
  processing: { level: 2, unlockedRecipes: 3 },
  trading: { level: 1, orderCapacity: 3 },
  stash: { level: 3, capacity: 60, used: 42 }
}
```
