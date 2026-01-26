/**
 * Product Grid Renderer
 * Handles rendering logic for product facility grids
 * Extracted from ProductGridUI in Phase 2 refactoring
 */
class ProductGridRenderer {
    constructor(gameState, productGridSystem, stashManager = null) {
        this.gameState = gameState;
        this.productGridSystem = productGridSystem;
        this.stashManager = stashManager;
        this.uiOrchestrator = null; // Reference to ProductGridUI (set via setUIOrchestrator)
        this.uiBuilder = null; // Reference to UIBuilder (set via setUIBuilder)
    }

    /**
     * Set reference to ProductGridUI for orchestration callbacks
     * Called after ProductGridUI construction to avoid circular dependencies
     */
    setUIOrchestrator(productGridUI) {
        this.uiOrchestrator = productGridUI;
    }

    /**
     * Set reference to UIBuilder for rendering utilities
     * Called after ProductGridUI construction
     */
    setUIBuilder(uiBuilder) {
        this.uiBuilder = uiBuilder;
    }

    /**
     * Build product grid UI for a facility
     * Populates the 3-panel layout in the HTML template
     * Layout: Left (Workers + Areas) | Center (Grid) | Right (Products & Collect)
     */
    buildProductGridUI(facilityId) {
        const facility = dataLoader.getFacility(facilityId);
        const facilityState = this.gameState.facilities[facilityId];

        if (!facility || !facilityState || facility.type !== 'product') {
            return null;
        }

        // Get grid dimensions
        let gridWidth, gridHeight;
        if (this.productGridSystem.gridState[facilityId]) {
            gridWidth = this.productGridSystem.gridState[facilityId].width;
            gridHeight = this.productGridSystem.gridState[facilityId].height;
        } else {
            const { x, y } = dataLoader.getGridDimensions(facilityId, facilityState.level);
            gridWidth = x;
            gridHeight = y;
        }

        // Get the HTML panel elements for this facility
        const gridContainer = document.getElementById(`${facilityId}-grid-container`);
        const panelLayout = gridContainer?.querySelector('.facility-three-panel-layout');

        if (!panelLayout) {
            // Fallback: create the old structure if HTML doesn't have new layout
            return this._buildProductGridUILegacy(facilityId, gridWidth, gridHeight);
        }

        // ===== LEFT PANEL: Worker Placement & Area Placement =====
        const workerSection = panelLayout.querySelector(`#${facilityId}-worker-section`);
        const areaSection = panelLayout.querySelector(`#${facilityId}-area-section`);

        if (workerSection && areaSection) {
            // Clear existing content
            while (workerSection.children.length > 1) workerSection.removeChild(workerSection.lastChild);
            while (areaSection.children.length > 1) areaSection.removeChild(areaSection.lastChild);

            // Add Edit Mode Toggle Switch to worker section
            const editModeContainer = document.createElement('div');
            editModeContainer.className = 'edit-mode-toggle-container';

            // Create checkbox input for toggle switch
            const editModeCheckbox = document.createElement('input');
            editModeCheckbox.type = 'checkbox';
            editModeCheckbox.id = `edit-mode-toggle-${facilityId}`;
            editModeCheckbox.className = 'edit-mode-toggle-checkbox';
            editModeCheckbox.checked = this.gameState.zoneEditMode[facilityId];
            editModeCheckbox.onchange = () => this.uiOrchestrator.gameLoopManager.toggleZoneEditMode(facilityId);

            // Create label for toggle switch
            const editModeLabel = document.createElement('label');
            editModeLabel.className = 'edit-mode-toggle-label';
            editModeLabel.htmlFor = `edit-mode-toggle-${facilityId}`;
            editModeLabel.textContent = 'Edit Mode';

            editModeContainer.appendChild(editModeCheckbox);
            editModeContainer.appendChild(editModeLabel);
            workerSection.appendChild(editModeContainer);

            // Add appropriate content to area section
            if (this.gameState.zoneEditMode[facilityId]) {
                // Edit mode: Show available areas
                const sidebar = this.createAreasSidebar(facilityId, facilityState.level);
                // Remove the h3 from sidebar to avoid duplicate headers
                const sidebarH3 = sidebar.querySelector('h3');
                if (sidebarH3) sidebarH3.remove();
                areaSection.appendChild(sidebar);
            } else {
                // Normal mode: Show idle workers in area section
                const workersPanel = this.uiOrchestrator.createIdleWorkersPanel(facilityId);
                // Remove the h3 from workers panel to avoid duplicate headers
                const workersH3 = workersPanel.querySelector('h3');
                if (workersH3) workersH3.remove();
                areaSection.appendChild(workersPanel);
            }
        }

        // ===== CENTER PANEL: Facility Grid =====
        const panelCenter = panelLayout.querySelector(`#${facilityId}-panel-center`);
        if (panelCenter) {
            panelCenter.innerHTML = '';
            const gridWrapper = document.createElement('div');
            gridWrapper.className = 'grid-wrapper';
            const grid = this.createGridDisplay(facilityId, gridWidth, gridHeight);
            gridWrapper.appendChild(grid);
            panelCenter.appendChild(gridWrapper);
        }

        // ===== RIGHT PANEL: Products & Collect All =====
        const productsSection = panelLayout.querySelector(`#${facilityId}-products-section`);

        if (productsSection) {
            // Clear existing content but keep the h3
            while (productsSection.children.length > 1) productsSection.removeChild(productsSection.lastChild);

            // Create and add Collect All button
            const collectBtn = document.createElement('button');
            collectBtn.className = 'btn btn-primary btn-collect-all';
            collectBtn.textContent = 'Collect All';
            collectBtn.onclick = () => {
                this.uiOrchestrator.gameLoopManager.collectFromFacility(facilityId);
            };
            productsSection.appendChild(collectBtn);

            // Create and add facility info panel
            const infoPanel = this.uiOrchestrator.createFacilityInfo(facilityId, facilityState, true);
            // Remove panel header from infoPanel as we already have the h3
            const infoPanelH3 = infoPanel.querySelector('h3');
            if (infoPanelH3) infoPanelH3.remove();
            productsSection.appendChild(infoPanel);
        }

        return true;
    }

