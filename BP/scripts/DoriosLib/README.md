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

`DoriosLib.containers` is reserved for the new DoriosContainers IO system. It
will remain empty until the dynamic-property JSON contract is finalized.
