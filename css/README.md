# Stylesheet Architecture (`css/`)

## Overview

This directory contains a **modular CSS architecture** organized by functionality and concern. The stylesheets are split into 6 focused, maintainable CSS files. Each file has a specific responsibility, making the stylesheets easy to modify, scale, and maintain.

All CSS files are imported into `index.html` in the correct loading order.

## File Dictionary

| File | Purpose | Scale |
|------|---------|-------|
| `reset.css` | Browser reset and base element styles | ~16 lines |
| `variables.css` | CSS custom properties (design tokens) for colors, spacing, typography | ~84 lines |
| `layout.css` | Grid/flexbox layout structure for major page sections | ~643 lines |
| `components.css` | Reusable UI component styles (buttons, panels, navigation) | ~500 lines |
| `animations.css` | Keyframe animations and transition effects | ~85 lines |
| `facilities.css` | Facility-specific styles (grids, panels, stash, production areas) | ~4,779 lines |

## Detailed File Descriptions

### `reset.css`
**Purpose:** Removes browser default styles and establishes consistent baseline styling.

**Responsibilities:**
- Reset all margins, padding, and borders to 0
- Set `box-sizing: border-box` for predictable element sizing
- Define base body styles (font-family, background color, text color, line-height)
- Establish visual baseline for all elements

**Contents:**
```css
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    background-color: #1a1a1a;  /* Very dark background */
    color: #e0e0e0;             /* Light gray text */
    line-height: 1.6;           /* Readable line spacing */
}
```

**Design Principle:** Normalize approach ensures consistent rendering across all browsers and prevents style surprises from browser defaults.

---

### `variables.css`
**Purpose:** Central repository for all **design tokens** (CSS custom properties/variables).

**Variable Categories:**

