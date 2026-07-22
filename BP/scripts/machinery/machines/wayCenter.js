import * as DoriosLib from "DoriosLib/index.js";
import { ItemStack, world } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";

const WAY_CENTER_BLOCK_ID = "utilitycraft:waycenter";
const WAY_CENTER_ENTITY_ID = "utilitycraft:waycenter";
const WAY_CARPET_BLOCK_ID = "utilitycraft:waycarpet";
const WAY_CHIP_ITEM_ID = "utilitycraft:way_chip";

const WAY_CHIP_DATA_PROPERTY_ID = "utilitycraft:way_chip_data";
const WAY_CENTER_DATA_PROPERTY_ID = "utilitycraft:way_center_data";
const DATA_VERSION = 1;
const MAX_DESTINATION_NAME_LENGTH = 32;

const RANGE_BY_LEVEL = [1_000, 2_500, 5_000, 10_000, 25_000, Infinity];
const DISCOUNT_BY_LEVEL = [0, 5, 15, 25, 50, 100];

const DIMENSION_ICONS = {
    "minecraft:overworld": "textures/ui/overworld",
    "minecraft:nether": "textures/ui/nether",
    "minecraft:the_end": "textures/ui/the_end",
};

let basesDimension;

world.afterEvents.worldLoad.subscribe(() => {
    basesDimension = world.getDimension("overworld");
    try {
        basesDimension.runCommand("tickingarea add 0 0 0 0 0 0 dorios");
    } catch {}
});

/**
 * Creates a translated RawMessage with optional substitutions.
 *
 * @param {string} key
 * @param {(string|number|import("@minecraft/server").RawMessage)[]} [values]
 * @returns {import("@minecraft/server").RawMessage}
 */
function translate(key, values = []) {
    if (values.length === 0) return { translate: key };

    return {
        translate: key,
        with: {
            rawtext: values.map((value) => {
                if (typeof value === "object" && value !== null) return value;
                return { text: String(value) };
            }),
        },
    };
}

/**
 * @param {import("@minecraft/server").Player} player
 * @param {string} key
 * @param {(string|number|import("@minecraft/server").RawMessage)[]} [values]
 */
function showMessage(player, key, values = []) {
    player.onScreenDisplay.setActionBar(translate(key, values));
}

/**
 * @returns {import("@minecraft/server").Dimension}
 */
function getBasesDimension() {
    basesDimension ??= world.getDimension("overworld");
    return basesDimension;
}

/**
 * @param {unknown} value
 * @returns {object|undefined}
 */
function parseJson(value) {
    if (typeof value !== "string" || value.length === 0) return undefined;
    try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === "object" ? parsed : undefined;
    } catch {
        return undefined;
    }
}

/**
 * @param {unknown} location
 * @returns {{x:number,y:number,z:number}|undefined}
 */
function normalizeLocation(location) {
    if (!location || typeof location !== "object") return undefined;

    const x = Number(location.x);
    const y = Number(location.y);
    const z = Number(location.z);
    if (![x, y, z].every(Number.isFinite)) return undefined;

    return {
        x: Math.floor(x),
        y: Math.floor(y),
        z: Math.floor(z),
    };
}

/**
 * @param {unknown} dimension
 * @returns {string|undefined}
 */
