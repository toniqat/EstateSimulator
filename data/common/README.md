# Game Configuration (`data/common/`)

## Overview

This directory contains **global game configuration** values that define core gameplay mechanics and initial state. These settings control fundamental game behavior and are applied to all game instances.

## File Dictionary

| File | Purpose |
|------|---------|
| `gameConfig.csv` | Global configuration constants for gameplay (initial resources, costs, intervals) |

## Detailed File Descriptions

### `gameConfig.csv`
**Purpose:** Defines all global game configuration parameters in key-value pairs.

**Columns:**
- `key` - Configuration parameter name
- `value` - Configuration parameter value

**Current Configuration Values:**

| Key | Value | Purpose |
|-----|-------|---------|
| `initial_gold` | 0 | Starting gold when a new game begins |
| `min_game_speed` | 1 | Minimum game speed multiplier (1x speed) |
| `max_game_speed` | 64 | Maximum game speed multiplier (64x speed) |

## How to Modify

1. **Edit** `gameConfig.csv` in a text editor or spreadsheet application
2. **Add or modify** key-value pairs as needed
3. **Run** `BuildData.bat` in the project root to regenerate `gameData.js`
4. **Reload** the game in your browser to see changes

**Example:** To change starting gold to 1000, modify the `initial_gold` row:
```csv
initial_gold,1000
```

## Integration Points

- **Core Systems:** Used by `core/gameState.js` during game initialization
- **Data Access:** Values are accessed via `gameData.config` object after compilation
- **Build Pipeline:** Auto-generated into `data/gameData.js` by `BuildData.bat`

## Design Notes

- Configuration values are meant to be **tunable parameters** for game balance
- Adding new configuration keys is as simple as adding a new row to `gameConfig.csv`
- All values are strings in the CSV but converted to appropriate types during build
- This centralized configuration approach helps maintain consistency across the entire game
