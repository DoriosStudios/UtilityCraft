import { system, world } from '@minecraft/server';

const speed = 20;

world.afterEvents.worldLoad.subscribe(() => {
    system.sendScriptEvent(
        "utilitycraft:set_tick_speed",
        JSON.stringify(speed)
    );
});
