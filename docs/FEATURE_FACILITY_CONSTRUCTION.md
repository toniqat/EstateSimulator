# Facility Construction System

## Overview

The Facility Construction System enables players to build new facilities from scratch. The game enforces strict facility initialization and visibility rules:

**Initialization:**
- **Default:** All facilities start at **Level 0** by default (hidden from sidebar)
- **Auto-Unlock Exception:** Facilities with empty `requirements` field in Level 1 of `facilityUpgrade.csv` are "Basic Facilities" and automatically initialize at **Level 1** (visible in sidebar)

**Visibility & Construction:**
- **Level 0 Facilities:** Hidden from sidebar, available for construction in Construction Mode
- **Level ≥ 1 Facilities:** Visible in sidebar, can be upgraded through normal upgrade flow
- **Construction Mode:** Dedicated UI interface showing all unbuilt facilities (level 0) with their Level 1 construction costs

This system:
- Creates a progression gate for facility building
- Provides a dedicated UI for discovering and constructing facilities
- Uses the same cost/requirement infrastructure as the upgrade system
- Reuses Level 1 requirements from `facilityUpgrade.csv` as construction costs
- Maintains strict CSV-based ordering for sidebar display

## Architecture

### Core Components

#### **core/gameState.js**
Facility initialization and default state:
- Initializes ALL facilities at **Level 0** by default on new game
- **Auto-unlock Logic:** Checks Level 1 requirements from `facilityUpgrade.csv`
  - If Level 1 `requirements` field is empty (null, empty string, or empty array) → Initialize at **Level 1**
  - If Level 1 has requirements → Initialize at **Level 0** (unbuilt)
- Maintains facility state: `{ id, level, assignedWorkers }`

#### **ui/navigationManager.js**
Manages sidebar navigation and facility availability:
- Maintains `facilityTypes` array in **exact CSV row order** from `facility.csv`
- Filters facilities by level (shows only level ≥ 1 facilities)
- Level 0 facilities are completely hidden from sidebar
- Manages "Add Facility" button visibility and state
- Handles entry/exit from construction mode
- Provides unbuilt facility list (level 0 facilities)

#### **systems/upgradeSystem.js**
Extends upgrade system with construction methods:
- `canConstruct(facilityId)` - Validate construction requirements
- `getConstructionCostDetails(facilityId)` - Get cost details for UI
- `constructFacility(facilityId)` - Execute facility construction (level 0 → 1)

#### **ui/uiBuilder.js**
UI element generation:
- `buildConstructionGridUI(container)` - Build 3-column grid of unbuilt facilities

#### **core/gameLoopManager.js**
User action handlers:
- `showConstructionConfirmation(facilityId)` - Show modal
- `closeConstructionConfirmation()` - Hide modal
- `confirmConstruction()` - Execute construction
- `exitConstructionMode()` - Return to normal view
- `updateAddFacilityButton()` - Proxy to navigationManager

#### **ui/uiUpdater.js**
State synchronization:
- `updateAddFacilityButtonState()` - Update button appearance based on resources

#### **Data Files**
- `data/facilities/facility.csv` - Facility definitions (row order determines sidebar order)
- `data/facilities/facilityUpgrade.csv` - Level 1 requirements; empty = auto-unlock to Level 1

## Data Flow

### Game Initialization (New Game)

```
Game starts (new save)
    ↓
gameState.initializeState()
    ├─ Load all facilities from data
    ├─ For EACH facility:
    │   ├─ Read Level 1 requirements from facilityUpgrade.csv
    │   ├─ Check if requirements is empty:
    │   │   ├─ YES (null/""/[]) → Initialize at Level 1 (Basic Facility, auto-unlocked)
    │   │   └─ NO (has requirements) → Initialize at Level 0 (unbuilt)
    │   └─ Set facility: { id, level: 0 or 1, assignedWorkers: 0 }
    ↓
navigationManager.initializeNavigation()
    ├─ Loop through facilityTypes in CSV row order
    ├─ For EACH facility:
    │   ├─ If level >= 1 → Render nav button in sidebar
    │   └─ If level == 0 → Skip (hidden from sidebar)
    ├─ If any level 0 facilities exist → Show "Add Facility" button
    └─ Select first level >= 1 facility as current
```

