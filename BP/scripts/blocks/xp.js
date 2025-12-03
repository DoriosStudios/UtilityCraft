import { system, ItemStack, world } from "@minecraft/server";
import { FluidManager } from "../machinery/DoriosMachinery/core.js";


DoriosAPI.register.blockComponent("xp", {
    onPlayerInteract({ block }) {
        if (block.typeId !== "utilitycraft:xp_spout") return;
        const isOpen = block.permutation.getState("utilitycraft:isOpen");
        block.setPermutation(block.permutation.withState("utilitycraft:isOpen", !isOpen));
    },

    onTick({ block }) {
        if (!worldLoaded) return;
        const dim = block.dimension;
        let { x, y, z } = block.location;

        // ─── XP DRAIN ───────────────────────────────────────────────
        if (block.typeId === "utilitycraft:xp_drain") {
            const player = dim.getPlayers({
                location: { x: x + 0.5, y, z: z + 0.5 },
                maxDistance: 0.8
            })[0];

            const tankBlock = block.below(1);
            if (!player || !tankBlock || !tankBlock.typeId.includes("fluid_tank")) return;

            // Obtener o crear entidad del tanque si el jugador tiene XP
            let tankEntity = dim.getEntitiesAtBlockLocation(tankBlock.location)[0];
            if (!tankEntity && player.getTotalXp() > 0) {
                tankEntity = FluidManager.addfluidToTank(tankBlock, "xp", 0);
            }
            if (!tankEntity) return;

            const tank = new FluidManager(tankEntity, 0);
            if (tank.isFull()) return;

            // Valor base por tick
            const baseDrain = 10;
            let xpToDrain = Math.min(baseDrain, player.xpEarnedAtCurrentLevel);

            // Si no tiene XP en el nivel actual, bajar uno
            if (player.xpEarnedAtCurrentLevel === 0 && player.getTotalXp() > 0) {
                player.addLevels(-1);
                // recalcula el valor real tras bajar un nivel
                xpToDrain = Math.min(baseDrain, player.totalXpNeededForNextLevel);
                player.addExperience(player.totalXpNeededForNextLevel - xpToDrain);
            } else {
                player.addExperience(-xpToDrain);
            }

            // Insertar en tanque
            const inserted = tank.tryInsert("xp", xpToDrain);
            if (inserted) {
                tankEntity.setHealth(tank.get());
            }
        }


        // ─── XP SPOUT ───────────────────────────────────────────────
        if (block.typeId === "utilitycraft:xp_spout" && block.permutation.getState("utilitycraft:isOpen")) {
            const facing = block.permutation.getState("minecraft:block_face");
            let targetBlock;
            let orbOffset = { x: 0.5, y: 0.5, z: 0.5 };

            switch (facing) {
                case "north":
                    targetBlock = block.south(1);
                    orbOffset = { x: 0.5, y: 0.5, z: 0.8 };
                    break;
                case "south":
                    targetBlock = block.north(1);
                    orbOffset = { x: 0.5, y: 0.5, z: 0.2 };
                    break;
                case "west":
                    targetBlock = block.east(1);
                    orbOffset = { x: 0.6, y: 0.5, z: 0.5 };
                    break;
                case "east":
                    targetBlock = block.west(1);
                    orbOffset = { x: 0.2, y: 0.5, z: 0.5 };
                    break;
            }

            if (!targetBlock || !targetBlock.typeId.includes("fluid_tank")) return;

            const tankEntity = dim.getEntitiesAtBlockLocation(targetBlock.location)[0];
            if (!tankEntity) return;

            const tank = new FluidManager(tankEntity, 0);

            // Solo emitir XP si el tanque contiene líquido tipo xp
            if (tank.getType() !== "xp" || tank.get() <= 0) return;

            // Cuánto XP sacar (máx 5)
            const drainAmount = Math.min(5, tank.get());

            // Drenar líquido del tanque
            tank.consume(drainAmount);
            tankEntity.setHealth(tank.get());

            // Generar orbes según la cantidad drenada
            for (let i = 0; i < drainAmount; i++) {
                dim.spawnEntity("xp_orb", {
                    x: block.location.x + orbOffset.x,
                    y: block.location.y + orbOffset.y,
                    z: block.location.z + orbOffset.z
                });
            }

            // Si el tanque quedó vacío → eliminar entidad y restaurar bloque
            if (tank.get() <= 0) {
                tankEntity.remove();
                const emptyBlock = targetBlock.typeId.replace(/_xp$/, "");
                targetBlock.setType(emptyBlock);
            }
        }

    }
});
