/**
 * Navigation Manager
 * Manages facility selection and dynamic view switching
 */
class NavigationManager {
    constructor(gameState = null, productGridSystem = null, uiBuilder = null) {
        this.currentFacility = null;
        this.gameState = gameState;
        this.productGridSystem = productGridSystem;
        this.uiBuilder = uiBuilder;
        this.inConstructionMode = false;
        // Facility order MUST match the exact row order in data/facilities/facility.csv
        this.facilityTypes = [
            { id: 'stash', name: 'Stash', type: 'utility' },
            { id: 'lodge', name: "Worker's Lodge", type: 'facility' },
            { id: 'processing', name: 'Processing Plant', type: 'utility' },
            { id: 'trading', name: 'Trading Post', type: 'utility' },
            { id: 'farm', name: 'Farm', type: 'facility' },
            { id: 'mine', name: 'Mine', type: 'facility' },
            { id: 'ranch', name: 'Ranch', type: 'facility' },
            { id: 'fishery', name: 'Fishery', type: 'facility' }
        ];
    }

    /**
     * Initialize navigation UI
     * Only displays built facilities (Level >= 1)
     */
    initializeNavigation() {
        const sidebarNav = document.querySelector('.sidebar-nav');
        if (!sidebarNav) return;

        sidebarNav.innerHTML = '';

        // Filter to only show built facilities (level >= 1)
        for (const facility of this.facilityTypes) {
            const facilityState = this.gameState?.facilities[facility.id];
            const level = facilityState?.level || 0;

            // Only show facilities that are built (level >= 1)
            if (level >= 1) {
                const navItem = document.createElement('button');
                navItem.className = 'nav-item';
                navItem.setAttribute('data-facility', facility.id);
                navItem.innerHTML = `
                    <span class="nav-label">${facility.name}</span>
                    <span class="nav-indicators" id="${facility.id}-nav-indicators"></span>
                `;
                navItem.addEventListener('click', () => this.selectFacility(facility.id));
                sidebarNav.appendChild(navItem);
            }
        }

        // Add "Add Facility" button if there are unbuilt facilities
        this.updateAddFacilityButton();

        // Set default facility on first load
        if (!this.currentFacility && this.facilityTypes.length > 0) {
            // Find first built facility
            for (const facility of this.facilityTypes) {
                const facilityState = this.gameState?.facilities[facility.id];
                if (facilityState?.level >= 1) {
                    this.selectFacility(facility.id);
                    break;
                }
            }
        }
    }

    /**
     * Select a facility and update the main view
     */
    selectFacility(facilityId) {
        // Deselect previous facility
        if (this.currentFacility) {
            const prevBtn = document.querySelector(`.nav-item[data-facility="${this.currentFacility}"]`);
            if (prevBtn) prevBtn.classList.remove('active');
        }

        // Select new facility
        this.currentFacility = facilityId;
        const currentBtn = document.querySelector(`.nav-item[data-facility="${facilityId}"]`);
        if (currentBtn) currentBtn.classList.add('active');

        // Update main view
        this.updateMainView(facilityId);
    }

    /**
     * Update the main view based on selected facility
     */
    updateMainView(facilityId) {
        const mainArea = document.querySelector('.main-area');
        if (!mainArea) return;

        // Hide all sections
        const sections = mainArea.querySelectorAll('.facility-view');
        sections.forEach(section => section.classList.add('hidden'));

        // Show selected facility view
        const selectedView = mainArea.querySelector(`.facility-view[data-view="${facilityId}"]`);
        if (selectedView) {
            selectedView.classList.remove('hidden');

            // Initialize product grid if this is a product facility
            if (this.gameState && this.productGridSystem && this.uiBuilder) {
                this.initializeProductGrid(facilityId, selectedView);
            }
        }
    }

    /**
     * Initialize product grid for a facility if needed
     */
    initializeProductGrid(facilityId, facilityView) {
        const facility = dataLoader.getFacility(facilityId);
        if (!facility || facility.type !== 'product') {
            return;
        }

        const facilityState = this.gameState.facilities[facilityId];
        if (!facilityState) return;

        // Initialize grid if not already done
        const { x: gridWidth, y: gridHeight } = dataLoader.getGridDimensions(facilityId, facilityState.level);
        if (!this.productGridSystem.gridState[facilityId]) {
            this.productGridSystem.initializeGrid(facilityId, gridWidth, gridHeight);
        }

        // Build the grid UI
        const gridContainer = facilityView.querySelector(`#${facilityId}-grid-container`);
        if (gridContainer) {
            this.uiBuilder.buildProductGridView(facilityId, gridContainer);
        }
    }

