/**
 * Trading Post System
 * Handles timed order arrivals, fulfillment, and region-based reputation tracking
 */
class TradingPostSystem {
    constructor(gameState, stashManager) {
        this.gameState = gameState;
        this.stashManager = stashManager;
    }

    /**
     * Initialize the trading post system
     */
    initialize() {
        this.gameState.tradingPost.lastRealTime = Date.now();
        this.updateTradingPostCapacity();
    }

    /**
     * Update trading post capacity and arrival interval based on facility level
     * Syncs with the actual trading facility level from gameState.facilities
     */
    updateTradingPostCapacity() {
        const tradingPost = this.gameState.tradingPost;
        const tradingFacility = this.gameState.facilities.trading;

        // Sync tradingPost.level with the actual facility level
        if (tradingFacility) {
            tradingPost.level = tradingFacility.level;
        }

        // If trading post is not built (Level 0), disable order arrivals completely
        if (tradingPost.level === 0) {
            tradingPost.arrivalInterval = 0;
            return;
        }

        // Read cooltime from upgrade data and apply
        const upgradeData = dataLoader.getTradingUpgrade(tradingPost.level);
        if (upgradeData) {
            tradingPost.maxQueueSlots = upgradeData.maxQueueSlots;
            tradingPost.arrivalInterval = upgradeData.cooltime * 1000;  // cooltime is in seconds, convert to milliseconds

            // Reset timer state when updating from construction/upgrade to restart the countdown
            // This ensures the timer immediately starts counting down with the new interval
            tradingPost.scaledElapsed = 0;
            tradingPost.lastRealTime = Date.now();
            tradingPost.isPaused = false;
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
     * Update order arrivals (called every game loop tick)
     * Follows worker arrival system pattern: scaledDeltaTime is game-speed-adjusted
     */
    updateOrderArrivals(scaledDeltaTime) {
        const state = this.gameState.tradingPost;
        const now = Date.now();

        // Stop order arrivals if trading post is not built (arrivalInterval = 0)
        if (state.arrivalInterval <= 0) {
            return;
        }

        // Ensure scaledElapsed is initialized (for save/load compatibility)
        if (typeof state.scaledElapsed !== 'number') {
            state.scaledElapsed = 0;
        }

        // Check if queue is full
        if (state.activeOrders.length >= state.maxQueueSlots) {
            if (!state.isPaused) {
                state.isPaused = true;
                state.lastRealTime = now; // Reset to prevent accumulated time
            }
            return;
        }

        // Queue not full - resume if paused
        if (state.isPaused) {
            state.isPaused = false;
            state.lastRealTime = now; // Reset to prevent time jump
            state.scaledElapsed = 0;
        }

        // Calculate delta time with game speed scaling
        const realDelta = now - state.lastRealTime;
        state.lastRealTime = now;
        const oldElapsed = state.scaledElapsed;
        state.scaledElapsed += realDelta * this.gameState.gameSpeed;


        // Check if order should arrive
        if (state.scaledElapsed >= state.arrivalInterval) {
            this.generateOrder();

            // CRITICAL FIX: Check if queue became full after generating order
            // If full, set timer to interval (100%) to prevent flickering reset-then-fill glitch
            if (state.activeOrders.length >= state.maxQueueSlots) {
                state.isPaused = true;
                state.scaledElapsed = state.arrivalInterval;  // Keep bar at 100%
            } else {
                state.scaledElapsed = 0;  // Normal reset for non-full queues
            }
        }
    }

    /**
     * Generate a new order
     */
    generateOrder() {
        // 1. Select random region
        const allRegions = dataLoader.getAllTradingRegions();
        const regionIds = allRegions.map(r => r.id);

        if (regionIds.length === 0) {
            return;
        }

        const randomRegion = regionIds[Math.floor(Math.random() * regionIds.length)];

        // 2. Get region's current level
        const regionState = this.gameState.tradingRegions[randomRegion];
        if (!regionState) {
            return;
        }

        // 3. Get available orders for this region level
        const region = dataLoader.getTradingRegion(randomRegion);
        if (!region) {
            return;
        }

        const levelOrders = this.getOrdersForLevel(randomRegion, regionState.level);
        if (levelOrders.length === 0) {
            return;
        }

        // 4. Weighted random selection
        const selectedOrderId = this.weightedRandomOrder(levelOrders);
        if (!selectedOrderId) {
            return;
        }

        // 5. Add to active orders
        const newOrder = {
            id: `${Date.now()}_${Math.random()}`,
            orderId: selectedOrderId,
            regionId: randomRegion,
            timestamp: Date.now()
        };

        this.gameState.tradingPost.activeOrders.push(newOrder);
    }

    /**
     * Get orders available for a region at a specific level
     */
    getOrdersForLevel(regionId, level) {
        const orders = dataLoader.getOrdersForRegionLevel(regionId, level);
        return orders.length === 0 ? [] : orders;
    }

    /**
     * Weighted random selection from orders
     */
    weightedRandomOrder(orders) {
        if (!orders || orders.length === 0) {
            return null;
        }

        const totalWeight = orders.reduce((sum, o) => sum + (o.appearRate || 1), 0);

        if (totalWeight <= 0) {
            return null;
        }

        let random = Math.random() * totalWeight;

        for (const order of orders) {
            const weight = order.appearRate || 1;
            random -= weight;
            if (random <= 0) {
                return order.orderId;
            }
        }

        return orders[0].orderId; // Fallback
    }

    /**
     * Fulfill an order (Trade button)
     */
    fulfillOrder(activeOrderId) {
        const activeOrder = this.gameState.tradingPost.activeOrders.find(o => o.id === activeOrderId);
        if (!activeOrder) return false;

        const orderData = dataLoader.getTradingOrder(activeOrder.orderId);
        if (!orderData) return false;

        const requiredArray = this.unwrapArray(orderData.required);
        const rewardArray = this.unwrapArray(orderData.reward);

        // Validate resources
        for (const req of requiredArray) {
            const have = this.stashManager.getItemQuantity(req.itemId);
            if (have < req.count) {
                console.warn(`Not enough ${req.itemId}! Need ${req.count}, have ${have}`);
                return false;
            }
        }

        // Deduct resources
        for (const req of requiredArray) {
            this.stashManager.removeItemFromStash(req.itemId, req.count);
        }

        // Add rewards
        for (const reward of rewardArray) {
            if (reward.itemId === 'gold') {
                this.gameState.gold += reward.count;
            } else {
                this.stashManager.addItemToStash(reward.itemId, reward.count);
            }
        }

        // Add region credit
        this.addRegionCredit(activeOrder.regionId, orderData.credit);

        // Log trade completion with grouped details
        const region = dataLoader.getTradingRegion(activeOrder.regionId);
        const regionName = region ? region.name : activeOrder.regionId;
        const requiredDetails = requiredArray.map(req => {
            const item = dataLoader.getItem(req.itemId);
            const itemName = item ? item.name : req.itemId;
            return `${itemName} (${req.count})`;
        });
        const rewardDetails = rewardArray.map(reward => {
            if (reward.itemId === 'gold') {
                return `Gold (${reward.count})`;
            }
            const item = dataLoader.getItem(reward.itemId);
            const itemName = item ? item.name : reward.itemId;
            return `${itemName} (${reward.count})`;
        });
        console.groupCollapsed(`💰 Trade Completed: ${regionName}`);
        console.log(`Region: ${regionName}`);
        console.log(`Items Given: ${requiredDetails.join(', ')}`);
        console.log(`Rewards Received: ${rewardDetails.join(', ')}`);
        console.log(`Region Credit: +${orderData.credit}`);
        console.groupEnd();

        // Remove order from queue
        this.removeOrder(activeOrderId);

        return true;
    }

    /**
     * Reject an order
     */
    rejectOrder(activeOrderId) {
        const activeOrder = this.gameState.tradingPost.activeOrders.find(o => o.id === activeOrderId);
        if (!activeOrder) return false;

        const orderData = dataLoader.getTradingOrder(activeOrder.orderId);
        if (!orderData) return false;

        // Calculate penalty (50% of credit)
        const penalty = Math.floor(orderData.credit * 0.5);

        // Apply penalty
        this.addRegionCredit(activeOrder.regionId, -penalty);

        // Remove order
        this.removeOrder(activeOrderId);

        return true;
    }

    /**
     * Remove order from active queue
     */
    removeOrder(activeOrderId) {
        const index = this.gameState.tradingPost.activeOrders.findIndex(o => o.id === activeOrderId);
        if (index !== -1) {
            this.gameState.tradingPost.activeOrders.splice(index, 1);
        }
    }

    /**
     * Add credit to a region (handles leveling up/down)
     */
    addRegionCredit(regionId, creditAmount) {
        const regionState = this.gameState.tradingRegions[regionId];
        if (!regionState) return;

        const region = dataLoader.getTradingRegion(regionId);
        if (!region) return;

        regionState.exp += creditAmount;

        const maxLevel = dataLoader.getTradingRegionMaxLevel(regionId);

        // Handle level up
        while (regionState.exp >= regionState.nextLevelExp && regionState.level < maxLevel) {
            regionState.exp -= regionState.nextLevelExp;
            regionState.level++;
            regionState.nextLevelExp = dataLoader.getRegionLevelExp(regionId, regionState.level);
        }

        // Clamp exp to valid range (prevents level down, maintains current level)
        regionState.exp = Math.max(0, regionState.exp);
    }

    /**
     * Check if player can fulfill an order
     */
    canFulfillOrder(activeOrderId) {
        const activeOrder = this.gameState.tradingPost.activeOrders.find(o => o.id === activeOrderId);
        if (!activeOrder) return false;

        const orderData = dataLoader.getTradingOrder(activeOrder.orderId);
        if (!orderData) return false;

        const requiredArray = this.unwrapArray(orderData.required);

        for (const req of requiredArray) {
            const have = this.stashManager.getItemQuantity(req.itemId);
            if (have < req.count) {
                return false;
            }
        }

        return true;
    }

    /**
     * Upgrade Trading Post facility
     */
    upgradeTradingPost() {
        const nextLevel = this.gameState.tradingPost.level + 1;
        const upgradeData = dataLoader.getTradingUpgrade(nextLevel);

        if (!upgradeData) {
            alert('Max level reached!');
            return false;
        }

        // Check gold requirement (placeholder - would need proper implementation with upgradeSystem)
        if (this.gameState.gold < 500) {
            alert('Not enough gold!');
            return false;
        }

        // Apply upgrade
        this.gameState.tradingPost.level = nextLevel;
        this.gameState.gold -= 500; // Placeholder cost

        // Update capacity and arrival interval based on new level
        this.updateTradingPostCapacity();

        return true;
    }
}
