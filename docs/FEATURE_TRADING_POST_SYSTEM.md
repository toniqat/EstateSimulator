# Trading Post System

## Overview

The Trading Post System generates dynamic trading orders at regular intervals, manages order fulfillment, tracks player reputation across three trading regions, and provides gold rewards for completed trades. This system creates economic progression and serves as a primary income source throughout the game.

## Architecture

### Core Components

#### **systems/tradingPostSystem.js**
Main order generation and management:
- Order queue with timed arrivals (async like workers)
- Order fulfillment validation and processing
- Pause/resume logic based on queue capacity
- Region and grade-based order generation
- Order state persistence

#### **systems/tradingSystem.js**
Item selling and price calculation:
- Bulk item selling for gold
- Per-item base price lookup
- Grade-based markup calculation (common→epic items sell for more)
- Batch processing of multiple items
- Integration with stash removal

#### **Data Files**
- `data/trading/tradingOrder.csv` - 15+ predefined orders with requirements
- `data/trading/tradingRegion.csv` - 3 trading regions with progression structure
- `data/trading/tradingUpgrade.csv` - Trading post facility upgrades (5 levels)
- `data/trading/trading.csv` - Base item selling prices

## Data Flow

```
tradingOrder.csv + tradingRegion.csv
    ↓
gameData.js (compiled)
    ↓
tradingPostSystem.js (each game tick)
    ├→ Processes order arrival queue
    ├→ Generates new orders (weighted by region/grade)
    ├→ Validates fulfillment against stash
    └→ Tracks region reputation & levels
    ↓
tradingSystem.js (item selling)
    ├→ Calculates gold value per item
    └→ Removes items from stash
    ↓
gameState.js (trading progress)
    └→ Updates gold & region levels
```

## Trading Mechanics

### Trading Orders

Orders are the core trading unit. Each order defines:

| Property | Source | Purpose |
|----------|--------|---------|
| `orderId` | tradingOrder.csv | Unique identifier |
| `region` | tradingOrder.csv | Region (Coastal, Desert, Forest) |
| `grade` | tradingOrder.csv | Common, Uncommon, Rare, Epic |
| `requiredItems` | tradingOrder.csv | Items needed (JSON array) |
| `goldReward` | tradingOrder.csv | Gold on completion |
| `experienceReward` | tradingOrder.csv | Region experience |
| `minRegionLevel` | tradingOrder.csv | Unlock requirement |

**Order Structure Example:**
```javascript
{
  orderId: "coastal_001",
  region: "Coastal",  // Coastal, Desert, or Forest
  grade: "uncommon",  // Rarity determines chance of appearing
  requiredItems: [
    { itemId: "wheat", quantity: 10 },
    { itemId: "steel", quantity: 5 }
  ],
  goldReward: 500,
  experienceReward: 25,
  minRegionLevel: 2  // Requires region to be at least level 2
}
```

### Order Queue System

**Order Arrival Flow:**
1. System checks for new order arrivals on each game tick
2. If queue not full, generate new order (weighted by region and grade)
3. Order added to **pending queue** with arrival timer
4. After interval elapses, order moves to **active queue**
5. Player sees order and can attempt fulfillment
6. On completion, order leaves queue

**Queue Capacity:**
- Varies by trading post facility level (from tradingUpgrade.csv)
- Example: Level 1 = 3 orders, Level 5 = 10 orders
- When queue full, order generation pauses
- When order completes, new order generates

**Async Queue Timing:**
```javascript
// Order timers scale with game speed
orderArrivalTime = baseInterval / gameSpeedMultiplier

// Example:
// baseInterval = 30 seconds
// At gameSpeed 1.0x, order arrives after 30 seconds
// At gameSpeed 2.0x, order arrives after 15 seconds
```

**DISABLED when Trading Post is Level 0**: Order arrival timer is completely paused until the Trading Post reaches Level 1, preventing unwanted order spawns before the facility is built.

### Order Generation & Weighting

**Grade-Based Generation:**
Different grades appear with different probabilities:

| Grade | Appearance Rate | Reward Level |
|-------|---|---|
| Common | 50% | Low (100-300 gold) |
| Uncommon | 30% | Medium (300-700 gold) |
| Rare | 15% | High (700-1200 gold) |
| Epic | 5% | Very High (1200-2000+ gold) |

**Region-Based Generation:**
Each order is associated with a specific region:
- **Coastal Region**: Fish, kelp, shell-based orders
- **Desert Region**: Sand, spice, mineral-based orders
- **Forest Region**: Wood, herb, plant-based orders

Orders unlock progressively as region levels increase (minRegionLevel gates).

### Order Fulfillment

**Validation:**
1. Player initiates fulfillment action on an order
2. System checks if stash contains all required items
3. If valid, items removed from stash
4. If invalid, error message shown

**Rewards on Completion:**
1. Gold: `goldReward` added to gameState.gold
2. Region Experience: `experienceReward` added to region progress
3. Region Level-Up: When experience threshold reached, region levels
4. Cooltime: Optional delay before next order can be completed (per trade)

**Failed Fulfillment:**
- Items not deducted
- Order remains active
- Player can collect required items and retry

