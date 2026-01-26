/**
 * Product Grid UI
 * Handles rendering and interaction for product facility grids
 */
class ProductGridUI {
    constructor(gameState, productGridSystem, gameLoopManager, workerGridSystem = null) {
        this.gameState = gameState;
        this.productGridSystem = productGridSystem;
        this.gameLoopManager = gameLoopManager;
        this.workerGridSystem = workerGridSystem;

        // Initialize drag-drop module
        this.dragDrop = new ProductGridDragDrop(
            gameState,
            productGridSystem,
            workerGridSystem,
            gameLoopManager
        );
        // Pass reference back to enable UI callbacks
        this.dragDrop.setUIOrchestrator(this);

        // Initialize renderer module
        this.renderer = new ProductGridRenderer(
            gameState,
            productGridSystem,
            gameLoopManager.stashManager
        );
        // Pass references to renderer for orchestration callbacks
        this.renderer.setUIOrchestrator(this);
        this.renderer.setUIBuilder(gameLoopManager.uiBuilder);

        // Initialize worker grid renderer module
        this.workerGridRenderer = new WorkerGridRenderer(
            gameState,
            gameLoopManager,
            workerGridSystem
        );
        // Pass reference back for handler callbacks
        this.workerGridRenderer.setUIOrchestrator(this);

        // Initialize facility info renderer module
        this.facilityInfoRenderer = new FacilityInfoRenderer(gameLoopManager);
        // Pass reference back for callbacks
        this.facilityInfoRenderer.setUIOrchestrator(this);
    }

    /**
     * State accessors - forward to dragDrop module
     */
    get draggedArea() {
        return this.dragDrop.draggedArea;
    }

    set draggedArea(value) {
        this.dragDrop.draggedArea = value;
    }

    get draggedWorker() {
        return this.dragDrop.draggedWorker;
    }

    set draggedWorker(value) {
        this.dragDrop.draggedWorker = value;
    }


    /**
     * Handle drag over worker area container (Delegated to ProductGridDragDrop)
     */
    handleWorkerAreaDragOver(e, slotsContainer) {
        return this.dragDrop.handleWorkerAreaDragOver(e, slotsContainer);
    }

    /**
     * Handle drag leave worker area container (Delegated to ProductGridDragDrop)
     */
    handleWorkerAreaDragLeave(e, slotsContainer) {
        return this.dragDrop.handleWorkerAreaDragLeave(e, slotsContainer);
    }

    /**
     * Handle drop on worker area container (Delegated to ProductGridDragDrop)
     */
    handleWorkerAreaDrop(e, zoneKey, facilityId) {
        return this.dragDrop.handleWorkerAreaDrop(e, zoneKey, facilityId);
    }


    /**
     * Handle drag over worker slot (Delegated to ProductGridDragDrop)
     */
    handleWorkerSlotDragOver(e, slot) {
        return this.dragDrop.handleWorkerSlotDragOver(e, slot);
    }

    /**
     * Handle drag leave worker slot (Delegated to ProductGridDragDrop)
     */
    handleWorkerSlotDragLeave(e, slot) {
        return this.dragDrop.handleWorkerSlotDragLeave(e, slot);
    }

    /**
     * Handle drop on worker slot (Delegated to ProductGridDragDrop)
     */
    handleWorkerSlotDrop(e, zoneKey, slotIndex, facilityId) {
        return this.dragDrop.handleWorkerSlotDrop(e, zoneKey, slotIndex, facilityId);
    }


    /**
     * Handle drag start from worker (Delegated to ProductGridDragDrop)
     */
    handleWorkerDragStart(e, workerId, sourceZone) {
        return this.dragDrop.handleWorkerDragStart(e, workerId, sourceZone);
    }

    /**
     * Handle drag end from worker (Delegated to ProductGridDragDrop)
     */
    handleWorkerDragEnd(e) {
        return this.dragDrop.handleWorkerDragEnd(e);
    }



    /**
     * Handle drag start from sidebar area
     */
    // ============================================================================
    // AREA PLACEMENT DRAG-DROP (Delegated to ProductGridDragDrop)
    // ============================================================================

    handleAreaDragStart(e, facilityId, area) {
        return this.dragDrop.handleAreaDragStart(e, facilityId, area);
    }

    handleAreaDragEnd(e) {
        return this.dragDrop.handleAreaDragEnd(e);
    }

    handleGridDragOver(e) {
        return this.dragDrop.handleGridDragOver(e);
    }

    handleGridDragLeave(e) {
        return this.dragDrop.handleGridDragLeave(e);
    }

    handleGridDrop(e, facilityId) {
        return this.dragDrop.handleGridDrop(e, facilityId);
    }

    handlePlacedAreaDragStart(e, facilityId, areaId, placementIndex) {
        return this.dragDrop.handlePlacedAreaDragStart(e, facilityId, areaId, placementIndex);
    }

