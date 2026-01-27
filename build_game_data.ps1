param(
    [string]$DataDir = (Join-Path $PSScriptRoot "data"),
    [string]$OutputFile = (Join-Path $PSScriptRoot "data\gameData.js")
)

Write-Host "Generating gameData.js from CSV files..."

# Initialize collections
$items = @()
$facilities = @()
$recipes = @{}
$tradingUpgrades = @{}
$tradingRegions = @()
$tradingRegionUpgrades = @()
$tradingOrders = @()
$upgradeTree = @{}
$config = @{}
$productAreas = @()
$workerNames = @()
$workerGrades = @()
$workerUpgrades = @{}
$workerLevels = @()
$processUpgrades = @{}
$productUpgrades = @{}
$stashUpgrades = @{}

# Helper function to convert values to appropriate types
function ConvertValue($value) {
    if ([string]::IsNullOrWhiteSpace($value)) {
        return ""
    }
    if ($value -match '^\d+$') {
        return [int]$value
    }
    return $value
}

# Process item.csv
$itemPath = Join-Path $DataDir "items\item.csv"
if (Test-Path $itemPath) {
    $itemRows = Import-Csv $itemPath
    foreach ($row in $itemRows) {
        if ($row.id) {
            $itemObj = @{
                id = $row.id
                name = $row.name
                stacks = [int]($row.stacks -replace '[^\d]', '999')
                grade = if ($row.grade) { $row.grade } else { 'common' }
                type = if ($row.type) { $row.type } else { 'Special' }
            }

            # Extract recipe from item if present
            if ($row.recipe) {
                try {
                    $recipeJson = ConvertFrom-Json $row.recipe
                    $recipes[$row.id] = $recipeJson
                } catch {
                    # Recipe parsing failed, skip
                }
            }

            $items += $itemObj
        }
    }
    Write-Host "✓ Loaded $($items.Count) items from item.csv"
}

# Process facility.csv
$facilityPath = Join-Path $DataDir "facilities\facility.csv"
if (Test-Path $facilityPath) {
    $facilityRows = Import-Csv $facilityPath
    foreach ($row in $facilityRows) {
        if ($row.id) {
            $facilities += @{
                id = $row.id
                name = $row.name
                type = $row.type
            }
        }
    }
    Write-Host "✓ Loaded $($facilities.Count) facilities from facility.csv"
}


# Process recipe.csv (legacy - recipes now come from item.csv)
$recipePath = Join-Path $DataDir "items\recipe.csv"
if (Test-Path $recipePath) {
    $recipeRows = Import-Csv $recipePath
    foreach ($row in $recipeRows) {
        if ($row.output_id -and -not $recipes.ContainsKey($row.output_id)) {
            $inputs = @()
            $inputsStr = $row.inputs
            if ($inputsStr) {
                $pairs = $inputsStr -split ','
                foreach ($pair in $pairs) {
                    $parts = $pair -split ':'
                    if ($parts.Count -eq 2) {
                        $inputs += @{
                            itemId = $parts[0].Trim()
                            amount = [int]($parts[1].Trim() -replace '[^\d]', '1')
                        }
                    }
                }
            }
            $recipes[$row.output_id] = @{
                outputId = $row.output_id
                outputAmount = [int]($row.output_amount -replace '[^\d]', '1')
                inputs = $inputs
            }
        }
    }
    if ($recipes.Count -gt 0) {
        Write-Host "✓ Loaded $($recipes.Count) recipes from recipe.csv (legacy)"
    }
}

# Process processUpgrade.csv
$processUpgradePath = Join-Path $DataDir "facilities\processUpgrade.csv"
if (Test-Path $processUpgradePath) {
    $processRows = Import-Csv $processUpgradePath
    foreach ($row in $processRows) {
        if ($row.level) {
            $level = [int]($row.level -replace '[^\d]', '1')
            $processList = @()
            if ($row.processList) {
                try {
                    $parsedList = ConvertFrom-Json $row.processList
                    # Ensure it's an array - ConvertFrom-Json on single items returns the item directly
                    if ($parsedList -is [System.Object[]]) {
                        $processList = [array]$parsedList
                    } else {
                        $processList = @($parsedList)
                    }
                } catch {
                    Write-Host "Warning: Failed to parse processList JSON for level $level"
                }
            }
            $processUpgrades[[string]$level] = @{
                level = $level
                processList = $processList
            }
        }
    }
    Write-Host "✓ Loaded $($processUpgrades.Count) process upgrade levels from processUpgrade.csv"
}

