# Game State & Persistence System

## Overview

The Game State & Persistence System provides centralized management of all game data, coordinate orchestration between game systems, and automatic save/load functionality via browser localStorage. Every significant game change flows through this system, ensuring consistent state across all modules and reliable save persistence.

## Architecture

### Core Components

#### **core/gameState.js**
Centralized game state object:
- Single source of truth for all game data
- Properties for gold, workers, facilities, inventories, etc.
- No methods (data-only object)
- Read/write access from all systems

#### **core/gameLoopManager.js**
Game orchestration and main loop:
- Initializes all systems
- Runs main game loop (each tick)
- Calls all system updates in correct order
- Handles game speed multiplier
- Entry point for UI event handling

#### **core/dataLoader.js**
Read-only game data access:
- Loads game configuration from gameData.js
- Provides query methods for system lookup
- Never modifies state (read-only)
- Caches data for performance

## Data Flow Architecture

```
Browser Storage (localStorage)
    ↓ (load on start)
gameState.js (current session data)
    ├→ All systems read from here
    ├→ All systems write to here
    └→ Single source of truth
    ↓ (every change)
UI layers (read-only access)
    └→ Display gameState data
    ↓ (save on change)
Browser Storage (localStorage)
    └→ Persistence across sessions
```

## Game State Structure

### Root Properties

The gameState object contains top-level properties:

```javascript
{
  // Currency & Resources
  gold: 5000,
  gameSpeed: 1.0,  // 1x, 2x, 4x, etc.

  // Facility Progression
  facilityLevels: {
    lodge: 2,
    farm: 3,
    mine: 1,
    ranch: 1,
    fishery: 1,
    processing: 2,
    trading: 1,
    stash: 2
  },

  // Facility Data
  facilities: {
    farm: {
      level: 3,
      gridX: 6,
      gridY: 20,
      gridZones: [...],  // placed areas
      storageCapacity: 40,
      storage: [...]
    },
    // ... per-facility
  },

  // Worker Data
  workers: [...],           // hired workers
  pendingWorkers: [...],    // in queue
  workerAssignments: {...}, // areaId → [workerIds]
  workerCapacity: 25,

  // Inventory
  stash: [...],
  stashCapacity: 60,
  facilityStorages: {...},

  // Trading & Progression
  tradingOrders: [...],
  regionExperience: {...},
  regionLevels: {...},

  // Production State
  zones: {
    "farm_001_area_a": {
      timer: 7.5,
      itemProductTime: 10
    }
  }
}
```

### Nested Structures

**Facility Object:**
```javascript
{
  facilityId: "farm",
  level: 3,

  // Grid (production facilities only)
  gridX: 6,
  gridY: 20,
  gridZones: [
    {
      zoneId: "farm_001_area_a",
      areaId: "farm_area_001",
      position: { x: 2, y: 5 },
      timer: 7.5
    }
  ],

  // Storage (production facilities only)
  storageCapacity: 40,
  storage: [
    { itemId: "wheat", quantity: 15, maxStack: 50 },
    null,
    { itemId: "corn", quantity: 8, maxStack: 50 }
  ]
}
```

**Worker Object:**
```javascript
{
  id: "worker_001",
  name: "John",
  grade: "uncommon",
  level: 15,
  experience: 2500,
  strength: 45,
  intelligence: 30,
  assignedAreaId: "farm_area_001"  // or null if unassigned
}
```

**Trading Order Object:**
```javascript
{
  orderId: "coastal_001",
  region: "Coastal",
  grade: "uncommon",
  status: "active",
  arrivalTime: 0,  // timestamp
  requiredItems: [
    { itemId: "wheat", quantity: 10 },
    { itemId: "steel", quantity: 5 }
  ],
  goldReward: 500,
  experienceReward: 25
}
```

## Game Loop Orchestration

### Main Loop Flow

The gameLoopManager runs the main game tick:

```javascript
function gameLoop(deltaTime, gameSpeed) {
  // 1. Update Production
  productionSystem.updateProduction(deltaTime, gameSpeed)

  // 2. Update Workers
  workerSystem.updateWorkers(deltaTime, gameSpeed)

  // 3. Update Trading
  tradingPostSystem.updateTradingPost(deltaTime, gameSpeed)

  // 4. Update UI
  uiUpdater.updateAllUI(gameState)

  // 5. Save State
  persistenceManager.saveToLocalStorage(gameState)
}
```

