# Systems Module

Contains specialized game systems that handle specific gameplay mechanics.

## Files

### productionSystem.js
Manages resource production from facilities:
- Updates production timers based on facility configuration
- Generates resources based on assigned workers and facility level
- Scales production by game speed

### workerSystem.js
Handles worker management:
- Hiring new workers with gold cost
- Assigning/reassigning workers to facilities
- Validates worker availability before assignment

### craftingSystem.js
Implements recipe-based crafting:
- Checks resource availability before crafting
- Consumes input items from stash
- Produces crafted items into stash
- Manages multiple input and output items per recipe

### tradingSystem.js
Manages the trading system:
- Selling items for gold
- Validates item availability
- Handles transaction calculations

### upgradeSystem.js
Manages facility upgrades:
- Determines upgrade costs based on facility and level
- Validates gold and material availability
- Consumes upgrade costs
- Increases facility level

### productGridSystem.js
Manages grid-based production area placement for product-type facilities:
- Initializes grid states with configurable dimensions
- Handles placement and removal of production areas
- Detects collisions between placed areas
- Validates area positions within grid bounds
- Supports moving areas to new positions

### workerGridSystem.js
Manages independent worker slot grids within production areas:
- Each area has its own worker grid layout (workerGridX × workerGridY)
- Independent from the facility's main grid system
- Tracks worker slot occupancy and assignments
- Generates grid layouts based on area configuration
- Supports querying slot information and worker assignments
- Automatically cleans up when areas are removed
