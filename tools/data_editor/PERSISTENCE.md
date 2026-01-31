# Data Editor Persistence System

## Overview

The Data Editor now includes a sophisticated persistence system that automatically remembers the last loaded folder path across browser sessions. This feature uses modern web APIs with graceful fallbacks to ensure compatibility across different browsers.

## Features

### ✓ Persistent Directory Access
- **Auto-load Last Folder**: Opens the previously selected data directory automatically when you return to the editor
- **No Manual Selection Required**: After the first time, you won't need to re-select the folder on each visit
- **Session Continuity**: Maintains folder access even after closing and reopening the browser

### ✓ Intelligent Storage Strategy
- **Primary Storage**: IndexedDB for robust, file system handle persistence
- **Fallback Storage**: localStorage for browser compatibility
- **Automatic Upgrade**: Uses the most capable approach available in your browser

### ✓ Write Restrictions
- **Secure Operation**: All file writes are restricted to the selected directory only
- **User Control**: You explicitly grant permission for each directory via browser picker
- **No Arbitrary Access**: The application cannot access files outside the selected folder

## Technical Architecture

### Storage Hierarchy

```
┌─────────────────────────────────────────────┐
│     EditorPersistence Module                 │
├─────────────────────────────────────────────┤
│                                              │
│  ┌─ Try IndexedDB First (Primary)          │
│  │  ├─ Stores directory FileSystemHandle   │
│  │  ├─ Stores folder metadata              │
│  │  └─ Full file system integration        │
│  │                                          │
│  └─ Fallback to localStorage               │
│     ├─ Stores folder name & timestamp      │
│     └─ Limited persistence (metadata only) │
│                                              │
└─────────────────────────────────────────────┘
```

### Components

#### 1. **EditorPersistence** (`js/editorPersistence.js`)
Core persistence module with:
- Browser capability detection
- IndexedDB initialization and management
- Directory handle storage/retrieval
- localStorage fallback support
- Permission verification

```javascript
const persistence = new EditorPersistence();
await persistence.initialize();
const dirHandle = await persistence.getDirectoryHandle();
```

#### 2. **FileExplorer Integration** (`js/fileExplorer.js`)
Enhanced to:
- Accept persistence module in constructor
- Use stored directory handles on startup
- Save directory handles after user selection
- Maintain backward compatibility

```javascript
const fileExplorer = new FileExplorer(container, header, persistence);
```

#### 3. **DataEditor Integration** (`js/dataEditor.js`)
Main coordinator:
- Initializes persistence on app load
- Attempts auto-loading stored folder
- Displays browser support status
- Manages file operations with stored handles

## Browser Support

### Full Support (✓)
- **Chrome 86+** - Full persistent directory access
- **Edge 86+** - Full persistent directory access
- **Opera 72+** - Full persistent directory access

### Partial Support (⚠)
- **Firefox 111+** - Limited; prompt every 30 days
- **Brave Browser** - Full support (Chromium-based)

### Limited/No Support (✗)
- **Safari** - Not supported (as of Feb 2025)
- **Internet Explorer** - Not supported
- **Mobile Safari** - Not supported

### Support Indicator
The header displays a visual indicator of your browser's capabilities:
- **✓ Green**: Full persistent directory access enabled
- **⚠ Yellow**: Partial support; some limitations apply
- **✗ Red**: No persistent directory access

## How It Works

### Initial Load (First Time)
1. User opens the Data Editor
2. Editor initializes EditorPersistence
3. No stored folder found → User sees "Open a data directory" prompt
4. User clicks folder button → Browser file picker appears
5. User selects data directory
6. Folder handle saved to IndexedDB (+ localStorage as fallback)
7. Files load normally

### Subsequent Loads (Auto-Load)
1. User opens the Data Editor
2. Editor initializes EditorPersistence
3. Stored folder handle retrieved from IndexedDB
4. Browser verifies read permission is still valid
5. Directory loads automatically → No user action needed
6. Last viewed file restored if available
7. Last selected row restored if available