# Process facilityUpgrade.csv
$upgradeCheckPath = Join-Path $DataDir "facilities\facilityUpgrade.csv"
if (Test-Path $upgradeCheckPath) {
    $upgradeRows = Import-Csv $upgradeCheckPath
    $upgradesByFacility = @{}

    foreach ($row in $upgradeRows) {
        $facilityId = $row.facility_id
        $level = [int]($row.level -replace '[^\d]', '1')

        if (-not $upgradesByFacility.ContainsKey($facilityId)) {
            $upgradesByFacility[$facilityId] = @{}
        }

        if (-not $upgradesByFacility[$facilityId].ContainsKey($level)) {
            $gridX = if ($row.gridX) { [int]($row.gridX -replace '[^\d]', '0') } else { $null }
            $gridY = if ($row.gridY) { [int]($row.gridY -replace '[^\d]', '0') } else { $null }
            $grid = if ($row.Grid) { [int]($row.Grid -replace '[^\d]', '0') } else { $null }
            $storageSlots = if ($row.storageSlots) { [int]($row.storageSlots -replace '[^\d]', '0') } else { $null }

            # Parse requirements JSON if present
            $requirements = @()
            if ($row.requirements) {
                try {
                    $requirements = ConvertFrom-Json $row.requirements
                } catch {
                    Write-Host "Warning: Failed to parse requirements JSON for $facilityId level $level"
                }
            }

            # Parse productAreas JSON if present
            $productAreas_parsed = $null
            if ($row.productAreas) {
                try {
                    $productAreas_parsed = ConvertFrom-Json $row.productAreas
                } catch {
                    Write-Host "Warning: Failed to parse productAreas JSON for $facilityId level $level"
                }
            }

            $upgradesByFacility[$facilityId][$level] = @{
                level = $level
                goldCost = 0
                materials = @()
                gridX = $gridX
                gridY = $gridY
                Grid = $grid
                storageSlots = $storageSlots
                requirements = $requirements
                productAreas = $productAreas_parsed
            }
        }

        $material = $row.material
        $cost = [int]($row.cost -replace '[^\d]', '0')

        for ($i = 0; $i -lt $cost; $i++) {
            $upgradesByFacility[$facilityId][$level].materials += $material
        }

        if ($material -eq "gold") {
            $upgradesByFacility[$facilityId][$level].goldCost = $cost
        }
    }

    foreach ($facilityId in $upgradesByFacility.Keys) {
        $upgradeTree[$facilityId] = @{}
        $levels = $upgradesByFacility[$facilityId].Keys | Sort-Object
        foreach ($level in $levels) {
            $upgradeTree[$facilityId][[string]$level] = $upgradesByFacility[$facilityId][$level]
        }
    }

    Write-Host "✓ Loaded upgrades for $($upgradeTree.Count) facilities from facilityUpgrade.csv"
}

# Process productUpgrade.csv - Add production-specific data to production facilities
$productUpgradePath = Join-Path $DataDir "facilities\productUpgrade.csv"
if (Test-Path $productUpgradePath) {
    $productRows = Import-Csv $productUpgradePath
    foreach ($row in $productRows) {
        if ($row.facility_id) {
            $facilityId = $row.facility_id
            $level = [int]($row.level -replace '[^\d]', '1')

            # Parse grid as integer
            $grid = if ($row.grid) { [int]($row.grid -replace '[^\d]', '0') } else { $null }

            # Parse productAreas JSON if present
            $productAreas_parsed = $null
            if ($row.productAreas) {
                try {
                    $productAreas_parsed = ConvertFrom-Json $row.productAreas
                } catch {
                    Write-Host "Warning: Failed to parse productAreas JSON for $facilityId level $level"
                }
            }

            # Parse storageSlots as integer
            $storageSlots = if ($row.storageSlots) { [int]($row.storageSlots -replace '[^\d]', '0') } else { $null }

            # Store in temporary productUpgrades for merging
            if (-not $productUpgrades.ContainsKey($facilityId)) {
                $productUpgrades[$facilityId] = @{}
            }

            $productUpgrades[$facilityId][[string]$level] = @{
                grid = $grid
                productAreas = $productAreas_parsed
                storageSlots = $storageSlots
            }
        }
    }
    Write-Host "✓ Loaded production upgrade data for $($productUpgrades.Count) facilities from productUpgrade.csv"
}

