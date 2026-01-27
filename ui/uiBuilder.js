/**
 * UI Builder
 * Builds dynamic UI elements from game data
 */
class UIBuilder {
    constructor(gameState, stashManager, gameLoopManager, productGridSystem = null, workerGridSystem = null, facilityStorageManager = null) {
        this.gameState = gameState;
        this.stashManager = stashManager;
        this.gameLoopManager = gameLoopManager;
        this.productGridSystem = productGridSystem;
        this.workerGridSystem = workerGridSystem;
        this.facilityStorageManager = facilityStorageManager;
        this.productGridUI = productGridSystem ? new ProductGridUI(gameState, productGridSystem, gameLoopManager, workerGridSystem) : null;

        // Filtering and sorting state for recipes UI
        this.currentFilter = 'all';
        this.currentSort = 'id';
        this.currentStashFilter = 'all';
        this.currentStashSort = 'id';
    }

    /**
     * Render a simplified item display element (Simplified Item View Standard)
     * Used across UI for consistent icon-based item representation
     *
     * @param {Object} item - Item object with {item: itemData, itemId, quantity}
     * @returns {HTMLElement} - Container div with grade-colored background, centered first letter icon, and quantity badge
     *
     * Specifications:
     * - Background: Grade-based color (class: grade-{grade})
     * - Icon: Centered first letter of item name (white, bold, 1.8em)
     * - Count: Quantity at bottom-right in semi-transparent badge
     * - Text: Item name is NOT displayed (compact icon-only format)
     */
    renderSimplifiedItem(item) {
        const itemData = item.item;
        const itemGrade = itemData?.grade || 'common';
        const itemName = itemData?.name || item.itemId;
        const firstLetter = itemName.charAt(0).toUpperCase();

        const container = document.createElement('div');
        container.className = `simplified-item-view grade-${itemGrade}`;
        container.title = itemName; // Tooltip shows full name on hover
        container.innerHTML = `
            <div class="simplified-item-icon">${firstLetter}</div>
            <span class="simplified-item-quantity">×${item.quantity}</span>
        `;

        return container;
    }

    /**
     * Render a cost item for grid display (for Required Materials sections)
     * Shows item grade background, first letter icon, item name, and quantity info
     *
     * @param {Object} cost - Cost object with {itemName, itemId, required, have, isSufficient}
     * @param {Object} itemData - Item data containing grade information
     * @returns {HTMLElement} - Container div with grid-style display
     */
    renderCostItemGrid(cost, itemData) {
        const itemGrade = itemData?.grade || 'common';
        const itemName = cost.itemName || cost.itemId;
        const firstLetter = itemName.charAt(0).toUpperCase();
        const statusClass = cost.isSufficient ? 'sufficient' : 'insufficient';
        const quantityStatusClass = cost.isSufficient ? 'available' : 'unavailable';

        const container = document.createElement('div');
        container.className = `cost-item-grid-cell grade-${itemGrade} ${statusClass}`;
        container.title = itemName;
        container.innerHTML = `
            <div class="cost-item-grid-icon">${firstLetter}</div>
            <div class="cost-item-grid-name">${itemName}</div>
            <div class="cost-item-grid-quantity ${quantityStatusClass}">${cost.required} (${cost.have})</div>
        `;

        return container;
    }

    /**
     * Render a grid container with cost items
     * Used for Required Materials sections in construction and upgrade panels
     *
     * @param {Array} costs - Array of cost objects
     * @returns {HTMLElement} - Grid container with cost items
     */
    renderCostItemsGridContainer(costs) {
        const gridContainer = document.createElement('div');
        gridContainer.className = 'cost-items-grid';

        for (const cost of costs) {
            const itemData = dataLoader.getItem(cost.itemId);
            const costCell = this.renderCostItemGrid(cost, itemData);
            gridContainer.appendChild(costCell);
        }

        return gridContainer;
    }

    /**
     * Build entire dynamic UI
     */
    buildDynamicUI() {
        this.buildRecipesUI();
        this.buildTradingPostUI();
        this.buildStashUI();
    }

    /**
     * Build product grid UI for a specific facility
     */
    buildProductGridView(facilityId, container) {
        if (!this.productGridUI) {
            console.warn('ProductGridUI not initialized');
            return;
        }

        container.innerHTML = '';
        const gridUI = this.productGridUI.buildProductGridUI(facilityId);
        if (gridUI) {
            container.appendChild(gridUI);

            // Ensure grid state matches what was built
            if (this.productGridSystem && this.productGridSystem.gridState[facilityId]) {
                // The gridUI contains a grid-display-wrapper, need to find the .product-grid inside
                const gridElement = gridUI.querySelector('.product-grid');
                if (gridElement) {
                    const gridState = this.productGridSystem.gridState[facilityId];
                    // Verify the grid was created with the correct dimensions
                    // Count the cells to verify
                    const cellCount = gridElement.querySelectorAll('.grid-cell').length;
                    const expectedCount = gridState.width * gridState.height;
                    if (cellCount !== expectedCount) {
                        console.warn(`Grid cell mismatch: expected ${expectedCount}, got ${cellCount}. Reinitializing...`);
                        this.productGridSystem.initializeGrid(facilityId, gridState.width, gridState.height);
                    }
                }
            }
        }
    }

    /**
     * Build recipes section with two-panel layout
     */
    buildRecipesUI() {
        const itemGrid = document.getElementById('processing-item-grid');
        if (!itemGrid) return;

        itemGrid.innerHTML = '';

        // Get all recipes from data loader
        const recipes = dataLoader.recipeData || {};
        const allItems = dataLoader.getAllItems();
        const availableRecipeIds = this.gameLoopManager.craftingSystem.getAvailableRecipes();

        // Filter to only available recipes at current processing level
        let filteredRecipes = Object.entries(recipes).filter(([outputId, recipe]) => {
            if (!availableRecipeIds.includes(outputId)) return false; // Not unlocked yet
            return this.shouldShowRecipe(outputId, allItems);
        });

        // Sort the recipes
        filteredRecipes = this.sortRecipes(filteredRecipes, allItems);

        // Render filtered and sorted recipes
        for (const [outputId, recipe] of filteredRecipes) {
            const itemCard = this.createProcessingItemCard(outputId, recipe, allItems);
            itemGrid.appendChild(itemCard);
        }

        // Update availability states for all cards
        this.updateItemCardAvailability();
    }

    /**
     * Check if a recipe should be shown based on current filter
     */
    shouldShowRecipe(outputId, allItems) {
        const item = allItems[outputId];
        const itemType = item?.type || 'Special';

        if (this.currentFilter === 'all') {
            return true;
        }

        // Check if item type matches filter
        const typeToFilter = {
            'farm': 'Farm',
            'mine': 'Mine',
            'ranch': 'Ranch',
            'fishery': 'Fishery'
        };

        if (this.currentFilter === 'etc') {
            // ETC includes everything except Farm, Mine, Ranch, and Fishery
            return !['Farm', 'Mine', 'Ranch', 'Fishery'].includes(itemType);
        }

        return itemType === typeToFilter[this.currentFilter];
    }