### Permission Expired or Revoked
If stored permissions are no longer valid (e.g., after 30 days in Firefox, or user revoked access):
1. User opens the Data Editor
2. Editor detects stored folder but can't verify valid permissions
3. Toast notification appears: "Your saved folder access expired. Grant permission to restore access. [Restore]"
4. User clicks the "Restore" button
5. Browser shows permission request dialog
6. User grants permission
7. Folder loads automatically
8. Handle remains stored for next session

### Manual Restore Flow
If auto-restore fails or user prefers manual approach:
1. Click the folder button (📁) in the header
2. Browser shows file picker
3. User re-selects the same folder
4. Folder loads and permissions are renewed
5. Handle is updated in storage

## API Reference

### EditorPersistence Class

#### Constructor
```javascript
const persistence = new EditorPersistence();
```

#### Methods

**initialize()**
```javascript
await persistence.initialize();
```
Sets up IndexedDB. Call once on app startup.

**saveDirectoryHandle(dirHandle)**
```javascript
await persistence.saveDirectoryHandle(fileSystemDirectoryHandle);
```
Saves a directory handle for future sessions.

**getDirectoryHandle()**
```javascript
const dirHandle = await persistence.getDirectoryHandle();
if (dirHandle) {
    // Directory handle is valid and ready to use
}
```
Retrieves the stored directory handle if still valid.

**requestDirectoryAccess()**
```javascript
const dirHandle = await persistence.requestDirectoryAccess();
```
Shows browser picker and saves the selected directory.

**hasStoredHandle()**
```javascript
const hasHandle = await persistence.hasStoredHandle();
if (hasHandle) {
    // A stored handle exists (but may need permission restoration)
}
```
Quick check to see if a stored handle exists without attempting to verify access.
Use this to determine if showing a "restore" option makes sense.

**restoreDirectoryHandleWithPermission()**
```javascript
const dirHandle = await persistence.restoreDirectoryHandleWithPermission();
if (dirHandle) {
    // Successfully restored access to previously saved folder
}
```
Attempts to restore permission for a stale handle. Must be called with user activation
(e.g., from a button click). Shows browser permission dialog. Returns handle if successful.

**isStoredHandleValid()**
```javascript
const isValid = await persistence.isStoredHandleValid();
```
Checks if stored handle has valid permissions.

**getBrowserSupport()**
```javascript
const support = persistence.getBrowserSupport();
console.log(support.supportsDirectoryPersistence); // true/false
```
Returns object with support status for each API.

**clearAll()**
```javascript
await persistence.clearAll();
```
Removes all stored data (for debugging or user reset).

## Data Storage

### IndexedDB Structure
```
Database: EstateSimulatorEditor (version 1)

Object Stores:
├── folderHandles
│   └── Key: "lastFolder"
│       ├── handle: FileSystemDirectoryHandle
│       ├── name: string (folder name)
│       └── timestamp: number (milliseconds)
│
└── settings
    └── Key: "lastFolder"
        ├── name: string
        └── timestamp: number
```

### localStorage Structure
```javascript
localStorage['editorPersistence_lastFolder'] = {
    name: "data",           // Folder name
    timestamp: 1706234567  // Last saved timestamp
}
```

## Usage Examples

### Example 1: Auto-Load on Startup
```javascript
class DataEditor {
    async init() {
        // Initialize persistence
        this.persistence = new EditorPersistence();
        await this.persistence.initialize();

        // Try to auto-load last folder
        const dirHandle = await this.persistence.getDirectoryHandle();
        if (dirHandle) {
            this.fileExplorer.dirHandle = dirHandle;
            await this.fileExplorer.loadDirectory();
        }
    }
}
```