# Merge productUpgrade data into upgradeTree for production facilities
foreach ($facilityId in $productUpgrades.Keys) {
    if ($upgradeTree.ContainsKey($facilityId)) {
        foreach ($level in $productUpgrades[$facilityId].Keys) {
            if ($upgradeTree[$facilityId].ContainsKey($level)) {
                $upgradeTree[$facilityId][$level].Grid = $productUpgrades[$facilityId][$level].grid
                $upgradeTree[$facilityId][$level].productAreas = $productUpgrades[$facilityId][$level].productAreas
                $upgradeTree[$facilityId][$level].storageSlots = $productUpgrades[$facilityId][$level].storageSlots
            }
        }
    }
}

# Process stashUpgrade.csv - Load stash capacity data
$stashUpgradePath = Join-Path $DataDir "stashUpgrade.csv"
if (Test-Path $stashUpgradePath) {
    $stashRows = Import-Csv $stashUpgradePath
    foreach ($row in $stashRows) {
        if ($row.level) {
            $level = [int]($row.level -replace '[^\d]', '1')
            $capacity = if ($row.capacity) { [int]($row.capacity -replace '[^\d]', '0') } else { 0 }

            $stashUpgrades[[string]$level] = @{
                level = $level
                capacity = $capacity
            }
        }
    }
    Write-Host "✓ Loaded stash capacity data for $($stashUpgrades.Count) levels from stashUpgrade.csv"
}

# gameConfig.csv
$configPath = Join-Path $DataDir "common\gameConfig.csv"
if (Test-Path $configPath) {
    $configRows = Import-Csv $configPath
    foreach ($row in $configRows) {
        if ($row.key) {
            $value = ConvertValue($row.value)
            $config[$row.key] = $value
        }
    }
    Write-Host "✓ Loaded $($config.Count) config values from gameConfig.csv"
}

# Process productArea.csv
$productAreaPath = Join-Path $DataDir "facilities\productArea.csv"
if (Test-Path $productAreaPath) {
    $areaRows = Import-Csv $productAreaPath
    foreach ($row in $areaRows) {
        if ($row.id) {
            $productItem = $null
            if ($row.productItem) {
                try {
                    $productItem = ConvertFrom-Json $row.productItem
                } catch {
                    Write-Host "Warning: Failed to parse productItem JSON for $($row.id)"
                }
            }

            # Parse requiredStat JSON if present
            $requiredStat = @()
            if ($row.requiredStat) {
                try {
                    $parsed = ConvertFrom-Json $row.requiredStat
                    # Ensure it's an array - ConvertFrom-Json on single items returns the item directly
                    if ($parsed -is [System.Object[]]) {
                        $requiredStat = [array]$parsed
                    } else {
                        $requiredStat = @($parsed)
                    }
                } catch {
                    Write-Host "Warning: Failed to parse requiredStat JSON for $($row.id)"
                }
            }

            $productAreas += @{
                id = $row.id
                facility_id = $row.facility_id
                requiredLevel = [int]($row.requiredLevel -replace '[^\d]', '1')
                gridX = [int]($row.gridX -replace '[^\d]', '1')
                gridY = [int]($row.gridY -replace '[^\d]', '1')
                productItem = $productItem
                cooltime = [int]($row.cooltime -replace '[^\d]', '10')
                workers = [int]($row.workers -replace '[^\d]', '0')
                requiredStat = $requiredStat
            }
        }
    }
    Write-Host "✓ Loaded $($productAreas.Count) product areas from productArea.csv"
}

# Process workerName.csv
$workerNamePath = Join-Path $DataDir "workers\workerName.csv"
if (Test-Path $workerNamePath) {
    $nameRows = Import-Csv $workerNamePath
    foreach ($row in $nameRows) {
        if ($row.name) {
            $workerNames += $row.name
        }
    }
    Write-Host "✓ Loaded $($workerNames.Count) worker names from workerName.csv"
}