### Construction Workflow (Player Interaction)

```
Player clicks "Add Facility" button (in sidebar)
    ↓
enterConstructionMode()
    ├─ getUnbuiltFacilities() → Filter level 0 facilities
    ├─ buildConstructionGridUI() → Render 3-column grid
    └─ Each panel shows:
        - Facility name
        - Level 1 cost details
        - "Construct" button (enabled/disabled based on resources)
    ↓
Player clicks "Construct" on a facility panel
    ↓
showConstructionConfirmation(facilityId)
    ├─ getConstructionCostDetails() → Get Level 1 costs
    ├─ Render modal with costs and confirmation
    └─ Update "Construct" button state
    ↓
Player clicks "Construct" in modal
    ↓
confirmConstruction()
    ├─ constructFacility(facilityId) → Execute construction
    │   ├─ Validate all Level 1 requirements
    │   ├─ Consume items/gold
    │   └─ Set facility.level = 1
    ├─ initializeNavigation() → Rebuild menu (show new facility)
    ├─ buildConstructionGridUI() → Rebuild construction grid (remove built facility)
    ├─ STAY IN CONSTRUCTION VIEW → Allow chained facility construction
    └─ updateUI() → Refresh display
```

## User Interface

### Sidebar Navigation

**Default State (New Game - Auto-Unlock Basic Facilities):**

Based on `facilityUpgrade.csv`, Level 1 requirements for basic facilities are empty:
- Stash Level 1: No requirements ✓ (auto-unlock)
- Lodge Level 1: Requires Stash Lv2 ✗ (unbuilt)
- Processing Level 1: Requires Farm & Mine ✗ (unbuilt)
- Trading Level 1: Requires Processing ✗ (unbuilt)
- Farm Level 1: Requires Lodge ✗ (unbuilt)
- Mine Level 1: Requires Lodge ✗ (unbuilt)
- Ranch Level 1: Has requirements ✗ (unbuilt)
- Fishery Level 1: Has requirements ✗ (unbuilt)

**Resulting Sidebar (only Level ≥ 1 shown in CSV order):**
```
┌─────────────────────┐
│ Facilities          │
├─────────────────────┤
│ ✓ Stash          Lv1│
├─────────────────────┤
│       [+]           │ ← Dashed border (unbuilt exist but can't afford)
│   (Add Facility)    │
└─────────────────────┘
```

(Note: Hidden from sidebar: Lodge, Processing, Trading, Farm, Mine, Ranch, Fishery at Level 0)

**Ready to Build:**
```
┌─────────────────────┐
│       [+]           │ ← Solid border, light green background
│   (Add Facility)    │
└─────────────────────┘
```

### Construction Mode Screen

**3-Column Grid of Unbuilt Facilities with Prerequisites & Materials (Sorted by Availability):**

Facilities in the construction grid are **sorted from highest to lowest availability**:

1. **Fully Buildable (Top):** Both prerequisites met AND materials available
2. **Materials Missing (Middle):** Prerequisites met BUT materials unavailable
3. **Locked (Bottom):** Prerequisites NOT met

