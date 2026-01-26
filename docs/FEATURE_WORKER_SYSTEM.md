# Worker System

## Overview

The Worker System manages the complete lifecycle of workers: hiring, grade assignment, leveling, stat progression, and assignment to production areas. Workers are essential to production efficiency, as their assigned stats directly modify production speed and output of production areas.

## Architecture

### Core Components

#### **systems/workerSystem.js**
Main worker management system:
- Worker hiring and capacity management
- Queue system for worker arrivals (new workers don't appear instantly)
- Grade assignment with weighted random distribution
- Stat calculation and worker inventory management
- Integration point with gameLoopManager

#### **systems/workerGridSystem.js**
Worker slot grid system (independent per production area):
- Creates and manages worker slot grids within each production area
- Drag-and-drop assignment of workers to slots
- Worker stat tracking per area
- Slot occupancy and overflow management
- Calculates aggregate worker stats for production bonuses

#### **Data Files**
- `data/workers/workerGrade.csv` - 5 rarity tiers (Common→Legendary) with level caps
- `data/workers/workerLevel.csv` - Experience progression (levels 1-100 with exponential thresholds)
- `data/workers/workerUpgrade.csv` - Hiring system facility progression (5 upgrade levels)
- `data/workers/workerName.csv` - Random name pool for worker generation

## Data Flow

```
workerGrade.csv, workerLevel.csv, workerName.csv
    ↓
gameData.js (compiled)
    ↓
dataLoader.js (query methods)
    ├→ getWorkerGrades()
    ├→ getWorkerLevelThreshold(level)
    └→ getRandomWorkerName()
    ↓
workerSystem.js (hiring & progression)
    ├→ Manages worker queue and arrivals
    ├→ Calculates experience and level-ups
    └→ Maintains global worker inventory
    ↓
workerGridSystem.js (per-area assignment)
    ├→ Creates slot grids for production areas
    ├→ Handles worker drag-drop placement
    └→ Aggregates worker stats
    ↓
productionSystem.js (production bonuses)
    └→ Uses aggregated stats for speed/output calculations
```

## Worker Progression System

### Grades (Rarity Tiers)

Workers are generated with one of 5 grades, each with different:
- **Base stat values** (strength, intelligence)
- **Experience multiplier** (affects leveling speed)
- **Level cap** (maximum achievable level)
- **Visual presentation** (color, border style)

| Grade | Color | Level Cap | Base Stats | Notes |
|-------|-------|-----------|-----------|-------|
| Common | Gray | 20 | Low | Starting workers, high spawn rate |
| Uncommon | Blue | 40 | Medium | Standard progression workers |
| Rare | Purple | 60 | Higher | Better stat growth |
| Epic | Orange | 80 | High | Significant bonuses |
| Legendary | Gold | 100 | Very High | Rare spawns, best stats |

### Worker Hiring

**Hiring Process:**
1. Player initiates hire action (requires gold cost based on lodge level)
2. Worker is added to **pending queue** with arrival timer
3. Queue processes based on:
   - **Spawn interval** - Time between worker arrivals (from workerUpgrade.csv)
   - **Queue capacity** - Max pending workers (increases with lodge level)
4. On arrival, worker is added to global inventory
5. Player can assign to production areas immediately

**Cost Formula:**
- Base gold cost: Defined in `workerUpgrade.csv` per lodge level
- Increases per hiring action (optional implementation detail)

**Async Queue System:**
- Workers don't arrive instantly (creates gameplay pacing)
- Queue pauses if at capacity
- Game speed scaling affects arrival interval
- **DISABLED when lodge is Level 0**: Worker arrival timer is completely paused until the Worker's Lodge reaches Level 1, preventing unwanted spawns before the facility is built

### Experience & Leveling

**Experience System:**
- Workers gain experience per game tick while assigned to production areas
- Experience amount depends on:
  - Production area efficiency (stat match to requirements)
  - Game speed multiplier
  - Worker grade (affects XP gain rate)

**Level Thresholds:**
- Exponential scaling (higher levels require exponentially more XP)
- Defined per level in `workerLevel.csv`
- Level cap enforced by grade (Common→20, Uncommon→40, etc.)
- Level-up event triggers stat increases

**Stat Growth:**
- Strength and Intelligence increase per level
- Growth rates vary by grade
- Stats directly affect production efficiency

## Worker Grid System (Per-Area Assignment)

### Grid Mechanics

Each production area has its own **worker slot grid**:
- **Grid dimensions**: Defined per production area in `productArea.csv` (gridX × gridY)
- **Slot states**: Empty, Occupied (with specific worker)
- **Drag-drop UI**: Allows placement/removal of workers from slots

### Worker Assignment

**Valid Placement:**
- A worker can be assigned to any available slot in any area's grid
- Multiple workers in same area stack their stats
- A worker can only be in one location at a time (removed from previous area if reassigned)

**Stat Aggregation:**
- When workers are assigned to an area, their stats sum to create aggregate worker stats
- Production system reads aggregate stats to calculate production bonus
- Formula: `productionSpeedBonus = (aggregateStrength × strengthWeight + aggregateIntelligence × intelligenceWeight) / requiredStats`

**Occupancy Management:**
- Grid has limited slots (width × height)
- Attempting to assign beyond capacity is rejected
- Removing workers frees slots for reassignment
- Overflow logic (if any) is handled by UI or business logic

## Integration with Game Systems

### GameLoopManager
- Calls `updateWorkers()` each tick
- Processes arrivals from queue
- Applies experience gains
- Triggers level-up events

### ProductionSystem
- Reads aggregate worker stats from areas
- Calculates speed bonuses based on stat matching
- Uses bonuses in production time calculations

### UpgradeSystem
- Worker lodge upgrades increase:
  - Worker hiring cost reductions
  - Max worker capacity
  - Queue capacity
  - Spawn interval
- Updates from `workerUpgrade.csv`

### GameState
Stores all worker data:
- `workers: [{ id, name, grade, level, experience, strength, intelligence }]`
- `pendingWorkers: [{ arrivalTime, grade }]`
- `workerAssignments: { areaId: [workerId1, workerId2, ...] }`
- `workerCapacity: number`
- `lodgeLevel: number`

## Key Methods

### workerSystem.js
- `hireWorker()` - Add worker to pending queue
- `updateWorkerArrivals(deltaTime)` - Process worker arrivals from queue; **returns immediately if `arrivalInterval <= 0`** (disabled when lodge is Level 0)
- `updateWorkerCapacity()` - Refresh capacity limits and arrival interval from lodge level; **explicitly sets `arrivalInterval = 0` when lodge is Level 0**
- `getWorkerById(workerId)` - Retrieve worker data
- `getWorkerStats(workerId)` - Get current strength/intelligence
- `getAvailableWorkers()` - Workers not assigned to any area

### workerGridSystem.js
- `getAreaWorkerGrid(areaId)` - Get worker slot state for area
- `assignWorkerToArea(workerId, areaId, slotIndex)` - Place worker in slot
- `removeWorkerFromArea(workerId)` - Unassign worker
- `getAggregateStats(areaId)` - Sum of all assigned worker stats
- `validatePlacement(workerId, areaId, slotIndex)` - Check if placement is valid

## Workflow Example: Worker Progression

1. **Hire a Worker:**
   - Player clicks hire button on worker lodge
   - System deducts gold cost and adds to pending queue
   - Worker arrives after interval

2. **Assign to Production Area:**
   - Drag worker from unassigned inventory to area worker grid
   - WorkerGridSystem validates placement
   - Worker starts gaining experience in area

3. **Level-Up:**
   - Worker accumulates experience each tick
   - On reaching level threshold, level increases
   - Stats (strength/intelligence) increase
   - Bonus applied to next production calculation

4. **Reassign for Optimization:**
   - Move worker to different area based on stat requirements
   - Different areas may have different stat weights (strength vs. intelligence)
   - Production bonuses are recalculated based on new aggregates

## Optimization Notes

- **Worker Grade Distribution**: Higher grade workers spawn less frequently (weighted random)
- **Experience Multiplier**: Different grades progress at different speeds
- **Stat Matching**: Production areas may favor certain stats (farmer prefers strength, scholar prefers intelligence)
- **Capacity Constraints**: Worker lodge level gates maximum workers
- **Queue Pacing**: Async queue prevents instantaneous worker generation, creates progression gates

## Data Structure Reference

### Worker Object
```javascript
{
  id: "worker_001",
  name: "John",
  grade: "uncommon",  // common, uncommon, rare, epic, legendary
  level: 15,
  experience: 2500,
  strength: 45,
  intelligence: 30
}
```

### Production Area Worker Grid
```javascript
{
  areaId: "farm_area_001",
  slots: [
    { workerId: "worker_001", strength: 45, intelligence: 30 },
    { workerId: "worker_003", strength: 52, intelligence: 28 },
    null,  // empty slot
    null
  ]
}
```
