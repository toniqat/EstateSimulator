#!/usr/bin/env python3
"""Generate gameData.js from CSV files"""

import csv
import json
import os
import sys
from pathlib import Path

# Fix Windows Unicode issues
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

def build_game_data():
    """Build game data from CSV files"""
    base_dir = Path(__file__).parent
    data_dir = base_dir / "data"
    output_file = base_dir / "data" / "gameData.js"

    game_data = {
        "items": [],
        "facilities": [],
        "production": {},
        "recipes": {},
        "trading": {},
        "upgradeTree": {},
        "config": {},
        "productAreas": [],
        "workerNames": [],
        "workerGrades": [],
        "workerUpgrades": {},
        "workerLevels": [],
        "tradingRegions": [],
        "tradingOrders": [],
        "tradingUpgrades": {},
        "processUpgrades": {}
    }

    # Load items
    print("Loading items...")
    items_file = data_dir / "item.csv"
    if items_file.exists():
        with open(items_file, 'r', encoding='utf-8') as f:
            for row in csv.DictReader(f):
                game_data["items"].append({
                    "id": row.get("id", "").strip(),
                    "name": row.get("name", "").strip(),
                    "stacks": int(row.get("stacks", 999))
                })
        print(f"✓ Loaded {len(game_data['items'])} items")

    # Load facilities
    print("Loading facilities...")
    facilities_file = data_dir / "facility.csv"
    if facilities_file.exists():
        with open(facilities_file, 'r', encoding='utf-8') as f:
            for row in csv.DictReader(f):
                game_data["facilities"].append({
                    "id": row.get("id", "").strip(),
                    "name": row.get("name", "").strip(),
                    "type": row.get("type", "").strip()
                })
        print(f"✓ Loaded {len(game_data['facilities'])} facilities")

    # Load production
    print("Loading production...")
    production_file = data_dir / "production.csv"
    if production_file.exists():
        with open(production_file, 'r', encoding='utf-8') as f:
            for row in csv.DictReader(f):
                facility_id = row.get("facility_id", "").strip()
                if facility_id:
                    game_data["production"][facility_id] = {
                        "facilityId": facility_id,
                        "output": row.get("output_item_id", "").strip(),
                        "outputItemId": row.get("output_item_id", "").strip(),
                        "baseOutput": int(row.get("base_output", 1)),
                        "productionInterval": int(row.get("production_interval_ms", 10000))
                    }
        print(f"✓ Loaded {len(game_data['production'])} production facilities")

    # Load recipes
    print("Loading recipes...")
    recipes_file = data_dir / "recipe.csv"
    if recipes_file.exists():
        with open(recipes_file, 'r', encoding='utf-8') as f:
            for row in csv.DictReader(f):
                output_id = row.get("output_id", "").strip()
                if output_id:
                    inputs = []
                    inputs_str = row.get("inputs", "").strip()
                    if inputs_str:
                        for pair in inputs_str.split(','):
                            parts = pair.strip().split(':')
                            if len(parts) == 2:
                                inputs.append({
                                    "itemId": parts[0].strip(),
                                    "amount": int(parts[1].strip())
                                })
                    game_data["recipes"][output_id] = {
                        "outputId": output_id,
                        "outputAmount": int(row.get("output_amount", 1)),
                        "inputs": inputs
                    }
        print(f"✓ Loaded {len(game_data['recipes'])} recipes")

    # Load trading
    print("Loading trading...")
    trading_file = data_dir / "trading.csv"
    if trading_file.exists():
        with open(trading_file, 'r', encoding='utf-8') as f:
            for row in csv.DictReader(f):
                item_id = row.get("item_id", "").strip()
                if item_id:
                    game_data["trading"][item_id] = {
                        "itemId": item_id,
                        "sellPrice": int(row.get("sell_price", 0))
                    }
        print(f"✓ Loaded {len(game_data['trading'])} trading prices")

    # Load facility upgrades
    print("Loading facility upgrades...")
    upgrades_file = data_dir / "facilityUpgrade.csv"
    if upgrades_file.exists():
        upgrades_by_facility = {}
        with open(upgrades_file, 'r', encoding='utf-8') as f:
            for row in csv.DictReader(f):
                facility_id = row.get("facility_id", "").strip()
                level = int(row.get("level", 1))

                if facility_id not in upgrades_by_facility:
                    upgrades_by_facility[facility_id] = {}

                if level not in upgrades_by_facility[facility_id]:
                    upgrades_by_facility[facility_id][level] = {
                        "level": level,
                        "goldCost": 0,
                        "materials": [],
                        "gridX": int(row.get("gridX", 0)) if row.get("gridX", "").strip() else None,
                        "gridY": int(row.get("gridY", 0)) if row.get("gridY", "").strip() else None
                    }

                material = row.get("material", "").strip()
                cost = int(row.get("cost", 0))

                for _ in range(cost):
                    upgrades_by_facility[facility_id][level]["materials"].append(material)

                if material == "gold":
                    upgrades_by_facility[facility_id][level]["goldCost"] = cost

        for facility_id in upgrades_by_facility:
            game_data["upgradeTree"][facility_id] = {}
            for level in sorted(upgrades_by_facility[facility_id].keys()):
                game_data["upgradeTree"][facility_id][str(level)] = upgrades_by_facility[facility_id][level]

        print(f"✓ Loaded upgrades for {len(game_data['upgradeTree'])} facilities")

    # Load config
    print("Loading config...")
    config_file = data_dir / "gameConfig.csv"
    if config_file.exists():
        with open(config_file, 'r', encoding='utf-8') as f:
            for row in csv.DictReader(f):
                key = row.get("key", "").strip()
                value = row.get("value", "").strip()
                if key:
                    try:
                        game_data["config"][key] = int(value)
                    except:
                        game_data["config"][key] = value
        print(f"✓ Loaded {len(game_data['config'])} config values")

    # Load product areas
    print("Loading product areas...")
    product_areas_file = data_dir / "productArea.csv"
    if product_areas_file.exists():
        with open(product_areas_file, 'r', encoding='utf-8') as f:
            for row in csv.DictReader(f):
                area_id = row.get("id", "").strip()
                if area_id:
                    product_item = None
                    product_item_str = row.get("productItem", "").strip()
                    if product_item_str:
                        try:
                            product_item = json.loads(product_item_str)
                        except:
                            print(f"Warning: Failed to parse productItem JSON for {area_id}")

                    game_data["productAreas"].append({
                        "id": area_id,
                        "facility_id": row.get("facility_id", "").strip(),
                        "requiredLevel": int(row.get("requiredLevel", 1)),
                        "gridX": int(row.get("gridX", 1)),
                        "gridY": int(row.get("gridY", 1)),
                        "productItem": product_item
                    })
        print(f"✓ Loaded {len(game_data['productAreas'])} product areas")

    # Load worker levels
    print("Loading worker levels...")
    worker_levels_file = data_dir / "workers" / "workerLevel.csv"
    if worker_levels_file.exists():
        with open(worker_levels_file, 'r', encoding='utf-8') as f:
            for row in csv.DictReader(f):
                level = int(row.get("level", 1))
                exp_required = int(row.get("expRequired", 0))
                game_data["workerLevels"].append({
                    "level": level,
                    "expRequired": exp_required
                })
        print(f"✓ Loaded {len(game_data['workerLevels'])} worker levels")
    else:
        print("⚠ Warning: workerLevel.csv not found")

    # Load worker names
    print("Loading worker names...")
    worker_names_file = data_dir / "workers" / "workerName.csv"
    if worker_names_file.exists():
        with open(worker_names_file, 'r', encoding='utf-8') as f:
            for row in csv.DictReader(f):
                name = row.get("name", "").strip()
                if name:
                    game_data["workerNames"].append(name)
        print(f"✓ Loaded {len(game_data['workerNames'])} worker names")
    else:
        print("⚠ Warning: workerName.csv not found")

    # Load worker grades
    print("Loading worker grades...")
    worker_grades_file = data_dir / "workers" / "workerGrade.csv"
    if worker_grades_file.exists():
        with open(worker_grades_file, 'r', encoding='utf-8') as f:
            for row in csv.DictReader(f):
                grade_id = row.get("id", "").strip()
                if grade_id:
                    game_data["workerGrades"].append({
                        "id": grade_id,
                        "name": row.get("name", "").strip(),
                        "weight": int(row.get("weight", 1)),
                        "baseGold": int(row.get("baseGold", 0)),
                        "levelGold": int(row.get("levelGold", 0)),
                        "maxLevel": int(row.get("maxLevel", 100))
                    })
        print(f"✓ Loaded {len(game_data['workerGrades'])} worker grades")
    else:
        print("⚠ Warning: workerGrade.csv not found")

    # Load worker upgrades
    print("Loading worker upgrades...")
    worker_upgrades_file = data_dir / "workers" / "workerUpgrade.csv"
    if worker_upgrades_file.exists():
        with open(worker_upgrades_file, 'r', encoding='utf-8') as f:
            for row in csv.DictReader(f):
                level = row.get("level", "").strip()
                if level:
                    grade_weight = None
                    grade_weight_str = row.get("gradeWeight", "").strip()
                    if grade_weight_str:
                        try:
                            grade_weight = json.loads(grade_weight_str)
                        except:
                            print(f"Warning: Failed to parse gradeWeight JSON for level {level}")

                    game_data["workerUpgrades"][level] = {
                        "level": int(level),
                        "capacity": int(row.get("capacity", 0)),
                        "gradeWeight": grade_weight
                    }
        print(f"✓ Loaded {len(game_data['workerUpgrades'])} worker upgrade levels")
    else:
        print("⚠ Warning: workerUpgrade.csv not found")

    # Load trading regions
    print("Loading trading regions...")
    trading_regions_file = data_dir / "trading" / "tradingRegion.csv"
    if trading_regions_file.exists():
        with open(trading_regions_file, 'r', encoding='utf-8') as f:
            for row in csv.DictReader(f):
                region_id = row.get("id", "").strip()
                if region_id:
                    order_list = None
                    order_list_str = row.get("orderList", "").strip()
                    if order_list_str:
                        try:
                            order_list = json.loads(order_list_str)
                        except:
                            print(f"Warning: Failed to parse orderList JSON for region {region_id}")

                    game_data["tradingRegions"].append({
                        "id": region_id,
                        "name": row.get("name", "").strip(),
                        "maxLevel": int(row.get("maxLevel", 5)),
                        "baseExp": int(row.get("baseExp", 1000)),
                        "orderList": order_list
                    })
        print(f"✓ Loaded {len(game_data['tradingRegions'])} trading regions")
    else:
        print("⚠ Warning: tradingRegion.csv not found")

    # Load trading orders
    print("Loading trading orders...")
    trading_orders_file = data_dir / "trading" / "tradingOrder.csv"
    if trading_orders_file.exists():
        with open(trading_orders_file, 'r', encoding='utf-8') as f:
            for row in csv.DictReader(f):
                order_id = row.get("id", "").strip()
                if order_id:
                    required = None
                    required_str = row.get("required", "").strip()
                    if required_str:
                        try:
                            required = json.loads(required_str)
                        except:
                            print(f"Warning: Failed to parse required JSON for order {order_id}")

                    reward = None
                    reward_str = row.get("reward", "").strip()
                    if reward_str:
                        try:
                            reward = json.loads(reward_str)
                        except:
                            print(f"Warning: Failed to parse reward JSON for order {order_id}")

                    game_data["tradingOrders"].append({
                        "id": order_id,
                        "grade": row.get("grade", "").strip(),
                        "credit": int(row.get("credit", 100)),
                        "required": required,
                        "reward": reward
                    })
        print(f"✓ Loaded {len(game_data['tradingOrders'])} trading orders")
    else:
        print("⚠ Warning: tradingOrder.csv not found")

    # Load trading upgrades
    print("Loading trading upgrades...")
    trading_upgrades_file = data_dir / "trading" / "tradingUpgrade.csv"
    if trading_upgrades_file.exists():
        with open(trading_upgrades_file, 'r', encoding='utf-8') as f:
            for row in csv.DictReader(f):
                level = row.get("level", "").strip()
                if level:
                    requirements = None
                    requirements_str = row.get("requirements", "").strip()
                    if requirements_str:
                        try:
                            requirements = json.loads(requirements_str)
                        except:
                            print(f"Warning: Failed to parse requirements JSON for level {level}")

                    game_data["tradingUpgrades"][level] = {
                        "level": int(level),
                        "cooltime": int(row.get("cooltime", 360)),
                        "maxQueueSlots": int(row.get("maxQueueSlots", 3)),
                        "requirements": requirements
                    }
        print(f"✓ Loaded {len(game_data['tradingUpgrades'])} trading upgrade levels")
    else:
        print("⚠ Warning: tradingUpgrade.csv not found")

    # Load process upgrades
    print("Loading process upgrades...")
    process_upgrades_file = data_dir / "facilities" / "processUpgrade.csv"
    if process_upgrades_file.exists():
        with open(process_upgrades_file, 'r', encoding='utf-8') as f:
            for row in csv.DictReader(f):
                level = row.get("level", "").strip()
                if level:
                    process_list = None
                    process_list_str = row.get("processList", "").strip()
                    if process_list_str:
                        try:
                            process_list = json.loads(process_list_str)
                        except:
                            print(f"Warning: Failed to parse processList JSON for level {level}")

                    game_data["processUpgrades"][level] = {
                        "level": int(level),
                        "processList": process_list
                    }
        print(f"✓ Loaded {len(game_data['processUpgrades'])} process upgrade levels")
    else:
        print("⚠ Warning: processUpgrade.csv not found")

    # Write output file
    print(f"\nWriting to {output_file}...")
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write("/**\n")
        f.write(" * Game Data - Embedded data files\n")
        f.write(" * AUTO-GENERATED by build_gamedata.py - Do not edit manually\n")
        f.write(" * This file contains all game data in JavaScript format\n")
        f.write(" * Run build_gamedata.py to regenerate after updating CSV files\n")
        f.write(" */\n\n")
        f.write("const GAME_DATA = " + json.dumps(game_data, indent=4) + ";\n")

    print("✓ Successfully generated gameData.js")
    print("Build complete!")

if __name__ == "__main__":
    build_game_data()