```
┌─────────────────────────────────────────┐
│ Facility Construction         [Back]    │
├─────────────────────────────────────────┤
│ FULLY BUILDABLE (Prerequisites + Materials Met) │
│  ┌──────────┐  ┌──────────┐             │
│  │  Mine    │  │[Empty]   │             │
│  │          │  │          │             │
│  │PREREQUISITES│ PREREQUISITES│         │
│  │Lodge Lv.1│  │          │             │
│  │/ Have: 1 │  │          │             │
│  │(GREEN)   │  │          │             │
│  │          │  │          │             │
│  │REQUIRED  │  │REQUIRED  │             │
│  │MATERIALS │  │MATERIALS │             │
│  │Gold: 500/│  │          │             │
│  │    600   │  │          │             │
│  │(GREEN)   │  │          │             │
│  │          │  │          │             │
│  │[Construct]│  │          │             │
│  │(Green)    │  │          │             │
│  └──────────┘  └──────────┘             │
│                                         │
│ MATERIALS MISSING (Prerequisites Met)    │
│  ┌──────────┐  ┌──────────┐             │
│  │  Lodge   │  │Processing│             │
│  │          │  │          │             │
│  │PREREQUISITES│ PREREQUISITES│         │
│  │Stash Lv.2│  │Farm Lv.1 │             │
│  │/ Have: 1 │  │/ Have: 1 │             │
│  │(RED)     │  │(GREEN)   │             │
│  │          │  │Mine Lv.1 │             │
│  │REQUIRED  │  │/ Have: 0 │             │
│  │MATERIALS │  │(RED)     │             │
│  │[Construct]│  │          │             │
│  │(Gray)     │  │[Construct]│             │
│  └──────────┘  └──────────┘             │
│                                         │
│ LOCKED (Prerequisites NOT Met)          │
│  ┌──────────┐  ┌──────────┐             │
│  │  Ranch   │  │ Fishery  │             │
│  │(Grayed   │  │(Grayed   │             │
│  │ Out)     │  │ Out)     │             │
│  │          │  │          │             │
│  │Prerequisites│ Prerequisites│         │
│  │Cooked    │  │Canned    │             │
│  │Meat x2   │  │Fish x2   │             │
│  │/ Have: 0 │  │/ Have: 0 │             │
│  │(RED)     │  │(RED)     │             │
│  │          │  │          │             │
│  │REQUIRED  │  │REQUIRED  │             │
│  │MATERIALS │  │MATERIALS │             │
│  │[Construct]│  │[Construct]│             │
│  │(Gray)     │  │(Gray)    │             │
│  └──────────┘  └──────────┘             │
│                                         │
└─────────────────────────────────────────┘

Legend:
- GREEN text = Requirement satisfied ✓
- RED text = Requirement NOT satisfied ✗
- Panel (NOT grayed) = All facility prerequisites met, button clickable if materials OK
- Panel (GRAYED OUT) = Missing facility prerequisites, entire panel disabled
- GREEN button = All prerequisites AND materials met (clickable)
- GRAY button = Prerequisites missing OR materials missing (disabled)
```

### Construction Confirmation Modal

```
┌──────────────────────────────────────────┐
│ Construct Facility : Lodge          [×]  │
├──────────────────────────────────────────┤
│                                          │
│ Required Materials:                      │
│ ┌──────────────────────────────────────┐ │
│ │Stash        Lv. 2 / Have: Lv.1     │ │  ← RED (not met)
│ │Gold           500 / Have: 600       │ │  ← GREEN (met)
│ └──────────────────────────────────────┘ │
│                                          │
│  [Cancel]      [Construct]               │
│                (Disabled/Gray)           │
│                                          │
│ Cannot construct: Requires Stash        │
│ at Level 2 (current: Level 1)           │
└──────────────────────────────────────────┘
```

**Key Changes (Jan 2026):**
- **Title Format:** Now displays "Construct Facility : [Facility Name]" for clarity
- **Content Cleanup:** Removed redundant facility name display from body content
- **View Persistence:** Construction View remains active after successful facility build, allowing chained construction

## Construction Requirements

### Requirement Types

Construction requirements come from Level 1 in `facilityUpgrade.csv` and can be two types:

#### Type: "item" (Resource Cost)
- Consumes resources (gold, items) when constructed
- Example: `{"type":"item","param1":"gold","param2":500}` → Requires 500 gold

#### Type: "facility" (Prerequisite)
- Does NOT consume resources, just gates construction
- Example: `{"type":"facility","param1":"stash","param2":2}` → Requires Stash Level 2
- Check is performed, not consumed

### Mapping to Upgrade System