## Region System

### Three Trading Regions

Each region has independent progression and orders:

| Region | Theme | Starting Orders | Max Level |
|--------|-------|---|---|
| **Coastal** | Sea/Maritime | Fish, kelp trades | 10+ |
| **Desert** | Sand/Spice | Sand, spice, minerals | 10+ |
| **Forest** | Flora/Wood | Wood, herbs, plants | 10+ |

### Region Progression

**Experience & Levels:**
- Each region tracks experience separately
- Completing orders grants region experience
- Experience thresholds scale with level (exponential)
- Higher region level unlocks more orders and better rewards

**Level-Based Unlocking:**
```
Region Level 1: Orders with minRegionLevel ≤ 1 available
Region Level 2: Orders with minRegionLevel ≤ 2 available
...
Region Level 10: All orders available (minRegionLevel ≤ 10)
```

**Progression Example:**
| Region Level | Cumulative Exp Req | Orders Unlocked |
|---|---|---|
| 1 | 0 | coastal_001, coastal_002 |
| 2 | 100 | coastal_003, coastal_004 |
| 3 | 300 | coastal_005, coastal_006 |
| 5 | 1000 | coastal_010-015 |
| 10 | 5000+ | All coastal orders |

## Facility Integration

### Trading Post Upgrades

Trading post facility progression (5 levels) improves trading:

| Upgrade | Effect |
|---|---|
| **Level 1** | Base trading (queue size 3, order interval 30s) |
| **Level 2** | Larger queue (size 5, interval 25s) |
| **Level 3** | Faster arrivals (size 7, interval 20s) |
| **Level 4** | Premium efficiency (size 9, interval 15s) |
| **Level 5** | Maximum capacity (size 10, interval 10s) |

### Facility Storage

- Trading post has NO facility storage (unlike farms/mines)
- All trades directly interact with stash
- Order fulfillment validates stash contents
- No intermediate buffering of trade items

## Integration with Game Systems

### GameLoopManager
- Calls `updateTradingPost(deltaTime, gameSpeed)` each tick
- Processes order arrivals and timers

### StashManager
- TradingSystem validates stash contains order items
- Removes items on successful fulfillment
- Respects stash stack limits during removal

### UpgradeSystem
- Trading post upgrades unlock via facility level
- Each level improves queue capacity and arrival interval
- Defined in tradingUpgrade.csv

### GameState
Stores trading progression:
```javascript
{
  tradingOrders: [
    { orderId, region, status: "pending|active", arrivalTime, requirements },
    { orderId, region, status: "active", completionTime }
  ],
  regionExperience: {
    Coastal: 150,
    Desert: 85,
    Forest: 220
  },
  regionLevels: {
    Coastal: 3,
    Desert: 2,
    Forest: 4
  },
  tradingPostLevel: 2
}
```

## Key Methods

### tradingPostSystem.js
- `updateOrderArrivals(scaledDeltaTime)` - Process order arrivals from queue; **returns immediately if `arrivalInterval <= 0`** (disabled when Trading Post is Level 0)
- `updateTradingPostCapacity()` - Refresh queue capacity and arrival interval from facility level; **explicitly sets `arrivalInterval = 0` when Trading Post is Level 0**
- `getActiveOrders()` - Currently available orders
- `fulfillOrder(orderId)` - Complete an order and claim rewards
- `getRegionExperience(region)` - Current region progression
- `getRegionLevel(region)` - Current region level
- `getQueueCapacity()` - Max orders per facility level

### tradingSystem.js
- `sellItem(itemId, quantity)` - Convert items to gold
- `calculateItemPrice(itemId)` - Get gold value per item
- `applyGradeMarkup(basePrice, grade)` - Adjust price by rarity

### dataLoader.js
- `getOrdersByRegion(region)` - All orders for region
- `getOrdersByGrade(grade)` - Filter orders by rarity
- `getTradingRegionUpgrades(level)` - Facility progression data

## Workflow Example: Trading Progression

1. **Start Game:**
   - Player has access to Coastal region (level 1)
   - 2 common orders available
   - Trading post at level 1 (queue size 3)

2. **First Orders Arrive:**
   - Order 1: "Trade 10 wheat for 200 gold"
   - Order 2: "Trade 5 steel for 150 gold"
   - Both in active queue

3. **Fulfill First Order:**
   - Player has 15 wheat (from production)
   - Player clicks "Fulfill Order 1"
   - System validates: ✓ Has 10 wheat
   - System deducts 10 wheat from stash
   - System adds 200 gold to gameState
   - System adds 25 experience to Coastal region
   - Order leaves queue (new order can arrive)

4. **Region Level-Up:**
   - After completing 4 orders, Coastal reaches level 2
   - New orders unlock: "Trade 15 wheat + 3 steel for 400 gold"
   - Previously inaccessible orders now available

5. **Upgrade Trading Post:**
   - Player upgrades trading post to level 2
   - Queue capacity increases to 5 orders
   - Order arrival interval decreases (faster new orders)
   - Can now handle more simultaneous orders

