import { world } from "@minecraft/server";

world.afterEvents.entitySpawn.subscribe((event) => {
    const { entity } = event;
    if (!entity || entity.typeId !== "minecraft:item") return;

    let itemComponent;
    try {
        itemComponent = entity.getComponent("item") ?? entity.getComponent("minecraft:item");
    } catch { }
    if (!itemComponent) return;

    const itemStack = itemComponent.itemStack;
    if (!itemStack) return;

    let isUiItem = false;
    try {
        isUiItem =
            itemStack.hasTag("utilitycraft:ui_element")
            || itemStack.hasTag("utilitycraft:ui.element");
    } catch { }
    if (!isUiItem) return;

    try {
        entity.remove();
    } catch { }
});
