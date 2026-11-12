import { system, world } from "@minecraft/server";

const DATA_PROPERTY = "utilitycraft:block_owner_data";
const owners = new WeakMap();

function key(block) {
  return `${block.dimension.id}:${block.location.x},${block.location.y},${block.location.z}`;
}

function readData() {
  try {
    const value = world.getDynamicProperty(DATA_PROPERTY);
    return value ? JSON.parse(value) : {};
  } catch {
    return {};
  }
}

function writeData(data) {
  world.setDynamicProperty(DATA_PROPERTY, JSON.stringify(data));
}

function getEntry(block, create = false) {
  const data = readData();
  const id = key(block);
  if (!data[id] && create) data[id] = { properties: {}, dynamic: {}, tags: [] };
  return data[id];
}

function mutate(block, callback) {
  const data = readData();
  const id = key(block);
  const entry = data[id] ?? (data[id] = { properties: {}, dynamic: {}, tags: [] });
  callback(entry);
  writeData(data);
}

/**
 * Entity-compatible state owner backed by a block and its native block
 * container. It deliberately exposes no entity lifecycle or spawn behavior.
 */
export function getBlockOwner(block) {
  if (!block) return undefined;
  const existing = owners.get(block);
  if (existing) return existing;

  const owner = {
    block,
    id: `block:${key(block)}`,
    typeId: block.typeId,
    dimension: block.dimension,
    get location() { return block.location; },
    get isValid() { return block.isValid !== false && !block.isAir; },
    get scoreboardIdentity() { return this.id; },
    get nameTag() { return block.localizationKey; },
    set nameTag(_) {},
    getComponent(componentId) {
      if (componentId === "minecraft:inventory" || componentId === "inventory") {
        return block.getComponent("minecraft:inventory");
      }
      if (componentId === "minecraft:type_family") {
        return { hasTypeFamily: family => {
          if (block.permutation.hasTag(family)) return true;
          if (family === "dorios:fluid_container") return block.permutation.hasTag("dorios:fluid");
          if (family === "dorios:gas_container") return block.permutation.hasTag("dorios:gas");
          if (family === "dorios:container") return block.permutation.hasTag("dorios:item");
          if (family === "dorios:energy_container") return block.permutation.hasTag("dorios:energy");
          if (family === "dorios:energy_source") return block.permutation.hasTag("dorios:generator");
          if (family === "dorios:battery") return block.typeId.includes("battery");
          return false;
        } };
      }
      return block.getComponent(componentId);
    },
    getTags() {
      return getEntry(block, true).tags.concat(
        ["dorios:item", "dorios:machine", "dorios:generator", "dorios:energy", "dorios:fluid", "dorios:gas", "dorios:fluid_container", "dorios:gas_container", "dorios:container"]
          .filter(tag => block.permutation.hasTag(tag)),
      );
    },
    hasTag(tag) { return this.getTags().includes(tag); },
    addTag(tag) { mutate(block, entry => { if (!entry.tags.includes(tag)) entry.tags.push(tag); }); },
    removeTag(tag) { mutate(block, entry => { entry.tags = entry.tags.filter(value => value !== tag); }); },
    getProperty(property) {
      const state = block.permutation.getState(property);
      return state === undefined ? getEntry(block, true).properties[property] : state;
    },
    setProperty(property, value) {
      if (block.permutation.getState(property) !== undefined) {
        block.setPermutation(block.permutation.withState(property, value));
      } else mutate(block, entry => { entry.properties[property] = value; });
    },
    getDynamicProperty(property) { return getEntry(block, true).dynamic[property]; },
    setDynamicProperty(property, value) {
      mutate(block, entry => {
        if (value === undefined) delete entry.dynamic[property];
        else entry.dynamic[property] = value;
      });
    },
    runCommand() {},
    triggerEvent() {},
    remove() {},
  };

  owners.set(block, owner);
  return owner;
}

export function isBlockOwner(value) {
  return Boolean(value?.block && value?.id?.startsWith("block:"));
}

export function clearBlockOwner(block) {
  if (!block) return;
  const data = readData();
  delete data[key(block)];
  writeData(data);
  owners.delete(block);
}

export function whenBlockContainerReady(block, callback, attempts = 20) {
  system.run(() => {
    if (!block?.isValid || block.isAir) return;
    const owner = getBlockOwner(block);
    if (owner.getComponent("minecraft:inventory")?.container) {
      callback(owner);
      return;
    }
    if (attempts > 0) whenBlockContainerReady(block, callback, attempts - 1);
  });
}
