import './DoriosAPI/index.js'
import './DoriosCore/index.js'
import { container as DoriosContainer } from './DoriosLib/index.js'
import './UIItemsCleanUp.js'

import './config/main.js'
import './machinery/main.js'

// Blocks
import './blocks/asphalt.js'
import './blocks/bonsai/bonsai.js'
import './blocks/cobble_generators.js'
import './blocks/crops.js'
import './blocks/crucible.js'
import './blocks/elevator.js'
import './blocks/fan.js'
import './blocks/light_blocks.js'
import './blocks/mech_spawners.js'
import './blocks/mob_grinder.js'
import './blocks/on_interact.js'
import './blocks/pedestal.js'
import './blocks/sieve.js'
import './blocks/xp_magnet.js'
import './blocks/xp.js'

// Items
import './items/block_loot.js'
import './items/dig_pebble.js'
import './items/durability.js'
import './items/drill.js'
import './items/essences.js'
import './items/hammer.js'
import './items/hoe.js'
import './items/potion.js'
import './items/shovel.js'
import './items/smelting.js'

// Systems
import './stack_refill.js'

DoriosContainer.initialize()