**Level 1 requirements in `facilityUpgrade.csv` become construction requirements:**

```csv
# Examples from facilityUpgrade.csv
lodge,1,"[{""type"":""facility"",""param1"":""stash"",""param2"":2}]",5,...
farm,1,"[{""type"":""facility"",""param1"":""lodge"",""param2"":1}]",5,...
mine,1,"[{""type"":""facility"",""param1"":""lodge"",""param2"":1}]",5,...
ranch,1,"[{""type"":""item"",""param1"":""cookedmeat"",""param2"":2}]",5,...
```

### Requirement Validation

```javascript
// Check if facility can be constructed
canConstruct(facilityId) {
  1. Facility exists and level === 0? ✓
  2. Get Level 1 requirements from facilityUpgrade.csv
  3. For each requirement:
     ├─ type === "item":
     │  └─ Validate stash has quantity (Gold or item)
     └─ type === "facility":
        └─ Validate required facility is at required level
  4. All requirements satisfied? Return true
  5. Any missing? Return false (button disabled, reason shown in UI)
}
```

### Requirement Display

**Construction Grid Panel:**
- Displays requirements in two clearly labeled sections:
  - **Prerequisites Section:** Facility-type requirements (gates construction, not consumed)
  - **Required Materials Section:** Item-type requirements (consumed on construction)

**Display Format:**
- Facility prerequisites display: `"Stash Lv. 2 / Have: Lv. 1"`
- Item costs display: `"Gold 500 / Have: 600"`
- Color coding:
  - GREEN = Requirement satisfied ✓
  - RED = Requirement NOT satisfied ✗

**Panel State Logic:**
- **If ANY facility prerequisite is NOT met:**
  - Entire panel is grayed out (opacity: 0.5)
  - Pointer events disabled (no interaction possible)
  - Button disabled and appears grayed
  - Panel shows visual feedback that it's locked
- **If facility prerequisites ARE met:**
  - Panel remains normal (fully enabled)
  - Button state depends ONLY on material requirements:
    - Button GREEN if all materials available
    - Button GRAY if any materials missing
    - Panel itself stays enabled (hover effects apply)

**Confirmation Modal:**
- Lists all requirements in order: facility prerequisites first, then items
- Same color coding as grid
- Button disabled if any requirement is missing (facility OR items)
- Clear message explaining what's blocking construction

### Requirement Consumption

On successful construction:
1. **Validate** all requirements again (both types)
2. **Consume** item requirements ONLY:
   - Remove gold from gameState.gold
   - Remove items from stashManager
   - Facility requirements are NOT consumed (just checked)
3. **Build** facility: Set facility.level = 1
4. **Update** storage: Set up facility storage if applicable
5. **Refresh** UI: Show facility in sidebar menu

## Sidebar Visibility & Ordering Rules

### Level-Based Visibility

**Level 0 (Unbuilt):** Completely hidden from sidebar
- Not shown in navigation menu
- Available only in Construction Mode
- Player must construct to Level 1 to make visible

**Level ≥ 1 (Built):** Visible in sidebar
- Rendered in **exact CSV row order** from `facility.csv`
- Not sorted alphabetically or by ID
- Can be selected and viewed

### CSV-Based Sidebar Ordering

Facility buttons appear in sidebar in the **exact order** they appear in `data/facilities/facility.csv`:
```csv
# facility.csv row order (determines sidebar order)
stash,Stash,stash
lodge,Worker's Lodge,emply
processing,Processing Plant,process
trading,Trading Post,trade
farm,Farm,product
mine,Mine,product
ranch,Ranch,product
fishery,Fishery,product
```

**Sidebar order (only if Level ≥ 1):**
1. Stash
2. Lodge
3. Processing
4. Trading
5. Farm
6. Mine
7. Ranch
8. Fishery

## Construction Grid Sorting

### Sorting Priority

The construction grid automatically sorts unbuilt facilities from highest to lowest buildability:

