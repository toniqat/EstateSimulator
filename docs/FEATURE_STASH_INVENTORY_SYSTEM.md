# Stash & Inventory System

## Overview

The Stash & Inventory System manages all player items through two separate storage systems: the **Stash** (main inventory) and **Facility Storage** (per-facility production storage). The system enforces item-specific stack limits, enables drag-drop reorganization, and coordinates item flow from production areas to the stash to trading/crafting.

## Architecture

### Core Components

#### **core/stashManager.js**
Central inventory management:
- Add items with smart stacking
- Remove items for trading/crafting
- Drag-drop slot swapping
- Automatic sort operations
- Stack limit enforcement
- Stash capacity per facility level

#### **core/facilityStorageManager.js**
Per-facility production buffers:
- Separate storage grid per facility type
- Stores items produced by production areas
- Stash-like interface (slots and stack limits)
- Capacity per facility upgrade level
- Collection interface to move to stash

#### **Data Files**
- `data/items/item.csv` - Item definitions with maxStack limits
- `data/facilities/facilityUpgrade.csv` - Stash capacity per level

## Data Flow

```
productionSystem.js
    ↓ (generated items)
facilityStorageManager.js
    ├→ Stores items per facility
    └→ Player collects when ready
    ↓ (collection action)
stashManager.js (main inventory)
    ├→ Smart stacking enforced
    ├→ Respects maxStack per item
    └→ Available for trading/crafting
```

## Stash System

### Stash Structure

The stash is a **grid-based inventory** with a fixed number of slots:

```javascript
{
  stash: [
    { itemId: "wheat", quantity: 25, maxStack: 50 },
    { itemId: "ore", quantity: 33, maxStack: 100 },
    null,  // empty slot
    { itemId: "bread", quantity: 5, maxStack: 50 },
    // ... more slots
  ],
  capacity: 60,  // Total slots
  used: 3        // Used slots
}
```

### Stash Capacity

Stash capacity is upgraded via the **Stash Facility**:

| Stash Level | Total Capacity |
|---|---|
| Level 1 | 30 slots |
| Level 2 | 45 slots |
| Level 3 | 60 slots |
| Level 4 | 75 slots |
| Level 5 | 90+ slots |

Each upgrade increases maximum slots by ~15.

### Item Stack Limits

Each item type has a `maxStack` property from `item.csv`:

| Item Type | Max Stack | Purpose |
|---|---|---|
| Wheat | 50 | Food crop |
| Ore | 100 | Mining resource |
| Steel | 75 | Processed metal |
| Bread | 50 | Crafted food |
| Cloth | 50 | Crafted textile |

**Stack Limit Enforcement:**
- When adding items, only stack up to `maxStack` per slot
- If quantity exceeds, overflow goes to next empty slot
- If no empty slots, operation fails (stash full)

### Adding Items (Smart Stacking)

```javascript
addItem(itemId, quantity) {
  1. Find slot with itemId and quantity < maxStack
  2. Add up to (maxStack - currentQuantity)
  3. If overflow, find next empty slot
  4. Repeat until all quantity placed or stash full
  5. Return success/overflow status
}
```

**Example:**
- Adding 80 wheat to stash with 30 wheat already in slot 0
- Slot 0 maxStack: 50, current: 30
- Can add 20 to slot 0 (now 50, full)
- Remaining 60 go to empty slot 1
- Result: Slot 0 (50 wheat), Slot 1 (60 wheat) ✓ Success

### Removing Items (For Trades/Crafts)

```javascript
removeItem(itemId, quantity) {
  1. Find slots containing itemId in order
  2. Remove from each slot until quantity satisfied
  3. Delete empty slots
  4. Return success/insufficient status
}
```

**Example:**
- Removing 75 ore from stash with 100 ore in slot 2 and 25 ore in slot 3
- Remove 75 from slot 2 (now 25)
- All 75 satisfied
- Result: Slot 2 (25 ore), Slot 3 (25 ore) - no deletion if still >= 1 ✓ Success

### Slot Swapping (Drag-Drop)

