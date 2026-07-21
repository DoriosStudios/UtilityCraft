import './DoriosCore/index.js'
import * as DoriosLib from './DoriosLib/index.js'
import './cleanupUiItems.js'

import './config/main.js'
import './machinery/main.js'

// Blocks
import './blocks/asphalt.js'
import './blocks/bonsai/bonsai.js'
import './blocks/cobbleGenerators.js'
import './blocks/crops.js'
import './blocks/crucible.js'
import './blocks/elevator.js'
import './blocks/fan.js'
import './blocks/lightBlocks.js'
import './blocks/mechSpawners.js'
import './blocks/mobGrinder.js'
import './blocks/onInteract.js'
import './blocks/pedestal.js'
import './blocks/sieve.js'
import './blocks/xpMagnet.js'
import './blocks/xp.js'

// Items
import './items/blockLoot.js'
import './items/digPebble.js'
import './items/durability.js'
import './items/drill.js'
import './items/essences.js'
import './items/hammer.js'
import './items/hoe.js'
import './items/potion.js'
import './items/shovel.js'
import './items/smelting.js'

// Systems
import './stackRefill.js'

DoriosLib.registry.install()
DoriosLib.container.initialize()