**Priority 1: Fully Buildable**
- **Condition:** Prerequisites met AND materials available
- **Position:** First (top of grid)
- **Visual:** Normal panel, GREEN "Construct" button
- **Player Action:** Can construct immediately

**Priority 2: Materials Missing**
- **Condition:** Prerequisites met BUT materials unavailable
- **Position:** Second (middle of grid)
- **Visual:** Normal panel, GRAY "Construct" button
- **Player Action:** Need to gather materials before construction

**Priority 3: Locked**
- **Condition:** Prerequisites NOT met
- **Position:** Third (bottom of grid)
- **Visual:** Grayed out panel, disabled button
- **Player Action:** Need to meet facility prerequisites first

### Implementation Details

**Sorting Method:** `UIBuilder.sortFacilitiesByAvailability(facilities)`

For each unbuilt facility:
1. Get construction cost details using `upgradeSystem.getConstructionCostDetails(facilityId)`
2. Check prerequisites: `costDetails.conditions.every(c => c.isSatisfied)`
3. Check materials: `costDetails.costs.every(c => c.isSufficient)`
4. Categorize into appropriate priority bucket
5. Return sorted array: [fullyBuildable, materialsMissing, locked]

**Execution Point:** Called in `buildConstructionGridUI()` immediately after fetching unbuilt facilities, before rendering panels.

**Re-sorting Trigger:** Grid is rebuilt with fresh sorting whenever:
- Player enters construction mode
- Player constructs a facility (grid refreshes automatically)
- UI updates on each game tick (if construction view is active)

## Add Facility Button Behavior

### Button States

#### **Hidden**
When there are NO unbuilt facilities (all Level ≥ 1):
- Button doesn't appear in sidebar
- All 8 facilities already built

#### **Idle (Dashed Border)**
When there ARE unbuilt facilities (any Level 0) but player lacks resources for all:
- Background: Transparent
- Border: 2px dashed #404040 (gray)
- Icon: Centered "+" symbol
- Color: #bdc3c7 (light gray)

**CSS:**
```css
.add-facility-btn {
    background-color: transparent;
    border: 2px dashed #404040;
    color: #bdc3c7;
}
```

#### **Ready (Solid Border + Green)**
When there ARE unbuilt facilities AND player can afford at least one:
- Background: rgba(46, 204, 113, 0.15) (light green)
- Border: 2px solid #2ecc71 (green)
- Icon: Centered "+" symbol
- Color: #2ecc71 (green)
- Shadow: Subtle green glow

**CSS:**
```css
.add-facility-btn.ready {
    background-color: rgba(46, 204, 113, 0.15);
    border: 2px solid #2ecc71;
    color: #2ecc71;
    box-shadow: 0 2px 6px rgba(46, 204, 113, 0.2);
}
```

### State Update Triggers

Button state is checked every game tick via `uiUpdater.updateUI()`:

```
gameLoop()
    ↓
uiUpdater.updateUI()
    ├─ updateHeaderStats() → Update gold display
    ├─ updateNavigationIndicators()
    └─ updateAddFacilityButtonState() ← Check if any facility is now buildable
        └─ navigationManager.updateAddFacilityButtonState()
            └─ canBuildAnyFacility() → Check Level 1 costs for all unbuilt
```

Updates triggered by:
- Facility production completing (items collected)
- Crafting completing (items created)
- Trading completing (items sold, gold gained)
- Any resource change via stash or gold

## Integration with Game Systems

### Sidebar Navigation (ui/navigationManager.js)

**Initialization (game start):**
```javascript
initializeNavigation() {
    // Only render facilities with level >= 1
    for (facility of facilityTypes) {
        if (gameState.facilities[facility.id].level >= 1) {
            createNavButton(facility)
        }
    }
    // Add construction button if unbuilt facilities exist
    updateAddFacilityButton()
}
```

**After Construction:**
```javascript
confirmConstruction() {
    upgradeSystem.constructFacility(facilityId)  // level 0 → 1
    navigationManager.initializeNavigation()     // Rebuild menu
    navigationManager.exitConstructionMode()     // Show new facility
}
```