    /**
     * Sort recipes based on current sort mode
     */
    sortRecipes(recipes, allItems) {
        if (this.currentSort === 'id') {
            // Sort by ID ascending
            return recipes.sort((a, b) => a[0].localeCompare(b[0]));
        } else if (this.currentSort === 'availability') {
            // Sort by availability: craftable first, then by ID
            return recipes.sort((a, b) => {
                const aCanCraft = this.gameLoopManager.craftingSystem.canCraft(a[0]);
                const bCanCraft = this.gameLoopManager.craftingSystem.canCraft(b[0]);

                // If craftability differs, craftable items come first
                if (aCanCraft !== bCanCraft) {
                    return aCanCraft ? -1 : 1;
                }

                // If same craftability, sort by ID
                return a[0].localeCompare(b[0]);
            });
        }

        return recipes;
    }

    /**
     * Create processing item card for left panel
     */
    createProcessingItemCard(outputId, recipe, allItems) {
        const card = document.createElement('div');
        card.className = 'processing-item-card';
        card.setAttribute('data-item-id', outputId);

        const item = allItems[outputId];
        const itemGrade = item?.grade || 'common';
        const canCraft = this.gameLoopManager.craftingSystem.canCraft(outputId);

        if (!canCraft) {
            card.classList.add('unavailable');
        }

        const firstLetter = (item?.name || outputId).charAt(0).toUpperCase();

        card.innerHTML = `
            <div class="processing-item-icon grade-${itemGrade}">${firstLetter}</div>
            <div class="processing-item-name">${item ? item.name : outputId}</div>
        `;

        card.addEventListener('click', () => {
            this.gameLoopManager.showCraftingDetails(outputId);
        });

        return card;
    }

    /**
     * Update item card availability state (active vs unavailable)
     */
    updateItemCardAvailability() {
        document.querySelectorAll('.processing-item-card').forEach(card => {
            const itemId = card.getAttribute('data-item-id');
            const canCraft = this.gameLoopManager.craftingSystem.canCraft(itemId);

            if (canCraft) {
                card.classList.remove('unavailable');
            } else {
                card.classList.add('unavailable');
            }
        });
    }

    /**
     * Update crafting details panel if it's currently displaying an item
     * Updates material counts and max craftable amount without rebuilding the panel
     */
    updateCraftingDetailsIfOpen() {
        const selectedCard = document.querySelector('.processing-item-card.selected');
        if (!selectedCard) return;

        const itemId = selectedCard.getAttribute('data-item-id');
        const recipe = dataLoader.getRecipe(itemId);
        if (!recipe) return;

        // Get materials from recipe (handles both old and new formats)
        const materials = this.gameLoopManager.craftingSystem.getMaterials(recipe);

        // Recalculate max craftable amount
        const maxCraftable = this.gameLoopManager.craftingSystem.getMaxCraftableAmount(itemId);

        // Update ingredient counts AND their validation CSS classes
        const ingredientItems = document.querySelectorAll('.ingredient-item');
        for (let i = 0; i < materials.length && i < ingredientItems.length; i++) {
            const input = materials[i];
            const have = this.stashManager.getItemQuantity(input.itemId);
            const isAvailable = have >= input.count;
            const countElement = ingredientItems[i].querySelector('.ingredient-count');

            if (countElement) {
                // Update text content
                countElement.textContent = `${input.count} (${have})`;

                // Re-validate and update CSS class
                countElement.classList.remove('available');
                if (isAvailable) {
                    countElement.classList.add('available');
                }
            }
        }

        // Update max craftable amount in button text and enable/disable based on availability
        const craftButton = document.querySelector('.btn-craft');
        if (craftButton) {
            craftButton.textContent = `Craft (Max: ${maxCraftable})`;

            // Disable craft button if no items can be crafted
            if (maxCraftable <= 0) {
                craftButton.disabled = true;
                craftButton.classList.add('disabled');
            } else {
                craftButton.disabled = false;
                craftButton.classList.remove('disabled');
            }
        }

        // Use event delegation for quantity adjustment buttons to avoid DOM thrashing
        // Only set up listeners once per panel - they'll persist across updates
        const quantityControl = document.querySelector('.quantity-control');
        if (quantityControl && !quantityControl.hasAttribute('data-listeners-attached')) {
            quantityControl.setAttribute('data-listeners-attached', 'true');

            quantityControl.addEventListener('click', (e) => {
                const button = e.target.closest('.quantity-btn');
                if (!button) return;

                // Get the currently selected item (in case panel is showing a different item)
                const selectedCard = document.querySelector('.processing-item-card.selected');
                const currentItemId = selectedCard?.getAttribute('data-item-id');
                if (!currentItemId) return;

                const action = button.getAttribute('data-action');
                const maxCraftable = this.gameLoopManager.craftingSystem.getMaxCraftableAmount(currentItemId);

                if (action === 'decrease-bulk') {
                    const amount = parseInt(button.getAttribute('data-amount')) || 10;
                    this.gameLoopManager.decreaseCraftQuantityBulk(currentItemId, amount, maxCraftable);
                } else if (action === 'decrease') {
                    this.gameLoopManager.decreaseCraftQuantity(currentItemId);
                } else if (action === 'increase') {
                    this.gameLoopManager.increaseCraftQuantity(currentItemId, maxCraftable);
                } else if (action === 'increase-bulk') {
                    const amount = parseInt(button.getAttribute('data-amount')) || 10;
                    this.gameLoopManager.increaseCraftQuantityBulk(currentItemId, amount, maxCraftable);
                }
            });
        }
    }