    /**
     * Legacy method: Build product grid UI using old structure
     * Used as fallback when HTML doesn't have new 3-panel layout
     */
    _buildProductGridUILegacy(facilityId, gridWidth, gridHeight) {
        const facilityState = this.gameState.facilities[facilityId];

        const container = document.createElement('div');
        container.className = 'product-grid-container';

        // Left panel
        const leftPanel = document.createElement('div');
        leftPanel.className = 'product-grid-left-panel';
        const leftPanelHeader = document.createElement('div');
        leftPanelHeader.className = 'product-grid-left-panel-header';
        const editModeBtn = document.createElement('button');
        editModeBtn.className = 'btn btn-secondary btn-small edit-mode-toggle';
        editModeBtn.textContent = this.gameState.zoneEditMode[facilityId] ? 'Exit Edit Mode' : 'Change Edit Mode';
        editModeBtn.onclick = () => this.uiOrchestrator.gameLoopManager.toggleZoneEditMode(facilityId);
        leftPanelHeader.appendChild(editModeBtn);
        leftPanel.appendChild(leftPanelHeader);

        const panelContent = document.createElement('div');
        panelContent.className = 'product-grid-panel-content';
        if (this.gameState.zoneEditMode[facilityId]) {
            const sidebar = this.createAreasSidebar(facilityId, facilityState.level);
            panelContent.appendChild(sidebar);
        } else {
            const workersPanel = this.uiOrchestrator.createIdleWorkersPanel(facilityId);
            panelContent.appendChild(workersPanel);
        }
        leftPanel.appendChild(panelContent);

        // Center section
        const gridWrapper = document.createElement('div');
        gridWrapper.className = 'grid-wrapper';
        const grid = this.createGridDisplay(facilityId, gridWidth, gridHeight);
        gridWrapper.appendChild(grid);

        // Right section
        const rightSection = document.createElement('div');
        rightSection.className = 'product-grid-right-section';
        const infoPanel = this.uiOrchestrator.createFacilityInfo(facilityId, facilityState, true);
        rightSection.appendChild(infoPanel);

        const contentWrapper = document.createElement('div');
        contentWrapper.className = 'product-grid-content';
        contentWrapper.appendChild(leftPanel);
        contentWrapper.appendChild(gridWrapper);
        contentWrapper.appendChild(rightSection);

        container.appendChild(contentWrapper);
        return container;
    }

    /**
     * Create production list grid showing all items produced at this facility
     * Displays item name, modified production time, and 24-hour yield
     */
    createProductionListGrid(facilityId) {
        const gridContainer = document.createElement('div');
        gridContainer.className = 'production-grid-container';

        // Get all placed areas for this facility
        const placements = this.productGridSystem.getPlacements(facilityId);

        // If no production areas placed, show message
        if (placements.length === 0) {
            const emptyMsg = document.createElement('div');
            emptyMsg.className = 'production-grid-empty';
            emptyMsg.textContent = 'No production areas placed';
            gridContainer.appendChild(emptyMsg);
            return gridContainer;
        }

        // Aggregate all production items and their max yields
        const itemYields = {}; // { itemId: { name, totalYield24h } }
        const itemsByArea = {}; // Track which areas produce which items

        for (let i = 0; i < placements.length; i++) {
            const placement = placements[i];
            const area = dataLoader.getProductArea(placement.areaId);
            if (!area) continue;

            const placementId = placement.id;
            const zoneKey = `${facilityId}_${placement.areaId}_${placementId}`;

            // Check if zone is staffed (has enough workers)
            const assignedWorkers = this.gameState.areaWorkerAssignments[zoneKey] || [];
            const requiredWorkers = area.workers || 0;
            const isStaffed = assignedWorkers.length >= requiredWorkers;

            // Only include production from staffed zones
            if (!isStaffed) {
                continue;
            }

            // Get yields for this zone
            const yields = this.uiOrchestrator.gameLoopManager.productionSystem.calculateYieldPerItem(zoneKey, area);

            for (const yieldData of yields) {
                if (!itemYields[yieldData.itemId]) {
                    itemYields[yieldData.itemId] = {
                        name: yieldData.itemName,
                        totalYield24h: 0
                    };
                    itemsByArea[yieldData.itemId] = [];
                }
                // Sum yields from all zones
                itemYields[yieldData.itemId].totalYield24h += yieldData.quantity24h;
                itemsByArea[yieldData.itemId].push({
                    areaId: placement.areaId,
                    areaIndex: i,
                    yield: yieldData.quantity24h
                });
            }
        }

        // If no items found, show message
        if (Object.keys(itemYields).length === 0) {
            const emptyMsg = document.createElement('div');
            emptyMsg.className = 'production-grid-empty';
            emptyMsg.textContent = 'No items produced by placed areas';
            gridContainer.appendChild(emptyMsg);
            return gridContainer;
        }

        // Create grid rows for each item
        for (const [itemId, data] of Object.entries(itemYields)) {
            const row = document.createElement('div');
            row.className = 'production-grid-row';
            row.title = `Produced by: ${itemsByArea[itemId].map(a => a.areaId).join(', ')}`;
            row.style.cursor = 'pointer';

            // Item name column
            const nameCell = document.createElement('div');
            nameCell.className = 'production-grid-cell item-name-cell';
            nameCell.innerHTML = `
                <span class="item-icon">${itemId.charAt(0).toUpperCase()}</span>
                <span class="item-name">${data.name}</span>
            `;

            // 24-hour yield column
            const yieldCell = document.createElement('div');
            yieldCell.className = 'production-grid-cell yield-cell';

            yieldCell.innerHTML = `
                <span class="yield-value" title="Total yield from all areas">${data.totalYield24h}</span>
            `;

            row.appendChild(nameCell);
            row.appendChild(yieldCell);

            // Add click handler to open item detail modal
            row.addEventListener('click', (e) => {
                e.stopPropagation();
                const totalOwned = this.uiOrchestrator.gameLoopManager.stashManager.getItemQuantity(itemId);
                this.uiOrchestrator.gameLoopManager.showItemInfoModal([{
                    itemId: itemId,
                    itemName: data.name,
                    quantity: totalOwned
                }], 0);
            });

            gridContainer.appendChild(row);
        }

        return gridContainer;
    }

