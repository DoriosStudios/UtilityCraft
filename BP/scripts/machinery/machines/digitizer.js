import * as DoriosLib from "DoriosLib/index.js";
import { Machine, registerIOInterface } from "DoriosCore/index.js";
import { crafterRecipes } from "../../config/recipes/crafter.js";
import { ItemStack, system } from "@minecraft/server";
import { writeBlueprintData, sendBlueprintDataEvent } from "../blueprint.js";

const BLUEPRINT_SLOT = 3;
const INPUT_START = 6;
const INPUT_END = 14;
const INPUT_SLOTS = [6, 7, 8, 9, 10, 11, 12, 13, 14];
const OUTPUT_SLOT = 15;
const BLUEPRINT_ITEM = "utilitycraft:blueprint_paper";
const OUTPUT_BLUEPRINT_ITEM = "utilitycraft:blueprint";

registerIOInterface("utilitycraft:digitizer", {
    items: {
        buttonSlots: [16, 21],
        anyInputSlots: INPUT_SLOTS,
        anyOutputSlots: [OUTPUT_SLOT],
        modes: [
            { id: "disabled" },
            { id: "input_1", inputSlots: INPUT_SLOTS },
            { id: "output_1", outputSlots: [OUTPUT_SLOT] },
            { id: "input_2", inputSlots: [BLUEPRINT_SLOT] },
        ],
    }
});
const MIN_Y_MAP = {
    "minecraft:overworld": DoriosLib.constants.DIMENSIONS.overworld.minY,
    "minecraft:nether": DoriosLib.constants.DIMENSIONS.nether.minY,
    "minecraft:the_end": DoriosLib.constants.DIMENSIONS.end.minY,
};

DoriosLib.registry.blockComponent("utilitycraft:digitizer", {
    /**
     * @param {{ params: MachineSettings }} ctx
     */
    beforeOnPlayerPlace(e, { params: settings }) {
        Machine.spawnEntity(e, settings, () => {
            const machine = new Machine(e.block, { ...settings, ignoreTick: true }, true);
            machine.setEnergyCost(settings.machine.energy_cost);
            machine.displayProgress();
            DoriosLib.entity.setNewItem(machine.entity, { slot: 1, typeId: "utilitycraft:arrow_right_0", amount: 1, nameTag: "" });
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
        machine.processIO();

        const blueprint = inv.getItem(BLUEPRINT_SLOT);
        if (!blueprint || blueprint.typeId !== BLUEPRINT_ITEM) {
            machine.showWarning("No Blueprint");
            return;
        }

        if (inv.getItem(OUTPUT_SLOT)) {
            machine.showWarning("Output Full");
            return;
        }

        let materialCount = 0;
        for (let slot = INPUT_START; slot <= INPUT_END; slot++) {
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
        let progress = machine.getProgress();

        const energyToConsume = Math.min(
            machine.energy.get(),
            machine.rate,
            Math.max(0, energyCost - progress) * machine.boosts.consumption
        );

        if (energyToConsume > 0) {
            machine.energy.consume(energyToConsume);
            progress += energyToConsume / machine.boosts.consumption;
            machine.setProgress(progress, { display: false });
        }

        if (progress < energyCost) {
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

        for (let slot = INPUT_START; slot <= INPUT_END; slot++) {
            const item = inv.getItem(slot);
            if (item) {
                const id = item.typeId;
                materialMap[id] = (materialMap[id] || 0) + 1;
                dimension.runCommand(`replaceitem block ${x} ${minY} ${z} slot.container ${slot - INPUT_START} ${id}`);
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

                inv.setItem(OUTPUT_SLOT, newBlueprint);
                sendBlueprintDataEvent(machine.entity, {
                    slot: OUTPUT_SLOT,
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