    handlePlacedAreaDragEnd(e) {
        return this.dragDrop.handlePlacedAreaDragEnd(e);
    }

    // ============================================================================
    // RENDERING DELEGATION METHODS (Delegated to ProductGridRenderer)
    // ============================================================================

    /**
     * Build product grid UI for a facility (Delegated to ProductGridRenderer)
     */
    buildProductGridUI(facilityId) {
        return this.renderer.buildProductGridUI(facilityId);
    }

    /**
     * Create the grid display (Delegated to ProductGridRenderer)
     */
    createGridDisplay(facilityId, gridWidth, gridHeight) {
        return this.renderer.createGridDisplay(facilityId, gridWidth, gridHeight);
    }

    /**
     * Create a placed area element on the grid (Delegated to ProductGridRenderer)
     */
    createPlacedAreaElement(facilityId, placement, placementIndex, cellSize = 80) {
        return this.renderer.createPlacedAreaElement(facilityId, placement, placementIndex, cellSize);
    }

    /**
     * Create production list grid (Delegated to ProductGridRenderer)
     */
    createProductionListGrid(facilityId) {
        return this.renderer.createProductionListGrid(facilityId);
    }

    /**
     * Create the areas sidebar (Delegated to ProductGridRenderer)
     */
    createAreasSidebar(facilityId, facilityLevel) {
        return this.renderer.createAreasSidebar(facilityId, facilityLevel);
    }

    /**
     * Create a draggable area item for the sidebar (Delegated to ProductGridRenderer)
     */
    createAreaItem(facilityId, area, isDisabled = false, areaCount = -1, currentPlacementCount = 0) {
        return this.renderer.createAreaItem(facilityId, area, isDisabled, areaCount, currentPlacementCount);
    }

    /**
     * Refresh the grid display for a facility (Delegated to ProductGridRenderer)
     */
    refreshGridDisplay(facilityId) {
        return this.renderer.refreshGridDisplay(facilityId);
    }

    /**
     * Create worker grid for a production area (Delegated to WorkerGridRenderer)
     */
    createWorkerGrid(facilityId, zoneKey, area, placementIndex, isEditMode = false) {
        return this.workerGridRenderer.createWorkerGrid(facilityId, zoneKey, area, placementIndex, isEditMode);
    }

    /**
     * Update a worker slot with worker data (Delegated to WorkerGridRenderer)
     */
    updateWorkerSlot(slot, worker, isEditMode = false) {
        return this.workerGridRenderer.updateWorkerSlot(slot, worker, isEditMode);
    }

    /**
     * Create idle workers panel (Delegated to WorkerGridRenderer)
     */
    createIdleWorkersPanel(facilityId) {
        return this.workerGridRenderer.createIdleWorkersPanel(facilityId);
    }

    /**
     * Update stat bonus display for a zone (Delegated to WorkerGridRenderer)
     */
    updateStatBonusDisplay(zoneKey) {
        return this.workerGridRenderer.updateStatBonusDisplay(zoneKey);
    }

    /**
     * Create facility information panel (Delegated to FacilityInfoRenderer)
     */
    createFacilityInfo(facilityId, facilityState, skipTitle = false) {
        return this.facilityInfoRenderer.createFacilityInfo(facilityId, facilityState, skipTitle);
    }

    /**
     * Create area item grid (Delegated to FacilityInfoRenderer)
     */
    createAreaItemGrid(area) {
        return this.facilityInfoRenderer.createAreaItemGrid(area);
    }

    /**
     * Get obtainable items for an area (Delegated to FacilityInfoRenderer)
     */
    getObtainableItemsForArea(area) {
        return this.facilityInfoRenderer.getObtainableItemsForArea(area);
    }

    /**
     * Update the production list display for a facility
     * Called when areas are placed/removed/moved to refresh the production grid
     */
    updateProductionListDisplay(facilityId) {
        // Search for the production grid container anywhere in the facility section
        const facilityGridContainer = document.getElementById(`${facilityId}-grid-container`);
        if (!facilityGridContainer) {
            return; // Facility view not currently visible or not loaded
        }

        // Find the production-grid-container within the facility's products section
        const oldGrid = facilityGridContainer.querySelector('.production-grid-container');
        if (!oldGrid) {
            return; // Production grid hasn't been initialized yet
        }

        // Rebuild the production grid
        const productionGrid = this.createProductionListGrid(facilityId);

        // Replace the old grid with the new one
        oldGrid.replaceWith(productionGrid);
    }


    /**
     * Transform the left panel into an unassign drop zone (Delegated to ProductGridDragDrop)
     */
    transformPanelToUnassignZone(sourceZone) {
        return this.dragDrop.transformPanelToUnassignZone(sourceZone);
    }

    /**
     * Revert the left panel back to showing available workers (Delegated to ProductGridDragDrop)
     */
    revertPanelFromUnassignZone(sourceZone) {
        return this.dragDrop.revertPanelFromUnassignZone(sourceZone);
    }
}
