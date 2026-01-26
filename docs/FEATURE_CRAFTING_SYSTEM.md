# Crafting System

## Overview

The Crafting System enables players to transform raw materials into processed goods through recipes. Players unlock recipes progressively by upgrading the Processing Facility, then craft items in batches. This system creates item progression chains and requires resource management.

## Architecture

### Core Components

#### **systems/craftingSystem.js**
Recipe management and crafting logic:
- Recipe unlock validation based on facility level
- Crafting action handling (batch or single)
- Input validation and quantity checks
- Output placement in stash
- Recipe filtering and UI display

#### **Data Files**
- `data/items/recipe.csv` - Recipe definitions (4+ core recipes)
- `data/facilities/facilityUpgrade.csv` - Processing facility levels gate recipes
- `data/items/item.csv` - Item definitions with stack limits

## Data Flow

```
recipe.csv + facilityUpgrade.csv
    ↓
gameData.js (compiled)
    ↓
dataLoader.js (query methods)
    ├→ getRecipesByFacility(facilityId)
    ├→ getRecipe(recipeId)
    └→ getUnlockedRecipes(facilityLevel)
    ↓
craftingSystem.js (crafting logic)
    ├→ Validates facility level
    ├→ Checks stash contents
    └→ Removes input items & adds output
    ↓
stashManager.js (item inventory)
    └→ Manages crafted item placement
```

## Crafting Mechanics

### Recipes

Each recipe defines a simple transformation:

| Property | Source | Purpose |
|----------|--------|---------|
| `recipeId` | recipe.csv | Unique identifier |
| `facilityId` | recipe.csv | Processing |
| `inputItems` | recipe.csv | Items consumed |
| `outputItems` | recipe.csv | Items produced |
| `unlockedAtLevel` | recipe.csv | Facility level gate |

**Recipe Structure Example:**
```javascript
{
  recipeId: "wheat_to_bread",
  facilityId: "processing",
  inputItems: [
    { itemId: "wheat", quantity: 5 }
  ],
  outputItems: [
    { itemId: "bread", quantity: 3 }
  ],
  unlockedAtLevel: 1  // Available at processing level 1
}
```

### Core Recipes

Typical crafting recipes follow item progression chains:

| Recipe | Inputs | Outputs | Unlock Level | Purpose |
|--------|--------|---------|---|---|
| **Wheat → Bread** | 5 wheat | 3 bread | 1 | Basic conversion |
| **Ore → Steel** | 10 ore | 5 steel | 1 | Metal processing |
| **Wool → Cloth** | 8 wool | 4 cloth | 2 | Textile processing |
| **Kelp → Paste** | 6 kelp | 3 paste | 3 | Specialty crafting |

### Unlock Progression

Recipes unlock as players upgrade the Processing Facility:

```
Processing Level 1: wheat→bread, ore→steel (basic recipes)
Processing Level 2: wool→cloth, leather prep
Processing Level 3: kelp→paste, herb extract
Processing Level 4: advanced recipes
Processing Level 5: rare combinations
```

### Crafting Process

**Single Craft:**
1. Player selects recipe and clicks "Craft" button
2. System validates facility level (must be unlocked)
3. System checks stash contains all required input items
4. If valid:
   - Deduct input items from stash
   - Add output items to stash
5. If invalid, show error (missing items or not unlocked)

**Batch Crafting:**
1. Player selects recipe and input quantity
2. System calculates max possible batches (limited by stash availability)
3. System performs batch operation:
   - Deduct (input × quantity) from stash
   - Add (output × quantity) to stash
4. Partial batches not allowed (all-or-nothing per batch)

**No Cooltime:**
- Crafting is instant (no timer or production delay)
- Multiple crafts can happen simultaneously
- No facility-based production rate limiting

## Integration with Game Systems

### UpgradeSystem
- Processing facility upgrades unlock new recipes
- `unlockedAtLevel` field gates recipe availability
- Each upgrade level unlocks 1-2 new recipes