    /**
     * Create the areas sidebar with available production areas
     */
    createAreasSidebar(facilityId, facilityLevel) {
        const sidebar = document.createElement('div');
        sidebar.className = 'product-areas-sidebar';

        // Header with title only
        const sidebarHeader = document.createElement('div');
        sidebarHeader.className = 'sidebar-header';

        const title = document.createElement('h3');
        title.textContent = 'Available Areas';
        sidebarHeader.appendChild(title);

        sidebar.appendChild(sidebarHeader);

        const areasList = document.createElement('div');
        areasList.className = 'areas-list';

        // Get all available areas for this facility at current level
        const availableAreaConfigs = dataLoader.getAvailableProductAreas(facilityId, facilityLevel);
        const placements = this.productGridSystem.getPlacements(facilityId);

        // Count how many times each area is already placed
        const placedAreaCounts = {};
        for (const placement of placements) {
            placedAreaCounts[placement.areaId] = (placedAreaCounts[placement.areaId] || 0) + 1;
        }

        for (const areaConfig of availableAreaConfigs) {
            const area = dataLoader.getProductArea(areaConfig.areaId);
            if (!area) continue;

            const areaCount = areaConfig.areaCount;
            const currentPlacementCount = placedAreaCounts[areaConfig.areaId] || 0;

            // Determine if this area should be shown
            let shouldShow = false;
            let isDisabled = false;

            if (areaCount === 0) {
                // Value 0: Show but disabled (visible in Available Area list but can't place)
                shouldShow = true;
                isDisabled = true;
            } else if (areaCount === -1) {
                // Value -1: Unlimited placement
                shouldShow = true;
                isDisabled = false;
            } else if (areaCount > 0) {
                // Positive value: Show if under limit
                shouldShow = true;
                isDisabled = currentPlacementCount >= areaCount;
            }

            if (shouldShow) {
                const areaItem = this.createAreaItem(facilityId, area, isDisabled, areaCount, currentPlacementCount);
                areasList.appendChild(areaItem);
            }
        }

        sidebar.appendChild(areasList);
        return sidebar;
    }

    /**
     * Create a draggable area item for the sidebar
     */
    createAreaItem(facilityId, area, isDisabled = false, areaCount = -1, currentPlacementCount = 0) {
        const item = document.createElement('div');
        item.className = 'area-item';
        item.draggable = !isDisabled;
        item.dataset.areaId = area.id;
        item.dataset.facilityId = facilityId;
        item.dataset.width = area.gridX;
        item.dataset.height = area.gridY;

        if (isDisabled) {
            item.classList.add('disabled');
            item.style.opacity = '0.5';
        }

        // Left side - Grid Preview Container with Grid Size label below
        const previewColumn = document.createElement('div');
        previewColumn.className = 'preview-column';

        // Grid Preview - Square container with scale-to-fit logic
        const footprint = document.createElement('div');
        footprint.className = 'area-footprint';
        footprint.title = `${area.gridX}x${area.gridY} cells`;
        footprint.style.setProperty('--grid-width', area.gridX);
        footprint.style.setProperty('--grid-height', area.gridY);

        // Calculate cell size based on which dimension is larger
        // Container is 60px x 60px, with 8px padding (16px total) and 2px gaps
        const containerSize = 60;
        const padding = 8 * 2; // padding on both sides
        const availableSpace = containerSize - padding;
        const gapSize = 2;
        const totalGaps = (area.gridX > 1 ? area.gridX - 1 : 0) * gapSize;
        const totalGapsY = (area.gridY > 1 ? area.gridY - 1 : 0) * gapSize;

        // Calculate cell size for each dimension
        const cellSizeX = (availableSpace - totalGaps) / area.gridX;
        const cellSizeY = (availableSpace - totalGapsY) / area.gridY;

        // Use the smaller cell size to fit within the square container
        const cellSize = Math.min(cellSizeX, cellSizeY);

        // Set the calculated cell size as a CSS variable
        footprint.style.setProperty('--cell-size', `${cellSize}px`);

        for (let i = 0; i < area.gridX * area.gridY; i++) {
            const cell = document.createElement('div');
            cell.className = 'footprint-cell';
            footprint.appendChild(cell);
        }

        // Grid Size text below preview - REMOVED per requirement
        // Only show the footprint icon, no grid size label

        previewColumn.appendChild(footprint);

        // Right side - Area Name and Item Grid
        const areaDetails = document.createElement('div');
        areaDetails.className = 'area-details-column';

        // Area Name with placement count
        const areaName = document.createElement('div');
        areaName.className = 'area-name-label';

        // Build name with placement count indicator
        let nameHtml = `<strong>${area.id}</strong>`;
        if (areaCount === 0) {
            nameHtml += '<span class="placement-count" style="color: #999; font-size: 0.8em;"> (Disabled)</span>';
        } else if (areaCount > 0) {
            nameHtml += `<span class="placement-count" style="color: #666; font-size: 0.8em;"> (${currentPlacementCount}/${areaCount})</span>`;
        }

        areaName.innerHTML = nameHtml;
        areaDetails.appendChild(areaName);

        // Item Grid - displays obtainable items (max 5x2 = 10 slots)
        const itemGrid = this.uiOrchestrator.createAreaItemGrid(area);
        areaDetails.appendChild(itemGrid);

        item.appendChild(previewColumn);
        item.appendChild(areaDetails);

        // Drag events
        item.addEventListener('dragstart', (e) => this.uiOrchestrator.handleAreaDragStart(e, facilityId, area));
        item.addEventListener('dragend', (e) => this.uiOrchestrator.handleAreaDragEnd(e));

        return item;
    }

