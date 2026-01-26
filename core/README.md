# Core Module

Handles core game state management and the main game loop orchestration.

## Files

### gameLoopManager.js
The central orchestrator of all game systems. Initializes all subsystems, manages the main game loop, and provides the public API interface called from HTML button handlers. This is the entry point where all systems work together.

### gameState.js
Manages the core game state including:
- Gold and worker counts
- Game speed settings
- Stash level and capacity
- Facility instances
- Game save/load functionality using localStorage
- Timing calculations for the game loop

### stashManager.js
Handles inventory storage and item management:
- Adding items with smart stacking logic
- Removing items from stash
- Querying item quantities
- Swapping/reorganizing stash slots (for drag-and-drop)
- Sorting stash by item ID
- Stash level upgrades

### facilityStorageManager.js
Manages grid-based storage for facility-produced items:
- Slot-based inventory system (each slot holds one item stack)
- Stack limits based on item max stack values
- Storage capacity per facility level
- Collection to stash with partial overflow handling
- Grid display support with empty slot visualization