### Update Order Importance

Systems must update in specific order to maintain consistency:

1. **Production First**: Generates items into facility storage
2. **Workers Second**: Gains experience from assigned areas
3. **Trading Third**: Generates orders and processes rewards
4. **UI Last**: Displays all updated state
5. **Save Last**: Persist all changes

**Why This Order:**
- Production must complete before workers gain experience
- Trading orders shouldn't see production items from this tick
- UI updates see all system changes from this tick
- Save captures final state after all updates

## Save & Load System

### Auto-Save

State is automatically saved to localStorage after each game tick:

```javascript
function saveGameState() {
  const serialized = JSON.stringify(gameState)
  localStorage.setItem("estateSimulator_save", serialized)
}

// Called every tick or on change
gameLoopManager.onStateChange(() => saveGameState())
```

**Save Frequency:**
- **Every Tick**: After all systems update (safer, more frequent)
- **On Change**: Only when data actually modifies (faster, less I/O)

### Load on Startup

When player loads the page, game initializes from saved state:

```javascript
function loadGameState() {
  const saved = localStorage.getItem("estateSimulator_save")
  if (saved) {
    gameState = JSON.parse(saved)
  } else {
    gameState = initializeNewGame()
  }
}
```

### New Game Initialization

If no save exists:

```javascript
function initializeNewGame() {
  return {
    gold: 100,
    gameSpeed: 1.0,

    facilityLevels: {
      lodge: 1,
      farm: 1,
      mine: 1,
      ranch: 1,
      fishery: 1,
      processing: 1,
      trading: 1,
      stash: 1
    },

    workers: [],
    pendingWorkers: [],
    workerAssignments: {},
    workerCapacity: 15,

    stash: [],
    stashCapacity: 30,

    tradingOrders: [],
    regionExperience: {
      Coastal: 0,
      Desert: 0,
      Forest: 0
    },
    regionLevels: {
      Coastal: 1,
      Desert: 1,
      Forest: 1
    },

    zones: {},
    facilities: initializeFacilities()
  }
}
```

### Save File Format

Saves are stored as JSON in localStorage key: `estateSimulator_save`

**Save Size Estimate:**
- Small game: ~50 KB
- Mid-game: ~200 KB
- Late-game: ~500 KB+ (localStorage limit ~5-10 MB per domain)

## State Modification Rules

### Read-Only Access

Systems that only READ gameState:
- `dataLoader.js` - Queries game data
- `ui/` module - Displays current state
- `upgradeStatistics.js` - Calculates comparisons

### Write Access (State-Modifying Systems)

Systems that WRITE to gameState:
- `productionSystem.js` - Updates timers, generates items
- `workerSystem.js` - Updates worker data, experience
- `tradingPostSystem.js` - Updates orders, gold, region exp
- `craftingSystem.js` - Removes inputs, adds outputs
- `upgradeSystem.js` - Updates facility levels
- `stashManager.js` - Modifies inventory

**Modification Pattern:**
```javascript
// Example: Production system generates items
function generateItem(facilityId, itemId, quantity) {
  // Directly modify gameState
  gameState.facilities[facilityId].storage.push({
    itemId,
    quantity,
    maxStack: dataLoader.getItemMaxStack(itemId)
  })
  // No explicit save - gameLoopManager saves at end of tick
}
```

### No Circular Dependencies

- Systems don't call other systems' update methods
- All inter-system communication via gameState reads
- gameLoopManager coordinates all updates

## Integration Points

### All Systems

Every system integrates with gameState:

```
productionSystem → reads grid from gameState
              ↓ → writes timers to gameState

workerSystem → reads workers from gameState
           ↓ → writes experience to gameState

tradingPostSystem → reads orders from gameState
                ↓ → writes region exp to gameState

craftingSystem → reads stash from gameState
             ↓ → writes inventory to gameState

upgradeSystem → reads levels from gameState
            ↓ → writes new levels to gameState

stashManager → reads inventory from gameState
           ↓ → writes items to gameState

uiUpdater → reads everything from gameState
        ↓ → displays to user (no writes)
```

### Data Loader

Provides read-only access to compiled game data:

