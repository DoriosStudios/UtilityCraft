import { Machine, Energy } from '../DoriosMachinery/core.js';
import { crafterRecipes } from "../../config/recipes/crafter.js";
import { ItemStack, system } from '@minecraft/server'


// Ranuras
const BLUEPRINT_SLOT = 3;
// Ajusta estos IDs si tu namespace difiere
const BLUEPRINT_ITEM = 'utilitycraft:blueprint_paper';
const OUTPUT_BLUEPRINT_ITEM = 'utilitycraft:blueprint';

DoriosAPI.register.blockComponent('digitizer', {
    /**
     * Runs before the machine is placed by the player.
     * 
     * @param {{ params: MachineSettings }} ctx
     */
    beforeOnPlayerPlace(e, { params: settings }) {
        Machine.spawnMachineEntity(e, settings, () => {
            const machine = new Machine(e.block, settings, true);
            machine.setEnergyCost(settings.machine.energy_cost);
            machine.displayProgress();
            machine.entity.setItem(1, 'utilitycraft:arrow_right_0', 1, "");
            machine.entity.setDynamicProperty('crafting', false);
        });
    },

    /**
     * Executes each tick for the machine.
     * 
     * @param {import('@minecraft/server').BlockComponentTickEvent} e
     * @param {{ params: MachineSettings }} ctx
     */
    onTick(e, { params: settings }) {
        if (!worldLoaded) return;

        const { block } = e;
        const machine = new Machine(block, settings);
        if (!machine.valid) return

        const inv = machine.inv;

        const size = inv.size;
        const OUTPUT_SLOT = size - 1;
        const INPUT_START = size - 10;
        const INPUT_END = size - 2; // inclusive

        // --- Validaciones de ranuras ---
        const blueprint = inv.getItem(BLUEPRINT_SLOT);
        if (!blueprint || blueprint.typeId !== BLUEPRINT_ITEM) {
            machine.showWarning('No Blueprint');
            return; // label: No Blueprint
        }

        // Output ocupado
        if (inv.getItem(OUTPUT_SLOT)) {
            machine.showWarning('Output Full');
            return; // label: Output Full
        }

        // Sin materiales en inputs (los 9 anteriores al output)
        let materialCount = 0;
        for (let i = INPUT_START; i <= INPUT_END; i++) {
            if (inv.getItem(i)) materialCount++;
        }
        if (materialCount === 0) {
            machine.showWarning('No Materials');
            return; // label: No Materials
        }

        if (machine.energy.get() <= 0) {
            machine.showWarning('No Energy', false);
            return; // label: No Energy
        }

        if (machine.entity.getDynamicProperty('crafting')) {
            machine.showWarning('Crafting', false);
            return; // label: No Energy
        }

        const energyCost = settings.machine.energy_cost;
        const progress = machine.getProgress();

        if (progress >= energyCost) {
            // Replicar EXACTAMENTE el comportamiento del crafter físico
            // Coordenadas y offsets como el código original
            let { x, y, z } = block.location;
            y += 0.25;
            x += 0.5;
            z += 0.5;

            const dimension = machine.dim;
            const crafterBlockId = dimension.getBlock({ x: x, y: -64, z })?.typeId;
            const redstoneBlockId = dimension.getBlock({ x: x, y: -63, z })?.typeId;

            // Estado: bloqueando para evitar dobles ejecuciones
            machine.entity.setDynamicProperty('crafting', true);

            // Colocar crafter y construir receta/materiales
            dimension.setBlockType({ x: x, y: -64, z }, 'minecraft:crafter');

            /** @type {Record<string, number>} */
            const materialMap = {};
            /** @type {string[]} */
            const recipeArray = [];

            for (let i = INPUT_START; i <= INPUT_END; i++) {
                const item = inv.getItem(i);
                if (item) {
                    const id = item.typeId;
                    materialMap[id] = (materialMap[id] || 0) + 1;
                    // Misma fórmula de índice que el código antiguo: i - 5
                    // (INPUT_START = size-10 → slot.container = (size-10)-5 = size-15 ... hasta (size-2)-5 = size-7)
                    dimension.runCommand(`replaceitem block ${x} -64 ${z} slot.container ${i - 6} ${id}`);
                    recipeArray.push(id.split(':')[1]);
                } else {
                    recipeArray.push('air');
                }
            }

            // Activar crafter
            dimension.setBlockType({ x, y: -63, z }, 'minecraft:redstone_block');

            // Clave de receta y datos de materiales
            const recipeString = recipeArray.join(',');
            const recipeData = Object.entries(materialMap).map(([id, amount]) => ({ id, amount }));

            // Crear blueprint de salida
            const newBlueprint = new ItemStack(OUTPUT_BLUEPRINT_ITEM, 1);

            // Espera corta (como el original: 9 ticks) para leer drop del crafter
            system.runTimeout(() => {
                const itemEntity = dimension.getEntitiesAtBlockLocation({ x, y: -65, z })[0];

                let recipeExists = false;
                let outputAmount = 0;
                let outputId;

                if (itemEntity) {
                    // Si el crafter dropeó un ítem, lo usamos
                    const itemStack = itemEntity.getComponent('minecraft:item').itemStack;
                    outputAmount = itemStack.amount;
                    outputId = itemStack.typeId;
                    itemEntity.remove();
                    recipeExists = true;
                } else {
                    // Si no dropeó, buscamos en las recetas configuradas
                    const itemRecipe = crafterRecipes[recipeString];
                    if (itemRecipe) {
                        outputAmount = itemRecipe.amount;
                        outputId = itemRecipe.output;
                        recipeExists = true;
                        if (itemRecipe.leftover) {
                            newBlueprint.setDynamicProperty('leftover', itemRecipe.leftover);
                        }
                    }
                }

                if (recipeExists && outputId) {
                    // Guardar metadata en el nuevo blueprint
                    newBlueprint.setDynamicProperty('amount', outputAmount);
                    newBlueprint.setDynamicProperty('id', outputId);

                    const fmt = DoriosAPI.utils.formatIdToText;
                    const lore = [
                        `§r§7 Recipe: §r§f${fmt(outputId)}`,
                        '§r§7 Materials:'
                    ];
                    for (const mat of recipeData) {
                        lore.push(`§r§7 - ${fmt(mat.id)} x${mat.amount}`);
                    }
                    newBlueprint.setDynamicProperty('materials', JSON.stringify(recipeData));
                    newBlueprint.setLore(lore);

                    // Consumir 1 blueprint base
                    if (blueprint.amount > 1) {
                        blueprint.amount--;
                        inv.setItem(BLUEPRINT_SLOT, blueprint);
                    } else {
                        inv.setItem(BLUEPRINT_SLOT);
                    }

                    // Colocar el blueprint resultante en el output
                    inv.setItem(OUTPUT_SLOT, newBlueprint);

                    // Descontar progreso consumido
                    machine.addProgress(-energyCost);
                }

                // Limpiar y restaurar mundo exactamente como antes
                removeCrafter(dimension, { x, y, z }, machine.entity, crafterBlockId, redstoneBlockId);
            }, 9);
        } else {
            // Cargar energía y avanzar progreso como el autosieve
            const energyToConsume = Math.min(machine.energy.get(), machine.rate);
            const consumed = machine.energy.consume(energyToConsume);
            machine.addProgress(energyToConsume / machine.boosts.consumption);
        }

        // Estado/visualización (mismo patrón del autosieve)
        machine.on();
        machine.displayEnergy();
        machine.displayProgress();
        machine.showStatus('Running');
    },

    onPlayerBreak(e) {
        Machine.onDestroy(e);
    }
});

/** Mantiene EXACTAMENTE la limpieza del crafter original */
function removeCrafter(dimension, { x, y, z }, entity, crafterBlockId, redstoneBlockId) {
    for (let i = 0; i < 9; i++) {
        dimension.runCommand(`replaceitem block ${x} -64 ${z} slot.container ${i} air`);
    }
    dimension.setBlockType({ x, y: -64, z }, crafterBlockId);
    dimension.setBlockType({ x, y: -63, z }, redstoneBlockId);
    entity.setDynamicProperty('crafting', false);
}