```javascript
swapSlots(fromSlot, toSlot) {
  1. Validate both slots
  2. If both have items of SAME type: merge stacks (respect maxStack)
  3. If different types or empty: exchange items
  4. Update UI
}
```

**Examples:**
- Swap slot 0 (30 wheat) with slot 1 (empty):
  - Result: Slot 0 (empty), Slot 1 (30 wheat)

- Swap slot 0 (30 wheat) with slot 1 (20 wheat):
  - Merge: Slot 0 can hold 50 total
  - Available space: 50 - 30 = 20
  - Transfer 20 from slot 1 to slot 0
  - Result: Slot 0 (50 wheat), Slot 1 (empty)

### Sorting

```javascript
sort() {
  1. Iterate all slots
  2. Find items of same type
  3. Stack them together (respecting maxStack)
  4. Consolidate empty slots to end
  5. Return consolidated stash
}
```

**Example Before:**
- Slot 0: 30 wheat
- Slot 1: null
- Slot 2: 20 wheat
- Slot 3: 15 ore

**After Sort:**
- Slot 0: 50 wheat (max)
- Slot 1: 15 ore
- Slot 2: null
- Slot 3: null

## Facility Storage System

### Per-Facility Storage

Each production facility (farm, mine, ranch, fishery) has **separate storage**:

```javascript
{
  facilityStorages: {
    farm: {
      level: 2,
      capacity: 30,
      items: [
        { itemId: "wheat", quantity: 15, maxStack: 50 },
        null,
        { itemId: "corn", quantity: 8, maxStack: 50 }
      ]
    },
    mine: {
      level: 1,
      capacity: 20,
      items: [
        { itemId: "ore", quantity: 45, maxStack: 100 }
        // ... more items
      ]
    },
    // ... other facilities
  }
}
```

### Facility Storage Capacity

Capacity scales with facility **upgrade level**:

| Facility Level | Storage Capacity |
|---|---|
| 1 | 20 slots |
| 2 | 30 slots |
| 3 | 40 slots |
| 4 | 50 slots |
| 5 | 60 slots |

- **Farm/Mine/Ranch/Fishery**: Have facility storage
- **Processing/Trading/Lodge**: No facility storage (items go directly to stash or bypass storage)
- **Stash Facility**: Is the main inventory (no separate storage)

### Item Collection

**Manual Collection:**
1. Player visits facility UI
2. Clicks "Collect All" or selects specific items
3. Items move from facility storage → stash
4. If stash full, shows "Inventory Full" error
5. Player can optionally move some stash items to sell/trade first

**Partial Collection:**
- If collecting 50 wheat but stash only has room for 30
- Can collect 30, then collect remaining 20 later
- No all-or-nothing enforcement

### Overflow Behavior

**Production Blocked on Full Storage:**
- When facility storage full and production completes
- Items cannot be generated
- ProductionSystem marks area as paused/blocked
- UI shows "Storage Full - Collect Items"
- No item loss (items wait for storage space)

## Integration with Game Systems

### ProductionSystem
- Generates items → `facilityStorageManager.addToStorage(facilityId, itemId, quantity)`
- Checks capacity before generation: `canAddItems(facilityId, itemId, quantity)`

### CraftingSystem
- Validates items in stash: `hasItem(itemId, quantity)`
- Removes inputs: `removeItem(itemId, quantity)`
- Adds outputs: `addItem(itemId, quantity)`

### TradingSystem
- Validates stash for order: `hasAllItems(orderRequirements)`
- Removes items on trade: `removeItem(itemId, quantity)` for each input

### UIBuilder
- Displays stash grid with item details
- Displays facility storage per facility
- Shows capacity usage and overflow warnings

### UpgradeSystem
- Stash facility upgrade increases capacity
- Facility upgrades increase per-facility storage capacity

### GameState
Stores inventory data:
```javascript
{
  stash: [{ itemId, quantity, maxStack }, ...],
  stashCapacity: 60,
  facilityStorages: {
    farm: { level, capacity, items: [...] },
    mine: { level, capacity, items: [...] },
    // ... other facilities
  }
}
```

