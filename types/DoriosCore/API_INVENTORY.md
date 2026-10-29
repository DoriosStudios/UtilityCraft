# DoriosCore public API inventory

This inventory is the source of truth for the DoriosCore documentation rewrite.
All addon code must import the runtime API from:

```js
import { Machine } from "DoriosCore/index.js";
```

DoriosCore is consumed as a library and must not be edited by addons. Addons
that need different behavior should extend its classes inside an addon-owned
module such as `ADDONNAME_CORE` or `ExampleCore`.

## Classification

- **Primary**: belongs in tutorials, concepts, and the main API reference.
- **Advanced**: public and supported, but intended for custom infrastructure or
  lower-level control.
- **Compatibility**: public for existing systems; prefer the newer API noted in
  its reference page for new code.
- **Internal**: not exported from `DoriosCore/index.js`; omit it from the public
  API reference even when it supports an exported facade.

## Runtime exports

The following 108 names are resolvable from `DoriosCore/index.js`. The audit
tool verifies that every name is declared by `index.d.ts` and appears exactly
once in this section.

<!-- runtime-exports:start -->

| Area | Classification | Runtime exports | Template coverage |
| --- | --- | --- | --- |
| Machinery foundation | Primary | `BasicMachine`, `Machine`, `Generator`, `EnergyStorage`, `FluidStorage`, `GasStorage`, `MachineUpgradeRegistry` | Normal machines, active/passive generators, liquid/gas machinery, and ExampleCore subclasses |
| Item energy storage | Primary | `ItemEnergyStorage` | Durability-backed charge storage for tagged items; callers persist modified stacks |
| Thermal storage and simulation | Primary | `TemperatureStorage`, `advanceTemperature` | Persistent temperature, thermal capacity, fixed-reservoir heat exchange, and the shared 32-frame temperature bar |
| Runtime helpers | Primary / Advanced | `Rotation`, `TickScheduler`, `OutputTracker`, `resolveItemContainerAt` | Rotatable machines, scheduler-aware ticks, IO targets, and multiblock ports |
| IO authoring | Primary | `registerIOInterface`, `registerIOInterfaceForBlockTag`, `ensureBlockIOInterface`, `hasRegisteredIOInterface`, `IOInterface`, `registerLinkNodeIO`, `getLinkNodeIODefinition`, `openLinkNodeIOForm` | Machine face controls and multiblock link-node routing |
| Container UI interfaces | Advanced | `InterfaceManager`, `encodeInterfaceSlot`, `decodeInterfaceSlot`, `stripInterfaceSlotCode` | Shared IO buttons and custom entity-container buttons |
| Fluid IO documents | Advanced | `DEFAULT_FLUID_IO_MODE`, `DISABLED_FLUID_IO_MODE`, `FLUID_CONFIG_VERSION`, `FLUID_CONFIG_KEY`, `FLUID_CONTAINER_FAMILY`, `FLUID_CONFIG_EVENT_NAMESPACE`, `SET_FLUID_CONFIG_EVENT_ID`, `registerFluidIODefinition`, `getFluidIODefinition`, `ensureFluidIOConfig`, `setFluidConfig`, `getFluidConfig`, `getFluidConfigRevision`, `getFluidStatus`, `getInputFluidIndices`, `getOutputFluidIndices`, `getFluidIODirectionMode`, `cycleFluidIODirectionMode`, `normalizeFluidConfig`, `cloneFluidConfig` | Used underneath registerIOInterface; document for custom routing systems |
| Gas IO documents | Advanced | `DEFAULT_GAS_IO_MODE`, `DISABLED_GAS_IO_MODE`, `GAS_CONFIG_VERSION`, `GAS_CONFIG_KEY`, `GAS_CONTAINER_FAMILY`, `GAS_CONFIG_EVENT_NAMESPACE`, `SET_GAS_CONFIG_EVENT_ID`, `registerGasIODefinition`, `getGasIODefinition`, `ensureGasIOConfig`, `setGasConfig`, `getGasConfig`, `getGasConfigRevision`, `getGasStatus`, `getInputGasIndices`, `getOutputGasIndices`, `getGasIODirectionMode`, `cycleGasIODirectionMode`, `normalizeGasConfig`, `cloneGasConfig` | Used underneath registerIOInterface; document for custom routing systems |
| Fluid container adapters | Advanced | `resolveFluidContainer`, `resolveFluidContainerAt`, `getFluidInputIndices`, `getFluidOutputIndices`, `getFluidContainerRevision`, `transferFluid`, `insertFluid`, `getFluidStorage` | Liquid washer, liquid generator, and liquid ports |
| Gas container adapters | Advanced | `resolveGasContainer`, `resolveGasContainerAt`, `getGasInputIndices`, `getGasOutputIndices`, `getGasContainerRevision`, `transferGas`, `insertGas`, `getGasStorage` | Gas reactor, gas turbine, and gas ports |
| Resource item lore | Advanced | `RESOURCE_LORE_MARKERS`, `buildEnergyLoreLine`, `buildFluidLoreLine`, `buildGasLoreLine`, `createResourceLore`, `parseResourceLore`, `getResourcesFromItem`, `restoreResourceSnapshot` | Machine placement/destruction and stored-resource restoration |
| Buttons and sessions | Compatibility / Advanced | `ButtonItemStack`, `loadButtonItemStack`, `ButtonManager`, `ContainerSessionManager`, `addOpenUICount`, `removeOpenUICount` | Existing button watchers and event-driven container sessions |
| Multiblocks | Primary | `Multiblock`, `MultiblockMachine`, `MultiblockGenerator` | Factory Crusher and Biofuel Dynamo |
| Scheduler protocol | Advanced | `TICK_GROUP_PROPERTY_ID`, `TICK_GROUP_COUNTS_PROPERTY_ID` | Scheduler integration and diagnostics |
| Cross-addon constants | Advanced | `DEFAULT_ENTITY_ID`, `DEFAULT_SCHEDULER_PROFILE`, `SET_SCHEDULER_PROFILE_EVENT_ID`, `SET_TICK_SPEED_EVENT_ID`, `REGISTER_GAS_ITEM_EVENT_ID`, `REGISTER_GAS_HOLDER_EVENT_ID`, `REGISTER_MACHINE_UPGRADE_EVENT_ID` | Protocol/reference pages; most addons should use DoriosLib registries instead of sending events manually |

