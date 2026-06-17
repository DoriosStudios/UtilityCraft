import { world } from "@minecraft/server";
import { DEFAULT_ENTITY_ID } from "../DoriosCore/constants.js";
import { addOpenUICount, removeOpenUICount } from "../DoriosCore/utils/entity.js";

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