    /**
     * Build crafting details panel (right side)
     */
    buildCraftingDetailsPanel(outputId) {
        const detailsPanel = document.getElementById('processing-details-panel');
        if (!detailsPanel) return;

        const recipe = dataLoader.getRecipe(outputId);
        if (!recipe) return;

        // Get materials from recipe (handles both old and new formats)
        const materials = this.gameLoopManager.craftingSystem.getMaterials(recipe);
        if (!materials || materials.length === 0) return;

        const allItems = dataLoader.getAllItems();
        const item = allItems[outputId];
        const itemGrade = item?.grade || 'common';
        const itemType = item?.type || 'Special';
        const firstLetter = (item?.name || outputId).charAt(0).toUpperCase();
        const maxCraftable = this.gameLoopManager.craftingSystem.getMaxCraftableAmount(outputId);

        // Build ingredients HTML
        const ingredientsHTML = materials.map(input => {
            const ingredientItem = allItems[input.itemId];
            const ingredientLetter = (ingredientItem?.name || input.itemId).charAt(0).toUpperCase();
            const have = this.stashManager.getItemQuantity(input.itemId);
            const isAvailable = have >= input.count;
            const availabilityClass = isAvailable ? 'available' : '';

            return `
                <div class="ingredient-item">
                    <div class="ingredient-icon">${ingredientLetter}</div>
                    <div class="ingredient-name">${ingredientItem ? ingredientItem.name : input.itemId}</div>
                    <div class="ingredient-count ${availabilityClass}">${input.count} (${have})</div>
                </div>
            `;
        }).join('');

        detailsPanel.innerHTML = `
            <div class="crafting-details-header">
                <div class="crafting-details-icon grade-${itemGrade}">${firstLetter}</div>
                <div>
                    <div class="crafting-details-name">${item ? item.name : outputId}</div>
                    <div class="crafting-details-type">${itemType}</div>
                </div>
            </div>

            <div class="crafting-ingredients">
                <h4>Required Materials</h4>
                <div class="ingredients-grid">
                    ${ingredientsHTML}
                </div>
            </div>

            <div class="quantity-control">
                <button class="btn btn-secondary quantity-btn" data-action="decrease-bulk" data-amount="10"><span>−10</span></button>
                <button class="btn btn-secondary quantity-btn" data-action="decrease"><span>−</span></button>
                <span class="quantity-display" id="craft-quantity-${outputId}">1</span>
                <button class="btn btn-secondary quantity-btn" data-action="increase"><span>+</span></button>
                <button class="btn btn-secondary quantity-btn" data-action="increase-bulk" data-amount="10"><span>+10</span></button>
            </div>

            <button class="btn btn-primary btn-craft" onclick="game.craftWithQuantity('${outputId}')">
                Craft (Max: ${maxCraftable})
            </button>
        `;

        // Update selected state and availability state in left panel
        document.querySelectorAll('.processing-item-card').forEach(card => {
            card.classList.remove('selected');
        });
        document.querySelector(`[data-item-id="${outputId}"]`)?.classList.add('selected');

        // Update availability states for all cards
        this.updateItemCardAvailability();

        // Initialize quantity button event listeners (this ensures fresh maxCraftable is used)
        this.updateCraftingDetailsIfOpen();
    }

    /**
     * Check if a stash item should be shown based on current filter
     */
    shouldShowStashItem(itemId, allItems) {
        const item = allItems[itemId];
        const itemType = item?.type || 'Special';

        if (this.currentStashFilter === 'all') {
            return true;
        }

        // Check if item type matches filter
        const typeToFilter = {
            'farm': 'Farm',
            'mine': 'Mine',
            'ranch': 'Ranch',
            'fishery': 'Fishery'
        };

        if (this.currentStashFilter === 'etc') {
            // ETC includes everything except Farm, Mine, Ranch, and Fishery
            return !['Farm', 'Mine', 'Ranch', 'Fishery'].includes(itemType);
        }

        return itemType === typeToFilter[this.currentStashFilter];
    }

    /**
     * Sort stash items based on current sort mode
     */
    sortStashItems(filteredItems) {
        if (this.currentStashSort === 'id') {
            // Sort by item ID ascending
            return filteredItems.sort((a, b) => a.data.itemId.localeCompare(b.data.itemId));
        } else if (this.currentStashSort === 'quantity') {
            // Sort by quantity descending (highest first)
            return filteredItems.sort((a, b) => b.data.quantity - a.data.quantity);
        }

        return filteredItems;
    }

    /**
     * Build stash grid
     */
    buildStashUI() {
        const stashGrid = document.getElementById('stash-grid');
        if (!stashGrid) return;

        // Always rebuild the entire grid when filter changes
        stashGrid.innerHTML = '';

        const maxCapacity = this.gameState.stash.capacity;
        const allItems = dataLoader.getAllItems();

        // Collect filtered items in order
        const filteredItems = [];
        for (let i = 0; i < maxCapacity; i++) {
            const slot = this.gameState.stash.slots[i];

            // Check if this slot's item should be shown based on current filter
            if (slot && this.shouldShowStashItem(slot.itemId, allItems)) {
                filteredItems.push({ index: i, data: slot });
            }
        }

        // Sort the filtered items based on current sort mode
        this.sortStashItems(filteredItems);

        // Render filtered items (occupied slots - no grid index)
        for (const filteredItem of filteredItems) {
            const slotDiv = document.createElement('div');
            slotDiv.className = 'stash-slot occupied';
            slotDiv.setAttribute('data-slot-index', filteredItem.index);
            slotDiv.draggable = true;

            const item = dataLoader.getItem(filteredItem.data.itemId);
            const itemGrade = item?.grade || 'common';
            slotDiv.classList.add(`grade-${itemGrade}`);
            const firstLetter = (item?.name || filteredItem.data.itemId).charAt(0).toUpperCase();
            slotDiv.innerHTML = `
                <div class="slot-item-icon">${firstLetter}</div>
                <span class="slot-item-quantity">×${filteredItem.data.quantity}</span>
            `;

            // Drag-drop event listeners
            slotDiv.addEventListener('dragstart', (e) => this.gameLoopManager.handleDragStart(e));
            slotDiv.addEventListener('dragover', (e) => this.gameLoopManager.handleDragOver(e));
            slotDiv.addEventListener('drop', (e) => this.gameLoopManager.handleDrop(e));
            slotDiv.addEventListener('dragend', (e) => this.gameLoopManager.handleDragEnd(e));

            // Click handler to show item details modal
            slotDiv.addEventListener('click', () => {
                const itemToShow = {
                    itemId: filteredItem.data.itemId,
                    itemName: dataLoader.getItem(filteredItem.data.itemId)?.name || filteredItem.data.itemId,
                    quantity: filteredItem.data.quantity
                };
                this.gameLoopManager.showItemInfoModal([itemToShow]);
            });

            stashGrid.appendChild(slotDiv);
        }

        // Render empty slots with their grid index numbers
        for (let i = 0; i < maxCapacity; i++) {
            const slot = this.gameState.stash.slots[i];

            // Only render empty slots
            if (slot === null) {
                const slotDiv = document.createElement('div');
                slotDiv.className = 'stash-slot';
                slotDiv.draggable = true;
                slotDiv.innerHTML = `<span class="slot-index">${i}</span>`;

                // Drag-drop event listeners (for moving items into empty slots)
                slotDiv.addEventListener('dragstart', (e) => this.gameLoopManager.handleDragStart(e));
                slotDiv.addEventListener('dragover', (e) => this.gameLoopManager.handleDragOver(e));
                slotDiv.addEventListener('drop', (e) => this.gameLoopManager.handleDrop(e));
                slotDiv.addEventListener('dragend', (e) => this.gameLoopManager.handleDragEnd(e));

                stashGrid.appendChild(slotDiv);
            }
        }
    }