    /**
     * Create the grid display
     */
    createGridDisplay(facilityId, gridWidth, gridHeight) {
        // Create wrapper for grid + overlay
        const gridWrapper = document.createElement('div');
        gridWrapper.className = 'grid-display-wrapper';
        gridWrapper.style.position = 'relative';

        // Calculate dimensions for scale-to-fit approach
        // We'll use a base cell size and then scale the entire grid to fit
        const baseGridPadding = 15; // 15px padding on each side
        const gapSize = 1;
        const baseCellSize = 80; // Base cell size before scaling

        // Calculate the total width and height of the grid at base size
        const totalGapsX = (gridWidth - 1) * gapSize;
        const totalGapsY = (gridHeight - 1) * gapSize;
        const baseGridWidth = baseGridPadding * 2 + (gridWidth * baseCellSize) + totalGapsX;
        const baseGridHeight = baseGridPadding * 2 + (gridHeight * baseCellSize) + totalGapsY;

        // Get available space (accounting for sidebar width 250px, padding 20px on each side, gaps)
        const sidebarWidth = 250;
        const containerPaddingX = 20;
        const containerPaddingY = 20;
        const wrapperPadding = 20;

        // Available width = window width - sidebar - container padding - wrapper padding - gap between elements
        const availableWidth = window.innerWidth - sidebarWidth - (containerPaddingX * 2) - (wrapperPadding * 2) - 20;
        // Available height = window height - header - footer - container padding - wrapper padding
        // Use actual element heights instead of estimates
        const headerElement = document.querySelector('.header');
        const footerElement = document.querySelector('.time-control-bar');
        const headerHeight = headerElement ? headerElement.offsetHeight : 100;
        const footerHeight = footerElement ? footerElement.offsetHeight : 60;
        const availableHeight = window.innerHeight - headerHeight - footerHeight - (containerPaddingY * 2) - (wrapperPadding * 2);

        // Calculate scale factor to fit within available space
        const scaleX = availableWidth / baseGridWidth;
        const scaleY = availableHeight / baseGridHeight;
        const scale = Math.min(scaleX, scaleY, 1); // Don't scale up, only down

        // Create base grid (cells only)
        const grid = document.createElement('div');
        grid.className = 'product-grid';
        grid.dataset.facilityId = facilityId;

        // Set base cell size and scale
        grid.style.gridTemplateColumns = `repeat(${gridWidth}, ${baseCellSize}px)`;
        grid.style.gridTemplateRows = `repeat(${gridHeight}, ${baseCellSize}px)`;
        grid.style.setProperty('--cell-size', `${baseCellSize}px`);
        grid.style.setProperty('--grid-scale', `${scale}`);

        // Create grid cells
        for (let y = 0; y < gridHeight; y++) {
            for (let x = 0; x < gridWidth; x++) {
                const cell = document.createElement('div');
                cell.className = 'grid-cell';
                cell.dataset.gridX = x;
                cell.dataset.gridY = y;

                // Drag-drop handlers for grid
                cell.addEventListener('dragover', (e) => this.uiOrchestrator.handleGridDragOver(e));
                cell.addEventListener('drop', (e) => this.uiOrchestrator.handleGridDrop(e, facilityId));
                cell.addEventListener('dragleave', (e) => this.uiOrchestrator.handleGridDragLeave(e));

                grid.appendChild(cell);
            }
        }

        // Create overlay for placed areas (separate from grid to avoid grid flow issues)
        const placementsOverlay = document.createElement('div');
        placementsOverlay.className = 'placements-overlay';
        placementsOverlay.style.position = 'absolute';
        placementsOverlay.style.top = '0';
        placementsOverlay.style.left = '0';
        placementsOverlay.style.width = '100%';
        placementsOverlay.style.height = '100%';
        placementsOverlay.style.pointerEvents = 'none'; // Allow clicks through to grid
        placementsOverlay.style.setProperty('--grid-scale', `${scale}`);

        // Add drag-over and drop handlers to overlay for repositioning areas
        placementsOverlay.addEventListener('dragover', (e) => {
            if (!this.uiOrchestrator.draggedArea?.isRepositioning) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';

            // Find grid cell coordinates from cursor position
            const rect = placementsOverlay.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const cellSize = baseCellSize;
            const gridBorder = 1;
            const gridPadding = 15;
            const cellGap = 1;
            const cellX = Math.floor((x - gridBorder - gridPadding) / (cellSize + cellGap));
            const cellY = Math.floor((y - gridBorder - gridPadding) / (cellSize + cellGap));

            if (cellX >= 0 && cellY >= 0 && cellX < gridWidth && cellY < gridHeight) {
                // Highlight the cell being hovered over
                const canPlace = this.productGridSystem.canPlaceArea(
                    this.uiOrchestrator.draggedArea.facilityId,
                    this.uiOrchestrator.draggedArea.areaId,
                    cellX,
                    cellY,
                    true, // isRepositioning = true, so it excludes self from collision check
                    this.uiOrchestrator.draggedArea.placementId  // Pass placementId to exclude self correctly
                );

                // Clear previous highlights
                grid.querySelectorAll('.grid-cell').forEach(cell => {
                    cell.classList.remove('drop-valid', 'drop-invalid');
                });

                // Highlight cells that will be occupied
                for (let dy = 0; dy < this.uiOrchestrator.draggedArea.height; dy++) {
                    for (let dx = 0; dx < this.uiOrchestrator.draggedArea.width; dx++) {
                        const targetX = cellX + dx;
                        const targetY = cellY + dy;
                        const targetCell = grid?.querySelector(
                            `.grid-cell[data-grid-x="${targetX}"][data-grid-y="${targetY}"]`
                        );
                        if (targetCell) {
                            targetCell.classList.add(canPlace ? 'drop-valid' : 'drop-invalid');
                        }
                    }
                }
            }
        });

        placementsOverlay.addEventListener('dragleave', () => {
            if (!this.uiOrchestrator.draggedArea?.isRepositioning) return;
            grid.querySelectorAll('.grid-cell').forEach(cell => {
                cell.classList.remove('drop-valid', 'drop-invalid');
            });
        });

        placementsOverlay.addEventListener('drop', (e) => {
            if (!this.uiOrchestrator.draggedArea?.isRepositioning) return;

            const rect = placementsOverlay.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const cellSize = baseCellSize;
            const gridBorder = 1;
            const gridPadding = 15;
            const cellGap = 1;
            const cellX = Math.floor((x - gridBorder - gridPadding) / (cellSize + cellGap));
            const cellY = Math.floor((y - gridBorder - gridPadding) / (cellSize + cellGap));

            if (cellX >= 0 && cellY >= 0 && cellX < gridWidth && cellY < gridHeight) {
                e.preventDefault();

                // Attempt to move the area
                // FIX: Pass placementId to ensure correct placement is moved when multiple areas of same type exist
                const success = this.productGridSystem.moveArea(
                    facilityId,
                    this.uiOrchestrator.draggedArea.areaId,
                    cellX,
                    cellY,
                    this.uiOrchestrator.draggedArea.placementId  // NEW: Pass UUID for precise targeting
                );

                if (success) {
                    this.refreshGridDisplay(facilityId);
                }
            }

            // Clear highlighting
            grid.querySelectorAll('.grid-cell').forEach(cell => {
                cell.classList.remove('drop-valid', 'drop-invalid');
            });
        });

        // Add placed areas to overlay (not to grid!)
        // Use placement ID for zone key generation (stored in placement.id)
        const placements = this.productGridSystem.getPlacements(facilityId);
        for (let i = 0; i < placements.length; i++) {
            const areaElement = this.createPlacedAreaElement(facilityId, placements[i], i, baseCellSize);
            if (areaElement) placementsOverlay.appendChild(areaElement);
        }

        gridWrapper.appendChild(grid);
        gridWrapper.appendChild(placementsOverlay);
        return gridWrapper;
    }

