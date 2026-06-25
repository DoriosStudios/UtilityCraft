import { world } from "@minecraft/server";
import { addOpenUICount, removeOpenUICount } from "DoriosCore/index.js";

const OPEN_UI_PLAYERS_PROPERTY_ID = "utilitycraft:players";
const TICK_GROUP_PROPERTY_ID = "utilitycraft:tick_group";

function hasMachineUIProperties(entity) {
  try {
    return (
      typeof entity?.getProperty(OPEN_UI_PLAYERS_PROPERTY_ID) === "number" &&
      typeof entity?.getProperty(TICK_GROUP_PROPERTY_ID) === "number"
    );
  } catch {
    return false;
  }
}

world.afterEvents.entityContainerOpened.subscribe((e) => {
  const { entity } = e;

  if (!hasMachineUIProperties(entity)) return;

  addOpenUICount(entity);
});

world.afterEvents.entityContainerClosed.subscribe((e) => {
  const { entity } = e;

  if (!hasMachineUIProperties(entity)) return;

  removeOpenUICount(entity);
});