    /**
     * Build a pending worker card (for hiring)
     */
    buildPendingWorkerCard(worker) {
        const grade = dataLoader.getWorkerGrade(worker.grade);
        const maxLevel = dataLoader.getMaxLevelForGrade(worker.grade);
        const cost = dataLoader.calculateHiringCost(grade, worker.level);
        const isMaxLevel = dataLoader.isWorkerAtMaxLevel(worker);

        const expBarHtml = isMaxLevel 
            ? `<div class="worker-exp-bar-container max-level">
                    <div class="worker-exp-bar">
                        <div class="worker-exp-bar-fill" style="width: 100%"></div>
                        <div class="worker-exp-overlay">
                            <span class="exp-level">Lv ${maxLevel} / ${maxLevel}</span>
                            <span class="exp-progress">0 / 0</span>
                        </div>
                    </div>
                </div>`
            : `<div class="worker-exp-bar-container">
                    <div class="worker-exp-bar">
                        <div class="worker-exp-bar-fill" style="width: 0%"></div>
                        <div class="worker-exp-overlay">
                            <span class="exp-level">Lv ${worker.level} / ${maxLevel}</span>
                            <span class="exp-progress">0 / 3000</span>
                        </div>
                    </div>
                </div>`;

        return `
            <div class="worker-card pending" data-worker-id="${worker.id}">
                <div class="worker-card-header">
                    <span class="worker-name">${worker.name}</span>
                    <span class="worker-rarity" style="background-color: ${this.getRarityColor(worker.grade)}">${grade ? grade.name : worker.grade}</span>
                </div>
                <div class="worker-stats">
                    <div class="worker-stat">
                        <span class="worker-stat-label">STR:</span>
                        <span class="worker-stat-value">${worker.stats.str}</span>
                    </div>
                    <div class="worker-stat">
                        <span class="worker-stat-label">AGI:</span>
                        <span class="worker-stat-value">${worker.stats.agi}</span>
                    </div>
                    <div class="worker-stat">
                        <span class="worker-stat-label">INT:</span>
                        <span class="worker-stat-value">${worker.stats.int}</span>
                    </div>
                    <div class="worker-stat">
                        <span class="worker-stat-label">END:</span>
                        <span class="worker-stat-value">${worker.stats.end}</span>
                    </div>
                </div>
                ${expBarHtml}
                <div class="worker-actions">
                    <button class="btn btn-primary btn-sm" onclick="game.hireWorker('${worker.id}')">Hire (${cost} Gold)</button>
                    <button class="btn btn-secondary btn-sm" onclick="game.dismissWorker('${worker.id}')">Dismiss</button>
                </div>
            </div>
        `;
    }

    /**
     * Build a hired worker card
     */
    buildHiredWorkerCard(worker) {
        const grade = dataLoader.getWorkerGrade(worker.grade);
        const maxLevel = dataLoader.getMaxLevelForGrade(worker.grade);
        const isMaxLevel = dataLoader.isWorkerAtMaxLevel(worker);

        let facilityName = 'Unassigned';
        if (worker.assignedTo) {
            const [facilityId, areaId] = worker.assignedTo.split('_');
            const facility = dataLoader.getFacility(facilityId);
            if (facility) {
                const area = dataLoader.getProductArea(areaId);
                facilityName = area ? `${facility.name} - ${areaId}` : facility.name;
            }
        }

        // Initialize baseStats if missing (migration)
        if (!worker.baseStats) {
            worker.baseStats = { ...worker.stats };
        }

        // Calculate bonus stats
        const getBonus = (statName) => {
            return Math.max(0, worker.stats[statName] - worker.baseStats[statName]);
        };

        const strBonus = getBonus('str');
        const agiBonus = getBonus('agi');
        const intBonus = getBonus('int');
        const endBonus = getBonus('end');

        // Get EXP display
        const currentExp = worker.exp || 0;
        const requiredExp = isMaxLevel ? 100 : dataLoader.getExpRequiredForLevel(worker.level + 1);
        const expPercentage = isMaxLevel ? 100 : Math.floor((currentExp / requiredExp) * 100);

        const expBarHtml = isMaxLevel 
            ? `<div class="worker-exp-bar-container max-level">
                    <div class="worker-exp-bar">
                        <div class="worker-exp-bar-fill" style="width: 100%"></div>
                        <div class="worker-exp-overlay">
                            <span class="exp-level">Lv ${maxLevel} / ${maxLevel}</span>
                            <span class="exp-progress">0 / 0</span>
                        </div>
                    </div>
                </div>`
            : `<div class="worker-exp-bar-container">
                    <div class="worker-exp-bar">
                        <div class="worker-exp-bar-fill" style="width: ${expPercentage}%"></div>
                        <div class="worker-exp-overlay">
                            <span class="exp-level">Lv ${worker.level} / ${maxLevel}</span>
                            <span class="exp-progress">${currentExp} / ${requiredExp}</span>
                        </div>
                    </div>
                </div>`;

        return `
            <div class="worker-card ${worker.assignedTo ? 'assigned' : ''}" data-worker-id="${worker.id}">
                <div class="worker-card-header">
                    <span class="worker-name">${worker.name}</span>
                    <span class="worker-rarity" style="background-color: ${this.getRarityColor(worker.grade)}">${grade ? grade.name : worker.grade}</span>
                </div>
                <div class="worker-stats">
                    <div class="worker-stat">
                        <span class="worker-stat-label">STR:</span>
                        <span class="worker-stat-value">${worker.stats.str}${strBonus > 0 ? ` <span class="stat-bonus">(+${strBonus})</span>` : ''}</span>
                    </div>
                    <div class="worker-stat">
                        <span class="worker-stat-label">AGI:</span>
                        <span class="worker-stat-value">${worker.stats.agi}${agiBonus > 0 ? ` <span class="stat-bonus">(+${agiBonus})</span>` : ''}</span>
                    </div>
                    <div class="worker-stat">
                        <span class="worker-stat-label">INT:</span>
                        <span class="worker-stat-value">${worker.stats.int}${intBonus > 0 ? ` <span class="stat-bonus">(+${intBonus})</span>` : ''}</span>
                    </div>
                    <div class="worker-stat">
                        <span class="worker-stat-label">END:</span>
                        <span class="worker-stat-value">${worker.stats.end}${endBonus > 0 ? ` <span class="stat-bonus">(+${endBonus})</span>` : ''}</span>
                    </div>
                </div>
                ${expBarHtml}
                <div class="worker-assignment">
                    ${worker.assignedTo ? `Assigned to: ${facilityName}` : 'Unassigned'}
                </div>
                <div class="worker-actions">
                    <button class="btn btn-danger btn-sm" onclick="game.showFireConfirmation('${worker.id}')">Fire</button>
                </div>
            </div>
        `;
    }

