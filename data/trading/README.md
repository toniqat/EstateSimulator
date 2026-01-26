# Trading System Data (`data/trading/`)

## Overview

This directory defines the **trading post mechanics, regional markets, trading orders, and pricing**. The trading system is how players convert produced items into gold revenue.

## File Dictionary

| File | Purpose |
|------|---------|
| `trading.csv` | Defines base selling prices for items at the trading post |
| `tradingOrder.csv` | Defines trading orders (quests) that players can complete for gold rewards |
| `tradingRegion.csv` | Defines trading region metadata (ID and name only) |
| `tradingRegionUpgrade.csv` | Defines trading region level progression, experience requirements, and available orders per level |
| `tradingUpgrade.csv` | Defines trading post facility upgrade levels affecting order management |

## Detailed File Descriptions

### `trading.csv`
**Purpose:** Base selling prices for items when trading at the trading post.

**Columns:**
- `item_id` - Item being sold
- `sell_price` - Gold earned per unit sold

**Data:**
```
Item          Sell Price  (Relative Value)
bread         10          (baseline)
steel         20          (2x value - more rare)
cookedmeat    15          (1.5x value)
cannedfish    12          (1.2x value)
```

**Design:** Prices increase with rarity/difficulty to craft, incentivizing production of higher-grade items.

---

### `tradingOrder.csv`
**Purpose:** Defines trading orders (quests) that players can accept and complete for gold rewards and region experience.

**Columns:**
- `id` - Order identifier
- `grade` - Order difficulty (Common, Uncommon, Rare, Epic)
- `credit` - Region experience points awarded for completion
- `required` - JSON array of items needed to complete order
- `reward` - JSON array of rewards (typically gold)

**Order Examples:**

| Order ID | Grade | Credit | Requirements | Reward | Difficulty |
|----------|-------|--------|--------------|--------|------------|
| order-10001 | Common | 100 | 5 bread | 500 gold | Easy (5 items) |
| order-10002 | Uncommon | 250 | 3 steel, 2 bread | 1,200 gold | Medium (complex) |
| order-10005 | Rare | 600 | 15 bread, 3 steel | 3,000 gold | Hard (many items) |
| order-10007 | Epic | 1,500 | 20 bread, 8 steel, 5 cooked meat | 8,000 gold | Very Hard |

**Order Progression:**
- **Common Orders:** 5-10 items, 500-600 gold reward
- **Uncommon Orders:** 5-15 items, 1,200-1,400 gold reward
- **Rare Orders:** 15-20 items, 2,500-3,500 gold reward
- **Epic Orders:** 20-30 items, 5,000-9,000 gold reward

---

### `tradingRegion.csv`
**Purpose:** Defines the basic trading region metadata (ID and display name).

**Columns:**
- `id` - Region identifier (e.g., `region_capital`, `region_coast`, `region_forest`)
- `name` - Display name (e.g., "Capital City", "Coastal Harbor", "Forest Haven")

**Regions (3 Total):**

1. **Capital City** (`region_capital`) - General trade orders
2. **Coastal Harbor** (`region_coast`) - Fish and maritime-based orders
3. **Forest Haven** (`region_forest`) - Wood, herb, and nature-based orders

**Note:** Level progression and available orders for each region are defined in `tradingRegionUpgrade.csv`, not here.

---

### `tradingRegionUpgrade.csv`
**Purpose:** Defines trading region level progression, experience requirements per level, and the available orders at each level.