# Process workerGrade.csv
$workerGradePath = Join-Path $DataDir "workers\workerGrade.csv"
if (Test-Path $workerGradePath) {
    $gradeRows = Import-Csv $workerGradePath
    foreach ($row in $gradeRows) {
        if ($row.id) {
            $workerGrades += @{
                id = $row.id
                name = $row.name
                maxLevel = [int]($row.maxLevel -replace '[^\d]', '10')
                baseGold = [int]($row.baseGold -replace '[^\d]', '20')
                levelGold = [int]($row.levelGold -replace '[^\d]', '10')
                weight = 1
            }
        }
    }
    Write-Host "✓ Loaded $($workerGrades.Count) worker grades from workerGrade.csv"
}

# Process workerUpgrade.csv
$workerUpgradePath = Join-Path $DataDir "workers\workerUpgrade.csv"
if (Test-Path $workerUpgradePath) {
    $upgradeRows = Import-Csv $workerUpgradePath
    foreach ($row in $upgradeRows) {
        if ($row.level) {
            $workerUpgrades[$row.level] = @{
                level = [int]($row.level -replace '[^\d]', '1')
                maxPending = [int]($row.maxPending -replace '[^\d]', '3')
                maxWorkers = [int]($row.maxWorkers -replace '[^\d]', '5')
                arrivalInterval = [int]($row.arrivalInterval -replace '[^\d]', '30000')
                gradeWeight = $row.gradeWeight
            }
        }
    }
    Write-Host "✓ Loaded $($workerUpgrades.Count) worker upgrades from workerUpgrade.csv"
}

# Process workerLevel.csv
$workerLevelPath = Join-Path $DataDir "workers\workerLevel.csv"
if (Test-Path $workerLevelPath) {
    $levelRows = Import-Csv $workerLevelPath
    foreach ($row in $levelRows) {
        $workerLevels += @{
            level = [int]($row.level -replace '[^\d]', '1')
            expRequired = [int]($row.expRequired -replace '[^\d]', '0')
        }
    }
    Write-Host "✓ Loaded $($workerLevels.Count) worker levels from workerLevel.csv"
}

# Process tradingUpgrade.csv
$tradingUpgradePath = Join-Path $DataDir "trading\tradingUpgrade.csv"
if (Test-Path $tradingUpgradePath) {
    $tradingUps = Import-Csv $tradingUpgradePath
    foreach ($upgrade in $tradingUps) {
        $level = [int]$upgrade.level
        $upgradeData = @{
            level = $level
            cooltime = [int]($upgrade.cooltime -replace '[^\d]', '360')
            maxQueueSlots = [int]($upgrade.maxQueueSlots -replace '[^\d]', '3')
        }

        # Parse requirements JSON if present
        if ($upgrade.requirements) {
            try {
                $upgradeData.requirements = ConvertFrom-Json $upgrade.requirements
            } catch {
                $upgradeData.requirements = @()
            }
        } else {
            $upgradeData.requirements = @()
        }

        $tradingUpgrades[[string]$level] = $upgradeData
    }
    Write-Host "✓ Loaded $($tradingUpgrades.Count) trading upgrade levels from tradingUpgrade.csv"
}

# Process tradingRegion.csv
$tradingRegionPath = Join-Path $DataDir "trading\tradingRegion.csv"
if (Test-Path $tradingRegionPath) {
    $regions = Import-Csv $tradingRegionPath
    foreach ($region in $regions) {
        if ($region.id) {
            $regionData = @{
                id = $region.id
                name = $region.name
            }

            $tradingRegions += $regionData
        }
    }
    Write-Host "✓ Loaded $($tradingRegions.Count) trading regions from tradingRegion.csv"
}