### Upgrade System (systems/upgradeSystem.js)

**New Methods:**
- `canConstruct(facilityId)` - Uses same validation as upgrades
- `getConstructionCostDetails(facilityId)` - Returns Level 1 costs
- `constructFacility(facilityId)` - Uses same consume logic as upgrades

**Reuses Existing Logic:**
- `_normalizeRequirements()` - Handle requirement format
- `_checkRequirement()` - Validate item/facility requirements
- Cost lookup from `dataLoader.getUpgradeCost(facilityId, 1)`

### UI Systems (ui/uiBuilder.js, ui/uiUpdater.js)

**UI Builder:**
- `buildConstructionGridUI()` - Renders 3-column facility grid
- Each panel shows facility name, costs, construct button

**UI Updater:**
- `updateAddFacilityButtonState()` - Called every tick
- Updates button appearance based on `canBuildAnyFacility()`

## Workflow Example: Constructing Mine

### Scenario
Game starts fresh. Auto-unlock logic applies:
- Stash: No Level 1 requirements → Auto-unlock to Level 1
- All others: Have Level 1 requirements → Initialize at Level 0 (hidden)

**Step 1: Game Initialization (New Save)**
```
gameLoopManager.init()
    ↓
gameState.initializeState()
    ├─ Check Stash Level 1: Empty requirements → Initialize Stash at Level 1 ✓
    ├─ Check Lodge Level 1: Requires Stash Lv2 → Initialize at Level 0
    ├─ Check Processing Level 1: Requires Farm & Mine → Initialize at Level 0
    ├─ Check Trading Level 1: Requires Processing → Initialize at Level 0
    ├─ Check Farm Level 1: Requires Lodge → Initialize at Level 0
    ├─ Check Mine Level 1: Requires Lodge → Initialize at Level 0
    ├─ Check Ranch Level 1: Has requirements → Initialize at Level 0
    └─ Check Fishery Level 1: Has requirements → Initialize at Level 0
    ↓
navigationManager.initializeNavigation()
    ├─ Loop through facilityTypes in CSV order: [stash, lodge, processing, trading, farm, mine, ranch, fishery]
    ├─ Render in sidebar (CSV order):
    │   └─ Stash (Level 1) ✓
    ├─ Skip (all Level 0, hidden):
    │   └─ Lodge, Processing, Trading, Farm, Mine, Ranch, Fishery
    ├─ Check: Unbuilt facilities exist? Yes (7 facilities at Level 0)
    └─ Create: "Add Facility" button (dashed border - resources not yet available)
```

**Step 2: Player Progression (Simplified)**
```
Player gathers resources and progresses through game:
    ├─ Upgrade Stash to Lv2 (100g) → Lodge becomes available
    ├─ Construct Lodge Lv1 (requires Stash Lv2) → Can now construct Farm/Mine
    ├─ Construct Farm Lv1 (requires Lodge Lv1) → Farm production starts
    ├─ Construct Mine Lv1 (requires Lodge Lv1) ← WE WANT TO BUILD THIS
    │
    └─ Current State:
        - Built: Stash Lv1, Lodge Lv1, Farm Lv1
        - Level 0 (hidden): Mine, Ranch, Fishery, Processing, Trading
        - Player has gathered: 600 gold (starting 500 + production)
        - Player has gathered: 100 ore (from other sources)
        - Mine Level 1 cost: 500 gold + no item requirements
        - Ready to construct Mine!
```

