# Claude Development Guide - Estate Simulator

**Project:** A browser-based incremental/idle game where players manage an estate with workers, production facilities, trading, and crafting systems.

**Entry Point:** `index.html` (opens the game client)

---

## 🚨 CRITICAL WORKFLOW RULES (MANDATORY)

**You MUST follow these 3 rules in every session without exception:**

1. **SESSION INITIALIZATION:** At the start of EVERY task, read this `CLAUDE.md` first to map the project structure.
2. **DOCUMENTATION MAINTENANCE:** If you change code, you MUST update the relevant documentation. Global changes → `CLAUDE.md`, Feature changes → local `README.md`.
3. **NO SUMMARY FILES:** Do NOT generate summary.md or log files at the end of the session. Just verbally confirm completion.

---

## Quick Reference

| Task | File |
|------|------|
| Start playing | `index.html` |
| Edit game data | CSV files in `data/` |
| Rebuild game data | `BuildData.bat` |
| Fix game logic | `core/` or `systems/` |
| Fix UI issues | `ui/` |
| Fix styling | `css/` |

## Module Navigation

Use this Knowledge Map to quickly navigate the codebase by following links to detailed module guides:

| Module | Purpose | README |
|--------|---------|--------|
| **core/** | Game state, persistence, inventory | [core/README.md](core/README.md) |
| **systems/** | Game mechanics (production, workers, trading, crafting) | [systems/README.md](systems/README.md) |
| **ui/** | User interface rendering and interaction | [ui/README.md](ui/README.md) |
| **css/** | Stylesheets (design tokens, layouts, components) | [css/README.md](css/README.md) |
| **data/** | Game configuration and content (CSV format) | [data/README.md](data/README.md) |

### Data Subdirectories

Each subdirectory in `data/` contains CSV files for specific game systems:

| Directory | Content | README |
|-----------|---------|--------|
| `data/common/` | Global game configuration | [data/common/README.md](data/common/README.md) |
| `data/workers/` | Worker definitions, grades, levels | [data/workers/README.md](data/workers/README.md) |
| `data/facilities/` | Facility types, production areas, upgrades | [data/facilities/README.md](data/facilities/README.md) |
| `data/items/` | Item definitions, recipes, stacking rules | [data/items/README.md](data/items/README.md) |
| `data/trading/` | Trading regions, orders, pricing | [data/trading/README.md](data/trading/README.md) |

## How to Use This Knowledge Map

1. **Starting a task?** First identify the module: Are you fixing game logic (core/systems), UI (ui), styling (css), or game content (data)?
2. **Need module details?** Click the README link for that module to see file descriptions, data flow, and architecture patterns.
3. **Editing game content?** Look at [data/README.md](data/README.md) to understand CSV structure and rebuild steps.
4. **Fixing a specific file?** The folder README tells you that file's exact role and how it connects to other systems.

## Key Features Index

Complex features have dedicated documentation. **When working on these features, refer to these specific documents** for detailed architecture, mechanics, and integration points.

### Core Gameplay Systems (High Priority)

| Feature | Purpose | File |
|---------|---------|------|
| **Product Grid System** | Grid-based production area placement with worker assignment and collision detection | [docs/FEATURE_PRODUCT_GRID.md](docs/FEATURE_PRODUCT_GRID.md) |
| **Worker System** | Worker hiring, progression, leveling, and stat-based assignment to production areas | [docs/FEATURE_WORKER_SYSTEM.md](docs/FEATURE_WORKER_SYSTEM.md) |
| **Production System** | Resource generation from production areas with worker bonuses, timers, and facility storage | [docs/FEATURE_PRODUCTION_SYSTEM.md](docs/FEATURE_PRODUCTION_SYSTEM.md) |
| **Trading Post System** | Order generation, fulfillment, region progression, and gold-based economy | [docs/FEATURE_TRADING_POST_SYSTEM.md](docs/FEATURE_TRADING_POST_SYSTEM.md) |

### Resource & Progression Systems (Medium Priority)

| Feature | Purpose | File |
|---------|---------|------|
| **Upgrade System** | Facility progression through 5 levels with cost validation and capability scaling | [docs/FEATURE_UPGRADE_SYSTEM.md](docs/FEATURE_UPGRADE_SYSTEM.md) |
| **Facility Construction System** | Building new facilities from scratch with dedicated UI and cost validation | [docs/FEATURE_FACILITY_CONSTRUCTION.md](docs/FEATURE_FACILITY_CONSTRUCTION.md) |
| **Crafting System** | Recipe-based item transformation with facility level gates and batch processing | [docs/FEATURE_CRAFTING_SYSTEM.md](docs/FEATURE_CRAFTING_SYSTEM.md) |
| **Stash & Inventory System** | Central inventory management with smart stacking, facility storage, and item collection | [docs/FEATURE_STASH_INVENTORY_SYSTEM.md](docs/FEATURE_STASH_INVENTORY_SYSTEM.md) |

### Foundation Systems (Reference)

| Feature | Purpose | File |
|---------|---------|------|
| **Game State & Persistence** | Centralized state management, game loop orchestration, and localStorage save/load | [docs/FEATURE_GAME_STATE_PERSISTENCE.md](docs/FEATURE_GAME_STATE_PERSISTENCE.md) |

### How to Use Feature Documentation

**Workflow for Feature Changes:**
1. Identify which feature your task affects
2. Open the corresponding `docs/FEATURE_*.md` file
3. Review the **Architecture**, **Data Flow**, and **Integration with Game Systems** sections
4. Understand how the system connects to other systems
5. Make your changes following existing patterns
6. Update the documentation if architecture changes

---

## UI Standards

### Simplified Item View

**When to Use:** Display items in compact, icon-focused layouts where visual scanning is prioritized over detailed text. Used in facility storage, grids, and any inventory-style displays where space is limited.

**Specification:**
- **Container:** Grid/Flex slot with fixed aspect ratio (1:1)
- **Background:** Grade-based color (CSS class: `grade-{grade}`)
  - `grade-common`: Gray gradient (#95a5a6 → #7f8c8d)
  - `grade-uncommon`: Green gradient (#2ecc71 → #27ae60)
  - `grade-rare`: Blue gradient (#3498db → #2980b9)
  - `grade-epic`: Purple gradient (#9b59b6 → #8e44ad)
  - `grade-legendary`: Red gradient (#e74c3c → #c0392b) with glow effect
- **Icon:** First letter of item name (capitalized, white, bold, 1.8em, centered, text-shadowed)
- **Count:** Quantity displayed at bottom-right in semi-transparent badge
- **Text:** Item name is **NOT** displayed (key difference from detailed format)
- **Hover Effect:** Grade-specific glow shadow

**CSS Classes:**
- `.simplified-item-view` - Base container
- `.simplified-item-icon` - Icon element (first letter)
- `.simplified-item-quantity` - Quantity badge
- `.grade-{grade}` - Grade-based background (applies to `.simplified-item-view`)

**Implementation:**
Use the reusable function in `ui/uiBuilder.js`:
```javascript
const itemElement = this.uiBuilder.renderSimplifiedItem(item);
```

Where `item` is an object: `{item: itemData, itemId: string, quantity: number}`

**Example Usage Locations:**
- Production Facilities Storage panels (Farm, Mine, Ranch, Fishery)
- Trading Post reward/requirement displays
- Any future compact item grids

## Development Workflow

### For AI Assistants Working on This Project

**MANDATORY WORKFLOW (Required for every task):**

1. **Start of Session**: Read this `CLAUDE.md` to understand the high-level project structure
2. **Identify Feature**: Determine which game system(s) your task affects (check the **Key Features Index** above)
3. **Read Feature Documentation**: Open the corresponding `docs/FEATURE_*.md` file to understand:
   - System architecture and components
   - How data flows through the system
   - Integration points with other systems
   - Existing code patterns and conventions
4. **Read Module README**: Open the relevant module folder's `README.md` (core/, systems/, ui/, data/) for file descriptions and local patterns
5. **Make Changes**: Modify only the specific files needed, following existing patterns
6. **Update Documentation**: If you change architecture or add features, update the relevant documentation

**Example: Fixing a bug in worker assignment**
1. Check Key Features Index → Worker System
2. Read [docs/FEATURE_WORKER_SYSTEM.md](docs/FEATURE_WORKER_SYSTEM.md) → understand architecture
3. Read [systems/README.md](systems/README.md) → understand file organization
4. Read `systems/workerSystem.js` and `systems/workerGridSystem.js` → find issue
5. Make minimal fix to specific file
6. If architecture changed, update the feature doc

**Optimization Tip**: Skip dataLoader documentation (it's self-explanatory) and focus on the system that needs changes and its direct dependencies.

### Module Communication Patterns

- **gameLoopManager** (core/) orchestrates all systems and runs the game tick
- **UI systems** (ui/) read from gameState and stashManager, never directly modify state
- **Game systems** (systems/) only modify gameState and stash, never directly modify UI
- **Data systems** (data/) provide read-only access to configuration and items

## Important Development Notes

- **Do NOT generate markdown summary files** at the end of every conversation session
- **Always use relative paths** when creating new files to maintain project structure
- **Follow existing patterns** in each module—consistency matters for team development
- **Keep modules focused**—add new functionality to the most relevant existing module or create a new focused system module
- **Data changes require rebuild:** After editing CSV files, run `BuildData.bat` to regenerate `gameData.js`

## Version History

- **Documentation Refactoring (Jan 2026)**: Restructured documentation to follow Single Responsibility Principle. Moved CSV workflow to [data/README.md](data/README.md) and Product Grid system details to [docs/FEATURE_PRODUCT_GRID.md](docs/FEATURE_PRODUCT_GRID.md). Added CRITICAL WORKFLOW RULES and Key Features Index.
- **Documentation Refactoring (Jan 2026)**: Created comprehensive Knowledge Map with module-specific READMEs and data subdirectory documentation
- **Product Grid System Implementation (Jan 2026)**: Added grid-based production area placement with collision detection and drag-and-drop UI
- **Refactoring Complete (Jan 2026)**: Split monolithic game.js into functional modules across core/, systems/, and ui/ directories. Each folder now contains a README.md for quick reference.