    /**
     * Get rarity color for worker grade
     */
    getRarityColor(grade) {
        const colors = {
            'common': '#9e9e9e',
            'uncommon': '#4CAF50',
            'rare': '#2196F3',
            'epic': '#9C27B0',
            'legendary': '#FF9800'
        };
        return colors[grade] || '#9e9e9e';
    }

    /**
     * Build facility inventory grid (stash-like display for produced items)
     */
    buildFacilityInventoryGrid(facilityId) {
        if (!this.facilityStorageManager) {
            console.warn('FacilityStorageManager not available');
            return null;
        }

        const maxSlots = this.facilityStorageManager.getStorageSlots(facilityId);
        const items = this.facilityStorageManager.getAllItems(facilityId);

        const gridContainer = document.createElement('div');
        gridContainer.id = `${facilityId}-inventory-grid`;
        gridContainer.className = 'inventory-item-grid';

        // Create slots for all items
        for (let i = 0; i < maxSlots; i++) {
            const slotDiv = document.createElement('div');
            slotDiv.className = 'inventory-item';
            slotDiv.setAttribute('data-slot-index', i);

            if (i < items.length) {
                const item = items[i];
                slotDiv.classList.add('occupied');
                slotDiv.innerHTML = `
                    <span class="item-slot-number">${i}</span>
                    <span class="item-name">${item.item ? item.item.name : item.itemId}</span>
                    <span class="item-quantity">×${item.quantity}</span>
                `;

                // Click handler to show item details modal for occupied slots
                slotDiv.addEventListener('click', () => {
                    const itemToShow = {
                        itemId: item.itemId,
                        itemName: item.item ? item.item.name : item.itemId,
                        quantity: item.quantity
                    };
                    this.gameLoopManager.showItemInfoModal([itemToShow]);
                });
            } else {
                slotDiv.innerHTML = `<span class="item-slot-number">${i}</span>`;
            }

            gridContainer.appendChild(slotDiv);
        }

        return gridContainer;
    }

    /**
     * Build Trading Post order cards UI with empty slot placeholders
     * Always shows available capacity with empty grid slots for pending orders
     */
    buildTradingPostUI() {
        const container = document.getElementById('trading-orders-grid');
        if (!container) return;

        container.innerHTML = '';

        const activeOrders = this.gameLoopManager.gameState.tradingPost.activeOrders;
        const maxQueueSlots = this.gameLoopManager.gameState.tradingPost.maxQueueSlots;

        // Add active order cards
        for (const activeOrder of activeOrders) {
            const card = this.createOrderCard(activeOrder);
            if (card) {
                container.appendChild(card);
            }
        }

        // Add empty slot placeholders for remaining capacity
        const slotsNeeded = maxQueueSlots - activeOrders.length;
        for (let i = 0; i < slotsNeeded; i++) {
            const emptySlot = document.createElement('div');
            emptySlot.className = 'trading-order-card trading-order-slot-empty';
            emptySlot.innerHTML = '<span>⊘</span>';
            container.appendChild(emptySlot);
        }
    }

    /**
     * Helper function to unwrap data arrays that may be wrapped in {value: [...]} structure
     */
    unwrapArray(data) {
        if (Array.isArray(data)) return data;
        if (data && typeof data === 'object' && Array.isArray(data.value)) return data.value;
        return [];
    }

    /**
     * Create individual order card
     */
    createOrderCard(activeOrder) {
        const orderData = dataLoader.getTradingOrder(activeOrder.orderId);
        const region = dataLoader.getTradingRegion(activeOrder.regionId);
        const regionState = this.gameLoopManager.gameState.tradingRegions[activeOrder.regionId];

        // DEFENSIVE: Ensure all required data exists before rendering
        if (!orderData || !region || !regionState) {
            return null;
        }

        const card = document.createElement('div');
        card.className = 'trading-order-card';
        card.setAttribute('data-order-id', activeOrder.id);

        // Check if player can fulfill
        const canFulfill = this.gameLoopManager.tradingPostSystem.canFulfillOrder(activeOrder.id);

        // Header: Region info with Grade badge positioned in top-right
        const header = document.createElement('div');
        header.className = 'order-card-header';
        
        // Grade badge positioned absolutely in top-right
        const gradeBadge = document.createElement('div');
        gradeBadge.className = `order-grade grade-${orderData.grade.toLowerCase()}`;
        gradeBadge.textContent = orderData.grade;
        
        // Region info and credit bar
        const regionInfoDiv = document.createElement('div');
        regionInfoDiv.className = 'order-region-info';
        regionInfoDiv.innerHTML = `<h4>${region.name}</h4>`;
        
        const creditBarDiv = document.createElement('div');
        creditBarDiv.className = 'order-region-credit-bar';
        creditBarDiv.innerHTML = `
            <div class="credit-bar-fill" style="width: ${(regionState.exp / regionState.nextLevelExp) * 100}%"></div>
            <div class="credit-bar-text-overlay">
                <span class="credit-bar-level">Level ${regionState.level}</span>
                <span class="credit-bar-xp">${regionState.exp} / ${regionState.nextLevelExp}</span>
            </div>
        `;

        header.appendChild(gradeBadge);
        header.appendChild(regionInfoDiv);
        header.appendChild(creditBarDiv);

        // Body: Order details
        const body = document.createElement('div');
        body.className = 'order-card-body';

        // Required items - Icon-based horizontal scroll layout
        const requiredSection = document.createElement('div');
        requiredSection.className = 'order-required';
        requiredSection.innerHTML = '<h5>Required:</h5>';
        
        const requiredItemsContainer = document.createElement('div');
        requiredItemsContainer.className = 'order-required-items';
        
        const requiredArray = this.unwrapArray(orderData.required);
        for (const req of requiredArray) {
            const item = dataLoader.getItem(req.itemId);
            if (!item) {
                continue;
            }
            const have = this.gameLoopManager.stashManager.getItemQuantity(req.itemId);
            const isSufficient = have >= req.count;
            const itemGrade = item.grade || 'common';
            const firstLetter = item.name.charAt(0).toUpperCase();
            
            const itemCard = document.createElement('div');
            itemCard.className = `order-required-item grade-${itemGrade}`;
            itemCard.innerHTML = `
                <div class="required-item-icon">${firstLetter}</div>
                <div class="required-item-name">${item.name}</div>
                <div class="required-item-qty ${isSufficient ? 'available' : 'unavailable'}">${req.count} (${have})</div>
            `;

            // Click handler to show item details modal
            itemCard.addEventListener('click', () => {
                const itemToShow = {
                    itemId: req.itemId,
                    itemName: item.name,
                    quantity: have
                };
                this.gameLoopManager.showItemInfoModal([itemToShow]);
            });

            requiredItemsContainer.appendChild(itemCard);
        }
        requiredSection.appendChild(requiredItemsContainer);
        body.appendChild(requiredSection);

        // Reward items - Icon-based horizontal scroll layout
        const rewardSection = document.createElement('div');
        rewardSection.className = 'order-reward';
        rewardSection.innerHTML = '<h5>Reward:</h5>';
        
        const rewardItemsContainer = document.createElement('div');
        rewardItemsContainer.className = 'order-reward-items';
        
        const rewardArray = this.unwrapArray(orderData.reward);
        for (const reward of rewardArray) {
            let itemName = '';
            let itemGrade = 'common';
            let firstLetter = '?';
            
            if (reward.itemId === 'gold') {
                itemName = 'Gold';
                firstLetter = 'G';
            } else {
                const item = dataLoader.getItem(reward.itemId);
                if (item) {
                    itemName = item.name;
                    itemGrade = item.grade || 'common';
                    firstLetter = item.name.charAt(0).toUpperCase();
                } else {
                    itemName = reward.itemId;
                    firstLetter = reward.itemId.charAt(0).toUpperCase();
                }
            }
            
            const itemCard = document.createElement('div');
            itemCard.className = `order-reward-item grade-${itemGrade}`;
            itemCard.innerHTML = `
                <div class="reward-item-icon">${firstLetter}</div>
                <div class="reward-item-name">${itemName}</div>
                <div class="reward-item-qty">×${reward.count}</div>
            `;

            // Click handler to show item details modal (skip for gold)
            if (reward.itemId !== 'gold') {
                itemCard.addEventListener('click', () => {
                    const itemToShow = {
                        itemId: reward.itemId,
                        itemName: itemName,
                        quantity: reward.count
                    };
                    this.gameLoopManager.showItemInfoModal([itemToShow]);
                });
            }

            rewardItemsContainer.appendChild(itemCard);
        }
        rewardSection.appendChild(rewardItemsContainer);
        body.appendChild(rewardSection);

        // Footer: Buttons
        const footer = document.createElement('div');
        footer.className = 'order-card-footer';

        const tradeBtn = document.createElement('button');
        tradeBtn.className = 'btn btn-primary';
        tradeBtn.textContent = 'Trade';
        tradeBtn.disabled = !canFulfill;
        tradeBtn.onclick = () => this.gameLoopManager.showTradeConfirmationModal(activeOrder.id);

        const rejectBtn = document.createElement('button');
        rejectBtn.className = 'btn btn-danger';
        rejectBtn.textContent = 'Reject';
        rejectBtn.onclick = () => this.gameLoopManager.showRejectOrderModal(activeOrder.id);

        footer.appendChild(tradeBtn);
        footer.appendChild(rejectBtn);

        card.appendChild(header);
        card.appendChild(body);
        card.appendChild(footer);

        return card;
    }

