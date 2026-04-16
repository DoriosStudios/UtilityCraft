import { Generator, EnergyStorage, FluidStorage } from "DoriosCore/machinery/index.js"
import { ButtonManager } from "DoriosCore/buttons/index.js"

const ENERGY_PER_LAVA_MB = 100

const MAGMATOR_MACHINE_ID = "magmator"
const MAGMATOR_BUTTON_SLOT = 3

ButtonManager.registerMachineButton(MAGMATOR_MACHINE_ID, MAGMATOR_BUTTON_SLOT, ({ entity }) => {
    const state = entity.getDynamicProperty("active") ?? true
    entity.setDynamicProperty("active", !state)
})

DoriosAPI.register.blockComponent(MAGMATOR_MACHINE_ID, {
    /**
     * Runs before the machine is placed by the player.
     * 
     * @param {import('@minecraft/server').BlockComponentPlayerPlaceBeforeEvent} e
     * @param {{ params: GeneratorSettings }} ctx
     */
    beforeOnPlayerPlace(e, { params: settings }) {
        Generator.spawnEntity(e, settings, (entity) => {
            entity.setItem(1, 'utilitycraft:progress_right_big_bar_00', 1, " ")
        });
    },

    /**
     * Executes each tick for the generator.
     * 
     * @param {import('@minecraft/server').BlockComponentTickEvent} e
     * @param {{ params: GeneratorSettings }} ctx
     */
    onTick(e, { params: settings }) {
        const generator = new Generator(e.block, settings);
        if (!generator.valid) return

        const { entity, energy, rate } = generator
        ButtonManager.ensureWatching(entity, MAGMATOR_MACHINE_ID)
        energy.transferToNetwork(rate * 4)

        /** @type {FluidStorage} */
        const fluid = FluidStorage.initializeSingle(entity);

        const state = entity.getDynamicProperty("active") ?? true
        if (!state) {
            updateMagmatorState(generator, fluid, "Off")
            return
        }

        if (fluid.type == 'empty') {
            updateMagmatorState(generator, fluid, "No Fuel")
            return
        }

        if (fluid.type != 'lava') {
            updateMagmatorState(generator, fluid, "Invalid Fuel")
            return
        }

        if (energy.getFreeSpace() <= 0) {
            updateMagmatorState(generator, fluid, "Energy Full", getMagmatorFuelStats(fluid, rate))
            return
        }

        const burnSpeed = Math.min(
            generator.rate,
            energy.getFreeSpace(),
            fluid.get() * ENERGY_PER_LAVA_MB
        )

        fluid.consume(burnSpeed / 100)
        energy.add(burnSpeed)

        updateMagmatorState(generator, fluid, "Running", {
            ...getMagmatorFuelStats(fluid, rate),
            statusColor: "a",
            powered: true,
        })
    },

    onPlayerBreak(e) {
        Generator.onDestroy(e);
    }
});


function getMagmatorFuelStats(fluid, rate) {
    return {
        fuelTime: DoriosAPI.utils.formatTime((fluid.get() / (rate / 50)) / 10),
        fuelValue: EnergyStorage.formatEnergyToText(fluid.get() * ENERGY_PER_LAVA_MB),
    }
}

function updateMagmatorState(generator, fluid, status, options = {}) {
    const { energy } = generator
    const {
        statusColor = "e",
        fuelTime = "---",
        fuelValue = "---",
        powered = false,
    } = options

    if (powered) {
        generator.on()
    } else {
        generator.off()
    }

    generator.displayEnergy()
    fluid.display(2)
    generator.setLabel(`
§r§${statusColor}${status}

§r§eFuel Information
 §eTime: §f${fuelTime}
 §eValue: §f${fuelValue}

§r§bEnergy at ${Math.floor(energy.getPercent())}%%
§r§cRate ${EnergyStorage.formatEnergyToText(generator.baseRate)}/t
`)
}