### Example 2: Save New Directory Selection
```javascript
async function selectNewFolder() {
    const dirHandle = await persistence.requestDirectoryAccess();
    if (dirHandle) {
        fileExplorer.dirHandle = dirHandle;
        await fileExplorer.loadDirectory();
    }
}
```

### Example 3: Check Browser Support
```javascript
const support = persistence.getBrowserSupport();
if (support.supportsDirectoryPersistence) {
    console.log("Your browser supports persistent folder access!");
} else if (support.fallbackAvailable) {
    console.log("Limited support available (using fallback)");
} else {
    console.log("Persistent folder access not available");
}
```

## Security & Permissions

### Security Model
1. **User Grants Permission**: Only the user can select which folder the app accesses
2. **Explicit Scope**: Access is limited to the selected directory and its contents
3. **No Elevation**: Application cannot request higher permissions than user granted
4. **Permission Verification**: Permissions are verified before each use
5. **Revocable**: User can revoke access anytime through browser settings

### Privacy
- Directory handles are stored locally in your browser
- No data is sent to servers
- No telemetry or tracking
- Handles are stored per-origin (per domain)

## Troubleshooting

### "File System Access API not supported"
- **Cause**: Your browser doesn't support the File System Access API
- **Solution**: Use Chrome, Edge, or Opera for full support
- **Fallback**: The editor still works, but won't remember the folder

### "Directory handle is no longer valid" / "Permission Expired"
- **Cause**: Permissions were revoked, expired (e.g., 30-day Firefox limit), or folder was moved
- **Solution 1**: Click the "Restore" button in the toast notification that appears on startup
- **Solution 2**: Click the folder button (📁) to manually re-select the directory
- **Prevention**: Keep the folder accessible at the same path
- **Note**: The app now automatically detects this case and offers one-click restoration

### "Cannot write to file"
- **Cause**: Write permissions were not granted
- **Solution**: Click the folder button and ensure you grant both read AND write permissions when prompted

### "Browser shows permission prompt every time"
- **Cause**: Normal behavior in some browsers (Firefox: every 30 days)
- **Solution**: Grant permission again; handle will be remembered
- **Note**: This is browser behavior, not an app limitation

## Performance

### Storage Size
- **IndexedDB**: ~1-2 KB per stored handle + metadata
- **localStorage**: ~200 bytes fallback data
- **Total**: Negligible impact on quota

### Load Time
- **Auto-load**: < 50ms typical
- **First-time folder access**: User wait time (browser picker delay)
- **Subsequent accesses**: Instant (cached handle)

## Implementation Notes

### For Developers

#### Integration Steps
1. Load `editorPersistence.js` before dependent modules
2. Instantiate `EditorPersistence` in main app controller
3. Call `initialize()` on startup
4. Pass persistence instance to FileExplorer
5. Update folder-selection logic to use persistence

#### Testing
```javascript
// Test persistence
const p = new EditorPersistence();
await p.initialize();

// Check browser support
const support = p.getBrowserSupport();
console.log('Support:', support);

// Test storage
await p.saveDirectoryHandle(dirHandle);
const retrieved = await p.getDirectoryHandle();
console.log('Handle retrieved:', retrieved !== null);

// Test clearance
await p.clearAll();
```

#### Debugging
Enable console logging to see persistence operations:
```javascript
// Monitor initialization
console.log('Persistence initialized');

// Monitor directory access
console.log('Directory handle:', dirHandle.name);

// Monitor storage
console.log('Data saved to:', useIndexedDB ? 'IndexedDB' : 'localStorage');
```

## Future Enhancements

Potential improvements:
- [ ] Support for multiple saved directories (quick-access list)
- [x] Permission restoration UI when handle becomes stale (completed Jan 2026)
- [ ] UI for managing stored directory permissions
- [ ] Directory change detection and refresh
- [ ] Per-directory file operation history

## References

- [File System Access API Spec](https://wicg.github.io/file-system-access/)
- [IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [Browser Compatibility](https://caniuse.com/native-filesystem-api)
