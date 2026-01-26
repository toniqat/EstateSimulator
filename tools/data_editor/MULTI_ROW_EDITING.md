# Multi-Row Editing & Complex Data Locking

## Overview

The Data Editor now supports advanced multi-row editing with specialized handling for complex data types (JSON/Array fields).

## Features

### 1. Multi-Row Editing

**How it works:**
- Select multiple rows in the middle pane using:
  - **Click** - Single select
  - **Ctrl+Click** (or Cmd+Click on Mac) - Toggle individual selection
  - **Shift+Click** - Select range
  - **Checkbox** - Toggle individual row selection

- When multiple rows are selected, the inspector shows all selected rows' data
- **Changes apply to all selected rows simultaneously**

**Behavior by field type:**
- **Simple fields** (Text, Number, Enum): Can edit directly; change applies to all rows
- **Complex fields** (JSON): Locked by default; use unlock toggle to enable editing

### 2. Complex Data Locking (JSON/Array Fields)

For JSON and Array fields with **mixed values** across selected rows, an "Unlock" toggle appears.

#### Default State: LOCKED
- **Toggle:** Unchecked (Off)
- **Display:** Shows `<Mixed Values - Unlock to edit>` message
- **Behavior:** Field cannot be edited
- **Purpose:** Prevents accidental bulk changes to structurally different data

#### Unlocked State
- **Toggle:** Checked (On)
- **Display:** Shows editor with the **top-most selected row's** data
- **Behavior:** Edit the data; changes apply to all selected rows
- **Note:** A message shows how many rows are selected for context

### 3. Form View vs Table View

#### Form View (Default)
- Shows unlock toggles **below each field label**
- One field per section
- Better for deep inspection and editing
- Unlock toggles only appear for JSON fields with mixed values

#### Table View
- Shows unlock toggles **at the top** in a collapsible section
- All columns visible at once
- Better for bulk editing across many fields
- Only JSON fields with mixed values show toggles

## Usage Examples

### Example 1: Bulk Update Enum Field
1. Select multiple workers (Shift+Click to select range)
2. Change "Grade" dropdown - applied to all selected workers immediately

### Example 2: Carefully Edit Mixed JSON Data
1. Select 3 facilities with different storage configurations
2. See "Storage" field shows `<Mixed Values - Unlock to edit>`
3. Click "Unlock (Edit from top row)"
4. Edit the top facility's storage config
5. Changes apply to all 3 facilities

### Example 3: Table View for Multiple Changes
1. Click "Table View" button
2. Select multiple rows
3. If JSON columns have mixed values, unlock toggles appear at top
4. Edit simple columns directly
5. For JSON columns, check the unlock toggle to enable row-by-row editing

## Implementation Details

### Key Classes & Methods
- **DataInspector._updateField()** - Updates field value across all selected rows
- **DataInspector.lockedFields** - Set tracking which JSON fields are currently locked
- **DataInspector._renderLockToggle()** - Renders unlock checkbox for form view
- **DataInspector._getJsonHeadersWithMixedValues()** - Identifies which fields need toggles

### CSS Classes
- `.inspector-field-lock-toggle` - Toggle container in form view
- `.inspector-field-lock-label` - Label and checkbox styling
- `.inspector-table-toggles` - Toggle section in table view
- `.inspector-field-note` - Note displayed when editing mixed values

### Data Flow
1. User selects multiple rows → `onSelectionChanged` fires
2. Inspector loads selected rows and displays fields
3. For JSON fields with mixed values → Toggle appears
4. User checks toggle → `lockedFields.delete(header)` → Re-render with editor
5. User edits data → `_updateField()` → Updates all selected rows
6. Data change event fires → File marked as modified

## Keyboard Shortcuts
- **Ctrl+S** - Save current file
- **Ctrl+Shift+S** - Save all modified files

## Best Practices

1. **Always check the selection count** - Look at the row count display to confirm how many rows you're editing
2. **Review unlocked mixed values carefully** - When editing mixed JSON, you're viewing the first selected row's data
3. **Use Table View for comparing values** - The table view makes it easier to see differences before unlocking
4. **Lock JSON fields when done** - Toggle off to prevent accidental edits to mixed values

## Technical Notes

### Why Lock JSON Fields?
JSON/Array fields often represent complex nested data structures. When multiple rows have different structures, editing becomes risky because:
- Applying one row's structure to all rows might break other rows
- The UI can't easily show which changes affect which rows
- The lock prevents bulk mistakes while still allowing intentional edits

### How Selections are Ordered
Selected rows maintain the order they were added to the selection, with "top-most row" referring to the first selected row in this order.

### Lock State Persistence
- Lock states reset when switching to a different CSV file
- Lock states reset when clearing the selection
- Lock states are preserved during view toggling (Form ↔ Table)