```javascript
// Examples
const wheat = dataLoader.getItem("wheat")      // { id, name, maxStack }
const recipe = dataLoader.getRecipe("wheat_to_bread")
const upgrade = dataLoader.getUpgrade("farm", 3)
const area = dataLoader.getProductArea("farm_area_001")
```

## Key Methods

### gameState.js
- Direct property access (no methods)
- `gameState.gold += 100` - Modify gold
- `gameState.facilityLevels.farm = 3` - Update facility level
- `gameState.workers.push(newWorker)` - Add worker

### gameLoopManager.js
- `startGameLoop()` - Initialize and begin loop
- `setGameSpeed(multiplier)` - Change 1x/2x/4x speed
- `pauseGame()` - Pause all updates
- `resumeGame()` - Resume updates
- `handleUpgradeAction(facilityId)` - Process UI upgrades
- `handleTradeAction(orderId)` - Process UI trades

### persistenceManager (if separate module)
- `saveGameState(gameState)` - Manual save
- `loadGameState()` - Manual load
- `deleteSave()` - Clear save data
- `exportSaveFile()` - For backup
- `importSaveFile(data)` - For restore

## Workflow Example: Gold Flow

1. **Initial State:**
   - `gameState.gold = 100`

2. **Trading Order Completed:**
   - Player completes order
   - `tradingPostSystem` validates stash
   - `stashManager.removeItems(orderInputs)`
   - `gameState.gold += 500` (order reward)
   - State now: `gameState.gold = 600`

3. **Upgrade Lodge:**
   - Player clicks upgrade button
   - `upgradeSystem` validates cost: `gameState.gold >= 500`
   - Deducts: `gameState.gold -= 500`
   - Updates: `gameState.facilityLevels.lodge = 2`
   - State now: `gameState.gold = 100, lodgeLevel = 2`

4. **Auto-Save:**
   - At end of tick
   - `persistenceManager.saveGameState(gameState)`
   - JSON serialized and stored in localStorage

5. **Next Session:**
   - Player closes browser and returns later
   - `persistenceManager.loadGameState()` from localStorage
   - Restores: `gold = 100, lodgeLevel = 2`
   - Game continues from save point

## Optimization Strategies

### Lazy Loading
- Load complete facility only when needed
- Grid data loaded when facility UI opened
- Production timers initialized on demand

### State Normalization
- Avoid duplicate data (single source of truth)
- Calculate derived values on read (not stored)
- Example: worker aggregate stats calculated, not cached

### Incremental Saves
- Save only changed properties (optional optimization)
- Delta compression for large saves
- Reduces localStorage write frequency

## Performance Considerations

- **State Size**: Grows with progression (workers, orders, items)
- **Save Frequency**: Each tick = localStorage write (potential bottleneck)
- **Load Time**: JSON parse on startup (~100ms for large saves)
- **Memory**: Entire state kept in RAM (typical ~1-5 MB)

## Persistence Limits

**Browser localStorage Limitations:**
- **Capacity**: 5-10 MB per domain (varies by browser)
- **Synchronous**: Blocks game loop briefly on write
- **No Encryption**: User data stored in plaintext
- **Per-Domain**: Other sites can't access (secure)

**When Save Fails:**
- localStorage full: Oldest data not recoverable
- Browser privacy mode: Save lost on close
- User clears cache: Save deleted

## Data Structure Reference

### Complete gameState Schema
```javascript
{
  // System-wide
  gold: number,
  gameSpeed: number,  // 1.0, 2.0, 4.0, etc.

  // Facility Progression
  facilityLevels: { lodge, farm, mine, ... },
  facilities: { [facilityId]: {...} },

  // Workers
  workers: Worker[],
  pendingWorkers: PendingWorker[],
  workerAssignments: { [areaId]: workerId[] },
  workerCapacity: number,

  // Inventory
  stash: StashSlot[],
  stashCapacity: number,
  facilityStorages: { [facilityId]: StorageSlot[] },

  // Trading
  tradingOrders: TradingOrder[],
  regionExperience: { Coastal, Desert, Forest },
  regionLevels: { Coastal, Desert, Forest },

  // Production
  zones: { [zoneId]: { timer, itemProductTime } }
}
```

### Save Metadata (Optional)
```javascript
{
  version: "1.0",
  timestamp: 1234567890,
  playTime: 3600000,  // milliseconds
  gameState: {...}
}
```