# Process tradingRegionUpgrade.csv
$tradingRegionUpgradePath = Join-Path $DataDir "trading\tradingRegionUpgrade.csv"
if (Test-Path $tradingRegionUpgradePath) {
    $upgrades = Import-Csv $tradingRegionUpgradePath
    foreach ($upgrade in $upgrades) {
        if ($upgrade.id) {
            $upgradeData = @{
                id = $upgrade.id
                level = [int]($upgrade.level -replace '[^\d]', '1')
                exp = [int]($upgrade.exp -replace '[^\d]', '1000')
            }

            # Parse orderList JSON if present
            if ($upgrade.orderList) {
                try {
                    $upgradeData.orderList = ConvertFrom-Json $upgrade.orderList
                } catch {
                    $upgradeData.orderList = @()
                }
            } else {
                $upgradeData.orderList = @()
            }

            $tradingRegionUpgrades += $upgradeData
        }
    }
    Write-Host "✓ Loaded $($tradingRegionUpgrades.Count) trading region upgrades from tradingRegionUpgrade.csv"
}

# Process tradingOrder.csv
$tradingOrderPath = Join-Path $DataDir "trading\tradingOrder.csv"
if (Test-Path $tradingOrderPath) {
    $orders = Import-Csv $tradingOrderPath
    foreach ($order in $orders) {
        if ($order.id) {
            $orderData = @{
                id = $order.id
                grade = $order.grade
                credit = [int]($order.credit -replace '[^\d]', '100')
            }

            # Parse required JSON
            if ($order.required) {
                try {
                    $orderData.required = ConvertFrom-Json $order.required
                } catch {
                    $orderData.required = @()
                }
            } else {
                $orderData.required = @()
            }

            # Parse reward JSON
            if ($order.reward) {
                try {
                    $orderData.reward = ConvertFrom-Json $order.reward
                } catch {
                    $orderData.reward = @()
                }
            } else {
                $orderData.reward = @()
            }

            $tradingOrders += $orderData
        }
    }
    Write-Host "✓ Loaded $($tradingOrders.Count) trading orders from tradingOrder.csv"
}

# Build the data object
$gameData = @{
    items = $items
    facilities = $facilities
    recipes = $recipes
    tradingUpgrades = $tradingUpgrades
    tradingRegions = $tradingRegions
    tradingRegionUpgrades = $tradingRegionUpgrades
    tradingOrders = $tradingOrders
    upgradeTree = $upgradeTree
    config = $config
    productAreas = $productAreas
    workerNames = $workerNames
    workerGrades = $workerGrades
    workerUpgrades = $workerUpgrades
    workerLevels = $workerLevels
    processUpgrades = $processUpgrades
    stashUpgrades = $stashUpgrades
}

# Convert to JSON and write to file
Write-Host "`nWriting to $OutputFile..."
$jsonOutput = ConvertTo-Json $gameData -Depth 10

$fileContent = @"
/**
 * Game Data - Embedded data files
 * AUTO-GENERATED by build_game_data.ps1 - Do not edit manually
 * This file contains all game data in JavaScript format
 * Run build_game_data.ps1 to regenerate after updating CSV files
 */

const GAME_DATA = $jsonOutput;
"@

Set-Content -Path $OutputFile -Value $fileContent -Encoding UTF8

Write-Host "✓ Successfully generated gameData.js"
Write-Host "`n=== Build Summary ==="
Write-Host "✓ $($items.Count) items loaded"
Write-Host "✓ $($facilities.Count) facilities loaded"
Write-Host "✓ $($recipes.Count) recipes loaded"
Write-Host "✓ $($upgradeTree.Count) facility upgrade trees loaded"
Write-Host "✓ $($config.Count) config values loaded"
Write-Host "✓ $($productAreas.Count) product areas loaded"
Write-Host "✓ $($workerNames.Count) worker names loaded"
Write-Host "✓ $($workerGrades.Count) worker grades loaded"
Write-Host "✓ $($workerUpgrades.Count) worker upgrades loaded"
Write-Host "✓ $($workerLevels.Count) worker levels loaded"
Write-Host "✓ $($tradingUpgrades.Count) trading upgrade levels loaded"
Write-Host "✓ $($tradingRegions.Count) trading regions loaded"
Write-Host "✓ $($tradingRegionUpgrades.Count) trading region upgrades loaded"
Write-Host "✓ $($tradingOrders.Count) trading orders loaded"
Write-Host "✓ $($processUpgrades.Count) process upgrade levels loaded"
Write-Host "✓ $($stashUpgrades.Count) stash upgrade levels loaded"
Write-Host "`nBuild complete! All CSV files processed successfully."