### StashManager
- CraftingSystem validates stash has input items
- Removes input items on successful craft
- Adds output items (respecting stack limits)
- Handles overflow if stash full

### GameState
- Tracks processing facility level
- Stores crafting history (optional)
- Unlocked recipes list (calculated from facility level)

### UIBuilder
- Creates recipe list filtered by facility level
- Shows craft buttons with input/output display
- Displays "Not Unlocked" for recipes above current level

## Key Methods

### craftingSystem.js
- `getUnlockedRecipes()` - Recipes available at current facility level
- `canCraft(recipeId)` - Check facility level and stash contents
- `craft(recipeId)` - Execute single craft
- `craftBatch(recipeId, batchCount)` - Execute multiple crafts
- `getRecipeDetails(recipeId)` - Input/output info

### dataLoader.js
- `getRecipe(recipeId)` - Get recipe definition
- `getRecipesByFacility(facilityId)` - All recipes for facility
- `getUnlockedRecipeCount(level)` - How many recipes at level X

## Workflow Example: Crafting Progression

1. **Start Game:**
   - Processing facility at level 1
   - Only basic recipes available: wheat→bread, ore→steel
   - Player has produced 30 wheat and 20 ore

2. **First Crafts:**
   - Craft wheat→bread: Deduct 5 wheat, gain 3 bread (repeat 6 times = 30 wheat → 18 bread)
   - Craft ore→steel: Deduct 10 ore, gain 5 steel (repeat 2 times = 20 ore → 10 steel)
   - Stash now contains: bread, steel (which trade for more gold)

3. **Upgrade Processing Facility to Level 2:**
   - New recipe unlocked: wool→cloth
   - Player now has access to 3 total recipes
   - Continues farming/mining to gather wool

4. **Produce Specialized Items:**
   - Craft cloth from wool (better trading prices than raw wool)
   - Combine multiple processed items for advanced trades
   - Stash becomes valuable with processed goods

5. **Late Game Crafting:**
   - Level 5 facility with 10+ recipes
   - Complex chains (ore→steel→tools)
   - Bulk crafting to match trading order requirements

## Advanced Features

### Recipe Chains
- Later recipes can use outputs of earlier recipes
- Example: wheat→flour→bread, flour→pastry
- Encourages multi-step production workflows

### Yield Ratios
- Input/output ratios balance recipe value
- Conversion inefficiency creates progression:
  - 5 wheat → 3 bread (loss, but bread trades better)
  - 10 ore → 5 steel (loss, but steel more valuable)
- Encourages finding balance between raw material production and crafting

### Rarity-Based Crafting
- Recipes might accept multiple input grades
- Premium recipes (rare inputs) yield higher quantities or quality
- Incentivizes collecting higher-grade materials

## Performance Considerations

- **Recipe Lookup**: O(1) via recipe dictionary in dataLoader
- **Unlock Validation**: Single level comparison (O(1))
- **Stash Validation**: O(n) where n = recipe inputs (typically 1-3)
- **Batch Processing**: O(batchCount) for multiple operations

## Data Structure Reference

### Recipe Object
```javascript
{
  recipeId: "wheat_to_bread",
  facilityId: "processing",
  name: "Wheat Bread",
  inputItems: [
    { itemId: "wheat", quantity: 5 }
  ],
  outputItems: [
    { itemId: "bread", quantity: 3 }
  ],
  unlockedAtLevel: 1
}
```

### Recipe List (by Level)
```javascript
{
  level1: [
    "wheat_to_bread",
    "ore_to_steel"
  ],
  level2: [
    "wool_to_cloth",
    "leather_prep"
  ],
  level3: [
    "kelp_to_paste",
    "herb_extract"
  ],
  // ... up to level 5
}
```

### Crafting Action
```javascript
{
  recipeId: "wheat_to_bread",
  quantity: 5,  // 5 batches
  totalInput: {
    wheat: 25  // 5 batches × 5 wheat per batch
  },
  totalOutput: {
    bread: 15  // 5 batches × 3 bread per batch
  },
  success: true,
  remainingStashSpace: 12  // Slots available after craft
}
```
