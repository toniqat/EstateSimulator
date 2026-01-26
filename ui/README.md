# UI Module

Handles all user interface building and updating based on game state.

## Files

### uiBuilder.js
Constructs all UI elements from game data:
- Builds facility cards with worker assignment inputs
- Creates recipe cards with crafting buttons
- Generates trade cards for buying/selling items
- Constructs the stash grid with drag-and-drop slots
- Integrates item data to populate card displays

### uiUpdater.js
Updates the UI to reflect current game state:
- Updates header stats (gold, worker count)
- Refreshes facility display values (level, assigned workers, production rate)
- Updates stash display (level, capacity, used slots)
- Refreshes trading stock displays
- **Rebuilds stash grid only when contents change** (optimized with change detection to prevent hover state flickering)

### productGridUI.js
Renders and manages product facility grid interfaces:
- Builds grid layouts for product-type facilities (farm, mine, ranch, fishery)
- Creates draggable production area items in sidebar
- Handles drag-and-drop placement of areas onto the grid
- Validates placement with visual feedback (valid/invalid states)
- Renders placed areas with removal controls
- Refreshes grid display dynamically

### navigationManager.js
Manages facility selection and view switching:
- Generates navigation items for all facilities
- Handles facility selection and view switching
- Initializes product grids when product facilities are selected
- Tracks currently active facility

---

## Performance Optimizations

### Stash Grid Change Detection
**Problem:** The stash grid was rebuilding on every game tick (100ms interval) regardless of whether items had been added/removed/moved, causing:
- Constant DOM destruction and recreation
- Loss of `:hover` CSS state when nodes are rebuilt
- Rapid toggle between hover/non-hover states = **flickering/jittering effect**

**Solution:** Implemented change detection in `uiUpdater.js`:
- `computeStashHash()` - Creates a hash of current stash contents (item IDs, quantities, filter)
- Only calls `buildStashUI()` when hash changes (items added/removed/moved or filter changes)
- No more unnecessary DOM rebuilds = **hover states persist** ✓

**Methods:**
- `computeStashHash()` - Computes hash of stash state
- `resetStashHash()` - Resets hash when filter changes (called from `gameLoopManager.filterStashItems()`)
- `updateStash()` - Compares hashes before rebuilding grid

---

## UI Standards

### Simplified Item View

**Purpose:** A reusable, icon-focused item display format for compact layouts where visual scanning is prioritized. Used whenever items need to be displayed in grids with limited space.

**When to Use:**
- Facility storage panels (Farm, Mine, Ranch, Fishery storage)
- Trading Post requirement/reward displays
- Any inventory-style grid where space is constrained
- Item collections that benefit from quick visual identification by grade

**Visual Specifications:**

| Element | Specification |
|---------|---|
| **Container** | Square slot (aspect-ratio: 1:1), positioned flex column |
| **Background** | Grade-based gradient colors with matching border |
| **Icon** | First letter of item name (white, bold, 1.8em, centered, text-shadowed) |
| **Quantity** | Bottom-right badge with semi-transparent dark background (×N format) |
| **Item Name** | Hidden (NOT displayed - compact format key) |
| **Hover Effect** | Grade-specific glow shadow |
| **Tooltip** | Full item name on hover (via `title` attribute) |

**Grade Colors:**
- **Common:** Gray (#95a5a6 → #7f8c8d)
- **Uncommon:** Green (#2ecc71 → #27ae60)
- **Rare:** Blue (#3498db → #2980b9)
- **Epic:** Purple (#9b59b6 → #8e44ad)
- **Legendary:** Red (#e74c3c → #c0392b) with glow effect

**CSS Classes:**
- `.simplified-item-view` - Base container (applies grade class)
- `.simplified-item-icon` - Centered letter icon element
- `.simplified-item-quantity` - Quantity badge
- `.grade-{grade}` - Grade-specific styling (common/uncommon/rare/epic/legendary)

**Implementation:**

**Option 1: Direct HTML (current approach for Storage)**
```javascript
// In uiUpdater.js or similar
const itemGrade = itemData?.grade || 'common';
const firstLetter = itemData?.name?.charAt(0).toUpperCase() || 'X';

slot.classList.add('simplified-item-view', `grade-${itemGrade}`);
slot.innerHTML = `
    <div class="simplified-item-icon">${firstLetter}</div>
    <span class="simplified-item-quantity">×${item.quantity}</span>
`;
slot.title = itemData?.name; // Full name tooltip
```

**Option 2: Reusable Function (for future code reuse)**
```javascript
// In uiBuilder.js
const itemElement = this.uiBuilder.renderSimplifiedItem(item);
// Returns HTMLElement with proper classes and structure
```

**Current Usage Locations:**
- Production Facility Storage (farm/mine/ranch/fishery panels) - `uiUpdater.js:200-247`

**Future Application:**
- Trading Post displays (reward/requirement items)
- Quest/mission reward previews
- Item comparison views
- Any other inventory-style grids where compact icons are beneficial