    /**
     * Update order card availability in real-time
     */
    updateOrderCardAvailability() {
        const cards = document.querySelectorAll('.trading-order-card');

        for (const card of cards) {
            const orderId = card.getAttribute('data-order-id');
            if (!orderId) continue; // Skip empty slots

            const canFulfill = this.gameLoopManager.tradingPostSystem.canFulfillOrder(orderId);

            const tradeBtn = card.querySelector('.btn-primary');

            // Update button disabled state but do NOT dim the order card visually
            if (tradeBtn) {
                tradeBtn.disabled = !canFulfill;
            }

            // Update required item quantities
            const requiredItems = card.querySelectorAll('.required-item-qty');
            const activeOrder = this.gameLoopManager.gameState.tradingPost.activeOrders.find(o => o.id === orderId);
            if (activeOrder) {
                const orderData = dataLoader.getTradingOrder(activeOrder.orderId);
                if (orderData) {
                    const requiredArray = this.unwrapArray(orderData.required);
                    const requiredItemElements = Array.from(requiredItems);

                    requiredArray.forEach((req, index) => {
                        const have = this.gameLoopManager.stashManager.getItemQuantity(req.itemId);
                        const isSufficient = have >= req.count;
                        const element = requiredItemElements[index];

                        if (element) {
                            element.textContent = `${req.count} (${have})`;
                            element.classList.remove('available', 'unavailable');
                            element.classList.add(isSufficient ? 'available' : 'unavailable');
                        }
                    });
                }
            }
        }
    }

    /**
     * Build Region Info Dashboard
     */
    buildRegionInfoUI() {
        const container = document.getElementById('region-cards-grid');
        if (!container) return;

        container.innerHTML = '';

        // Get all trading regions from data loader
        const allRegions = dataLoader.getAllTradingRegions();

        // Build a card for each region
        for (const region of allRegions) {
            const regionState = this.gameLoopManager.gameState.tradingRegions[region.id];
            if (!regionState) {
                console.warn(`[Region Info] Region state not found for: ${region.id}`);
                continue;
            }

            const card = this.createRegionCard(region, regionState);
            container.appendChild(card);
        }
    }

    /**
     * Create a region info card
     */
    createRegionCard(region, regionState) {
        const card = document.createElement('div');
        card.className = 'region-card';
        card.setAttribute('data-region-id', region.id);

        const allItems = dataLoader.getAllItems();

        // Get commonly requested items for this region at current level
        const commonlyRequestedItems = this.getCommonlyRequestedItems(
            region.id,
            regionState.level,
            allItems
        );

        // Calculate progress percentage
        const progressPercent = Math.min(
            (regionState.exp / regionState.nextLevelExp) * 100,
            100
        );

        card.innerHTML = `
            <div class="region-card-header">
                <h4 class="region-name">${region.name}</h4>
            </div>

            <div class="region-level-exp">
                <div class="region-exp-bar">
                    <div class="region-exp-bar-fill" style="width: ${progressPercent}%"></div>
                    <div class="region-exp-bar-text-overlay">
                        <span class="region-level">Level ${regionState.level}</span>
                        <span class="region-xp">${regionState.exp} / ${regionState.nextLevelExp}</span>
                    </div>
                </div>
            </div>

            <div class="region-card-body">
                <h5>Commonly Requested Items:</h5>
                <div class="region-items-grid" data-region-id="${region.id}">
                    <!-- Item icons will be added here -->
                </div>
            </div>
        `;

        // Add commonly requested items to the grid
        const itemsGrid = card.querySelector('.region-items-grid');

        // Deduplicate items and render them
        const uniqueItemIds = [...new Set(commonlyRequestedItems.map(item => item.itemId))];
        for (const itemId of uniqueItemIds) {
            const item = allItems[itemId];
            if (!item) continue;

            const itemElement = document.createElement('div');
            itemElement.className = `region-item-icon grade-${item.grade || 'common'}`;
            itemElement.title = item.name;
            itemElement.innerHTML = `
                <div class="region-item-letter">${item.name.charAt(0).toUpperCase()}</div>
                <div class="region-item-name">${item.name}</div>
            `;

            // Click handler to show item details
            itemElement.addEventListener('click', () => {
                const itemToShow = {
                    itemId: itemId,
                    itemName: item.name,
                    quantity: 0
                };
                this.gameLoopManager.showItemInfoModal([itemToShow]);
            });

            itemsGrid.appendChild(itemElement);
        }

        // Add "View Order List" button
        const buttonFooter = document.createElement('div');
        buttonFooter.className = 'region-card-footer';
        const viewOrdersBtn = document.createElement('button');
        viewOrdersBtn.className = 'btn btn-secondary btn-small';
        viewOrdersBtn.textContent = 'View Order List';
        viewOrdersBtn.onclick = () => this.showOrderListModal(region.id, regionState.level);
        buttonFooter.appendChild(viewOrdersBtn);
        card.appendChild(buttonFooter);

        return card;
    }

