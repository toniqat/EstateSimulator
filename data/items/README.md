# Item System Data (`data/items/`)

## Overview

This directory defines **all items in the game, their properties, and crafting recipes**. Items are the core currency and resources that drive gameplay, from raw materials to processed goods and special currency.

## File Dictionary

| File | Purpose |
|------|---------|
| `item.csv` | Defines all items available in the game with properties (name, stack size, rarity grade, source) |
| `recipe.csv` | Defines crafting recipes that transform input items into output items |

## Detailed File Descriptions

### `item.csv`
**Purpose:** Central registry of all items in the game with their properties and metadata.

**Columns:**
- `id` - Item identifier (used everywhere in code)
- `name` - Display name
- `stacks` - Maximum stack size in inventory (how many of this item can occupy one slot)
- `grade` - Rarity grade (affects visual styling and prestige value)
- `type` - Source/category (which facility produces it or special classification)

**Current Items:**

| ID | Name | Stack | Grade | Type | Purpose |
|----|------|-------|-------|------|---------|
| wheat | Wheat | 25 | Common | Farm | Raw material, primary crop |
| ore | Ore | 25 | Common | Mine | Raw material, primary ore |
| meat | Meat | 25 | Common | Ranch | Raw material, animal product |
| fish | Fish | 25 | Common | Fishery | Raw material, aquatic product |
| bread | Bread | 10 | Uncommon | Farm | Processed food (from wheat) |
| steel | Steel | 10 | Rare | Mine | Processed metal (from ore) |
| cookedmeat | Cooked Meat | 10 | Uncommon | Ranch | Processed food (from meat) |
| cannedfish | Canned Fish | 10 | Uncommon | Fishery | Processed food (from fish) |
| gold | Gold | 999,999 | Legendary | Special | Game currency, unlimited stacking |

**Grade Distribution:**
- **Common (Gray):** Raw materials (wheat, ore, meat, fish)
- **Uncommon (Blue):** Processed basic items (bread, cooked meat, canned fish)
- **Rare (Purple):** Advanced processed items (steel)
- **Legendary (Red):** Special items (gold currency)

**Stack Sizes:** Raw materials stack to 25 (efficient bulk transport), processed items to 10 (balanced inventory management), gold to 999,999 (unlimited currency).

---

### `recipe.csv`
**Purpose:** Defines all crafting recipes available in the processing facility.

**Columns:**
- `output_id` - Item produced by this recipe
- `output_amount` - Quantity produced
- `inputs` - JSON array of required input items with counts

**Crafting Recipes:**

| Output | Qty | Inputs | Purpose |
|--------|-----|--------|---------|
| bread | 1 | 2 wheat | Convert raw wheat to food |
| steel | 1 | 3 ore | Convert raw ore to metal |
| cookedmeat | 1 | 2 meat | Convert raw meat to food |
| cannedfish | 1 | 2 fish | Convert raw fish to food |

**Crafting Pattern:**
- All recipes convert 2-3 raw materials into 1 processed item
- Creates economy progression: raw materials → processed goods → trading revenue
- Processing Plant (facility) executes these recipes

**Recipe Economics:**
- 2 wheat → 1 bread (requires 2 units input for 1 output)
- 3 ore → 1 steel (highest cost recipe, creates rarity)
- This creates a bottleneck that balances gameplay

## How to Modify

### Adding a New Item

1. **Add to** `item.csv`:
   ```csv
   wine,Wine,5,uncommon,Winery
   ```

2. **Add recipe to** `recipe.csv` if this item is crafted:
   ```csv
   wine,1,"[{""itemId"":""grapes"",""count"":3}]"
   ```

3. **Update facility production** in `data/facilities/production.csv` if it's a new facility output:
   ```csv
   winery,wine,1,10000
   ```

4. **Run** `BuildData.bat`

### Modifying Recipes

1. **Edit** `recipe.csv` to change input requirements or output quantities:
   ```csv
   bread,2,"[{""itemId"":""wheat"",""count"":2}]"
   ```

2. **Run** `BuildData.bat`

### Adjusting Stack Sizes

1. **Edit** `item.csv` to change the `stacks` column:
   ```csv
   wheat,Wheat,50,common,Farm
   ```

2. **Run** `BuildData.bat`

## Integration Points

- **Stash Manager:** `core/stashManager.js` manages item stacks and inventory slots
- **Crafting System:** `systems/craftingSystem.js` executes recipes from `recipe.csv`
- **Trading System:** `systems/tradingSystem.js` sells items from `data/trading/trading.csv`
- **UI Display:** `ui/uiUpdater.js` renders items with grade-based colors from `ui/uiBuilder.js`
- **Data Access:** Values accessed via `gameData.item` and `gameData.recipe`
- **Build Pipeline:** Auto-generated into `data/gameData.js` by `BuildData.bat`

## Design Patterns

- **Grade as Rarity:** Grade colors provide visual feedback on item value
- **Stack Scaling:** Stack sizes inversely related to item value (common items stack high, legendary stack lowest)
- **Recipe Progression:** Recipes create gameplay flow (produce raw → craft → trade)
- **Material Bottlenecks:** Recipes requiring 3 inputs (steel from ore) create challenging crafting goals
- **Currency Unlimited:** Gold has 999,999 stack to never create inventory issues for currency

## Item Economics

### Production Ratios
- **Wheat → Bread:** 2:1 (2 wheat produces 1 bread)
- **Ore → Steel:** 3:1 (3 ore produces 1 steel—highest cost)
- **Meat → Cooked Meat:** 2:1
- **Fish → Canned Fish:** 2:1

### Trading Value (from `data/trading/trading.csv`)
- Bread: 10 gold
- Steel: 20 gold
- Cooked Meat: 15 gold
- Canned Fish: 12 gold

### Progression Strategy
1. Players produce raw materials (wheat, ore, meat, fish)
2. Craft into processed goods (bread, steel, cooked meat, canned fish)
3. Trade processed goods for gold
4. Use gold to upgrade facilities and hire workers

## Future Extension Ideas

- **Quality Grades:** Items could have quality modifiers (normal, fine, superior) affecting value
- **Enchantments:** Recipes could produce enchanted variants with special properties
- **Item Combinations:** Advanced recipes combining multiple processed items
- **Equipment System:** Items as gear rather than just tradeable goods