<!-- runtime-exports:end -->

## Type-only exports

These 93 contracts exist only for editors and TypeScript/JSDoc consumers. They
must be documented alongside the runtime member that accepts or returns them.

<!-- type-exports:start -->

- Core values and configuration: `DirectionName`, `CardinalDirectionName`,
  `TransferMode`, `OutputTransferType`, `SchedulerProfileId`, `NormalizedValue`,
  `Bounds`, `MachineEntityConfig`, `BaseMachineConfig`, `MachineRuntimeConfig`,
  `GeneratorRuntimeConfig`, `MachineSettings`, `GeneratorSettings`, `Requirement`,
  `FillBlocksConfig`, `PlacementEventLike`, `DestroyEventLike`,
  `InteractionEventLike`, `ProgressOptions`, `WarningOptions`, `MachineBoosts`,
  `MachineUpgradeRegistration`, `CompiledMachineUpgrade`, `BasicMachineOptions`.
- IO authoring: `ItemIOModeConfig`, `ItemIOGroupConfig`, `FluidIOModeConfig`,
  `LiquidIOGroupConfig`, `GasIOModeConfig`, `GasIOGroupConfig`,
  `IOInterfaceConfig`, `LinkNodeItemGroupConfig`, `LinkNodeIndexedGroupConfig`,
  `LinkNodeItemIOConfig`, `LinkNodeIndexedIOConfig`, `LinkNodeIOConfig`,
  `LinkNodeIOGroup`, `LinkNodeResourceDefinition`, `LinkNodeIODefinition`,
  `ProcessIOLimits`, `ProcessIOSummary`.
