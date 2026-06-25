# UtilityCraft v3.4.5

This update focuses on performance, smoother machine behavior, cleaner transfer logic, and better creator-facing DoriosCore documentation.

## SUMMARY

- Reduced lag by up to 75% by optimizing machines, Mechanical Hoppers, Cobblestone Generators, and transfer systems.
- Most worlds should now be able to play comfortably on Normal or Fast refresh speed without major issues.
- Machines now feel smoother when their UI is open, even when using lower refresh speed profiles.
- Added refresh speed profiles so lower-end devices can spread machine updates more efficiently.
- Reworked Mechanical Hopper speed upgrades to move more items per tick instead of ticking faster.
- Improved item, fluid, and energy transfers so machines waste fewer checks on invalid targets.
- Added the full UtilityCraft in-game wiki to the How To Play screen.
- Fixed several item-loss, auto-refill, Ender Hopper, compressed block, hammer, and recipe issues.
- Added better DoriosCore documentation and creator-facing autocomplete support.

## CHANGES

### How To Play

- Added a full UtilityCraft in-game wiki inside the How To Play screen.
- Added guide sections for progression, early resources, water and lava, steel, machines, generators, drop tables, and addon information.
- Added visual renders, tables, colored keywords, and clearer explanations to make the guide easier to read in-game.

### Recipes

- Added the recipe for the Basic Receiver.
- Changed the recipe for the Basic Transmitter.
- Added a Grass Block recipe.
- Calcite now requires half as much catalyst item.
- Compressed Stone now gives Compressed Deepslate in the Electro Press.

### Machines

- Reworked machine ticking so machines are distributed across tick groups instead of all updating at the same time.
- Added refresh speed profiles for machine updates:
  - Fast keeps the current update cadence.
  - Normal and Low spread closed-machine updates across longer spans for lower-end devices.
- Machines with an open UI keep updating smoothly while closed machines can be spread out more aggressively.
- Updated the base machine tick interval to reduce constant script load while preserving expected processing behavior.
- Improved machine progress compensation for slower update speeds so machines better preserve their real processing rate.
- Reworked stack auto-refill behavior.
- Sieve stack auto-refill now works correctly.
- Crucibles now work with the Big Torch.

### Transfers

- Improved item output tracking so machines avoid repeatedly checking invalid output targets.
- Improved fluid output tracking with the same cached-output behavior used by item outputs.
- Energy networks now clean invalid cached transfer targets when no compatible energy container is found.
- Battery transfer logic now uses the configured transfer rate correctly.
- Machine item output transfer now avoids unnecessary work when there is no output to move.

### Mechanical Hoppers

- Mechanical Hoppers now use a fixed tick interval.
- Speed upgrades now increase how many operations a hopper can perform per tick instead of making the block tick faster.
- Hopper throughput now scales from 1 to 5 operations per tick based on speed level.
- Mechanical Hoppers skip input scans when their inventory cannot accept items.
- Hoppers with a valid source container no longer scan minecarts or dropped items unnecessarily.
- Ender Hoppers no longer scan dropped items when their inventory is full.
- Hopper variants now use component parameters for their type instead of detecting behavior from block identifiers.
- Hopper entities now use the same default placement and hitbox style as traditional machine entities.
- Ender Hoppers keep their previous smaller hitbox and placement through a dedicated entity event.

### Cobblestone Generators

- Optimized Cobblestone Generator behavior to reduce script cost during normal operation.

### Tools

- Hammers can now dig shovel blocks.

### Localization

- Added `@UtilityCraft` to all item and block language entries.

## BUG FIXES

- Fixed durability values for hammers.
- Fixed a Bonsai/Pedestal bug that could cause item loss when breaking it.
- Fixed a bug that caused Ender Hoppers to collect UI items when pressing buttons.
- Fixed a UI bug that caused screen labels to flicker when taking an item.
- Fixed Compressed Stone and Compressed Deepslate so they now drop their cobbled versions correctly when mined.
- Fixed Battery energy transfer running with incorrect rate handling.
- Fixed several cases where transfer logic could keep checking invalid or missing targets.
- Fixed Mechanical Hopper placement to use the normal place event instead of the before-place event.
- Fixed Mechanical Hopper speed permutations so they no longer redefine identical tick behavior.
- Fixed hopper variant detection to avoid fragile string matching.
- Fixed upgrade blocks accepting levels above their real maximum and resetting previous upgrades.

## OPTIMIZATIONS

- Reduced large scripting spikes by spreading closed-machine updates more evenly over time.
- Reduced repeated inventory and entity scans in machine and hopper logic.
- Reduced unnecessary dropped-item scans for hoppers and Ender Hoppers.
- Reduced wasted transfer attempts for item, fluid, and energy outputs.
- Improved overall server tick stability, especially in worlds with many machines.

## CREATOR CHANGES

- Added and expanded DoriosCore documentation across machine, storage, scheduler, and utility systems.
- Added clearer JSDoc for DoriosCore classes, settings, parameters, and helper methods.
- Added DoriosCore typings so creators get better autocomplete and inline documentation when building machines.
- Normalized UtilityCraft machine script imports through `DoriosCore/index.js`.
- Reworked the tick scheduler into a documented static class for easier extension and reuse.
- Added helper APIs for checking open machine UIs and output state.
- Added debug and inspection support for machine tick groups.
- Added the `inanimate` family to all entities.