#### Primary Color Palette
- `--color-primary` (#3498db) - Main brand blue
- `--color-primary-dark` (#2980b9) - Darker blue for hover
- `--color-primary-light` (#5dade2) - Lighter blue for highlights

#### Status Colors
- `--color-success` (#2ecc71) - Green for positive feedback
- `--color-warning` (#f39c12) - Orange for warnings
- `--color-danger` (#e74c3c) - Red for errors/destructive actions
- `--color-danger-dark` (#c0392b) - Darker red for hover

#### Background Colors
- `--bg-dark` (#1a1a1a) - Main background
- `--bg-darker` (#0d0d0d) - Darker areas/text
- `--bg-panel` (#252525) - Panel/card background
- `--bg-panel-alt` (#2a2a2a) - Alternate panel background
- `--bg-hover` (#313131) - Hover state background

#### Text Colors
- `--text-primary` (#e0e0e0) - Main body text
- `--text-secondary` (#bdc3c7) - Secondary text
- `--text-muted` (#95a5a6) - Muted/disabled text
- `--text-success` (#2ecc71) - Success text
- `--text-warning` (#f39c12) - Warning text

#### Border & Decorative Colors
- `--border-color` (#404040) - Main border color
- `--border-color-light` (#555) - Lighter borders
- `--gradient-header` - Linear gradient for header background

#### Item Grade/Rarity Colors
```
Grade        Color       Dark Variant  Purpose
Common       #95a5a6     #7f8c8d       Gray - basic items
Uncommon     #3498db     #2980b9       Blue - improved items
Rare         #9b59b6     #8e44ad       Purple - powerful items
Epic         #f39c12     #e67e22       Orange - very rare items
Legendary    #e74c3c     #c0392b       Red - ultimate items
```

#### Typography
- `--font-family` - 'Segoe UI' (professional sans-serif)
- `--font-size-base` (0.9em), sm (0.85em), lg (1.1em), xl (1.3em)
- `--font-size-h1` (2.5em), h2 (1.8em), h3 (1.1em)

#### Spacing Scale (Consistent & Composable)
```
xs:  4px   (micro-spacing)
sm:  8px   (small padding)
md:  12px  (default padding)
lg:  15px  (large padding)
xl:  20px  (extra large)
xxl: 30px  (section padding)
```

#### Border Radius Scale
```
sm: 3px    (subtle rounding)
md: 4px    (default)
lg: 6px    (noticeable rounding)
xl: 8px    (very round corners)
```

#### Shadow Effects
- `--shadow-sm` - Subtle small shadow (2px offset)
- `--shadow-md` - Medium shadow (4px offset)
- `--shadow-lg` - Large shadow with blue tint
- `--shadow-primary` - Glowing blue shadow effect

#### Transition Timings
- `--transition-fast` (0.2s ease) - Quick interactions (hover)
- `--transition-normal` (0.3s ease) - Standard animations
- `--transition-slow` (0.5s ease) - Cinematic transitions

**Usage Pattern:** All CSS files reference these variables for consistency:
```css
.button {
    background-color: var(--color-primary);
    padding: var(--spacing-md);
    border-radius: var(--radius-md);
    transition: all var(--transition-fast);
    box-shadow: var(--shadow-md);
}
```

**Benefits:** Changing a single variable propagates across all components—enables rapid theming changes or brand updates.

---

### `layout.css`
**Purpose:** Defines **page structure and major layout containers**.

**Key Layout Components:**

#### Main Container
- Flex column layout (vertical stacking)
- Full viewport height (100vh)
- Max width 1600px for desktop
- Auto margins for center alignment

#### Header
- Gradient background (`--gradient-header`)
- Flex row with space-between alignment
- Contains game title and game stats
- Blue bottom border (3px solid #3498db)

#### Navigation/Sidebar
- Vertical flex layout
- Contains facility tabs/buttons
- Status badges and upgrade indicators

#### Main Content Area
- Flex row layout
- Left panel (facility view)
- Center area (facility details)
- Right panel (inventory/stash)

#### Facility Grid Section
- CSS Grid or Flex layout for production areas
- Handles drag-drop interactions and highlighting

#### View Container
- Standardized spacing and padding
- Consistent header styling for sections

**Layout Philosophy:**
- Flexbox-based for flexible, responsive layouts
- Adapts naturally to content changes
- Mobile-friendly base with desktop enhancements

---

### `components.css`
**Purpose:** Styles for **reusable UI components** (buttons, panels, badges, etc.).

**Component Categories:**

#### Speed Controller
- `.speed-controller-compact` - Compact button row container
- `.speed-btn-compact` - Individual speed buttons (1x, 2x, 4x, 8x, 16x, 32x, 64x)
- `.speed-btn-compact:hover` - Hover state (background change)
- `.speed-btn-compact:active` - Active/pressed state (scale 0.95)
- `.speed-display` - Current speed indicator display

#### Top Statistics Display
- `.top-stats` - Container for game statistics
- `.stat` - Individual stat (gold, workers, items, etc.)
- `.stat-label` - Label text ("Gold:", "Workers:")
- `.stat-value` - Numeric value with emphasis

#### Navigation Items (Tabs)
- `.nav-item` - Facility/screen tab button
- `.nav-item:hover` - Hover feedback
- `.nav-item.active` - Currently selected tab (bold/highlighted)
- `.nav-label` - Tab text label
- `.nav-icon` - Icon within nav item
- `.nav-count` - Resource count badge

#### Status Badges & Indicators
- `.status-badge` - General badge (gray background)
- `.status-badge.warning` - Yellow warning indicator
- `.status-badge.critical` - Red critical indicator
- `.upgrade-indicator` - Special "upgrade available" indicator
- `.nav-item.active .status-badge` - Badge styling when tab active

#### Buttons
- Button styling with consistent colors
- Hover state (color shift, shadow increase)
- Active/pressed state (scale 0.98)
- Focus state (outline)
- Disabled state (opacity reduction)

#### Input Elements
- Input field styling
- Focus states with border highlight
- Placeholder text styling
- Disabled field styling

**Component Behavior Patterns:**
- Smooth transitions on state changes
- Scale animations on click/active (tactile feedback)
- Color changes for interactive feedback
- Consistent hover delays for responsive feel

---

### `animations.css`
**Purpose:** **Keyframe animations and transition effects** for smooth, polished interactions.

**Animation Types:**

#### Fade-In Animation
```css
@keyframes fadeIn {
    from {
        opacity: 0;
        transform: translateY(10px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}
```
- Duration: 0.3s ease
- Fades in with subtle upward slide (10px)
- Used for view/panel entry

#### Scale Animations
- **Hover:** Scale 0.95 (subtle zoom out/press)
- **Active/Click:** Scale 0.98 (pressed effect)
- **Normal State:** Scale 1 (identity, no transform)

#### Grid Animations
- `--grid-scale` CSS variable for custom grid scaling
- Smooth transitions for drag-drop feedback
- Visual highlighting during drag operations

#### Transition Patterns Applied
- **Hover:** Smooth scale + color transition
- **Active:** Larger scale for tactile feedback
- **Focus:** Border/outline changes
- All use `var(--transition-fast)` or `var(--transition-normal)`

**Performance Optimization:**
- Uses `transform` and `opacity` properties (GPU accelerated)
- Achieves smooth 60fps animations
- Avoids animating expensive properties (width, height, layout changes)

---

### `facilities.css`
**Purpose:** **Facility-specific styling** (facility panels, production grids, stash display, worker areas).

**Facility Section Styles:**

#### Facility Information Panel
- `.facility-info` - Container for facility details/stats
- `.facility-info p` - Stat lines (level, workers assigned, etc.)
- `.facility-info p span` - Stat values with emphasis/color

#### Facility Controls/Actions
- `.facility-actions` - Upgrade/control buttons container
- `.facility-actions label` - Labels for controls
- `.facility-actions input` - Input fields (checkboxes, upgrade buttons)
- `.facility-actions input:focus` - Focus state with highlight

#### Stash/Inventory Section
- `.stash-section` - Main inventory container
- `.stash-header` - Title and slot usage info
- `.stash-header h2` - "Stash" or "Inventory" title
- `.stash-info` - Slot count display (e.g., "15/20 slots used")
- `.stash-grid` - CSS Grid layout for item slots

#### Stash Item Slots
- `.stash-slot` - Individual inventory slot (grid cell)
- `.stash-slot:hover` - Hover state (brightened)
- `.stash-slot.occupied` - Contains an item
- `.stash-slot.occupied:hover` - Item slot hover
- `.stash-slot.dragging` - Currently being dragged (opacity reduced)
- `.stash-slot.drag-over` - Drag target (highlight for drop zone)

#### Grade-Specific Slot Colors
Each item grade has unique colors based on `data/items/item.csv` grade:
- `.stash-slot.grade-common` - Gray background
- `.stash-slot.grade-uncommon` - Blue background
- `.stash-slot.grade-rare` - Purple background
- `.stash-slot.grade-epic` - Orange background
- `.stash-slot.grade-legendary` - Red background

Grade hover states apply darker tint.

#### Production Grid
- `.processing-grid` - Grid for production areas (craft recipes)
- `.grid-area` - Individual production area cell
- Collision detection visual feedback
- Drag-drop highlighting and drop zones

#### Worker Grid
- `.worker-grid` - Grid for assigning workers
- Worker slot styles
- Assignment feedback

**Grid Responsiveness:**
- Grid layouts adapt to facility size changes
- Available space determines visible slots
- Scrollable areas for overflow content

## How to Modify

### Adding a New Color Token

1. **Edit** `css/variables.css`:
   ```css
   :root {
       --color-new-status: #ff6b6b;
   }
   ```

2. **Use in any component:**
   ```css
   .alert {
       background-color: var(--color-new-status);
       color: var(--text-primary);
   }
   ```

### Creating a New Component

1. **Add styles to** `css/components.css`:
   ```css
   .card {
       background: var(--bg-panel);
       padding: var(--spacing-lg);
       border-radius: var(--radius-lg);
       box-shadow: var(--shadow-md);
       transition: all var(--transition-normal);
   }

   .card:hover {
       box-shadow: var(--shadow-lg);
       transform: translateY(-2px);
   }
   ```

2. **Reference in HTML** (no changes needed to CSS import)

### Adding an Animation

1. **Define keyframes in** `css/animations.css`:
   ```css
   @keyframes slideIn {
       from {
           opacity: 0;
           transform: translateX(-100%);
       }
       to {
           opacity: 1;
           transform: translateX(0);
       }
   }
   ```

2. **Apply to elements:**
   ```css
   .modal {
       animation: slideIn var(--transition-normal);
   }
   ```

### Modifying Layout

1. **Edit** `css/layout.css` for structure changes
2. **Use CSS Grid or Flexbox** for responsive adjustments
3. **Reference spacing variables** for consistency:
   ```css
   .container {
       padding: var(--spacing-xl);
       gap: var(--spacing-lg);
   }
   ```

## CSS Import Order (Critical)

Files **must** load in this specific order in `index.html`:

1. **variables.css** - Define all design tokens (referenced by other files)
2. **reset.css** - Establish baseline (must be early)
3. **layout.css** - Page structure
4. **components.css** - Component styles
5. **animations.css** - Animations (can reference variables)
6. **facilities.css** - Facility overrides (must be last to override others)

This cascade ensures:
- Variables defined before use
- Later files can override earlier ones
- Specific facility styles take precedence
- No circular dependencies

## Integration Points

- **HTML:** `index.html` imports all modular CSS files in order (variables.css, reset.css, layout.css, components.css, animations.css, facilities.css)
- **UI Builder:** `ui/uiBuilder.js` applies classes to DOM elements
- **JavaScript:** Components use inline `--custom-property` CSS variables for dynamic theming

## Design Patterns & Principles

- **Design Tokens:** All colors, spacing, typography defined as CSS variables (single source of truth)
- **Mobile-First:** Base styles apply to all sizes, media queries enhance larger screens
- **Component-Based:** Related styles grouped in single files (easy to find/modify)
- **DRY (Don't Repeat Yourself):** Variables eliminate style duplication across files
- **Separation of Concerns:** Reset, layout, components, animations in separate focused files
- **Consistent Interactions:** All interactive elements follow same hover/active/focus patterns

## Performance Considerations

- **CSS Variables:** Minimal runtime cost (calculated at parse time)
- **GPU Acceleration:** Animations use `transform` and `opacity` (best performance)
- **Specificity:** Keep selectors simple to minimize recalculation overhead
- **Modular Structure:** Single stylesheet request, modular organization for team development

## Accessibility Features

- **Color Contrast:** Meets WCAG AA standards (dark background with light text)
- **Focus States:** Clearly visible focus indicators on interactive elements
- **Status Indicators:** Use both color AND text/icons (not color alone)
- **Motion:** Can add `prefers-reduced-motion` support for accessibility

## Future Enhancement Ideas

- **Dark/Light Mode Toggle:** Create alternate color palette in `variables.css`
- **Responsive Breakpoints:** Add media queries in `css/layout.css` for mobile/tablet layouts
- **CSS Grid System:** Advanced layouts using CSS Grid
- **Print Stylesheet:** Separate `print.css` for game state export
- **Theme Switching:** Support multiple color schemes via CSS variable switching
- **SCSS Preprocessing:** Use SCSS for nesting, mixins, functions