**Columns:**
- `id` - Region identifier (matches `tradingRegion.csv`)
- `level` - Region level (1-5 for each region)
- `exp` - Experience points required to reach the *next* level (e.g., level 1's exp = points to reach level 2)
- `orderList` - JSON array of orders available at this level (no explicit level key in the objects)

**Example Data Structure:**
```csv
id,level,exp,orderList
region_capital,1,1000,"[{""orderId"":""order-10001"",""appearRate"":3},{""orderId"":""order-10002"",""appearRate"":1}]"
region_capital,2,2000,"[{""orderId"":""order-10003"",""appearRate"":2},{""orderId"":""order-10004"",""appearRate"":1}]"
```

**Region Progression:**

1. **Capital City** (`region_capital`)
   - Level 1: order-10001 (common bread), order-10002 (uncommon steel+bread)
   - Level 2: order-10003 (uncommon bread), order-10004 (rare meat+steel)
   - Level 3: order-10005 (rare bread+steel)
   - Level 4: order-10006 (epic meat+steel)
   - Level 5: order-10007 (epic complex order)

2. **Coastal Harbor** (`region_coast`)
   - Focuses on fish-based orders (canned fish trading)
   - Level progression mirrors Capital City structure
   - Orders: 10011-10017

3. **Forest Haven** (`region_forest`)
   - Focuses on meat-based orders (cooked meat trading)
   - Level progression mirrors Capital City structure
   - Orders: 10021-10027

**Order Appearance Rates:**
- Each level has 1-2 orders available
- `appearRate` defines probability (higher = more frequent in queue generation)
- Multiple orders can be available simultaneously at the same level

---

### `tradingUpgrade.csv`
**Purpose:** Defines trading post facility upgrade levels, affecting order queue management.

**Columns:**
- `facility_id` - Always "trading"
- `level` - Upgrade level (1-5)
- `cooltime` - Time in seconds between order completion and reward
- `maxQueueSlots` - Maximum orders in queue simultaneously
- `requirements` - Items needed to unlock this level

**Upgrade Progression:**

| Level | Cooltime | Max Queue | Requirements | Purpose |
|-------|----------|-----------|--------------|---------|
| 1 | 360s (6 min) | 3 orders | None | Starting point |
| 2 | 300s (5 min) | 4 orders | 500 gold | Faster completion, more slots |
| 3 | 240s (4 min) | 5 orders | 1,000 gold | Better efficiency |
| 4 | 180s (3 min) | 6 orders | 2,000 gold | Advanced player |
| 5 | 120s (2 min) | 8 orders | 5,000 gold | End-game |

**Upgrade Impact:**
- **Cooltime:** Shorter = orders complete faster, faster gold generation
- **Max Queue:** More slots = handle more orders in parallel
- **Requirements:** Gold gates progression (costs reflect facility importance)

## How to Modify

### Adding a New Trading Order

1. **Add to** `tradingOrder.csv`:
   ```csv
   order-20001,Uncommon,300,"[{""itemId"":""cloth"",""count"":5}]","[{""itemId"":""gold"",""count"":1000}]"
   ```

2. **Add to available orders in** `tradingRegionUpgrade.csv`:
   - Find the region row (by region ID and level)
   - Edit the `orderList` JSON array to include the new order ID
   - Set `appearRate` to control frequency (higher = more frequent)

3. **Run** `BuildData.bat` or `node build_game_data.js`

### Creating a New Trading Region

1. **Add to** `tradingRegion.csv`:
   ```csv
   region_mountain,Mountain Pass
   ```

2. **Add level progressions to** `tradingRegionUpgrade.csv`:
   ```csv
   region_mountain,1,1000,"[{""orderId"":""order-30001"",""appearRate"":2}]"
   region_mountain,2,2000,"[{""orderId"":""order-30002"",""appearRate"":1}]"
   region_mountain,3,3000,"[{""orderId"":""order-30003"",""appearRate"":1}]"
   region_mountain,4,4000,"[{""orderId"":""order-30004"",""appearRate"":1}]"
   region_mountain,5,5000,"[{""orderId"":""order-30005"",""appearRate"":1}]"
   ```

3. **Create corresponding orders in** `tradingOrder.csv`

4. **Run** `BuildData.bat` or `node build_game_data.js`

### Adjusting Trading Prices

1. **Edit** `trading.csv` to change sell prices:
   ```csv
   bread,15
   ```

2. **Run** `BuildData.bat`

### Accelerating Trading Progression

1. **Edit** `tradingUpgrade.csv` to reduce cooltime or increase max queue slots
2. **Run** `BuildData.bat`

## Integration Points

- **Trading System:** `systems/tradingSystem.js` manages order queues and completion
- **Trading Post UI:** `systems/tradingPostSystem.js` handles trading post mechanics and region progression
- **Stash Manager:** Items are consumed from player inventory when completing orders
- **Game State:** Region levels stored in `gameState.tradingRegions`
- **Data Access:**
  - `gameData.trading` - Item selling prices
  - `gameData.tradingOrder` - Order definitions
  - `gameData.tradingRegion` - Region metadata (ID and name)
  - `gameData.tradingRegionUpgrades` - Region level progression and available orders
  - `gameData.tradingUpgrade` - Trading post facility upgrades
- **Data Loader:** Helper methods in `dataLoader.js`:
  - `getTradingRegion(regionId)` - Get region metadata
  - `getTradingRegionUpgrade(regionId, level)` - Get upgrade data for a specific level
  - `getTradingRegionMaxLevel(regionId)` - Get maximum level for a region
  - `getOrdersForRegionLevel(regionId, level)` - Get available orders at a level
  - `getRegionLevelExp(regionId, level)` - Get XP required to reach next level
- **Build Pipeline:** Auto-generated into `data/gameData.js` by `BuildData.bat` (or `node build_game_data.js`)

## Design Patterns

- **Regional Specialization:** Each region specializes in different item types (fish, meat, general)
- **Progressive Unlocking:** Orders available at region levels, requiring upgrades
- **Reward Scaling:** Order rewards increase with difficulty (epic orders = best gold/time)
- **Queue Management:** Limited slots creates strategic decisions (which orders to prioritize?)
- **Cooldown Balancing:** Cooltime vs queue slots trade-off (take longer or queue fewer)

## Trading Economy

### Revenue Generation (per gold earned)
- Common order: ~100 gold / average items
- Uncommon order: ~1,300 gold / average items
- Rare order: ~3,000 gold / average items
- Epic order: ~7,500 gold / average items

### Alternative Revenue (direct trading from `trading.csv`)
- Bread: 10 gold/unit = very low revenue
- Steel: 20 gold/unit = highest direct revenue
- Cooked Meat: 15 gold/unit
- Canned Fish: 12 gold/unit

**Strategy:** Completing trading orders yields much more gold than direct selling, incentivizing order focus.

## Future Extension Ideas

- **Negotiation Mechanic:** Player can increase order reward at risk of order cancellation
- **Rush Orders:** Pay premium to reduce cooltime
- **Reputation System:** Better prices as reputation increases
- **Seasonal Orders:** Orders change based on game season/time
- **NPC Traders:** Multiple trading partners with different specialties
