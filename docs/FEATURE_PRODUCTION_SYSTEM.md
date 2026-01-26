# Production System

## Overview

The Production System is the core gameplay loop engine. It handles resource generation from production areas, manages production timers and zones, applies worker-based stat bonuses, manages facility storage, and handles item overflow. This system bridges the Product Grid System (where areas are placed) and the Stash Manager (where items are collected).

## Architecture

### Core Components

#### **systems/productionSystem.js**
Main production engine:
- Manages production timers per zone (area)
- Calculates worker stat bonuses for active areas
- Handles item generation and storage
- Manages item overflow from facility storage to stash
- Delta time accumulation and game speed scaling
- Persistence of production state

#### **systems/upgradeSystem.js**
Facility progression and production upgrades:
- Validates upgrade costs and prerequisites
- Updates facility levels and grid dimensions
- Unlocks new production areas per level
- Increases storage capacity per facility
- Defines upgrade tree structure

#### **core/facilityStorageManager.js**
Per-facility item storage:
- Separate storage grid per facility (farm, mine, ranch, etc.)
- Storage capacity per facility level
- Item stacking with per-item max limits
- Overflow detection when full
- Item retrieval for player collection

#### **Data Files**
- `data/facilities/productArea.csv` - Production area definitions with output rates
- `data/facilities/production.csv` - Base production rates (deprecated/reference)
- `data/facilities/facilityUpgrade.csv` - Upgrade progression with storage capacity

## Data Flow

```
productArea.csv + workerStats
    ↓
productionSystem.js (each game tick)
    ├→ Reads grid placements from productGridSystem
    ├→ Reads worker stats from workerGridSystem
    ├→ Updates production timers
    ├→ Generates items when timer completes
    └→ Sends items to facilityStorageManager
    ↓
facilityStorageManager.js (per-facility storage)
    ├→ Adds items to facility storage
    ├→ Detects overflow
    └→ Tracks available items for collection
    ↓
stashManager.js (player inventory)
    └→ Player collects items via UI
```

## Production Mechanics

### Production Areas

Each production area on a grid has a production definition:

| Property | Source | Purpose |
|----------|--------|---------|
| `areaId` | productArea.csv | Unique identifier |
| `facilityId` | productArea.csv | Farm, mine, ranch, fishery |
| `gridX`, `gridY` | productArea.csv | Grid space occupied |
| `itemId` | productItem (JSON) | Item produced |
| `itemProductCount` | productItem (JSON) | Quantity per cycle |
| `itemProductTime` | productItem (JSON) | Duration of cycle (seconds) |

### Timer System

**Production Timing:**
Each area tracks an internal timer (in seconds):
1. Timer starts at 0 when area is placed or newly loaded
2. Timer increments by `deltaTime` every game tick
3. When timer ≥ `itemProductTime`, production completes
4. Items are generated and added to facility storage
5. Timer resets to 0

**Delta Time & Game Speed:**
```javascript
effectiveTime = deltaTime * gameSpeedMultiplier
timer += effectiveTime
```

**Example:**
- Area produces wheat with `itemProductTime = 10` seconds
- At gameSpeed 1.0x, takes 10 real seconds
- At gameSpeed 2.0x, takes 5 real seconds (production is twice as fast)

### Worker Stat Bonuses

**Stat Matching System:**
Worker-assigned stats modify production efficiency based on matching ratio:

```javascript
// For areas with stat requirements
statRatio = (assignedStrength + assignedIntelligence) / requiredStats
speedBonus = max(statRatio, 1.0)  // No penalty, only speed gains

effectiveProductionTime = baseProductionTime / speedBonus
```

**Examples:**
- Area requires 100 total stats
- 2 workers assigned with 60 strength + 50 intelligence = 110 total
- Stat ratio = 110 / 100 = 1.1 (10% faster)
- Effective time = 10 seconds / 1.1 = 9.09 seconds

**Zero Worker Penalty:**
- If no workers assigned, area still produces (at base rate)
- No speed penalty for empty areas
- Worker assignment is always beneficial

### Item Generation

