import { Machine } from "DoriosCore/machinery/index.js"

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