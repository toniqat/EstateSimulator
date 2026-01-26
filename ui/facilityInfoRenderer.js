/**
 * Facility Info Renderer
 * Handles rendering of facility management panels and item grids
 */
class FacilityInfoRenderer {
    constructor(gameLoopManager) {
        this.gameLoopManager = gameLoopManager;
        this.uiOrchestrator = null;
    }

    /**
     * Set the UI orchestrator reference for callbacks
     * @param {ProductGridUI} productGridUI - The ProductGridUI orchestrator
     */
    setUIOrchestrator(productGridUI) {
        this.uiOrchestrator = productGridUI;
    }

    /**
     * Create Product Management panel
     * @param {string} facilityId - The facility ID
     * @param {object} facilityState - The facility state
     * @param {boolean} skipTitle - If true, skip adding the title (default: false)
     */
    createFacilityInfo(facilityId, facilityState, skipTitle = false) {
        const infoPanel = document.createElement('div');
        infoPanel.className = 'product-management-panel';

        const facility = dataLoader.getFacility(facilityId);

        // Header with facility name (only if not skipped)
        if (!skipTitle) {
            const header = document.createElement('div');
            header.className = 'panel-header';
            header.innerHTML = `<h3>${facility ? facility.name : facilityId}</h3>`;
            infoPanel.appendChild(header);
        }

        // Production List (items that zones will produce)
        const productionSection = document.createElement('div');
        productionSection.className = 'production-list-section';
        productionSection.innerHTML = '<h4>Production per 24 Hour</h4>';

        // Use new grid-based production list display
        const productionGrid = this.uiOrchestrator.createProductionListGrid(facilityId);
        productionSection.appendChild(productionGrid);
        infoPanel.appendChild(productionSection);

        // Storage Panel - unified section combining inventory, capacity, and collect button
        const storageSection = document.createElement('div');
        storageSection.className = 'storage-panel-section';

        // Storage header with capacity progress bar on the same line
        const storageHeader = document.createElement('div');
        storageHeader.className = 'storage-header';

        const storageTitle = document.createElement('h4');
        storageTitle.textContent = 'Storage';
        storageHeader.appendChild(storageTitle);

        // Capacity container with progress bar and percentage text
        const capacityContainer = document.createElement('div');
        capacityContainer.className = 'storage-capacity-inline';
        capacityContainer.innerHTML = `
            <div class="capacity-meter" id="${facilityId}-capacity-meter">
                <div class="capacity-fill" id="${facilityId}-capacity-fill" style="width: 0%"></div>
            </div>
            <span class="capacity-text" id="${facilityId}-capacity-text">0%</span>
        `;
        storageHeader.appendChild(capacityContainer);
        storageSection.appendChild(storageHeader);

        // Collect All Button - immediately above the grid
        const collectBtn = document.createElement('button');
        collectBtn.className = 'btn btn-primary btn-collect-all';
        collectBtn.textContent = 'Collect All';
        collectBtn.onclick = () => this.gameLoopManager.collectFromFacility(facilityId);
        storageSection.appendChild(collectBtn);

        // Inventory Grid with vertical scroll
        const inventoryList = document.createElement('div');
        inventoryList.className = 'inventory-item-grid';
        inventoryList.id = `${facilityId}-inventory-list`;
        storageSection.appendChild(inventoryList);

        infoPanel.appendChild(storageSection);

        return infoPanel;
    }

    /**
     * Create an item grid for an area (displays obtainable items)
     * Fixed 4x1 Grid (1 row, 4 columns)
     * Displays up to 3 items, 4th slot shows +N count of remaining items
     */
    createAreaItemGrid(area) {
        const gridContainer = document.createElement('div');
        gridContainer.className = 'area-item-grid';
        gridContainer.style.gridTemplateColumns = 'repeat(4, 1fr)';
        gridContainer.style.gridTemplateRows = 'auto';

        // Get the product item(s) from this area
        const obtainableItems = this.getObtainableItemsForArea(area);

        // Fixed 4 slots (4x1)
        const maxSlots = 4;
        const maxDisplayItems = 3;
        const itemsToDisplay = obtainableItems.slice(0, maxDisplayItems);
        const hiddenCount = Math.max(0, obtainableItems.length - maxDisplayItems);

        // Create item slots
        for (let i = 0; i < maxSlots; i++) {
            const slot = document.createElement('div');
            slot.className = 'area-item-slot';

            if (i < itemsToDisplay.length) {
                // Display item icon and quantity badge
                const itemData = itemsToDisplay[i];
                slot.innerHTML = `
                    <div class="item-icon">${itemData.itemId.charAt(0).toUpperCase()}</div>
                    ${itemData.quantity > 1 ? `<div class="item-quantity-badge">x${itemData.quantity}</div>` : ''}
                `;
                slot.title = `${itemData.itemName} (x${itemData.quantity})`;
                slot.setAttribute('data-item-id', itemData.itemId);
                slot.setAttribute('data-item-name', itemData.itemName);
                slot.style.cursor = 'pointer';

                // Click handler - open modal for this single item
                slot.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.gameLoopManager.showItemInfoModal([itemData], 0);
                });
            } else if (i === maxSlots - 1 && hiddenCount > 0) {
                // 4th slot shows count of hidden items (+N)
                slot.className = 'area-item-slot hidden-count-slot';
                slot.innerHTML = `<div class="hidden-count">+${hiddenCount}</div>`;
                slot.title = `${hiddenCount} more item${hiddenCount > 1 ? 's' : ''}`;
                slot.style.cursor = 'pointer';

                // Click handler - open modal showing all hidden items
                slot.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const hiddenItems = obtainableItems.slice(maxDisplayItems);
                    this.gameLoopManager.showItemInfoModal(hiddenItems, 0);
                });
            } else {
                // Empty slot
                slot.className = 'area-item-slot empty-slot';
            }

            gridContainer.appendChild(slot);
        }

        return gridContainer;
    }

    /**
     * Get obtainable items for an area
     * Returns array of {itemId, itemName, quantity}
     */
    getObtainableItemsForArea(area) {
        const obtainableItems = [];

        // Each area produces a specific item with a quantity
        if (area.productItem && area.productItem.itemId) {
            const item = dataLoader.getItem(area.productItem.itemId);
            const itemName = item ? item.name : area.productItem.itemId;
            const quantity = area.productItem.itemProductCount || 1;

            obtainableItems.push({
                itemId: area.productItem.itemId,
                itemName: itemName,
                quantity: quantity
            });
        }

        return obtainableItems;
    }
}
