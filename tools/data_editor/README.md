# Estate Simulator - Data Editor

A powerful, browser-based CSV editor for managing game configuration data. Edit game content without needing external tools.

## Quick Start

1. Open `index.html` in a modern browser (Chrome, Edge, or Opera)
2. Click the **📁** button to select your `data/` directory
3. CSV files appear in the left panel
4. Select a file to view and edit rows
5. Use **Ctrl+S** to save changes

## Features

### ✨ Core Functionality
- **CSV Editing**: View, add, delete, and modify CSV rows
- **Type Inference**: Automatic detection of data types (string, number, enum, JSON)
- **Multi-File Editing**: Work with multiple files simultaneously via tabs
- **Search**: Find rows by ID quickly
- **Undo-Friendly**: All changes tracked and easy to revert

### 📁 Persistent Folder Access
- **Auto-Load**: Remembers your data directory across sessions
- **No Re-Selection**: Open the editor and your folder loads automatically
- **Browser Support**: Works in Chrome, Edge, and other modern browsers
- **Security**: You control what folder the app can access

For detailed persistence documentation, see [PERSISTENCE.md](PERSISTENCE.md).

### 👀 Data Views
- **Form View**: Edit each field as a form (default)
- **Table View**: See all columns in a spreadsheet-like layout
- **JSON View**: Edit JSON fields directly (for complex data)

### ⌨️ Keyboard Shortcuts
| Shortcut | Action |
|----------|--------|
| `Ctrl+S` | Save current file |
| `Ctrl+Shift+S` | Save all modified files |
| `Arrow Keys` | Navigate rows |
| `Enter` | Edit selected field |

## UI Overview

```
┌─────────────────────────────────────────────────────────────┐
│  Estate Simulator - Data Editor              [Support ✓]    │
├──────────────────┬──────────────┬────────────────────────────┤
│                  │              │                             │
│  File Explorer   │  Row List    │  Inspector                  │
│                  │   (Rows)     │   (Field Details)           │
│  📁 data/        │              │                             │
│   ├─ common/    │ [farmer_1]   │ Name: farmer_1              │
│   ├─ facilities│ [farmer_2]   │ ┌──────────────────────┐    │
│   ├─ items/    │ [farmer_3]   │ │ Description:         │    │
│   ├─ workers/  │              │ │ [text field]         │    │
│   └─ trading/  │              │ │ ┌──────────────────┐ │    │
│                 │              │ │ │ Change Type...   │ │    │
│                 │              │ └──────────────────────┘    │
│                 │              │                             │
│                 │              │ [Table View] [+ Add Col]   │
└──────────────────┴──────────────┴────────────────────────────┘
```

## Editing Data

### Edit a Field
1. Click a row in the row list
2. Click the field in the inspector
3. Type new value
4. Changes are marked with ⚠ indicator

### Add a Row
1. Click **+** button in row list header
2. New row appears with default values
3. Click fields to edit
4. Save with Ctrl+S

### Delete a Row
1. Select row(s) in the row list
2. Click **Delete** button
3. Confirm deletion
4. Save with Ctrl+S

### Add a Column
1. Click **+ Add Col** in inspector header
2. Enter column name and select type
3. Column added to all rows with default values
4. Save with Ctrl+S

## Data Types

The editor automatically detects and handles different data types:

| Type | Example | Editing |
|------|---------|---------|
| **String** | `"wooden_sword"` | Text input |
| **Number** | `42` | Number input with validation |
| **Enum** | `"common"` | Dropdown with options |
| **JSON** | `{"min": 5, "max": 10}` | JSON editor with validation |

## After Editing Data

### Rebuild Game Data
After editing CSV files, you must rebuild the compiled game data:

**Windows:**
```bash
BuildData.bat
```

**PowerShell:**
```powershell
.\build_game_data.ps1
```

This compiles CSV files into `gameData.js` for the game to use.

## Workspace Structure

```
tools/data_editor/
├── index.html                    Main editor UI
├── PERSISTENCE.md                Folder persistence system docs
├── README.md                      This file
├── css/
│   └── editor.css               Editor stylesheet
└── js/
    ├── editorPersistence.js      Folder persistence system
    ├── dataEditor.js            Main application controller
    ├── fileExplorer.js          File browser
    ├── tabManager.js            Multi-file tab system
    ├── rowList.js               Row selection UI
    ├── dataInspector.js         Field editing interface
    ├── csvParser.js             CSV parsing/serialization
    ├── typeInference.js         Type detection system
    ├── jsonRenderer.js          JSON field visualization
    └── uiComponents.js          Reusable UI utilities
```

## Technical Details

### Storage Location
All file writing is restricted to:
- Your selected data directory and its subdirectories
- No access outside this scope

### Browser Requirements

**Full Support:**
- Chrome 86+
- Edge 86+
- Opera 72+

**Limited Support:**
- Firefox 111+ (permission prompt every 30 days)

**Not Supported:**
- Safari
- Internet Explorer

Check the support indicator (✓/⚠/✗) in the header for your browser.

### Architecture

The data editor uses a modular architecture:

```javascript
// Core components
EditorPersistence     // Manages folder access and storage
FileExplorer          // Displays file tree
RowList              // Shows CSV rows
DataInspector        // Field editing
TabManager           // Multi-file support
DataEditor           // Main orchestrator
```

## Development

### Adding Features
1. Implement in relevant module (see js/ directory)
2. Add keyboard shortcuts in `dataEditor.js` if needed
3. Update UI components in `uiComponents.js`
4. Test in browser with real CSV files

### Debugging
Open browser DevTools (F12) and check console for:
- Persistence initialization status
- File loading operations
- Type inference results
- Save/load errors

Enable verbose logging:
```javascript
console.log = (...args) => {
    console.info('[DataEditor]', ...args);
};
```

## Troubleshooting

### Folder not remembered
- Check browser console (F12)
- Verify File System Access API is supported
- Try Firefox or Chrome
- See [PERSISTENCE.md](PERSISTENCE.md) for details

### Can't edit JSON fields
- Ensure JSON is valid (use JSON validator if unsure)
- Check data types were inferred correctly
- Try switching to JSON view

### Changes won't save
- Verify write permissions were granted
- Check console for error messages
- Ensure CSV file isn't corrupted
- Try selecting folder again

### Performance issues
- Close unused tabs
- Reduce number of rows loaded at once
- Check browser resources (DevTools)

## Tips & Tricks

- **Quick Search**: Use Ctrl+F in row list to find by ID
- **Batch Edit**: Select multiple rows, then edit in inspector
- **Type Override**: Click field type indicator to change type manually
- **JSON Formatting**: JSON editor auto-formats on save
- **Keyboard Navigation**: Use arrow keys to move between rows

## See Also

- [PERSISTENCE.md](PERSISTENCE.md) - Detailed folder persistence system documentation
- [Estate Simulator Main Docs](../../CLAUDE.md) - Game architecture
- [Data Format Guide](../../data/README.md) - CSV structure reference

## License

Part of Estate Simulator project.