    /**
     * Create a placed area element on the grid
     */
    createPlacedAreaElement(facilityId, placement, placementIndex, cellSize = 80) {
        const area = dataLoader.getProductArea(placement.areaId);
        if (!area) return null;

        const element = document.createElement('div');
        element.className = 'placed-area';
        element.dataset.areaId = placement.areaId;
        element.dataset.facilityId = facilityId;
        element.dataset.placementIndex = placementIndex;
        element.dataset.placementId = placement.id;

        // Generate zoneKey for this placement
        const placementId = placement.id;
        const zoneKey = `${facilityId}_${placement.areaId}_${placementId}`;
        element.dataset.zoneKey = zoneKey;

        // Account for grid border, padding, and cell gaps when positioning
        const gridBorder = 1;   // .product-grid border width
        const gridPadding = 15; // .product-grid padding
        const cellGap = 1;      // CSS grid gap

        // Calculate position accounting for border + padding + gaps
        // Total offset: border + padding + (cellPosition * (cellSize + gap))
        const left = gridBorder + gridPadding + (placement.gridX * (cellSize + cellGap));
        const top = gridBorder + gridPadding + (placement.gridY * (cellSize + cellGap));

        // Calculate size accounting for gaps between cells
        // Size: (cellCount * cellSize) + ((cellCount - 1) * gap)
        const width = (placement.width * cellSize) + ((placement.width - 1) * cellGap);
        const height = (placement.height * cellSize) + ((placement.height - 1) * cellGap);

        element.style.position = 'absolute';
        element.style.left = `${left}px`;
        element.style.top = `${top}px`;
        element.style.width = `${width}px`;
        element.style.height = `${height}px`;
        element.style.pointerEvents = 'auto'; // Re-enable pointer events

        // Check if zone has assigned workers (FIX: Only show progress if workers are assigned)
        const assignedWorkers = this.gameState.areaWorkerAssignments[zoneKey] || [];
        const requiredWorkers = area.workers || 0;
        const hasWorkers = assignedWorkers.length >= requiredWorkers;

        const timer = hasWorkers ? (this.gameState.zoneTimers[zoneKey] || 0) : 0;
        const productionTime = area?.cooltime || 10;
        const productionTimeMs = productionTime * 1000;
        const progress = hasWorkers ? Math.min((timer / productionTimeMs) * 100, 100) : 0;

        // Calculate remaining time
        const remainingMs = hasWorkers ? Math.max(productionTimeMs - timer, 0) : productionTimeMs;
        const hours = Math.floor(remainingMs / (1000 * 60 * 60));
        const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((remainingMs % (1000 * 60)) / 1000);
        const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

        // Get edit mode state
        const isEditMode = this.gameState.zoneEditMode[facilityId];

        // Create the remove button section (only visible in edit mode)
        const topSection = document.createElement('div');
        topSection.className = 'placed-area-top-section';
        topSection.innerHTML = `
            <button class="area-remove-btn" data-placement-index="${placementIndex}" title="Remove area">×</button>
        `;
        // Hide remove button in non-edit mode
        if (!isEditMode) {
            topSection.style.display = 'none';
        }
        element.appendChild(topSection);

        // MIDDLE: Add WorkerGrid (always visible, but interaction state depends on mode)
        const workerGrid = this.uiOrchestrator.createWorkerGrid(facilityId, zoneKey, area, placementIndex, isEditMode);
        element.appendChild(workerGrid);

        // BOTTOM: Add Progress Bar with overlay text
        const bottomSection = document.createElement('div');
        bottomSection.className = 'placed-area-bottom-section';

        const progressContainer = document.createElement('div');
        progressContainer.className = 'zone-progress-container';

        const progressBar = document.createElement('div');
        progressBar.className = 'zone-progress-bar';

        const progressFill = document.createElement('div');
        progressFill.className = 'zone-progress-fill';
        progressFill.style.width = `${progress.toFixed(1)}%`;

        // Overlay text inside progress bar
        const progressOverlay = document.createElement('div');
        progressOverlay.className = 'zone-progress-overlay';

        const timeSpan = document.createElement('span');
        timeSpan.className = 'zone-time';
        timeSpan.textContent = timeStr;

        const percentageSpan = document.createElement('span');
        percentageSpan.className = 'zone-percentage';
        percentageSpan.textContent = `${progress.toFixed(0)}%`;

        progressOverlay.appendChild(timeSpan);
        progressOverlay.appendChild(percentageSpan);

        progressBar.appendChild(progressFill);
        progressBar.appendChild(progressOverlay);

        progressContainer.appendChild(progressBar);
        bottomSection.appendChild(progressContainer);
        element.appendChild(bottomSection);

        // Add disabled class if in edit mode
        if (isEditMode) {
            workerGrid.classList.add('disabled');
        }

        // Check if understaffed and add visual indicator
        if (assignedWorkers.length < requiredWorkers) {
            element.classList.add('needs-workers');
        }

        // Update stat bonus display
        this.uiOrchestrator.updateStatBonusDisplay(zoneKey);

        // NEW: Add drag-and-drop handlers to the placed-area element itself (not just slots container)
        // This allows users to drop workers anywhere on the area, not just on specific grid cells
        if (!isEditMode) {
            element.addEventListener('dragover', (e) => {
                e.preventDefault(); // CRITICAL: Must prevent default to allow drop
                e.stopPropagation();

                if (!this.uiOrchestrator.draggedWorker) {
                    return;
                }

                // Check if area has available slots
                const occupiedSlots = this.uiOrchestrator.workerGridSystem?.getOccupiedSlots(zoneKey) || {};
                const totalWorkerGridCells = Math.min(requiredWorkers, Math.max(1, (area?.gridX || 1)) * Math.max(1, (area?.gridY || 1) - 1));

                let hasAvailableSlots = false;
                for (let i = 0; i < totalWorkerGridCells; i++) {
                    if (!occupiedSlots.hasOwnProperty(i)) {
                        hasAvailableSlots = true;
                        break;
                    }
                }

                // Apply appropriate visual feedback
                if (hasAvailableSlots) {
                    element.classList.remove('worker-drop-invalid');
                    element.classList.add('worker-drop-valid');
                } else {
                    element.classList.remove('worker-drop-valid');
                    element.classList.add('worker-drop-invalid');
                }

                e.dataTransfer.dropEffect = hasAvailableSlots ? 'move' : 'none';
            });

            element.addEventListener('dragleave', (e) => {
                // Only remove classes when leaving the placed-area itself
                if (e.target === element) {
                    element.classList.remove('worker-drop-valid', 'worker-drop-invalid');
                }
            });

            element.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();

                element.classList.remove('worker-drop-valid', 'worker-drop-invalid');

                if (!this.uiOrchestrator.draggedWorker) {
                    return;
                }

                const workerId = this.uiOrchestrator.draggedWorker.workerId;

                // Get area info
                let areaId = area.id; // Use the area object we already have
                const requiredWorkers = area.workers || 0;

                // Find the first available slot
                const occupiedSlots = this.uiOrchestrator.workerGridSystem?.getOccupiedSlots(zoneKey) || {};
                let firstAvailableSlot = null;

                // Iterate through slots to find first empty one (filling from left)
                const totalWorkerGridCells = Math.min(requiredWorkers, Math.max(1, (area?.gridX || 1)) * Math.max(1, (area?.gridY || 1) - 1));
                for (let i = 0; i < totalWorkerGridCells; i++) {
                    if (!occupiedSlots.hasOwnProperty(i)) {
                        firstAvailableSlot = i;
                        break;
                    }
                }

                // If no slot available, don't assign
                if (firstAvailableSlot === null) {
                    this.uiOrchestrator.draggedWorker = null;
                    return;
                }

                let assignmentSuccess = false;

                if (this.uiOrchestrator.draggedWorker.sourceType === 'idle') {
                    // Assign idle worker to the zone at the first available slot
                    assignmentSuccess = this.uiOrchestrator.gameLoopManager.workerSystem.assignWorkerToZone(workerId, zoneKey, firstAvailableSlot);
                } else if (this.uiOrchestrator.draggedWorker.sourceType === 'assigned') {
                    // Worker relocation: unassign from source zone and assign to target zone
                    const sourceZone = this.uiOrchestrator.draggedWorker.sourceZone;
                    if (sourceZone && sourceZone !== zoneKey) {
                        // Different zones - relocate the worker
                        this.uiOrchestrator.gameLoopManager.workerSystem.unassignWorkerFromZone(workerId);
                        assignmentSuccess = this.uiOrchestrator.gameLoopManager.workerSystem.assignWorkerToZone(workerId, zoneKey, firstAvailableSlot);
                    }
                }

                if (assignmentSuccess) {
                    // Get the assigned worker for logging
                    const assignedWorker = this.gameState.workers.hired.find(w => w.id === workerId);

                    // LOG: Worker assignment with stats
                    if (assignedWorker) {
                        console.group(`✅ Worker Assigned: ${assignedWorker.name}`);
                        console.log(`Worker ID: ${workerId}`);
                        console.log(`Grade: ${assignedWorker.grade}, Level: ${assignedWorker.level}`);
                        console.log(`Stats:`, assignedWorker.stats);
                        console.log(`Assigned to Zone: ${zoneKey}`);
                        console.log(`Area ID: ${areaId}, Max Workers: ${requiredWorkers}`);
                        console.log(`Assigned to Slot: ${firstAvailableSlot} (Auto-assigned to first available)`);
                    }

                    // FEEDBACK 1: Show assignment success with visual effect on the slot
                    const slotsContainer = element.querySelector('.worker-slots-container');
                    const slot = slotsContainer?.querySelector(`[data-slot-index="${firstAvailableSlot}"]`);
                    if (slot) {
                        slot.classList.add('assignment-success');
                        setTimeout(() => slot.classList.remove('assignment-success'), 500);
                    }

                    // FEEDBACK 2: Check if area is now fully staffed and trigger production
                    const assignedWorkerIds = this.gameState.areaWorkerAssignments[zoneKey] || [];
                    const isNowFullyStaffed = assignedWorkerIds.length >= requiredWorkers && requiredWorkers > 0;

                    if (isNowFullyStaffed) {
                        // Calculate and display the new production time with full staffing
                        const productionSystem = this.uiOrchestrator.gameLoopManager.productionSystem;
                        const statBonus = productionSystem.calculateStatBonus(zoneKey, area, true);
                        const speedMultiplier = Math.pow(2, statBonus / 100);
                        const modifiedTime = productionSystem.calculateModifiedProductionTime(zoneKey, area);

                        // Log the production time calculation
                        console.log(`🎯 Area Fully Staffed! Production Details:`);
                        console.log(`  Base Production Time: ${area.cooltime}s`);
                        console.log(`  Stat Bonus: ${statBonus.toFixed(2)}`);
                        console.log(`  Speed Multiplier: ${speedMultiplier.toFixed(2)}x`);
                        console.log(`  Reduced Production Time: ${modifiedTime.toFixed(2)}s (${productionSystem.formatTimeHHMMSS(modifiedTime)})`);
                        console.groupEnd();

                        // Add visual indicator that production will start
                        if (element) {
                            element.classList.remove('needs-workers');
                            // Brief animation to signal production is starting
                            element.classList.add('production-starting');
                            setTimeout(() => element.classList.remove('production-starting'), 600);

                            // Add tooltip or notification showing the new production time
                            const workerGridWrapper = element.querySelector('.worker-grid-wrapper');
                            if (workerGridWrapper) {
                                const notification = document.createElement('div');
                                notification.className = 'production-time-notification';
                                notification.innerHTML = `
                                    <div class="notification-content">
                                        <div class="production-speed">⚡ ${speedMultiplier.toFixed(2)}x Speed</div>
                                        <div class="production-time">${productionSystem.formatTimeHHMMSS(modifiedTime)}/item</div>
                                    </div>
                                `;
                                workerGridWrapper.appendChild(notification);
                                setTimeout(() => notification.remove(), 3000);
                            }
                        }
                    } else if (assignedWorker) {
                        console.log(`📊 Staffing Status:`);
                        console.log(`  Assigned Workers: ${assignedWorkerIds.length}/${requiredWorkers} (needs ${requiredWorkers - assignedWorkerIds.length} more)`);
                        if (area) {
                            console.log(`  Production Time: ${area.cooltime}s`);
                            console.log(`  Output Item: ${area.productItem}`);
                        }
                        console.groupEnd();
                    }

                    // FEEDBACK 3: Update UI to reflect changes
                    this.refreshGridDisplay(facilityId);

                    // Trigger real-time update of Production panel on worker assignment
                    this.uiOrchestrator.gameLoopManager.uiUpdater.updateProductionPanelForFacility(facilityId);

                    // Force UI update to ensure immediate feedback
                    this.uiOrchestrator.gameLoopManager.uiUpdater.updateUI();
                }

                this.uiOrchestrator.draggedWorker = null;
            });
        }

        // Remove button handler - use persistent index for reliable zone identification
        const removeBtn = element.querySelector('.area-remove-btn');
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const buttonIndex = parseInt(e.target.dataset.placementIndex);

            // Log area removal with UUID
            const area = dataLoader.getProductArea(placement.areaId);
            if (area) {
                const assignedWorkers = this.gameState.areaWorkerAssignments[zoneKey] || [];
                console.group(`🗑️ Area Removed: ${area.id}`);
                console.log(`Area UUID (Placement ID): ${placement.id}`);
                console.log(`Placement Index: ${buttonIndex}`);
                console.log(`Grid Position: (${placement.gridX}, ${placement.gridY})`);
                console.log(`Area Dimensions: ${area.gridX}x${area.gridY}`);
                console.log(`Workers Unassigned: ${assignedWorkers.length}`);
                if (assignedWorkers.length > 0) {
                    const workerDetails = assignedWorkers.map(workerId => {
                        const worker = this.gameState.workers.hired.find(w => w.id === workerId);
                        return worker ? `${worker.name} (Lv${worker.level})` : 'Unknown';
                    });
                    console.log(`  Workers: ${workerDetails.join(', ')}`);
                }
                console.groupEnd();
            }

            this.productGridSystem.removeArea(facilityId, buttonIndex);
            this.refreshGridDisplay(facilityId);
        });

        // Drag handlers for repositioning placed areas - only in edit mode
        if (isEditMode) {
            element.draggable = true;
            element.addEventListener('dragstart', (e) => this.uiOrchestrator.handlePlacedAreaDragStart(e, facilityId, placement.areaId, placementIndex));
            element.addEventListener('dragend', (e) => this.uiOrchestrator.handlePlacedAreaDragEnd(e));

            // NEW: Click handler for area click logging in Edit Mode
            element.addEventListener('click', (e) => {
                // Don't log if clicking the remove button
                if (e.target.closest('.area-remove-btn')) return;

                console.group(`🖱️ Area Clicked in Edit Mode`);
                console.log(`Area ID: ${placement.areaId}`);
                console.log(`Area UUID (Placement ID): ${placement.id}`);
                console.log(`Placement Index: ${placementIndex}`);
                console.log(`Grid Position: (${placement.gridX}, ${placement.gridY})`);
                console.log(`Area Dimensions: ${placement.width}x${placement.height}`);
                console.log(`Area Data:`, {
                    areaId: placement.areaId,
                    gridX: placement.gridX,
                    gridY: placement.gridY,
                    width: placement.width,
                    height: placement.height,
                    productionTime: area?.cooltime,
                    outputItem: area?.productItem,
                    maxWorkers: area?.workers
                });
                const assignedWorkers = this.gameState.areaWorkerAssignments[zoneKey] || [];
                console.log(`Assigned Workers: ${assignedWorkers.length}/${area.workers}`);
                if (assignedWorkers.length > 0) {
                    const workerDetails = assignedWorkers.map(workerId => {
                        const worker = this.gameState.workers.hired.find(w => w.id === workerId);
                        return worker ? `${worker.name} (Lv${worker.level})` : 'Unknown';
                    });
                    console.log(`  Workers: ${workerDetails.join(', ')}`);
                }
                console.groupEnd();
            });
        } else {
            // In non-edit mode, disable dragging
            element.draggable = false;
        }

        return element;
    }

    /**
     * Refresh the grid display for a facility
     * Preserves zone state by using persistent indices instead of array positions
     * Supports both NEW (3-panel HTML template) and LEGACY (dynamic) UI structures
     */
    refreshGridDisplay(facilityId) {
        const gridContainer = document.getElementById(`${facilityId}-grid-container`);
        if (!gridContainer) return;

        // Try to detect NEW structure (3-panel HTML template)
        const panelLayout = gridContainer.querySelector('.facility-three-panel-layout');

        if (panelLayout) {
            // NEW STRUCTURE: Use the three-panel HTML template
            this._refreshGridDisplayNew(facilityId, panelLayout);
        } else {
            // LEGACY STRUCTURE: Use the old dynamic structure
            this._refreshGridDisplayLegacy(facilityId);
        }
    }

    /**
     * Refresh grid display for NEW structure (3-panel HTML template)
     * Handles the facility-three-panel-layout based layout
     */
    _refreshGridDisplayNew(facilityId, panelLayout) {
        const facilityState = this.gameState.facilities[facilityId];
        const gridState = this.productGridSystem.gridState[facilityId];
        if (!gridState) return;

        const gridWidth = gridState.width;
        const gridHeight = gridState.height;

        // Update edit mode button
        const editModeBtn = panelLayout.querySelector('.edit-mode-toggle');
        if (editModeBtn) {
            editModeBtn.textContent = this.gameState.zoneEditMode[facilityId] ? 'Exit Edit Mode' : 'Change Edit Mode';
        }

        // Update area section content - ONLY if not currently showing unassign zone
        // This prevents disrupting an active worker drag-and-drop operation
        const areaSection = panelLayout.querySelector(`#${facilityId}-area-section`);
        if (areaSection && !areaSection.classList.contains('unassign-drop-target')) {
            // Clear content (preserve h3 header)
            while (areaSection.children.length > 1) {
                areaSection.removeChild(areaSection.lastChild);
            }

            // Add appropriate content based on mode
            if (this.gameState.zoneEditMode[facilityId]) {
                // Edit mode: Show available areas
                const sidebar = this.createAreasSidebar(facilityId, facilityState.level);
                const sidebarH3 = sidebar.querySelector('h3');
                if (sidebarH3) sidebarH3.remove();
                areaSection.appendChild(sidebar);
            } else {
                // Normal mode: Show idle workers
                const workersPanel = this.uiOrchestrator.createIdleWorkersPanel(facilityId);
                const workersH3 = workersPanel.querySelector('h3');
                if (workersH3) workersH3.remove();
                areaSection.appendChild(workersPanel);
            }
        }

        // Rebuild grid
        const panelCenter = panelLayout.querySelector(`#${facilityId}-panel-center`);
        if (panelCenter) {
            const gridWrapper = panelCenter.querySelector('.grid-wrapper');
            if (gridWrapper) {
                const newGridDisplay = this.createGridDisplay(facilityId, gridWidth, gridHeight);
                gridWrapper.innerHTML = '';
                gridWrapper.appendChild(newGridDisplay);
            }
        }

        // Update production list in right panel
        this.uiOrchestrator.updateProductionListDisplay(facilityId);
    }

    /**
     * Refresh grid display for LEGACY structure (dynamic elements)
     * Fallback for old structure that uses .product-grid-panel-content selector
     */
    _refreshGridDisplayLegacy(facilityId) {
        const productGridContainer = document.querySelector(`[data-facility-id="${facilityId}"]`)?.closest('.product-grid-container');
        if (!productGridContainer) return;

        const facilityState = this.gameState.facilities[facilityId];
        const gridState = this.productGridSystem.gridState[facilityId];
        if (!gridState) return;

        const gridWidth = gridState.width;
        const gridHeight = gridState.height;

        // Update the edit mode button in the left panel header
        const editModeBtn = productGridContainer.querySelector('.edit-mode-toggle');
        if (editModeBtn) {
            editModeBtn.textContent = this.gameState.zoneEditMode[facilityId] ? 'Exit Edit Mode' : 'Change Edit Mode';
        }

        // Update left panel content based on edit mode
        const panelContent = productGridContainer.querySelector('.product-grid-panel-content');
        if (panelContent) {
            panelContent.innerHTML = '';
            if (this.gameState.zoneEditMode[facilityId]) {
                // Edit mode: Show available areas
                const sidebar = this.createAreasSidebar(facilityId, facilityState.level);
                panelContent.appendChild(sidebar);
            } else {
                // Normal mode: Show idle workers
                const workersPanel = this.uiOrchestrator.createIdleWorkersPanel(facilityId);
                panelContent.appendChild(workersPanel);
            }
        }

        // Rebuild grid - preserve all zone state using persistent indices
        const gridWrapper = productGridContainer.querySelector('.grid-wrapper');
        if (gridWrapper) {
            // Create new grid display (uses persistent indices internally)
            const newGridDisplay = this.createGridDisplay(facilityId, gridWidth, gridHeight);
            gridWrapper.innerHTML = '';
            gridWrapper.appendChild(newGridDisplay);
        }

        // Update production list in right panel
        this.uiOrchestrator.updateProductionListDisplay(facilityId);
    }
}