    /**
     * Get commonly requested items for a region at a specific level
     * Logic:
     * 1. Look up orderList for region + level in tradingRegionUpgrade.csv
     * 2. Use orderIds to find required items in tradingOrder.csv
     * 3. Deduplicate item list
     */
    getCommonlyRequestedItems(regionId, regionLevel, allItems) {
        // Get region upgrade data to find order list for this level
        const regionUpgrade = dataLoader.getTradingRegionUpgrade(regionId, regionLevel);
        if (!regionUpgrade || !regionUpgrade.orderList) {
            return [];
        }

        // Collect all required items from orders in the orderList
        const requiredItems = [];
        const orderList = this.unwrapArray(regionUpgrade.orderList);

        for (const orderRef of orderList) {
            const orderId = orderRef.orderId;
            const orderData = dataLoader.getTradingOrder(orderId);
            if (!orderData) continue;

            const requiredArray = this.unwrapArray(orderData.required);
            for (const req of requiredArray) {
                requiredItems.push({
                    itemId: req.itemId,
                    itemName: allItems[req.itemId]?.name || req.itemId
                });
            }
        }

        return requiredItems;
    }

    /**
     * Create an Order Preview Card (simplified version for modal display)
     * Shows Order ID, required items, and reward items without extra details
     */
    createOrderPreviewCard(activeOrder) {
        const orderData = dataLoader.getTradingOrder(activeOrder.orderId);
        const region = dataLoader.getTradingRegion(activeOrder.regionId);

        // DEFENSIVE: Ensure all required data exists before rendering
        if (!orderData || !region) {
            return null;
        }

        const card = document.createElement('div');
        card.className = 'order-preview-card';

        // Order ID
        const idElement = document.createElement('div');
        idElement.className = 'order-preview-id';
        idElement.textContent = `#${activeOrder.orderId}`;

        // Body: Order details
        const body = document.createElement('div');
        body.className = 'order-preview-body';

        // Required items - Compact display
        const requiredSection = document.createElement('div');
        requiredSection.className = 'order-preview-required';
        requiredSection.innerHTML = '<h6>Required:</h6>';

        const requiredItemsContainer = document.createElement('div');
        requiredItemsContainer.className = 'order-preview-items';

        const requiredArray = this.unwrapArray(orderData.required);
        for (const req of requiredArray) {
            const item = dataLoader.getItem(req.itemId);
            if (!item) {
                continue;
            }
            const itemGrade = item.grade || 'common';
            const firstLetter = item.name.charAt(0).toUpperCase();

            const itemCard = document.createElement('div');
            itemCard.className = 'order-preview-item';
            itemCard.innerHTML = `
                <div class="order-preview-item-icon grade-${itemGrade}">${firstLetter}</div>
                <div class="order-preview-item-qty">×${req.count}</div>
            `;

            requiredItemsContainer.appendChild(itemCard);
        }
        requiredSection.appendChild(requiredItemsContainer);
        body.appendChild(requiredSection);

        // Reward items - Compact display
        const rewardSection = document.createElement('div');
        rewardSection.className = 'order-preview-reward';
        rewardSection.innerHTML = '<h6>Reward:</h6>';

        const rewardItemsContainer = document.createElement('div');
        rewardItemsContainer.className = 'order-preview-items';

        const rewardArray = this.unwrapArray(orderData.reward);
        for (const reward of rewardArray) {
            let itemGrade = 'common';
            let firstLetter = '?';

            if (reward.itemId === 'gold') {
                firstLetter = 'G';
            } else {
                const item = dataLoader.getItem(reward.itemId);
                if (item) {
                    itemGrade = item.grade || 'common';
                    firstLetter = item.name.charAt(0).toUpperCase();
                } else {
                    firstLetter = reward.itemId.charAt(0).toUpperCase();
                }
            }

            const itemCard = document.createElement('div');
            itemCard.className = 'order-preview-item';
            itemCard.innerHTML = `
                <div class="order-preview-item-icon grade-${itemGrade}">${firstLetter}</div>
                <div class="order-preview-item-qty">×${reward.count}</div>
            `;

            rewardItemsContainer.appendChild(itemCard);
        }
        rewardSection.appendChild(rewardItemsContainer);
        body.appendChild(rewardSection);

        card.appendChild(idElement);
        card.appendChild(body);

        return card;
    }

    /**
     * Show Order List Modal with all available orders for a region
     * Displays orders in a 3-column grid that can be scrolled vertically
     */
    showOrderListModal(regionId, regionLevel) {
        const region = dataLoader.getTradingRegion(regionId);
        if (!region) return;

        // Get orders available for this region and level
        const regionUpgrade = dataLoader.getTradingRegionUpgrade(regionId, regionLevel);
        if (!regionUpgrade || !regionUpgrade.orderList) {
            console.warn(`No orders available for region ${regionId} at level ${regionLevel}`);
            return;
        }

        const orderList = this.unwrapArray(regionUpgrade.orderList);

        // Create or get modal container
        let modal = document.getElementById('order-list-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'order-list-modal';
            modal.className = 'order-list-modal';
            document.body.appendChild(modal);
        }

        // Clear previous content
        modal.innerHTML = '';

        // Create modal content
        const content = document.createElement('div');
        content.className = 'order-list-modal-content';

        // Header
        const header = document.createElement('div');
        header.className = 'order-list-modal-header';
        header.innerHTML = `<h2>${region.name} - Potential Orders (Level ${regionLevel})</h2>`;

        const closeBtn = document.createElement('button');
        closeBtn.className = 'order-list-modal-close';
        closeBtn.textContent = '×';
        closeBtn.onclick = () => this.closeOrderListModal();
        header.appendChild(closeBtn);

        // Body with order preview cards
        const body = document.createElement('div');
        body.className = 'order-list-modal-body';

        for (const orderRef of orderList) {
            const orderId = orderRef.orderId;
            const orderData = dataLoader.getTradingOrder(orderId);
            if (!orderData) continue;

            // Create a minimal active order object for the preview card
            const previewOrder = {
                orderId: orderId,
                regionId: regionId
            };

            const card = this.createOrderPreviewCard(previewOrder);
            if (card) {
                body.appendChild(card);
            }
        }

        // Assemble modal
        content.appendChild(header);
        content.appendChild(body);
        modal.appendChild(content);

        // Show modal
        modal.classList.add('active');

        // Close modal on background click
        modal.onclick = (e) => {
            if (e.target === modal) {
                this.closeOrderListModal();
            }
        };
    }