- Container UI interfaces: `InterfaceButtonDefinition`, `InterfaceDefinition`,
  `RegisteredInterfaceButton`, `RegisteredInterfaceDefinition`,
  `InterfaceButtonContext`, `InterfaceButtonDescriptor`, `PressedInterfaceButtons`.
- Containers and resource storage: `ResolvedItemContainer`,
  `FaceFluidIndexConfig`, `SimpleFluidConfig`, `ComplexFluidConfig`, `FluidConfig`,
  `FluidIOMode`, `FluidIODefinition`, `ResolvedFluidContainer`,
  `FluidContainerTarget`, `FluidTransferOptions`, `FluidInsertOptions`,
  `FaceGasIndexConfig`, `SimpleGasConfig`, `ComplexGasConfig`, `GasConfig`,
  `GasIOMode`, `GasIODefinition`, `ResolvedGasContainer`, `GasContainerTarget`,
  `GasTransferOptions`, `GasInsertOptions`, `FluidContainerData`,
  `FluidHolderData`, `SelectedInventoryItem`, `GasContainerData`, `GasHolderData`,
  `StoredResourceEntry`, `StoredResourceSnapshot`.
- Scheduler, buttons, and sessions: `SchedulerProfileConfig`, `ContainerSession`,
  `ContainerSessionEntry`, `ButtonPressEvent`, `ButtonPressCallback`,
  `ButtonDefinition`, `ButtonWatcher`.
- Thermal storage and simulation: `ThermalContact`, `ThermalStepOptions`,
  `TemperatureStepOptions`, `TemperatureStepResult`, `TemperatureStorageOptions`,
  `TemperatureDisplayOptions`.
- Multiblocks: `DetectedStructure`, `ActivationContext`,
  `MachineActivationContext`, `InteractionHandlers`, `MachineStats`,
  `MultiblockStructureDetector`, `MultiblockActivationManager`,
  `MultiblockDeactivationManager`, `MultiblockEntityManager`,
  `MultiblockConstants`.

<!-- type-exports:end -->

## Source-file coverage

Every current file under `BP/scripts/DoriosCore` was classified during this
audit. “Facade” means the file itself is not imported by addons but its API is
reachable through an exported object such as `Multiblock`.

| Directory | Public or facade files | Internal files |
| --- | --- | --- |
| Root | `index.js`; selected values from `constants.js` | `initializer.js`, `scriptEvents.js`; non-re-exported values in `constants.js` |
| `buttons` | `index.js` | `constants.js` |
| `containerSessions` | `index.js` | None |
| `interfaces` | `index.js`, `IOInterface.js`, `linkNodeIO.js`, `fluidIO.js`, `gasIO.js` | `itemIO.js`, `constants.js` |
| `machinery` | `index.js`, `basicMachine.js`, `machine.js`, `generator.js`, `energyStorage.js`, `fluidStorage.js`, `gasStorage.js`, `machineUpgrades.js`, `resourceLore.js`, `tickScheduler.js`, `outputTracker.js`, `itemContainers.js`, `fluidContainers.js`, `gasContainers.js` | `constants.js` |
| `multiblock` | `index.js`, `multiblockMachine.js`, `multiblockGenerator.js`; facade APIs from `activationManager.js`, `deactivationManager.js`, `entityManager.js`, `structureDetection.js`, and `constants.js` | `listeners.js` |
| `utils` | `rotation.js`; `addOpenUICount` and `removeOpenUICount` from `entity.js` | `directions.js`, `scoreboards.js`, `constants.js`; remaining helpers in `entity.js` |

## Documentation order

1. Concepts: machine lifecycle, helper entities, storage, IO, upgrades, and
   extension classes.
2. Primary reference: machinery classes, storage classes, registration APIs,
   and multiblocks.
3. Advanced reference: low-level IO documents, container adapters, resource
   lore, scheduler/output tracking, and protocol constants.
4. Compatibility reference: legacy button watcher APIs and migration to
   `InterfaceManager`/`registerIOInterface` where applicable.
