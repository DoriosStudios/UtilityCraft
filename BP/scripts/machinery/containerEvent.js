import { world } from "@minecraft/server";
import { DEFAULT_ENTITY_ID, addOpenUICount, removeOpenUICount } from "DoriosCore/index.js";

world.afterEvents.entityContainerOpened.subscribe((e) => {
  const { entity } = e;

  if (entity.typeId !== DEFAULT_ENTITY_ID) return;

  addOpenUICount(entity);
});

world.afterEvents.entityContainerClosed.subscribe((e) => {
  const { entity } = e;

  if (entity.typeId !== DEFAULT_ENTITY_ID) return;

  removeOpenUICount(entity);
});
