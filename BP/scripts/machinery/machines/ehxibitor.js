import { Machine, registerIOInterface } from "DoriosCore/index.js"

const DISPLAY_SLOT = 3

registerIOInterface("utilitycraft:ehxibitor", {
    items: {
        anyInputSlots: [DISPLAY_SLOT],
        anyOutputSlots: [],
        modes: [
            { id: "disabled" },
            { id: "input_1", inputSlots: [DISPLAY_SLOT] }
        ]
    }
})

DoriosAPI.register.blockComponent("ehxibitor", {
    /**
     * Spawns the backing machine entity.
     *
     * @param {import('@minecraft/server').BlockComponentPlayerPlaceBeforeEvent} e
     * @param {{ params: MachineSettings }} ctx
     */
    beforeOnPlayerPlace(e, { params: settings }) {
        Machine.spawnEntity(e, settings)
    },

    /**
     * Drops block + stored inventory and removes backing entity.
     *
     * @param {import('@minecraft/server').BlockComponentPlayerBreakEvent} e
     */
    onPlayerBreak(e) {
        Machine.onDestroy(e)
    }
})