function normalizeDimensionId(dimension) {
    if (typeof dimension !== "string") return undefined;
    const value = dimension.trim();
    if (value.length === 0) return undefined;
    if (value.includes(":")) return value;
    if (value === "overworld" || value === "nether" || value === "the_end") {
        return `minecraft:${value}`;
    }
    return value;
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function sanitizeDestinationName(value) {
    return String(value ?? "")
        .replace(/§./g, "")
        .replace(/[\r\n\t]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, MAX_DESTINATION_NAME_LENGTH);
}

/**
 * @param {string} dimensionId
 * @returns {string}
 */
function formatDimensionText(dimensionId) {
    const names = {
        "minecraft:overworld": "Overworld",
        "minecraft:nether": "Nether",
        "minecraft:the_end": "The End",
    };
    if (names[dimensionId]) return names[dimensionId];

    return dimensionId
        .replace(/^.*:/, "")
        .split("_")
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

/**
 * @param {string} dimensionId
 * @returns {import("@minecraft/server").RawMessage}
 */
function getDimensionRawMessage(dimensionId) {
    const keys = {
        "minecraft:overworld": "ui.utilitycraft:way_center.dimension.overworld",
        "minecraft:nether": "ui.utilitycraft:way_center.dimension.nether",
        "minecraft:the_end": "ui.utilitycraft:way_center.dimension.the_end",
    };
    const key = keys[dimensionId];
    return key ? translate(key) : { text: formatDimensionText(dimensionId) };
}

/**
 * @param {unknown} value
 * @returns {{version:number,name:string,location?:{x:number,y:number,z:number},dimension?:string}|undefined}
 */
function normalizeWayChipData(value) {
    if (!value || typeof value !== "object") return undefined;

    const name = sanitizeDestinationName(value.name);
    if (!name) return undefined;

    const location = normalizeLocation(value.location);
    const dimension = normalizeDimensionId(value.dimension);
    if (!location || !dimension) {
        return { version: DATA_VERSION, name };
    }

    return {
        version: DATA_VERSION,
        name,
        location,
        dimension,
    };
}

/**
 * @param {object|undefined} data
 * @returns {boolean}
 */
function isBoundWayChip(data) {
    return Boolean(data?.name && data?.location && data?.dimension);
}

/**
 * @param {import("@minecraft/server").ItemStack} item
 * @returns {object|undefined}
 */
function readWayChipData(item) {
    if (!item || item.typeId !== WAY_CHIP_ITEM_ID) return undefined;
    return normalizeWayChipData(parseJson(item.getDynamicProperty(WAY_CHIP_DATA_PROPERTY_ID)));
}

/**
 * Writes all chip data into one JSON dynamic property. Lore is presentation
 * only and can be changed without invalidating the destination.
 *
 * @param {import("@minecraft/server").ItemStack} item
 * @param {object} value
 * @returns {import("@minecraft/server").ItemStack|undefined}
 */
function writeWayChipData(item, value) {
    const data = normalizeWayChipData(value);
    if (!data) return undefined;

    item.setDynamicProperty(WAY_CHIP_DATA_PROPERTY_ID, JSON.stringify(data));

    const lore = [`§r§b${data.name}`];
    if (isBoundWayChip(data)) {
        lore.push(
            `§r§7${formatDimensionText(data.dimension)}`,
            `§r§f${data.location.x}, ${data.location.y}, ${data.location.z}`,
        );
    }
    item.setLore(lore);
    return item;
}

/**
 * @param {object} data
 * @returns {import("@minecraft/server").ItemStack}
 */
function createWayChip(data) {
    return writeWayChipData(new ItemStack(WAY_CHIP_ITEM_ID, 1), data) ?? new ItemStack(WAY_CHIP_ITEM_ID, 1);
}

/**
 * @param {object} destination
 * @returns {string}
 */
function getDestinationKey(destination) {
    return `${destination.dimension}:${destination.location.x},${destination.location.y},${destination.location.z}`;
}

/**
 * @param {object} a
 * @param {object} b
 * @returns {boolean}
 */
function sameDestination(a, b) {
    return getDestinationKey(a) === getDestinationKey(b);
}

/**
 * @param {unknown} value
 * @returns {{version:number,center:{location:{x:number,y:number,z:number},dimension:string},destinations:object[]}|undefined}
 */
function normalizeWayCenterData(value) {
    if (!value || typeof value !== "object") return undefined;

    const centerSource = value.center ?? value;
    const location = normalizeLocation(centerSource.location);
    const dimension = normalizeDimensionId(centerSource.dimension);
    if (!location || !dimension) return undefined;

    const destinations = [];
    const seen = new Set();
    for (const entry of Array.isArray(value.destinations) ? value.destinations : []) {
        const destination = normalizeWayChipData(entry);
        if (!isBoundWayChip(destination)) continue;

        const key = getDestinationKey(destination);
        if (seen.has(key)) continue;
        seen.add(key);
        destinations.push(destination);
    }

    return {
        version: DATA_VERSION,
        center: { location, dimension },
        destinations,
    };
}

/**
 * @param {import("@minecraft/server").Entity} entity
 * @param {object} data
 */
function writeWayCenterData(entity, data) {
    const normalized = normalizeWayCenterData(data);
    if (!normalized) throw new Error("Invalid Way Center data");
    entity.setDynamicProperty(WAY_CENTER_DATA_PROPERTY_ID, JSON.stringify(normalized));
}

/**
 * @param {import("@minecraft/server").Entity} entity
 * @returns {object|undefined}
 */
function readWayCenterData(entity) {
    if (!entity?.isValid) return undefined;
    return normalizeWayCenterData(parseJson(entity.getDynamicProperty(WAY_CENTER_DATA_PROPERTY_ID)));
}

/**
 * @returns {import("@minecraft/server").Entity[]}
 */
function getWayCenterEntities() {
    return getBasesDimension().getEntities({ type: WAY_CENTER_ENTITY_ID });
}

/**
 * @param {{x:number,y:number,z:number}} location
 * @param {string} dimension
 * @returns {{entity:import("@minecraft/server").Entity,data:object}[]}
 */
function findWayCenters(location, dimension) {
    const normalizedLocation = normalizeLocation(location);
    const normalizedDimension = normalizeDimensionId(dimension);
    if (!normalizedLocation || !normalizedDimension) return [];

    return getWayCenterEntities().flatMap((entity) => {
        const data = readWayCenterData(entity);
        if (!data) return [];
        const sameLocation = data.center.location.x === normalizedLocation.x
            && data.center.location.y === normalizedLocation.y
            && data.center.location.z === normalizedLocation.z;
        return sameLocation && data.center.dimension === normalizedDimension ? [{ entity, data }] : [];
    });
}

/**
 * @param {import("@minecraft/server").Block} block
 * @returns {{entity:import("@minecraft/server").Entity,data:object}|undefined}
 */
function getOrCreateWayCenter(block) {
    const existing = findWayCenters(block.location, block.dimension.id)[0];
    if (existing) return existing;

    const entity = getBasesDimension().spawnEntity(WAY_CENTER_ENTITY_ID, { x: 0.5, y: 0, z: 0.5 });
    const data = normalizeWayCenterData({
        version: DATA_VERSION,
        center: {
            location: block.location,
            dimension: block.dimension.id,
        },
        destinations: [],
    });
    writeWayCenterData(entity, data);
    return { entity, data };
}

/**
 * @param {object} destination
 * @returns {{entity:import("@minecraft/server").Entity,data:object,destination:object}|undefined}
 */
function findDestinationRegistration(destination) {
    for (const entity of getWayCenterEntities()) {
        const data = readWayCenterData(entity);
        if (!data) continue;
        const registered = data.destinations.find((entry) => sameDestination(entry, destination));
        if (registered) return { entity, data, destination: registered };
    }
    return undefined;
}

/**
 * @param {import("@minecraft/server").Entity} entity
 * @param {object} destination
 * @returns {boolean}
 */
function removeDestinationFromCenter(entity, destination) {
    const data = readWayCenterData(entity);
    if (!data) return false;

    const remaining = data.destinations.filter((entry) => !sameDestination(entry, destination));
    if (remaining.length === data.destinations.length) return false;
    data.destinations = remaining;
    writeWayCenterData(entity, data);
    return true;
}

/**
 * Removes a carpet from every center record.
 *
 * @param {{x:number,y:number,z:number}} location
 * @param {string} dimension
 * @returns {boolean}
 */
function unregisterWayCarpet(location, dimension) {
    const target = normalizeWayChipData({
        name: "Way Carpet",
        location,
        dimension,
    });
    if (!target) return false;

    let removed = false;
    for (const entity of getWayCenterEntities()) {
        const data = readWayCenterData(entity);
        if (!data) continue;

        const registered = data.destinations.find((entry) => sameDestination(entry, target));
        if (!registered) continue;

        removed = true;
        data.destinations = data.destinations.filter((entry) => !sameDestination(entry, target));
        writeWayCenterData(entity, data);
    }
    return removed;
}

/**
 * @param {import("@minecraft/server").Block} block
 * @returns {number}
 */
function getRangeLevel(block) {
    const value = Number(block.permutation.getState("utilitycraft:range"));
    return Math.max(0, Math.min(RANGE_BY_LEVEL.length - 1, Math.floor(value || 0)));
}

/**
 * @param {object} origin
 * @param {object} destination
 * @returns {number}
 */
function getDistance(origin, destination) {
    const dx = destination.location.x - origin.location.x;
    const dy = destination.location.y - origin.location.y;
    const dz = destination.location.z - origin.location.z;
    let distance = Math.sqrt(dx ** 2 + dy ** 2 + dz ** 2);
    if (origin.dimension !== destination.dimension) distance *= 8;
    return distance;
}

/**
 * @param {object} center
 * @param {object} destination
 * @param {number} discount
 * @returns {number}
 */
function getPrice(center, destination, discount) {
    const distance = getDistance(center, destination);
    const distancePrice = distance < 10_000
        ? Math.floor(distance / 1_000)
        : 10 + Math.floor(distance / 10_000);
    const dimensionPrice = destination.dimension.includes("the_end")
        ? 5
        : destination.dimension.includes("nether") ? 2 : 0;

    return Math.max(0, Math.ceil((distancePrice + dimensionPrice) * ((100 - discount) / 100)));
}

/**
 * @param {number} value
 * @returns {string}
 */
function formatNumber(value) {
    return Math.max(0, Math.floor(Number(value) || 0))
        .toString()
        .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * @param {string} dimensionId
 * @returns {import("@minecraft/server").Dimension|undefined}
 */
function tryGetDimension(dimensionId) {
    try {
        return world.getDimension(dimensionId);
    } catch {
        return undefined;
    }
}

/**
 * @param {import("@minecraft/server").Player} player
 * @param {{location:{x:number,y:number,z:number},dimension:import("@minecraft/server").Dimension}} origin
 */
function restorePlayer(player, origin) {
    try {
        const restored = player.tryTeleport(origin.location, {
            dimension: origin.dimension,
            checkForBlocks: false,
        });
        if (!restored) player.teleport(origin.location, { dimension: origin.dimension });
    } catch {}
}

/**
 * Tries the collision-safe API first. If the destination chunk is unloaded,
 * regular teleport is used to load it while preserving the block check.
 *
 * @param {import("@minecraft/server").Player} player
 * @param {{x:number,y:number,z:number}} target
 * @param {import("@minecraft/server").Dimension} dimension
 * @returns {boolean}
 */
function safeTeleport(player, target, dimension) {
    try {
        if (player.tryTeleport(target, { dimension, checkForBlocks: true })) return true;

        player.teleport(target, { dimension, checkForBlocks: true });
        const location = player.location;
        return player.dimension.id === dimension.id
            && Math.abs(location.x - target.x) < 0.1
            && Math.abs(location.y - target.y) < 0.1
            && Math.abs(location.z - target.z) < 0.1;
    } catch {
        return false;
    }
}

/**
 * @param {import("@minecraft/server").Player} player
 * @param {import("@minecraft/server").Entity} centerEntity
 * @param {object} destination
 * @param {number} price
 */
function teleportToDestination(player, centerEntity, destination, price) {
    if (player.level < price) {
        showMessage(player, "message.utilitycraft.way_center.not_enough_levels", [price, player.level]);
        return;
    }

    const destinationDimension = tryGetDimension(destination.dimension);
    if (!destinationDimension) {
        removeDestinationFromCenter(centerEntity, destination);
        showMessage(player, "message.utilitycraft.way_center.destination_missing");
        return;
    }

    const origin = {
        location: { ...player.location },
        dimension: player.dimension,
    };
    const target = {
        x: destination.location.x + 0.5,
        y: destination.location.y + 0.125,
        z: destination.location.z + 0.5,
    };

    try {
        const teleported = safeTeleport(player, target, destinationDimension);
        if (!teleported) {
            let destinationExists = true;
            try {
                destinationExists = destinationDimension.getBlock(destination.location)?.typeId === WAY_CARPET_BLOCK_ID;
            } catch {}

            if (!destinationExists) {
                removeDestinationFromCenter(centerEntity, destination);
                showMessage(player, "message.utilitycraft.way_center.destination_missing");
            } else {
                showMessage(player, "message.utilitycraft.way_center.destination_blocked");
            }
            return;
        }

        const destinationBlock = destinationDimension.getBlock(destination.location);
        if (destinationBlock?.typeId !== WAY_CARPET_BLOCK_ID) {
            restorePlayer(player, origin);
            removeDestinationFromCenter(centerEntity, destination);
            showMessage(player, "message.utilitycraft.way_center.destination_missing");
            return;
        }

        if (price > 0) player.addLevels(-price);
    } catch (error) {
        restorePlayer(player, origin);
        showMessage(player, "message.utilitycraft.way_center.teleport_failed");
        console.warn(`[Way Center] Teleport failed: ${error?.message ?? error}`);
    }
}

/**
 * @param {import("@minecraft/server").Block} carpet
 * @param {import("@minecraft/server").Player} player
 */
function teleportToWayCenter(carpet, player) {
    const destination = normalizeWayChipData({
        name: "Way Carpet",
        location: carpet.location,
        dimension: carpet.dimension.id,
    });
    const registration = findDestinationRegistration(destination);
    if (!registration) {
        showMessage(player, "message.utilitycraft.way_center.center_missing");
        return;
    }

    const centerDimension = tryGetDimension(registration.data.center.dimension);
    if (!centerDimension) {
        showMessage(player, "message.utilitycraft.way_center.center_missing");
        return;
    }

    const origin = {
        location: { ...player.location },
        dimension: player.dimension,
    };
    const target = {
        x: registration.data.center.location.x + 0.5,
        y: registration.data.center.location.y + 1,
        z: registration.data.center.location.z + 0.5,
    };

    try {
        const teleported = safeTeleport(player, target, centerDimension);
        if (!teleported) {
            let centerExists = true;
            try {
                centerExists = centerDimension.getBlock(registration.data.center.location)?.typeId === WAY_CENTER_BLOCK_ID;
            } catch {}

            if (!centerExists) {
                registration.entity.remove();
                showMessage(player, "message.utilitycraft.way_center.center_missing");
            } else {
                showMessage(player, "message.utilitycraft.way_center.center_blocked");
            }
            return;
        }

        const centerBlock = centerDimension.getBlock(registration.data.center.location);
        if (centerBlock?.typeId !== WAY_CENTER_BLOCK_ID) {
            restorePlayer(player, origin);
            registration.entity.remove();
            showMessage(player, "message.utilitycraft.way_center.center_missing");
        }
    } catch (error) {
        restorePlayer(player, origin);
        showMessage(player, "message.utilitycraft.way_center.teleport_failed");
        console.warn(`[Way Center] Return teleport failed: ${error?.message ?? error}`);
    }
}

/**
 * @param {import("@minecraft/server").Player} player
 * @param {import("@minecraft/server").Block} block
 */
async function bindWayChip(player, block) {
    const itemAtOpen = DoriosLib.entity.getEquipment(player, "Mainhand");
    if (itemAtOpen?.typeId !== WAY_CHIP_ITEM_ID) return;

    const currentData = readWayChipData(itemAtOpen);
    const form = new ModalFormData()
        .title(translate("ui.utilitycraft:way_chip.bind_title"))
        .label(translate("ui.utilitycraft:way_chip.location", [
            getDimensionRawMessage(block.dimension.id),
            block.location.x,
            block.location.y,
            block.location.z,
        ]))
        .divider()
        .textField(
            translate("ui.utilitycraft:way_chip.name_field"),
            translate("ui.utilitycraft:way_chip.name_placeholder"),
            { defaultValue: currentData?.name ?? "" },
        )
        .submitButton(translate("ui.utilitycraft:way_chip.bind_button"));

    try {
        const response = await form.show(player);
        if (response.canceled || !response.formValues) return;

        const activeBlock = block.dimension.getBlock(block.location);
        if (activeBlock?.typeId !== WAY_CARPET_BLOCK_ID) {
            showMessage(player, "message.utilitycraft.way_center.destination_missing");
            return;
        }

        const currentItem = DoriosLib.entity.getEquipment(player, "Mainhand");
        if (currentItem?.typeId !== WAY_CHIP_ITEM_ID) {
            showMessage(player, "message.utilitycraft.way_center.invalid_chip");
            return;
        }

        const formValues = Array.isArray(response.formValues) ? response.formValues : [];
        const nameValue = [...formValues]
            .reverse()
            .find((value) => typeof value === "string");
        const name = sanitizeDestinationName(nameValue);
        if (!name) {
            showMessage(player, "message.utilitycraft.way_center.chip_name_required");
            return;
        }

        const updatedItem = writeWayChipData(currentItem, {
            version: DATA_VERSION,
            name,
            location: activeBlock.location,
            dimension: activeBlock.dimension.id,
        });
        if (!updatedItem || !DoriosLib.entity.setEquipment(player, { slot: "Mainhand", item: updatedItem })) {
            showMessage(player, "message.utilitycraft.way_center.invalid_chip");
            return;
        }

        showMessage(player, "message.utilitycraft.way_center.chip_bound", [name]);
    } catch (error) {
        console.warn(`[Way Center] Chip form failed: ${error?.message ?? error}`);
    }
}

/**
 * @param {import("@minecraft/server").Player} player
 * @param {import("@minecraft/server").Entity} centerEntity
 * @param {import("@minecraft/server").Block} block
 */
function registerWayChip(player, centerEntity, block) {
    const item = DoriosLib.entity.getEquipment(player, "Mainhand");
    const destination = readWayChipData(item);
    if (!isBoundWayChip(destination)) {
        showMessage(player, "message.utilitycraft.way_center.chip_unbound");
        return;
    }

    const destinationDimension = tryGetDimension(destination.dimension);
    if (!destinationDimension) {
        showMessage(player, "message.utilitycraft.way_center.destination_missing");
        return;
    }

    try {
        const destinationBlock = destinationDimension.getBlock(destination.location);
        if (destinationBlock && destinationBlock.typeId !== WAY_CARPET_BLOCK_ID) {
            showMessage(player, "message.utilitycraft.way_center.destination_missing");
            return;
        }
    } catch {
        // Unloaded destinations are validated after teleporting to them.
    }

    if (findDestinationRegistration(destination)) {
        showMessage(player, "message.utilitycraft.way_center.already_registered");
        return;
    }

    const rangeLevel = getRangeLevel(block);
    const maxDistance = RANGE_BY_LEVEL[rangeLevel];
    const centerData = readWayCenterData(centerEntity);
    if (!centerData) {
        showMessage(player, "message.utilitycraft.way_center.center_missing");
        return;
    }

    const distance = getDistance(centerData.center, destination);
    if (distance > maxDistance) {
        showMessage(player, "message.utilitycraft.way_center.out_of_range", [
            formatNumber(Math.ceil(distance)),
            Number.isFinite(maxDistance) ? formatNumber(maxDistance) : "Unlimited",
        ]);
        return;
    }

    centerData.destinations.push(destination);
    try {
        writeWayCenterData(centerEntity, centerData);
        DoriosLib.entity.setEquipment(player, { slot: "Mainhand", item: undefined });
        showMessage(player, "message.utilitycraft.way_center.registered", [destination.name]);
    } catch (error) {
        showMessage(player, "message.utilitycraft.way_center.invalid_chip");
        console.warn(`[Way Center] Registration failed: ${error?.message ?? error}`);
    }
}

/**
 * @param {import("@minecraft/server").Player} player
 * @param {import("@minecraft/server").Entity} centerEntity
 * @param {import("@minecraft/server").Block} block
 */
async function openWayCenterMenu(player, centerEntity, block) {
    const data = readWayCenterData(centerEntity);
    if (!data) {
        showMessage(player, "message.utilitycraft.way_center.center_missing");
        return;
    }

    const rangeLevel = getRangeLevel(block);
    const maxRange = RANGE_BY_LEVEL[rangeLevel];
    const discount = DISCOUNT_BY_LEVEL[rangeLevel];
    const destinations = data.destinations
        .map((destination) => ({
            destination,
            distance: getDistance(data.center, destination),
            price: getPrice(data.center, destination, discount),
        }))
        .sort((a, b) => a.distance - b.distance || a.destination.name.localeCompare(b.destination.name));

    const form = new ActionFormData().title(translate("ui.utilitycraft:way_center.title"));
    if (destinations.length === 0) {
        form.body(translate("ui.utilitycraft:way_center.empty"));
        form.button(translate("ui.utilitycraft:way_center.close"));
    } else {
        const rangeText = Number.isFinite(maxRange)
            ? translate("ui.utilitycraft:way_center.blocks", [formatNumber(maxRange)])
            : translate("ui.utilitycraft:way_center.unlimited");
        form.body(translate("ui.utilitycraft:way_center.summary", [
            destinations.length,
            rangeText,
            discount,
            player.level,
        ]));

        for (const entry of destinations) {
            const buttonText = translate("ui.utilitycraft:way_center.destination_button", [
                entry.destination.name,
                entry.price,
                translate("ui.utilitycraft:way_center.blocks", [formatNumber(Math.ceil(entry.distance))]),
            ]);
            const icon = DIMENSION_ICONS[entry.destination.dimension];
            if (icon) form.button(buttonText, icon);
            else form.button(buttonText);
        }
    }

    try {
        const response = await form.show(player);
        if (response.canceled || response.selection === undefined || destinations.length === 0) return;

        const selected = destinations[response.selection];
        if (!selected) return;
        teleportToDestination(player, centerEntity, selected.destination, selected.price);
    } catch (error) {
        console.warn(`[Way Center] Menu failed: ${error?.message ?? error}`);
    }
}

DoriosLib.registry.blockComponent("utilitycraft:computer", {
    onPlayerInteract({ player, block }) {
        const mainHand = DoriosLib.entity.getEquipment(player, "Mainhand");

        // Allow the dedicated upgradeable component to handle upgrade items.
        if (mainHand?.typeId.endsWith("_upgrade")) return;

        const center = findWayCenters(block.location, block.dimension.id)[0] ?? getOrCreateWayCenter(block);
        if (!center) {
            showMessage(player, "message.utilitycraft.way_center.center_missing");
            return;
        }

        if (mainHand?.typeId === WAY_CHIP_ITEM_ID) {
            registerWayChip(player, center.entity, block);
            return;
        }

        void openWayCenterMenu(player, center.entity, block);
    },

    onPlace({ block }) {
        getOrCreateWayCenter(block);
    },

    onPlayerBreak({ block, player }) {
        const centers = findWayCenters(block.location, block.dimension.id);
        const destinations = new Map();

        for (const { entity, data } of centers) {
            for (const destination of data.destinations) {
                destinations.set(getDestinationKey(destination), destination);
            }
            entity.remove();
        }

        if (!player || !DoriosLib.player.isSurvival(player)) return;
        for (const destination of destinations.values()) {
            block.dimension.spawnItem(createWayChip(destination), block.center());
        }
    },
});

DoriosLib.registry.blockComponent("utilitycraft:carpet", {
    onPlayerInteract({ player, block }) {
        const mainHand = DoriosLib.entity.getEquipment(player, "Mainhand");
        if (mainHand?.typeId === WAY_CHIP_ITEM_ID) {
            void bindWayChip(player, block);
            return;
        }

        teleportToWayCenter(block, player);
    },

    onPlayerBreak({ block }) {
        unregisterWayCarpet(block.location, block.dimension.id);
    },
});