**On Production Completion:**
1. System generates `itemProductCount` items
2. Items are added to **facility storage** (not directly to stash)
3. Item ID validated against item.csv (includes stack limits)
4. Stack limits enforced during storage

**Overflow Handling:**
- If facility storage is full, item generation is blocked
- UI alerts player to collect items
- Production pauses until storage capacity freed
- Player must manually move items to stash via collect action

## Storage System

### Facility Storage

Each facility (farm, mine, ranch, fishery) has separate **per-facility storage**:
- **Grid-based**: Similar to stash, slots hold stacked items
- **Capacity per level**: Increases with facility upgrade level
- **Per-item limits**: Respects item.csv stack limits

**Capacity Scaling Example:**
| Facility Level | Storage Capacity |
|---|---|
| 1 | 20 slots |
| 2 | 30 slots |
| 3 | 40 slots |
| 4 | 50 slots |
| 5 | 60 slots |

### Overflow & Collection

**Manual Collection:**
- Player clicks "Collect" button on facility UI
- Items move from facility storage → stash
- Respects stash stack limits
- Partial collection if stash nearly full

**Automatic Transfers (if implemented):**
- Some implementations auto-move items when space allows
- Can be time-gated or cost-gated
- Reduces manual clicking

### Production Progress Bar UI States

