import * as DoriosLib from '../DoriosLib/index.js';

import { readContent, contentCode, readBlockValue, writeBlockValue, clearBlockValue } from './compactState.js';

const FRAME = 'utilitycraft:pestle_frame';

DoriosLib.registry.blockComponent('utilitycraft:mortar', {
    onPlace({ block }) { clearBlockValue(block, 'mortar'); },
    onBreak({ block }) { clearBlockValue(block, 'mortar'); },
    onPlayerInteract({ block, player }) {
        const equipment = player?.getComponent('equippable');
        if (!equipment) return;
        const mainhand = equipment.getEquipment('Mainhand');
        let permutation = block.permutation;
        let [leaves, water] = readContent(block);
        let crushing = readBlockValue(block, 'mortar', 7);

        if (!mainhand) {
            const frame = permutation.getState(FRAME);
            permutation = permutation.withState(FRAME, (frame + 1) % 8);
            // Only turns made with leaves inside count toward crushing.
            if (leaves > 0) {
                block.dimension.playSound('use.grass', block.location);
                crushing = (crushing + 1) % 8;
                if (crushing === 0) {
                    leaves--;
                    water++;
                }
            }
        } else if (mainhand.typeId.endsWith('leaves') && leaves + water < 4) {
            player.runCommand(`clear @s ${mainhand.typeId} 0 1`);
            leaves++;
            block.dimension.playSound('dig.grass', block.location);
        } else if (mainhand.typeId === 'minecraft:bucket' && water === 4) {
            player.runCommand('clear @s minecraft:bucket 0 1');
            DoriosLib.player.giveItem(player, { item: 'minecraft:water_bucket' });
            water = 0;
            block.dimension.playSound('bucket.fill_water', block.location);
        } else {
            return;
        }

        block.setPermutation(permutation.withState('utilitycraft:content', contentCode(leaves, water)));
        writeBlockValue(block, 'mortar', leaves > 0 ? crushing : 0);
        player.onScreenDisplay.setActionBar(`Leaves: ${leaves}   Water: ${water * 250}mB`);
    },
});