**Step 3: Player Clicks "Add Facility" Button**
```
navigationManager.enterConstructionMode()
    ├─ getUnbuiltFacilities() → Filter Level 0 facilities in CSV order
    │   └─ [Lodge, Processing, Trading, Mine, Ranch, Fishery]
    │       (Note: Lodge might be Level 1 already in this scenario)
    ├─ buildConstructionGridUI()
    │   └─ For each unbuilt facility (Level 0):
    │       ├─ Get Level 1 costs
    │       ├─ Check availability: Can afford?
    │       └─ Render panel with green/gray "Construct" button
    └─ Show construction view (hide current facility view)

Display (3-column grid, facilities in CSV order, only Level 0 shown):
┌─────────────────────────────────────────────────┐
│ Facility Construction                 [Back]     │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────┐
│  │ Processing  │  │   Trading   │  │  Mine   │
│  │             │  │             │  │         │
│  │PREREQUISITES│ │PREREQUISITES│  │PRESET.  │
│  │Farm Lv1 (R) │  │Process (R)  │  │Lodge(G) │
│  │Mine Lv1 (R) │  │  Lv1        │  │         │
│  │             │  │             │  │REQUIRED │
│  │REQUIRED MAT.│ │REQUIRED MAT.│  │MATERIALS│
│  │[Construct]  │  │[Construct]  │  │Gold 500/│
│  │  (Gray)     │  │  (Gray)     │  │   600(G)│
│  │             │  │             │  │         │
│  │             │  │             │  │[Const]  │
│  │             │  │             │  │ (Green) │
│  └─────────────┘  └─────────────┘  └─────────┘
│                                                 │
│  ┌─────────────┐  ┌─────────────┐             │
│  │   Ranch     │  │  Fishery    │             │
│  │ (GRAYED)    │  │             │             │
│  │PREREQUISITES│  │PREREQUISITES│             │
│  │Cooked x2(R) │  │Canned x2(R) │             │
│  │             │  │             │             │
│  │REQUIRED MAT.│  │REQUIRED MAT.│             │
│  │[Construct]  │  │[Construct]  │             │
│  │  (Gray)     │  │  (Gray)     │             │
│  └─────────────┘  └─────────────┘             │
│                                                 │
└─────────────────────────────────────────────────┘

(G) = GREEN (met)  |  (R) = RED (not met)
GRAYED = Prerequisite missing, entire panel disabled
```

(Note: Facilities displayed in CSV row order; only Level 0 facilities shown)

**Step 4: Player Clicks "Construct" on Mine Panel**
```
showConstructionConfirmation('mine')
    ├─ getConstructionCostDetails('mine')
    │   └─ Level 1 requirements: Lodge Lv1 (facility prerequisite)
    ├─ Validate requirement: Lodge >= 1? Yes ✓
    ├─ Render modal:
    │   - Mine
    │   - Requires: Lodge Level 1 or higher
    │   - Status: Available ✓
    │   - [Construct] button (green, enabled)
    └─ Show modal
```

**Step 5: Player Clicks "Construct" in Modal**
```
confirmConstruction()
    ├─ gameLoopManager.upgradeSystem.constructFacility('mine')
    │   ├─ Validate: Level 0? Yes ✓
    │   ├─ Validate requirements: Lodge >= 1? Yes ✓
    │   ├─ Consume: No items/gold (facility requirement only)
    │   ├─ Build: facilities.mine.level = 1
    │   └─ Set up storage: Initialize mine storage (10 slots)
    ├─ navigationManager.initializeNavigation()
    │   ├─ Now renders in CSV order: Stash, Lodge, Mine, (others based on level)
    │   └─ Add Facility button still shows (Processing, Trading, Ranch, Fishery unbuilt)
    ├─ navigationManager.exitConstructionMode()
    │   └─ selectFacility('mine') ← Switch to Mine view
    └─ uiUpdater.updateUI() ← Refresh all displays
```

**Step 6: Mine is Ready!**
- Player remains in Construction View
- Mine panel is removed (no longer available for construction)
- Player sees updated grid with only unbuilt facilities (Ranch, Fishery, Processing, Trading, etc.)
- "Add Facility" button still shows remaining unbuilt facilities
- Player can immediately construct another facility or click [Back] to exit to sidebar

## CSS Styling

### Classes

**Add Facility Button:**
- `.add-facility-btn` - Base button
- `.add-facility-btn.ready` - Green state when buildable
- `.add-facility-icon` - The "+" symbol