6. **Advanced Trading:**
   - Multiple regions leveling in parallel
   - Can juggle 5+ orders at once
   - Mix of common, uncommon, rare orders
   - High-level orders yield 1000+ gold each

## Advanced Features

### Multi-Region Trading
- Can progress all 3 regions simultaneously
- Different regions offer different item requirements
- Strategic focus on regions with best rewards

### Grade-Based Economy
- Epic orders worth 3-4x common orders
- Rare orders appear less frequently
- Requires higher facility level to increase epic order chance

### Cooltime Management
- Optional: Per-region or per-order cooltime
- Forces player to manage multiple regions
- Prevents instant order spamming

### Reward Scaling
- Gold rewards scale with region level
- Experience rewards increase with order grade
- Late-game orders provide 5000+ gold each

## Performance Considerations

- **Order Queue**: Fixed-size array (max 10 orders)
- **Region Tracking**: 3 simple number variables (exp, level per region)
- **Order Validation**: O(n) array lookup (n = required items per order)
- **Filtering**: Orders cached by region and grade in dataLoader

## Data Structure Reference

### Active Order
```javascript
{
  orderId: "desert_005",
  region: "Desert",
  grade: "rare",
  status: "active",
  requiredItems: [
    { itemId: "sand", quantity: 20 },
    { itemId: "spice", quantity: 8 }
  ],
  goldReward: 800,
  experienceReward: 50,
  minRegionLevel: 3
}
```

### Region Progress
```javascript
{
  region: "Coastal",
  level: 3,
  experience: 250,  // Toward next level
  totalExperience: 400,  // Cumulative
  unlockedOrders: ["coastal_001", "coastal_002", "coastal_003", "coastal_004"]
}
```

### Trading Order Queue
```javascript
{
  capacity: 5,
  orders: [
    {
      orderId: "coastal_001",
      status: "active",
      arrivalTime: 0
    },
    {
      orderId: "coastal_003",
      status: "pending",
      arrivalTime: 25  // Will arrive after 25 more seconds
    }
  ]
}
```

## User Interface

### Sidebar Status Display

The Trading Post button in the left sidebar shows **real-time order queue status** at the far right:

- **Display Format:**
  - Button label: `Trading Post` (left side)
  - Status badge: `X/Y` (far right side) where:
    - `X` = current number of active orders
    - `Y` = maximum queue capacity (based on facility level)
  - Example: `Trading Post` with `0/3` on right at level 1, updates to `1/3` when first order arrives

- **Visual Indicators (on status badge):**
  - **Normal (75% or less):** Default styling
  - **Warning (75-99%):** Yellow/orange badge when 3/4 or more slots filled
  - **Critical (100%):** Red badge when queue is completely full (new orders pause generation)

- **Update Frequency:** Updates every frame (100ms) as the game loop processes new orders
- **Layout:** Status badge positioned at the far right end of the button, separate from label

### Main Trading Post View

The main Trading Post panel displays:
- **Order Count:** Shows current active orders and max capacity
- **Order Cards:** One card per active order with:
  - Region name and credit bar
  - Required items (icon-based display)
  - Reward items (icon-based display)
  - Fulfill/Reject buttons (state-based on resource availability)
- **Upgrade Button:** Shows facility level and next upgrade requirements
- **Arrival Timer:** Countdown to next order arrival (when queue not full)

### Trade Confirmation Modal

When the player clicks the "Trade" button on an order card, a **Trade Confirmation Modal** appears (instead of immediately executing the trade):

**Modal Content:**
- **Order Display:** Shows the complete order information using the same layout as the Active Orders grid:
  - Region name and grade badge
  - Required items (icon-based display with quantities and availability)
  - Reward items (icon-based display with quantities)
- **Projected Progress Bar:** Two-color visualization showing region credit progression:
  - **Base Fill (Green):** Current region credit
  - **Projected Fill (Orange):** Credit gain from this trade
  - **Progress Bar Scale:** Always uses the current level's experience threshold
  - If the trade causes a level-up, the progress bar fills completely (100%) and the text shows the level increase
- **Text Label:** Displays credit information and level-up prediction:
  - Format: `Level X (+Y if leveling up) ... Current (+Gain) / Max`
  - Example: `0 (+200) / 1000` (no level-up)
  - Example: `Level 1 (+1) ... 900 (+200) / 1000` (will level up)
- **Action Buttons:**
  - **Confirm** - Executes the trade
  - **Cancel** - Closes the modal without trading

**Projected State Visualization:**
- The progress bar dynamically calculates what the region state will be AFTER the trade
- Simulates all potential level-ups and displays the final projected level
- Allows the player to understand region progression impact before committing to the trade

### Responsive Behavior

- When queue is **full (100% capacity):** Button badge shows critical styling (red)
- When order **arrives:** Badge updates immediately (e.g., `0/3` → `1/3`)
- When order **fulfilled:** Badge updates (e.g., `3/3` → `2/3`)
- On **facility upgrade:** Capacity changes trigger immediate UI refresh (e.g., `3/3` → `3/5`)
- When **Trade button clicked:** Confirmation modal opens instead of executing immediately
- When **modal cancelled:** Player can re-evaluate and click Trade again