**Normal State (Production Active):**
- Progress bar displays green gradient (#4CAF50 → #8BC34A)
- Shows time remaining in format `HH:MM:SS`
- Shows production progress as percentage (0-100%)
- Updates in real-time as production timer advances
- Zone produces normally even if storage is nearly full

**Halted State (Production Stopped):**
- Progress bar changes to red gradient (#e74c3c → #c0392b)
- Text display changes to "Storage Full" (split across left/right positions: "Storage" and "Full")
- Progress bar fill width stays at current production progress (does not reset)
- CSS class `.progress-bar-full` applied to `.zone-progress-fill` element
- Only shows when production has **actually halted** (not just when storage capacity is reached)

**Trigger Mechanism:**
- When `productionSystem.updateZoneProduction()` attempts to add items to storage
  - If **ALL items can still fit** → Clears `haltedZones[zoneKey]` flag, continues normal production
  - If **NO items can fit** → Sets `haltedZones[zoneKey] = true`, halts production (returns early)
- `uiUpdater.updateZoneProgress()` checks `gameState.haltedZones[zoneKey]` to apply visual state
- State automatically reverts to normal once items are collected and storage has space

**Key Difference from Simple Capacity Check:**
- **Before:** Showed warning if `usedSlots >= maxSlots` (immediate feedback)
- **After:** Shows warning only if production loop actually halted (true production stop)
- Allows production to continue through a cycle even when storage is full, as long as items can still be added

**Implementation Details:**
- `productionSystem.updateZoneProduction()` manages `haltedZones` state
  - Sets flag: `this.gameState.haltedZones[zoneKey] = true` when `canProduce` is false
  - Clears flag: `delete this.gameState.haltedZones[zoneKey]` when zone can produce
- `uiUpdater.updateZoneProgress()` reads the halted state
  - Checks: `const isZoneHalted = this.gameState.haltedZones && this.gameState.haltedZones[zoneKey]`
  - Applies red gradient and "Storage Full" text only when halted
- `gameState` persists `haltedZones` through save/load cycles

## Integration with Game Systems

### GameLoopManager
- Calls `updateProduction(deltaTime, gameSpeed)` each tick
- Provides unified entry point for production updates

### ProductGridSystem
- ProductionSystem reads grid placements: `productGridSystem.getGridZones(facilityId)`
- Iterates over placed areas to calculate active production

### WorkerGridSystem
- ProductionSystem reads assigned workers: `workerGridSystem.getAggregateStats(areaId)`
- Uses stats for bonus calculation

### UpgradeSystem
- Production areas unlock per facility level
- Storage capacity increases per level
- Grid dimensions expand (more production areas placeable)

### StashManager
- ProductionSystem doesn't directly add to stash
- Player initiates collection via UI
- Collection respects stash stack limits

### GameState
Stores production state:
- `zones: { areaInstanceId: { timer, itemsInStorage } }`
- `facilityStorageState: { facilityId: { slots, usedCapacity } }`
- `productionInProgress: boolean` (production paused/running)

## Key Methods

### productionSystem.js
- `updateProduction(deltaTime, gameSpeed)` - Main production tick
- `getActiveAreas(facilityId)` - Get currently placed areas
- `getProductionProgress(areaId)` - Get timer progress (0-1)
- `pauseProduction()` / `resumeProduction()` - Control flow
- `getStorageStatus(facilityId)` - Check facility storage capacity

### facilityStorageManager.js
- `addItemToStorage(facilityId, itemId, quantity)` - Add produced items
- `removeItemFromStorage(facilityId, itemId, quantity)` - Remove on collection
- `getStorageCapacity(facilityId)` - Total and used slots
- `getItemsInStorage(facilityId)` - List of items currently stored
- `isStorageFull(facilityId)` - Check if overflow will occur

### upgradeSystem.js
- `getFacilityUpgrade(facilityId, level)` - Get upgrade requirements
- `applyUpgrade(facilityId, newLevel)` - Apply level change and unlock areas

## Workflow Example: Production Cycle

1. **Place Production Area:**
   - Area placed on farm grid at level 2
   - Unlocked because farm is level 3
   - Produces wheat at 10 seconds per cycle
   - Requires 80 total worker stats

2. **Start Production:**
   - Area timer starts at 0
   - No workers assigned (base rate)
   - Timer increments: 0 → 1 → 2 → ... → 10 seconds

3. **First Production Completes:**
   - Timer ≥ 10 seconds triggered
   - System generates 5 wheat items
   - Items added to farm facility storage
   - Timer resets to 0 and continues

4. **Assign Workers:**
   - Player assigns 2 workers (100 total stats)
   - Stat ratio = 100 / 80 = 1.25
   - New effective time = 10 / 1.25 = 8 seconds
   - Next production cycle completes faster

5. **Collect Items:**
   - Farm storage shows 25 wheat accumulated
   - Player clicks Collect
   - Items move to stash
   - Farm storage now empty (space for more items)

## Advanced Features

### Batch Production
- Multiple areas of same type produce simultaneously
- Each has independent timer
- Items accumulate in shared facility storage

### Zone Management
- Each area placement has unique `zoneId`
- Timers maintained per zone
- State persistence allows resuming from saves

### Game Speed Scaling
- All production timers scale with gameSpeed multiplier
- UI displays adjusted times (e.g., "5 sec at 2x speed")
- Does not affect player action cooldowns

### Storage Optimization
- Player can upgrade facility to increase storage (via upgradeSystem)
- Early-game: frequent manual collection
- Late-game: large storage reduces collection frequency

## Performance Considerations

- **Timer accumulation**: Uses deltaTime for smooth progression (not per-frame increments)
- **Grid iteration**: Only iterates active areas (not empty grid cells)
- **Stat calculation**: Cached until worker assignment changes
- **Storage lookups**: Hash-based facility lookup (O(1))

## Data Structure Reference

### Active Production Zone
```javascript
{
  zoneId: "farm_001_area_a",
  areaId: "farm_area_001",
  facilityId: "farm",
  timer: 7.5,  // seconds elapsed
  itemProductTime: 10,  // seconds to complete
  itemProductCount: 5,
  itemId: "wheat"
}
```

### Facility Storage State
```javascript
{
  facilityId: "farm",
  level: 3,
  maxCapacity: 40,
  items: [
    { itemId: "wheat", quantity: 15, maxStack: 50 },
    { itemId: "corn", quantity: 8, maxStack: 50 },
    null,  // empty slot
    ...
  ]
}
```

### Worker Bonus Calculation
```javascript
{
  areaId: "farm_area_001",
  assignedWorkers: ["worker_001", "worker_003"],
  aggregateStats: {
    strength: 95,
    intelligence: 45,
    total: 140
  },
  requiredStats: 100,
  statRatio: 1.4,
  productionSpeedBonus: 1.4  // 40% faster production
}
```