**Construction Grid:**
- `.construction-grid` - 3-column grid container
- `.construction-panel` - Individual facility panel
- `.construction-panel.disabled` - Grayed out panel when prerequisites missing
- `.construction-panel-header` - Facility name section
- `.construction-panel-name` - Facility name text
- `.construction-panel-costs` - Cost section
- `.construction-section-label` - Section header ("Prerequisites" or "Required Materials")
- `.construction-panel-cost-item` - Individual cost line
- `.construction-panel-cost-item.sufficient` - Green (have enough)
- `.construction-panel-cost-item.insufficient` - Red (not enough)
- `.construction-panel-actions` - Button section
- `.btn-construct` - Construct button
- `.btn-construct:disabled` - Grayed out button

### Responsive Design

```css
/* Desktop (3 columns) */
@media (min-width: 1201px) {
    .construction-grid {
        grid-template-columns: repeat(3, 1fr);
    }
}

/* Tablet (2 columns) */
@media (max-width: 1200px) {
    .construction-grid {
        grid-template-columns: repeat(2, 1fr);
    }
}

/* Mobile (1 column) */
@media (max-width: 768px) {
    .construction-grid {
        grid-template-columns: 1fr;
    }
}
```

## Performance Considerations

- **Construction Validation**: O(1) per facility (single level check + cost lookup)
- **Grid Building**: O(n) where n = number of unbuilt facilities (typically 8)
- **Button State Update**: O(n) where n = unbuilt facilities, happens every tick
  - Optimization: Only check if stash changed or gold changed
- **No Grid Resize**: Construction doesn't resize grids (level is always 1)

## Modals

### Construction Confirmation Modal

**ID:** `#constructionConfirmModal`

**Elements:**
- `.modal-header h2` - Title "Construct Facility : [Facility Name]" (dynamically updated)
- `.construction-costs-section` - Cost breakdown with facility prerequisites and item costs
- `.cost-item` - Individual cost line (sufficient/insufficient state)
- `.btn-secondary` - Cancel button
- `.btn-primary.btn-confirm` - Construct button

**Title Format:**
- Format: `Construct Facility : [Facility Name]`
- Example: "Construct Facility : Processing Plant"
- Updated dynamically by `showConstructionConfirmation()`

**Interaction:**
- Click background → Close modal, return to Construction View
- Click [Cancel] → Close modal, return to Construction View
- Click [Construct] → Execute construction, stay in Construction View with updated grid

**Post-Construction Behavior:**
- After successful construction, modal closes automatically
- Construction View remains active with rebuilt grid
- User can immediately construct another facility or click [Back] to exit

## Integration Checklist

- ✓ Filter sidebar to show only level ≥ 1 facilities
- ✓ Add "Add Facility" button to sidebar footer
- ✓ Style button with dashed border (idle) and solid green (ready)
- ✓ Create construction view with 3-column grid
- ✓ Show facility panels with costs and construct buttons
- ✓ Create confirmation modal
- ✓ Add construction methods to upgradeSystem
- ✓ Add UI builder for construction grid
- ✓ Add handlers to gameLoopManager
- ✓ Update button state every tick
- ✓ Exit construction mode after build
- ✓ Refresh navigation to show new facility
- ✓ Test end-to-end workflow

## Future Enhancements

1. **Facility Prerequisites**: Gate construction on other facilities
   - Example: "Fishery requires Farm level 2"
   - Uses existing facility requirement system

2. **Visual Indicators**: Show locked facilities with icons
   - Gray out unbuilt facilities
   - Show "Requires Farm Lv2" text

3. **Construction Progress**: Add animation/timer
   - Construction takes time (seconds/minutes)
   - Show progress bar in construction mode

4. **Bulk Construction**: Construct multiple facilities at once
   - Select multiple unbuilt facilities
   - Execute batch construction

5. **Resource Requirements Scaling**: Different costs per facility
   - Mine vs Farm might have different costs
   - Encourages strategic building order