## Key Methods

### stashManager.js
- `addItem(itemId, quantity)` - Add to stash with smart stacking
- `removeItem(itemId, quantity)` - Remove for trading/crafting
- `hasItem(itemId, quantity)` - Check if available
- `hasAllItems(itemRequirements)` - Batch check for orders
- `getStashSlots()` - Get current stash state
- `swapSlots(fromIndex, toIndex)` - Drag-drop reorganization
- `sortStash()` - Consolidate and organize
- `getCapacity()` - Total slots and used count
- `isFull()` - Quick check for overflow

### facilityStorageManager.js
- `addToFacilityStorage(facilityId, itemId, quantity)` - Production → storage
- `removeFromStorage(facilityId, itemId, quantity)` - Collection to stash
- `getFacilityStorageState(facilityId)` - Current items and capacity
- `canAddToStorage(facilityId, itemId, quantity)` - Overflow check
- `isStorageFull(facilityId)` - Binary check
- `getStorageCapacity(facilityId)` - Slots and used count
- `collectAll(facilityId)` - Move all items to stash

## Workflow Example: Item Flow

1. **Production Completes:**
   - Farm produces 5 wheat
   - `productionSystem` → `facilityStorageManager.addToFacilityStorage("farm", "wheat", 5)`
   - Farm storage now has 5 wheat (stash not yet affected)

2. **Player Collects:**
   - Player clicks "Collect All" on farm UI
   - `facilityStorageManager.collectAll("farm")`
   - Wheat moves: farm storage (5) → stash (now has 5)

3. **Player Uses Items:**
   - 2 Crafting orders require 10 wheat total
   - `stashManager.removeItem("wheat", 10)`
   - Wheat deducted: stash (5) → stash (0), craft output (+bread)

4. **Advanced Scenario:**
   - 3 facilities producing simultaneously
   - Farm storage: 20 wheat, Mine storage: 30 ore
   - Stash has room for 15 items total
   - Player collects farm: 20 wheat → stash (fills to 15 capacity)
   - Player sells 5 wheat for gold
   - Player collects mine: 15 ore → stash (capacity now has room)
   - Continue managing resources

## Advanced Features

### Smart Stacking
- Automatically fills existing partial stacks before new slots
- Optimizes slot usage to maximize inventory capacity
- Consolidates duplicates on sort

### Drag-Drop Merging
- Dragging same item type onto another merges stacks
- Respects maxStack limits during merge
- Provides intuitive inventory management

### Visual Feedback
- Slot colors by item type (visual organization)
- Grade-based coloring (common→rare items different colors)
- Overflow warnings and hints

### Batch Operations
- Craft multiple batches (affects stash directly)
- Trade multiple orders (validates then deducts in sequence)
- Collect from multiple facilities at once

## Performance Considerations

- **Add Operation**: O(n) where n = stash size (worst case: find empty slot)
- **Remove Operation**: O(n) (iterate until quantity found)
- **Swap Operation**: O(1) (direct slot access)
- **Sort Operation**: O(n log n) (sort algorithm on items)
- **Collection**: O(m) where m = facility storage size (one-time when collecting)

## Data Structure Reference

### Stash Slot
```javascript
{
  itemId: "wheat",
  quantity: 30,
  maxStack: 50
}
// or null for empty slot
```

### Full Stash State
```javascript
{
  slots: [
    { itemId: "wheat", quantity: 50 },
    { itemId: "ore", quantity: 100 },
    { itemId: "steel", quantity: 75 },
    null,
    { itemId: "bread", quantity: 15 },
    // ... up to capacity
  ],
  totalCapacity: 60,
  usedSlots: 4,
  isFull: false
}
```

### Facility Storage State
```javascript
{
  facilityId: "farm",
  level: 2,
  maxCapacity: 30,
  items: [
    { itemId: "wheat", quantity: 20, maxStack: 50 },
    { itemId: "corn", quantity: 8, maxStack: 50 },
    null,
    null,
    // ... up to 30 slots
  ],
  usedSlots: 2,
  isFull: false
}
```
