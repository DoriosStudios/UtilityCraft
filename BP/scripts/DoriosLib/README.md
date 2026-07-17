# DoriosLib

DoriosLib is the general-purpose Minecraft Bedrock Script API library used by
Dorios Studios projects.

The library is intentionally side-effect free when imported:

- It does not modify Minecraft class prototypes.
- It does not create a `globalThis` variable.
- It does not subscribe to events unless an explicit lifecycle method is used.
- It does not contain UtilityCraft machine rules or third-party integrations.

## Import

```js
import * as DoriosLib from "./DoriosLib/index.js";

DoriosLib.block.setState(block, "utilitycraft:on", true);
const displayName = DoriosLib.text.formatIdentifier(item.typeId);
```

Operations with several related values use an options object while keeping the
target as the first argument:

```js
DoriosLib.entity.setItem(entity, {
  slot: 3,
  item,
});

DoriosLib.entity.setEquipment(player, {
  slot: "Mainhand",
  item,
});
```

Items can be created independently:

```js
const item = DoriosLib.item.create({
  typeId: "minecraft:diamond",
  amount: 4,
  nameTag: "§bSpecial Diamond",
  lore: ["§7Created by UtilityCraft"],
});
```

Or created and placed in one operation:

```js
DoriosLib.entity.setNewItem(entity, {
  slot: 3,
  typeId: "minecraft:diamond",
  amount: 4,
  nameTag: "§bSpecial Diamond",
  lore: ["§7Created by UtilityCraft"],
});
```

Player item insertion follows the same options pattern:

```js
DoriosLib.player.giveItem(player, {
  item: "minecraft:diamond",
  amount: 4,
  dropRemainder: true,
});
```

## Constants

Shared conversion tables and block lists are available through the constants
module:

```js
const permission = DoriosLib.constants.PERMISSION_LEVELS.admin;
const type = DoriosLib.constants.COMMAND_PARAMETER_TYPES.integer;

if (DoriosLib.constants.isUnbreakableBlock(block.typeId)) return;
if (DoriosLib.constants.isVanillaContainerBlock(block.typeId)) return;
```

The public lists remain editable and DoriosLib does not freeze exported data.

## Utilities

Generic utilities live under `DoriosLib.utils`. JSON helpers report failures
explicitly, which is useful for dynamic-property data:

```js
const result = DoriosLib.utils.json.tryParse(rawJson);

if (result.ok) {
  console.warn(result.value);
} else {
  console.warn(result.error);
}

const settings = DoriosLib.utils.json.parseOr(rawJson, {});
const serialized = DoriosLib.utils.json.stringify(settings);
```

## Time

Promise-based waits use the native Script API wait implementation:

```js
await DoriosLib.time.waitTicks(20);
await DoriosLib.time.waitSeconds(5);
await DoriosLib.time.waitMinutes(1);
```

Callbacks can be scheduled separately:

```js
DoriosLib.time.runAfterTicks(20, callback);
DoriosLib.time.runAfterSeconds(5, callback);
DoriosLib.time.runAfterMinutes(1, callback);
```

## Explicit lifecycle modules

Registrations are collected and installed explicitly:

```js
const registrar = DoriosLib.registry.createRegistrar("utilitycraft");

registrar
  .block("machine", handlers)
  .item("tool", itemHandlers)
  .install();
```

Dependency discovery is also initialized explicitly:

```js
DoriosLib.dependencies.initialize({
  name: "UtilityCraft",
  identifier: "utilitycraft",
  version: "3.5.0",
});
```

## Containers

Container entities opt in with the `dorios:container` family. Importing the
module is side-effect free, so each addon initializes the cross-addon event
listener explicitly:

```js
DoriosLib.container.initialize();
```

Configurations are published from their owning entity. The script event lets
every listening addon merge the same item rules into
`utilitycraft:io_config.items` and refresh its local cache:

```js
DoriosLib.container.setConfig(entity, {
  version: 1,
  type: "complex",
  anyInputSlots: [3, 4],
  anyOutputSlots: [6],
  inputConfig: {
    north: [3],
    up: [4],
  },
  outputConfig: {
    south: [6],
  },
});
```

`setConfig` always publishes the complete item document, not a partial patch.
The root `utilitycraft:io_config` object is merged so other resource groups,
such as `liquids`, remain untouched. Runtime reads are cached by `entity.id`;
the script-event listener replaces that cache entry whenever the config changes.

The system that owns a configured entity republishes its complete document once
when that entity initializes. This hydrates every active addon without a read
request or a type-ID registry. Readers never rebroadcast cached copies: doing so
would make a real Basic container indistinguishable from an addon that simply
does not own a local DP yet, and stale listeners could race a newer config.

Each configured cache entry also has a local revision token. Higher-level
systems can use `getConfigRevision(entity)` to avoid cloning or validating the
same document every tick; that revision is runtime-only and is not part of the
persisted schema.

Mode IDs and display names are intentionally absent from this backend schema.
They belong to the interface registry that translates a visual choice such as
`input_1` into the input/output slot arrays persisted for that face.

Fallback lists are explicit security boundaries declared by the interface
registration. A call without `face` uses `anyInputSlots` or `anyOutputSlots`;
DoriosLib never derives them from the currently configured faces.

```js
const automaticInputs = DoriosLib.container.getInputSlots(entity);
const northInputs = DoriosLib.container.getInputSlots(entity, {
  face: "north",
});
```

Simple containers use direct slot lists, while an entity with the family and no
item configuration is Basic and exposes every inventory slot for both access
directions.

World targets are resolved by capability. Block inventories take priority;
otherwise DoriosLib searches the cell for an entity with `dorios:container`:

```js
const target = DoriosLib.container.resolveAt(dimension, location);
if (!target) return;

const moved = DoriosLib.container.insert(target, {
  item,
  face: "up",
  maxAmount: 16,
});
```

`insert` returns the exact inserted amount and never mutates the supplied
`ItemStack`. Existing stacks are compared with `isStackableWith`, so names,
lore, durability and other metadata are not merged incorrectly.

Transfers use the direction from source toward target. DoriosLib applies that
direction to the source output and its opposite to the target input:

```js
const moved = DoriosLib.container.transfer(source, {
  sourceSlot: 6,
  target,
  direction: "down",
  maxAmount: 8,
});
```

For non-adjacent networks, `sourceFace` and `targetFace` can be supplied
independently. `targetSlots` narrows the destination but can never bypass the
slots allowed by the target configuration.