    /**
     * Get current selected facility
     */
    getCurrentFacility() {
        return this.currentFacility;
    }

    /**
     * Check if a facility is currently selected
     */
    isFacilityActive(facilityId) {
        return this.currentFacility === facilityId;
    }

    /**
     * Update facility level display in navigation indicators
     */
    updateFacilityLevel(facilityId) {
        const indicatorsElement = document.getElementById(`${facilityId}-nav-indicators`);
        if (!indicatorsElement || !this.gameState) return;

        const facility = this.gameState.facilities[facilityId];
        if (!facility) return;

        // Update the level indicator display
        indicatorsElement.textContent = `Lv ${facility.level}`;
    }

    /**
     * Get all unbuilt facilities (level 0)
     */
    getUnbuiltFacilities() {
        return this.facilityTypes.filter(facility => {
            const facilityState = this.gameState?.facilities[facility.id];
            return facilityState?.level === 0;
        });
    }

    /**
     * Check if there are any unbuilt facilities
     */
    hasUnbuiltFacilities() {
        return this.getUnbuiltFacilities().length > 0;
    }

    /**
     * Update the "Add Facility" button state and visibility
     */
    updateAddFacilityButton() {
        const sidebar = document.querySelector('.sidebar');
        let addFacilityBtn = document.getElementById('add-facility-btn');

        if (!this.hasUnbuiltFacilities()) {
            // Remove button if no unbuilt facilities
            if (addFacilityBtn) {
                addFacilityBtn.remove();
            }
            return;
        }

        // Create button if it doesn't exist
        if (!addFacilityBtn) {
            addFacilityBtn = document.createElement('button');
            addFacilityBtn.id = 'add-facility-btn';
            addFacilityBtn.className = 'add-facility-btn';
            addFacilityBtn.innerHTML = '<span class="add-facility-icon">+</span>';
            addFacilityBtn.addEventListener('click', () => this.enterConstructionMode());
            sidebar.appendChild(addFacilityBtn);
        }

        // Update button state based on resources
        this.updateAddFacilityButtonState();
    }

    /**
     * Check if player can build at least one unbuilt facility
     */
    canBuildAnyFacility() {
        const unbuilt = this.getUnbuiltFacilities();
        for (const facility of unbuilt) {
            if (this.canBuildFacility(facility.id)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Check if a specific facility can be built
     */
    canBuildFacility(facilityId) {
        // Get Level 1 requirements from upgrade system
        if (!window.game || !window.game.upgradeSystem) return false;
        return window.game.upgradeSystem.canConstruct(facilityId);
    }

    /**
     * Update Add Facility button visual state
     */
    updateAddFacilityButtonState() {
        const addFacilityBtn = document.getElementById('add-facility-btn');
        if (!addFacilityBtn) return;

        if (this.canBuildAnyFacility()) {
            addFacilityBtn.classList.add('ready');
        } else {
            addFacilityBtn.classList.remove('ready');
        }
    }

    /**
     * Enter construction mode
     */
    enterConstructionMode() {
        this.inConstructionMode = true;
        this.currentFacility = null;

        // Hide all facility views
        const mainArea = document.querySelector('.main-area');
        if (mainArea) {
            mainArea.querySelectorAll('.facility-view').forEach(view => {
                view.classList.add('hidden');
            });
        }

        // Show construction view
        const constructionView = mainArea.querySelector('.facility-view[data-view="construction"]');
        if (constructionView) {
            constructionView.classList.remove('hidden');
            this.buildConstructionUI(constructionView);
        }

        // Update navigation
        document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
    }

    /**
     * Exit construction mode and return to a facility
     */
    exitConstructionMode() {
        this.inConstructionMode = false;
        // Return to first built facility
        for (const facility of this.facilityTypes) {
            if (this.gameState?.facilities[facility.id]?.level >= 1) {
                this.selectFacility(facility.id);
                break;
            }
        }
    }

    /**
     * Build construction mode UI
     */
    buildConstructionUI(container) {
        if (!this.uiBuilder) return;
        this.uiBuilder.buildConstructionGridUI(container);
    }
}