    /**
     * Close the Order List Modal
     */
    closeOrderListModal() {
        const modal = document.getElementById('order-list-modal');
        if (modal) {
            modal.classList.remove('active');
        }
    }

    /**
     * Sort facilities by their availability/buildability status
     * Priority Order (High to Low):
     * 1. Fully Buildable: Prerequisites met AND materials available
     * 2. Materials Missing: Prerequisites met BUT materials unavailable
     * 3. Locked: Prerequisites NOT met
     */
    sortFacilitiesByAvailability(facilities) {
        if (!window.game || !window.game.upgradeSystem) return facilities;

        // Categorize facilities
        const fullyBuildable = [];
        const materialsMissing = [];
        const locked = [];

        for (const facility of facilities) {
            const costDetails = window.game.upgradeSystem.getConstructionCostDetails(facility.id);
            if (!costDetails) continue;

            // Check if prerequisites are met
            const prerequisitesMet = !costDetails.conditions ||
                costDetails.conditions.every(c => c.isSatisfied);

            // Check if materials are available
            const materialsMet = costDetails.costs.every(c => c.isSufficient);

            // Categorize based on status
            if (prerequisitesMet && materialsMet) {
                fullyBuildable.push(facility);
            } else if (prerequisitesMet && !materialsMet) {
                materialsMissing.push(facility);
            } else {
                locked.push(facility);
            }
        }

        // Return sorted array: fully buildable first, then materials missing, then locked
        return [...fullyBuildable, ...materialsMissing, ...locked];
    }

    /**
     * Build the construction mode UI showing all unbuilt facilities
     * Facilities are sorted by availability (fully buildable first, then partially available, then locked)
     */
    buildConstructionGridUI(container) {
        const gridContainer = container.querySelector('#construction-grid');
        if (!gridContainer) return;

        gridContainer.innerHTML = '';

        // Get all unbuilt facilities
        const navigationManager = this.gameLoopManager?.navigationManager;
        if (!navigationManager) return;
        let unbuiltFacilities = navigationManager.getUnbuiltFacilities();

        if (unbuiltFacilities.length === 0) {
            gridContainer.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #95a5a6;">No facilities available for construction.</p>';
            return;
        }

        // Sort facilities by availability
        unbuiltFacilities = this.sortFacilitiesByAvailability(unbuiltFacilities);

        for (const facility of unbuiltFacilities) {
            const costDetails = window.game.upgradeSystem.getConstructionCostDetails(facility.id);
            if (!costDetails) continue;

            const panel = document.createElement('div');
            panel.className = 'construction-panel';

            // Header with facility name
            const header = document.createElement('div');
            header.className = 'construction-panel-header';
            header.innerHTML = `<div class="construction-panel-name">${facility.name}</div>`;

            // Check facility prerequisites
            const facilityPrerequisitesMet = !costDetails.conditions ||
                costDetails.conditions.every(c => c.isSatisfied);
            const itemRequirementsMet = costDetails.costs.every(c => c.isSufficient);

            // If facility prerequisites are NOT met, disable the entire panel
            if (!facilityPrerequisitesMet) {
                panel.classList.add('disabled');
            }

            // Costs and conditions section
            const costsDiv = document.createElement('div');
            costsDiv.className = 'construction-panel-costs';

            // Render facility prerequisites section with label
            if (costDetails.conditions && costDetails.conditions.length > 0) {
                const prerequisitesLabel = document.createElement('div');
                prerequisitesLabel.className = 'construction-section-label';
                prerequisitesLabel.textContent = 'Prerequisites';
                costsDiv.appendChild(prerequisitesLabel);

                for (const condition of costDetails.conditions) {
                    const conditionItem = document.createElement('div');
                    conditionItem.className = `construction-panel-cost-item ${condition.isSatisfied ? 'sufficient' : 'insufficient'}`;
                    conditionItem.innerHTML = `
                        <span>${condition.facilityName}</span>
                        <span class="construction-cost-amount">
                            Lv. ${condition.requiredLevel}
                            <span style="color: #95a5a6;">/ Have:</span>
                            Lv. ${condition.currentLevel}
                        </span>
                    `;
                    costsDiv.appendChild(conditionItem);
                }
            }

            // Render item costs section with label
            if (costDetails.costs && costDetails.costs.length > 0) {
                const materialsLabel = document.createElement('div');
                materialsLabel.className = 'construction-section-label';
                materialsLabel.textContent = 'Required Materials';
                costsDiv.appendChild(materialsLabel);

                // Use grid layout for required materials
                const costGridContainer = this.renderCostItemsGridContainer(costDetails.costs);
                costsDiv.appendChild(costGridContainer);
            }

            // Actions section with Construct button
            const actions = document.createElement('div');
            actions.className = 'construction-panel-actions';
            const constructBtn = document.createElement('button');
            constructBtn.className = 'btn btn-construct';
            constructBtn.textContent = 'Construct';
            // Disable button if facility prerequisites are missing OR item requirements are missing
            constructBtn.disabled = !facilityPrerequisitesMet || !itemRequirementsMet;
            constructBtn.addEventListener('click', () => {
                window.game.showConstructionConfirmation(facility.id);
            });

            actions.appendChild(constructBtn);

            // Assemble panel
            panel.appendChild(header);
            panel.appendChild(costsDiv);
            panel.appendChild(actions);

            gridContainer.appendChild(panel);
        }
    }

    /**
     * Build a reset game button
     * Clears all save data and reloads the game
     * @returns {HTMLElement} - Button element
     */
    buildResetButton() {
        const resetBtn = document.createElement('button');
        resetBtn.textContent = 'Reset Game';
        resetBtn.className = 'reset-button';
        resetBtn.title = 'Clear all progress and start fresh';
        resetBtn.onclick = () => {
            if (confirm('Are you sure? This will delete all progress including workers, items, and facility levels!')) {
                localStorage.removeItem('estateSimulatorSave');
                location.reload();
            }
        };
        return resetBtn;
    }
}
