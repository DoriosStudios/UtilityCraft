# DoriosLib public API inventory

This inventory tracks the public surface imported by addons with:

```js
import * as DoriosLib from "DoriosLib/index.js";
```

DoriosLib is UtilityCraft's general-purpose shared library. Unlike DoriosCore,
it is not limited to machinery. Its runtime API is intentionally grouped into
namespaces so addons can identify the owner of each helper at the call site.

## Classification

- **Foundation**: general helpers suitable for most addon code.
- **Integration**: cross-addon protocols or UtilityCraft registration entrypoints.
- **Infrastructure**: lower-level storage, link-node, startup, or lifecycle APIs.
- **Configuration**: data exported by the installed copy of DoriosLib.

## Runtime exports

The audit tool compares every dotted path below with the JavaScript modules and
`index.d.ts`. Namespace paths are included because they are real runtime exports.

<!-- runtime-exports:start -->

- Root: `VERSION`, `block`, `config`, `constants`, `container`, `dependencies`, `entity`, `item`, `linkNode`, `math`, `messages`, `player`, `registry`, `text`, `time`, `utils`.
- Block foundation: `block.getState`, `block.setState`, `block.setStates`, `block.getFacingVector`, `block.getFacingBlock`, `block.getAdjacentBlocks`, `block.getEntity`, `block.isType`.
- Installed configuration: `config.ADDON_METADATA`, `config.DEPENDENCY_OPTIONS`.
- Shared constants: `constants.PERMISSION_LEVELS`, `constants.COMMAND_PARAMETER_TYPES`, `constants.EQUIPMENT_SLOTS`, `constants.DIRECTION_VECTORS`, `constants.DIMENSIONS`, `constants.UNBREAKABLE_BLOCKS`, `constants.VANILLA_CONTAINER_BLOCKS`, `constants.isUnbreakableBlock`, `constants.isVanillaContainerBlock`.
- Container infrastructure: `container.CONTAINER_FAMILY`, `container.DIRECTIONS`, `container.IO_CONFIG_PROPERTY`, `container.ITEM_CONFIG_KEY`, `container.ITEM_CONFIG_VERSION`, `container.SCRIPT_EVENT_NAMESPACE`, `container.SET_CONFIG_EVENT_ID`, `container.initialize`, `container.shutdown`, `container.isInitialized`, `container.setConfig`, `container.resolve`, `container.resolveAt`, `container.getConfig`, `container.getConfigRevision`, `container.getStatus`, `container.getInputSlots`, `container.getOutputSlots`, `container.insert`, `container.transfer`, `container.isCompatible`, `container.invalidate`.
- Dependency integration: `dependencies.SCRIPT_EVENT_ID`, `dependencies.initialize`, `dependencies.get`, `dependencies.getAll`, `dependencies.validate`, `dependencies.compareVersions`, `dependencies.formatReport`, `dependencies.report`.
- Entity foundation: `entity.startPlayerTracking`, `entity.stopPlayerTracking`, `entity.isPlayerTracking`, `entity.getInventory`, `entity.getInventoryEntries`, `entity.getItems`, `entity.getItem`, `entity.setItem`, `entity.setNewItem`, `entity.tryAddItem`, `entity.changeItemAmount`, `entity.findItem`, `entity.countItem`, `entity.hasItem`, `entity.removeItem`, `entity.clearInventory`, `entity.dropAllItems`, `entity.findFirstEmptySlot`, `entity.setInFirstEmptySlot`, `entity.isInventoryFull`, `entity.getHealthComponent`, `entity.getHealth`, `entity.setHealth`, `entity.addHealth`, `entity.getHealthInfo`, `entity.getEquippable`, `entity.getEquipment`, `entity.setEquipment`.
- Item foundation: `item.durability`, `item.durability.getComponent`, `item.durability.getInfo`, `item.durability.repair`, `item.durability.damage`, `item.create`, `item.isType`.
- Link-node infrastructure: `linkNode.LINK_NODE_BLOCK_TAG`, `linkNode.LINK_NODE_TAG_PREFIX`, `linkNode.LINK_NODE_IO_CONFIG_KEY`, `linkNode.LINK_NODE_IO_VERSION`, `linkNode.LINK_NODE_IO_EVENT_NAMESPACE`, `linkNode.SET_LINK_NODE_IO_EVENT_ID`, `linkNode.createLinkNodeTag`, `linkNode.createLinkNodeKey`, `linkNode.parseLinkNodeKey`, `linkNode.parseLinkNodeTag`, `linkNode.isLinkNode`, `linkNode.getLinkNodeLocations`, `linkNode.isLinkedEntity`, `linkNode.resolveLinkNode`, `linkNode.resolveLinkNodeAt`, `linkNode.initializeLinkNodeIO`, `linkNode.shutdownLinkNodeIO`, `linkNode.isLinkNodeIOInitialized`, `linkNode.getLinkNodeIOOverride`, `linkNode.getLinkNodeIORevision`, `linkNode.invalidateLinkNodeIO`, `linkNode.setLinkNodeIO`, `linkNode.parseLinkNodeIOUpdate`.
- Math foundation: `math.clamp`, `math.roundTo`, `math.scaleTo`, `math.randomInt`, `math.randomFloat`, `math.distance`, `math.offset`, `math.romanToInteger`, `math.integerToRoman`.
- Messages foundation: `messages.broadcast`, `messages.send`, `messages.actionBar`, `messages.printJson`.
- Player foundation: `player.isCreative`, `player.isSurvival`, `player.giveItem`, `player.getEquipment`, `player.setEquipment`.
- Registry integration: `registry.COMMAND_PARAMETER_TYPES`, `registry.PERMISSION_LEVELS`, `registry.PARAMETER_TYPES`, `registry.REGISTRATION_EVENT_IDS`, `registry.registerAutoFisherDrop`, `registry.registerBonsai`, `registry.registerCoolant`, `registry.registerCrafterRecipe`, `registry.registerCrusherRecipe`, `registry.registerFluidHolder`, `registry.registerFluidItem`, `registry.registerFuel`, `registry.registerFurnaceRecipe`, `registry.registerGasHolder`, `registry.registerGasItem`, `registry.registerInfuserRecipe`, `registry.registerItemDuctCompatibility`, `registry.registerItemDuctChest`, `registry.unregisterItemDuctCompatibility`, `registry.registerLinkNodeIO`, `registry.registerMelterRecipe`, `registry.registerMachineUpgrade`, `registry.registerPlant`, `registry.registerPressRecipe`, `registry.registerSieveDrop`, `registry.registerSpecialContainerSlots`, `registry.createRegistrar`, `registry.blockComponent`, `registry.itemComponent`, `registry.customCommand`, `registry.install`.
- Text foundation: `text.FORMAT`, `text.capitalizeFirst`, `text.formatIdentifier`.
- Time foundation: `time.TICKS_PER_SECOND`, `time.TICKS`, `time.formatClock`, `time.formatDuration`, `time.runAfterTicks`, `time.runAfterSeconds`, `time.runAfterMinutes`, `time.waitTicks`, `time.waitSeconds`, `time.waitMinutes`.
- Utils foundation: `utils.json`, `utils.json.tryParse`, `utils.json.parseOr`, `utils.json.tryStringify`, `utils.json.stringify`, `utils.json.clone`, `utils.toArray`, `utils.isPlainObject`.

