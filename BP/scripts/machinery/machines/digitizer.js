import { Machine } from "DoriosCore/machinery/index.js";
import { crafterRecipes } from "../../config/recipes/crafter.js";
import { ItemStack, system } from "@minecraft/server";
import { writeBlueprintData, sendBlueprintDataEvent } from "../blueprint.js";

const BLUEPRINT_SLOT = 3;
const BLUEPRINT_ITEM = "utilitycraft:blueprint_paper";
const OUTPUT_BLUEPRINT_ITEM = "utilitycraft:blueprint";
const MIN_Y_MAP = {
    "minecraft:overworld": DoriosAPI.constants.dimensions.overworld.minY,
    "minecraft:nether": DoriosAPI.constants.dimensions.nether.minY,
    "minecraft:the_end": DoriosAPI.constants.dimensions.end.minY,
};

DoriosAPI.register.blockComponent("digitizer", {
    /**
     * @param {{ params: MachineSettings }} ctx
     */
    beforeOnPlayerPlace(e, { params: settings }) {
        Machine.spawnEntity(e, settings, () => {
            const machine = new Machine(e.block, { ...settings, ignoreTick: true }, true);
            machine.setEnergyCost(settings.machine.energy_cost);
            machine.displayProgress();
            machine.entity.setItem(1, "utilitycraft:arrow_right_0", 1, "");
            machine.entity.setDynamicProperty("crafting", false);
        });
    },

    /**
     * @param {import("@minecraft/server").BlockComponentTickEvent} e
     * @param {{ params: MachineSettings }} ctx
     */
    onTick(e, { params: settings }) {
        const { block } = e;
        const machine = new Machine(block, settings);
        if (!machine.valid) return;

        const inv = machine.container;
        const size = inv.size;
        const outputSlot = size - 1;
        const inputStart = size - 10;
        const inputEnd = size - 2;

        const blueprint = inv.getItem(BLUEPRINT_SLOT);
        if (!blueprint || blueprint.typeId !== BLUEPRINT_ITEM) {
            machine.showWarning("No Blueprint");
            return;
        }

        if (inv.getItem(outputSlot)) {
            machine.showWarning("Output Full");
            return;
        }

        let materialCount = 0;
        for (let slot = inputStart; slot <= inputEnd; slot++) {
            if (inv.getItem(slot)) materialCount++;
        }

        if (materialCount === 0) {
            machine.showWarning("No Materials");
            return;
        }

        if (machine.energy.get() <= 0) {
            machine.showWarning("No Energy", false);
            return;
        }

        if (machine.entity.getDynamicProperty("crafting")) {
            machine.showWarning("Crafting", false);
            return;
        }

        const energyCost = settings.machine.energy_cost;
        const progress = machine.getProgress();

        if (progress < energyCost) {
            const energyToConsume = Math.min(machine.energy.get(), machine.rate);
            machine.energy.consume(energyToConsume);
            machine.addProgress(energyToConsume / machine.boosts.consumption);

            machine.on();
            machine.displayProgress({ maxValue: settings.machine.energy_cost });
            machine.showStatus("Running");
            return;
        }

        let { x, y, z } = block.location;
        y += 0.25;
        x += 0.5;
        z += 0.5;

        const dimension = machine.dimension;
        const minY = MIN_Y_MAP[dimension.id];
        const crafterBlockId = dimension.getBlock({ x, y: minY, z })?.typeId;
        const redstoneBlockId = dimension.getBlock({ x, y: minY + 1, z })?.typeId;

        machine.entity.setDynamicProperty("crafting", true);
        dimension.setBlockType({ x, y: minY, z }, "minecraft:crafter");

        /** @type {Record<string, number>} */
        const materialMap = {};
        /** @type {string[]} */
        const recipeArray = [];

        for (let slot = inputStart; slot <= inputEnd; slot++) {
            const item = inv.getItem(slot);
            if (item) {
                const id = item.typeId;
                materialMap[id] = (materialMap[id] || 0) + 1;
                dimension.runCommand(`replaceitem block ${x} ${minY} ${z} slot.container ${slot - 6} ${id}`);
                recipeArray.push(id.split(":")[1]);
            } else {
                recipeArray.push("air");
            }
        }

        dimension.setBlockType({ x, y: minY + 1, z }, "minecraft:redstone_block");

        const recipeString = recipeArray.join(",");
        const recipeData = Object.entries(materialMap).map(([id, amount]) => ({ id, amount }));
        const newBlueprint = new ItemStack(OUTPUT_BLUEPRINT_ITEM, 1);

        system.runTimeout(() => {
            const itemEntity = dimension.getEntitiesAtBlockLocation({ x, y: minY - 1, z })[0];

            let recipeExists = false;
            let outputAmount = 0;
            let outputId;
            let leftoverId;

            if (itemEntity) {
                const itemStack = itemEntity.getComponent("minecraft:item").itemStack;
                outputAmount = itemStack.amount;
                outputId = itemStack.typeId;
                itemEntity.remove();
                recipeExists = true;
            } else {
                const itemRecipe = crafterRecipes[recipeString];
                if (itemRecipe) {
                    outputAmount = itemRecipe.amount;
                    outputId = itemRecipe.output;
                    recipeExists = true;
                    leftoverId = itemRecipe.leftover;
                }
            }

            if (recipeExists && outputId) {
                const blueprintData = {
                    id: outputId,
                    amount: outputAmount,
                    materials: recipeData,
                    leftover: leftoverId,
                };

                writeBlueprintData(newBlueprint, blueprintData);

                if (blueprint.amount > 1) {
                    blueprint.amount--;
                    inv.setItem(BLUEPRINT_SLOT, blueprint);
                } else {
                    inv.setItem(BLUEPRINT_SLOT);
                }

                inv.setItem(outputSlot, newBlueprint);
                sendBlueprintDataEvent(machine.entity, {
                    slot: outputSlot,
                    data: blueprintData,
                });
                machine.addProgress(-energyCost);
            }

            removeCrafter(dimension, { x, y, z }, machine.entity, crafterBlockId, redstoneBlockId, minY);
        }, 9);

        machine.on();
        machine.displayProgress({ maxValue: settings.machine.energy_cost });
        machine.showStatus("Running");
    },

    onPlayerBreak(e) {
        Machine.onDestroy(e);
    },
});

function removeCrafter(dimension, { x, y, z }, entity, crafterBlockId, redstoneBlockId, minY) {
    for (let slot = 0; slot < 9; slot++) {
        dimension.runCommand(`replaceitem block ${x} ${minY} ${z} slot.container ${slot} air`);
    }

    dimension.setBlockType({ x, y: minY, z }, crafterBlockId);
    dimension.setBlockType({ x, y: minY + 1, z }, redstoneBlockId);
    entity?.setDynamicProperty("crafting", false);
}
