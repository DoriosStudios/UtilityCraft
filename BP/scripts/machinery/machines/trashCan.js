import * as DoriosLib from "DoriosLib/index.js";
// trashCan.js
import { system } from "@minecraft/server";
import {
    EnergyStorage, FluidStorage, GasStorage, registerIOInterface,
} from "DoriosCore/index.js";
import { initializeEntity } from "DoriosCore/utils/entity.js";
import { ensureItemIOConfig } from "DoriosCore/interfaces/itemIO.js";
import { ensureFluidIOConfig } from "DoriosCore/interfaces/fluidIO.js";
import { ensureGasIOConfig } from "DoriosCore/interfaces/gasIO.js";
import { getBlockOwner, clearBlockOwner } from "DoriosCore/utils/blockOwner.js";

DoriosLib.registry.blockComponent("utilitycraft:trash_can", {
    /**
     * Before placing the block:
     * Spawns the machine entity manually without using the Machine class.
     */
    onPlace(e, { params }) {
        getBlockOwner(e.block);
    },

    /**
     * Every tick: clear the entity inventory completely.
     */
    onTick(e) {
        const { block } = e;
        const entity = getBlockOwner(block);

        const inv = entity.getComponent("minecraft:inventory")?.container;
        if (!inv) return;

        // Clear all items
        for (let i = 0; i < inv.size; i++) {
            inv.setItem(i, undefined);
        }
    },

    /**
     * On break:
     * Remove the entity and do NOT drop contents.
     */
    onPlayerBreak(e) {
        const { block, dimension } = e;
        clearBlockOwner(block);
    }
});


// Passive sinks: their buffers accept resources from every face and never export.
const TRASH_ENTITY = "utilitycraft:resource_trash_can";
const TRASH_CAPACITY = 1_000_000_000;
const trashTypes = {
    liquid: { liquids: true },
    gas: { gases: true },
    energy: {},
    ultimate: { items: true, liquids: true, gases: true },
};
for (const [variant, types] of Object.entries(trashTypes)) {
    const definition = {};
    if (types.items) definition.items = {
        anyInputSlots: Array.from({ length: 27 }, (_, i) => i), anyOutputSlots: [],
        modes: [{ id: "default" }, { id: "disabled" }],
    };
    for (const resource of ["liquids", "gases"]) {
        if (types[resource]) definition[resource] = {
            anyInputIndices: [0, 1], anyOutputIndices: [],
            modes: [{ id: "default" }, { id: "disabled" }],
        };
    }
    registerIOInterface("utilitycraft:" + variant + "_trash_can", definition);
}

DoriosLib.registry.blockComponent("utilitycraft:resource_trash_can", {
    onPlace({ block }, { params }) {
        const entity = getBlockOwner(block);
        initializeTrashEntity(entity, block, params);
    },
    onTick({ block }, { params }) {
        const entity = getBlockOwner(block);
        initializeTrashEntity(entity, block, params);
        if (params.items) entity.getComponent("minecraft:inventory")?.container?.clearAll();
        if (params.liquids) for (const tank of FluidStorage.initializeMultiple(entity, 2)) {
            tank.set(0);
            tank.setType("empty");
        }
        if (params.gases) for (const tank of GasStorage.initializeMultiple(entity, 2)) {
            tank.set(0);
            tank.setType("empty");
        }
        if (params.energy) new EnergyStorage(entity).set(0);
    },
    onPlayerBreak({ block, dimension }) {
        clearBlockOwner(block);
    },
});


function initializeTrashEntity(entity, block, params) {
    initializeEntity(entity);
    if (params.liquids) for (const tank of FluidStorage.initializeMultiple(entity, 2)) {
        tank.setCap(TRASH_CAPACITY);
        tank.set(0);
        tank.setType("empty");
    }
    if (params.gases) for (const tank of GasStorage.initializeMultiple(entity, 2)) {
        tank.setCap(TRASH_CAPACITY);
        tank.set(0);
        tank.setType("empty");
    }
    if (params.energy) {
        const energy = new EnergyStorage(entity);
        energy.setCap(TRASH_CAPACITY);
        energy.set(0);
    }
    // Inventory component groups finish updating before the input policy is installed.
    system.run(() => {
        if (!entity.isValid) return;
        if (params.items) ensureItemIOConfig(entity, block.typeId);
        if (params.liquids) ensureFluidIOConfig(entity, block.typeId);
        if (params.gases) ensureGasIOConfig(entity, block.typeId);
    });
}
