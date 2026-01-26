# Product Grid System

## Overview

The grid-based production area system allows players to place and manage production areas on facility grids. This system enables dynamic production management where players can strategically position different production areas within a facility's grid space.

## Architecture

### Core Components

The Product Grid System is implemented across three modules:

#### **systems/productGridSystem.js**
Core grid logic and state management:
- Grid collision detection
- Production area placement validation
- State persistence for grid layouts
- Grid queries and lookups

#### **ui/productGridUI.js**
User interface and interaction:
- Grid rendering and visualization
- Drag-and-drop functionality for placing production areas
- Visual feedback during placement
- UI state management for selected areas

#### **data/facilities/productArea.csv**
Production area definitions:
- Area configurations and properties
- Resource production specifications
- Facility-level unlock requirements
- Grid space requirements

## Data Flow

```
productArea.csv
    ↓
gameData.js (compiled)
    ↓
dataLoader.js (query methods)
    ├→ getProductAreasByFacility(facilityId)
    ├→ getProductArea(areaId)
    └→ getGridDimensions(facilityId, level)
    ↓
Systems Layer (productGridSystem.js)
    └→ State modification & validation
    ↓
UI Layer (productGridUI.js)
    └→ Rendering & user interaction
```

## Grid Configuration

Grid dimensions are defined in `data/facilities/facilityUpgrade.csv`:

| Field | Purpose |
|-------|---------|
| `gridX` | Grid width (cells) |
| `gridY` | Grid height (cells) |

### Default Grid Dimensions
- **Product facilities** (farm, mine, ranch, fishery) have grid dimensions for each level
- **Level 1** facilities typically use 10x10 grids
- **Grid size** scales with facility level (larger facilities = bigger grids)
- **Non-product facilities** (stash, trade, employment) have empty grid values

## Production Areas

Production areas define what can be placed on a facility grid:

### productArea.csv Structure
| Column | Purpose |
|--------|---------|
| `id` | Unique area identifier |
| `facility_id` | References the facility type |
| `minLevel` | Minimum facility level to unlock |
| `gridX`, `gridY` | Grid space occupied (width × height) |
| `productItem` | JSON-encoded production logic |

### Production Item Structure
The `productItem` field is JSON-encoded with:

```json
{
  "itemId": "wheat",
  "itemProductCount": 5,
  "itemProductTime": 10
}
```

- **itemId**: Item produced by this area
- **itemProductCount**: Quantity produced per production cycle
- **itemProductTime**: Duration in seconds per production cycle

## Worker Grid Integration

Each placed production area has its own **independent worker slot grid**. This allows players to assign workers strategically to different areas, with each area tracking assigned workers and calculating aggregate stats for production bonuses.

### Worker Grid Per Area

When a production area is placed on the grid:
1. System creates a worker slot grid for that area
2. Slot grid dimensions defined in `productArea.csv` (gridX × gridY)
3. Players drag workers from unassigned pool to area slots
4. Area tracks assigned workers and calculates aggregate stats

**Example:** Farm area A (2×3 grid = 6 slots)
- Slot [0,0]: Empty
- Slot [0,1]: Worker #001 (strength 45, intelligence 30)
- Slot [1,0]: Worker #003 (strength 52, intelligence 28)
- Slots [1,1] to [1,2]: Empty
- Aggregate stats: Strength 97, Intelligence 58

### Worker Assignment Mechanics

**Drag-Drop Assignment:**
1. Player opens unassigned workers panel
2. Drags worker onto area worker grid
3. System validates slot is empty
4. Worker placed in slot, stats aggregated
5. Production bonus recalculated immediately

**Removing Workers:**
1. Click worker in area slot
2. Worker returns to unassigned pool
3. Aggregate stats recalculated
4. Production bonus adjusted (slower if stats decreased)

### Production Bonus Calculation

Worker stats modify production speed based on required stats:

```javascript
// Simple bonus formula
statRatio = (aggregateStrength + aggregateIntelligence) / requiredStats
productionSpeedBonus = max(statRatio, 1.0)  // Minimum 1x (no penalty)
effectiveProductionTime = baseTime / productionSpeedBonus
```

**Examples:**
- Area requires 100 stats, has 2 workers (110 total): 10% faster
- Area requires 100 stats, has 0 workers: Base speed (no penalty)
- Area requires 100 stats, has 200 stats: 2x faster production

### Worker Grid State

Worker assignments stored per area in gameState:

```javascript
gameState.workerAssignments = {
  "farm_001_area_a": ["worker_001", "worker_003", null, null, null, null],
  "farm_001_area_b": ["worker_005", "worker_007", "worker_009"],
  "mine_001_area_a": []  // No workers assigned
}
```

## Integration with Game Systems

### Orchestration
The `gameLoopManager` (in core/) orchestrates all systems including the product grid:
- Runs the main game tick loop
- Calls productGridSystem updates each tick
- Calls workerGridSystem updates for worker assignments
- Updates production progress for areas on grids
- Calculates stat bonuses from worker assignments

### State Management
- **Grid state changes** happen in `productGridSystem.js`
- **Worker assignment changes** happen in `workerGridSystem.js`
- **UI updates** happen in `productGridUI.js` (read-only)
- **Data queries** happen through `dataLoader.js` (read-only)
- **All state persisted** to `gameState`

### System Interactions

**Production ← Worker Stats:**
```
productionSystem reads area placement
  ↓
gets assigned workers via workerGridSystem.getAggregateStats(areaId)
  ↓
calculates stat ratio bonus
  ↓
applies to production time calculation
```

**UI Coordination:**
```
productGridUI displays grid and areas
  ↓ (on click)
productGridUI opens area detail modal
  ↓
modal shows assigned workers from workerGridSystem
  ↓
drag-drop assigns/removes workers
  ↓
workerGridSystem updates gameState
  ↓
productGridUI re-renders with updated assignments
```

### Grid Lifecycle

1. **Initialization**: When a facility is created, its grid dimensions are loaded from data
2. **Placement**: Players drag-and-drop production areas onto the grid
3. **Validation**: Grid system checks for collisions and space availability
4. **Worker Assignment**: Players assign workers to area slots for bonuses
5. **Production**: Active areas generate items with worker-boosted speed
6. **Persistence**: Grid state and worker assignments saved to `gameState`

## Key Methods

### dataLoader.js
- `getProductAreasByFacility(facilityId)` - Retrieve all production areas for a facility type
- `getProductArea(areaId)` - Get specific production area definition
- `getGridDimensions(facilityId, level)` - Get grid width/height for a facility at a level

### productGridSystem.js
Primary entry point for grid operations and state updates.

### productGridUI.js
Renders grids and handles user interaction (drag-drop, selection, etc.).

## Workflow Example

To add a new production area:

1. **Edit** `data/facilities/productArea.csv` with new area definition
2. **Run** `BuildData.bat` to regenerate `gameData.js`
3. **Reload** the game in browser
4. The new area becomes immediately available for placement

To adjust grid dimensions:

1. **Edit** `data/facilities/facilityUpgrade.csv` and update `gridX`, `gridY` columns
2. **Run** `BuildData.bat`
3. **Reload** the game
4. Existing facility grids update to new dimensions