- Gas processing recipes: `registry.registerChemicalConverterRecipe`, `registry.registerElectrolyzerRecipe`.

<!-- runtime-exports:end -->

## Type-only exports

These contracts make runtime methods discoverable and safe in TypeScript and
JSDoc without adding JavaScript exports.

<!-- type-exports:start -->

- Core aliases: `BlockStateValue`, `ContainerFace`, `ScaleMode`, `LinkNodeIOResource`, `LinkNodeIOOperation`, `RegistrationPayload`, `ItemDuctCompatibilityRegistration`, `LinkNodeIORegistration`, `JsonResult`.
- Container IO: `SimpleItemConfig`, `FaceSlotConfig`, `ComplexItemConfig`, `ItemConfig`, `ResolvedContainer`, `ContainerTarget`, `InsertOptions`, `TransferOptions`, `SlotQueryOptions`, `ContainerStatus`.
- Dependencies: `DependencyRequirement`, `AddonMetadata`, `DependencyIssue`, `ValidationResult`, `InitializeDependencyOptions`.
- Entities and items: `InventoryEntry`, `SetItemOptions`, `SetNewItemOptions`, `TryAddItemOptions`, `AddItemResult`, `ChangeItemAmountOptions`, `HealthInfo`, `SetEquipmentOptions`, `PlayerTrackingOptions`, `CreateItemOptions`, `DurabilityInfo`, `DamageResult`, `GiveItemOptions`.
- Link nodes: `ResolvedLinkNode`, `LinkNodeIOSelection`, `LinkNodeIOUpdate`.
- Registries and JSON: `CoolantRegistration`, `CommandParameter`, `CommandDefinition`, `RegistrarOptions`, `Registrar`, `JsonStringifyOptions`.

<!-- type-exports:end -->

## Source classification

| Runtime area | Public files | Private implementation files |
| --- | --- | --- |
| Root/configuration | `index.js`, `config.js` | None |
| Blocks/constants | `block/index.js`, `constants/index.js` | None |
| Containers | `containers/index.js`, `containers/constants.js` | `containers/config.js` normalization helpers |
| Dependencies/entities | `dependencies/index.js`, `entity/index.js` | None |
| Items | `item/index.js`, `item/durability.js` | None |
| Link nodes | `linkNodes/index.js`, `linkNodes/io.js` | None |
| General helpers | `math/index.js`, `messages/index.js`, `player/index.js`, `text/index.js`, `time/index.js`, `utils/index.js`, `utils/json.js` | None |
| Registration | `registry/index.js` | Queueing, validation, and startup installation helpers in the same file |
