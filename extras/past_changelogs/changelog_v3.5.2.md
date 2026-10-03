# UtilityCraft v3.5.2

This update expands compressed storage, improves automated harvesting and block breaking, refreshes in-game documentation and strengthens addon tooling and compatibility.

## HIGHLIGHTS
- Added four compression levels for 16 additional block families.
- Reworked the Harvester with internal outputs, safer crop handling and configurable item extraction.
- Added Pickaxe support and configurable item input to the Block Breaker.
- Refreshed the How to Play artwork, pack icons and machine visuals.
- Fixed Stack Refill settings and machine-area outline orientation.

---

## BLOCKS
### Compressed Blocks
- Added a data-driven compressed-block generator with reusable material presets, automatic four-level textures, block definitions, compression/decompression recipes, registrations and localization.
- Added four compression levels for each of the following blocks:
  - Tuff
  - Calcite
  - Dripstone Block
  - Basalt
  - Red Sand
  - Mud
  - Soul Sand
  - Soul Soil
  - Clay
  - Bamboo Block
  - Moss Block
  - Slime Block
  - Honey Block
  - Silicon Block
  - Brute Energized Iron Block
  - Blaze Block
- Restored the custom glass geometry and consolidated all compressed glass face culling under `utilitycraft:glass`.
- Split the Blaze Block texture atlas into side, top and bottom textures and migrated the block to `minecraft:geometry.full_block`.
- Added missing block sounds and removed incomplete or unregistered compressed texture assets.
- Added reusable compression-level overlays and render assets for the compressed-block catalog.

## MACHINES
### Furnace
- Fixed the Quartz Block recipe so the Furnace now produces Smooth Quartz.

### Harvester
- Reworked harvesting to generate loot directly and reset mature crops without breaking the plant.
- Added support for mature vanilla crops, registered UtilityCraft crops and the upper growth of tall crops.
- Added 15 internal output slots and configurable item-output faces.
- The fourth Range Upgrade now stores harvested drops directly in the machine and pauses safely when the complete harvest cannot fit.

### Block Breaker
- Added an optional Pickaxe input whose tool properties determine generated block drops.
- Added configurable item-input faces and a dedicated Pickaxe slot to the machine interface.

### Machine Areas
- Fixed east/west orientation for Harvester, Block Breaker and Block Placer area outlines.

## ITEMS
### Hammers
- Added the missing survival crafting recipe for the Golden Hammer.

### Stack Refill
- Fixed the Stack Refill player setting so disabling it now prevents automatic hotbar refills.

### Machine Chips
- Updated the Basic, Advanced, Expert and Ultimate Machine Chip textures.

## UI/UX
### How to Play
- Replaced and expanded the in-game How to Play artwork for machines, generators, sieves, crafting processes and other UtilityCraft systems.
- Updated Block Breaker and Harvester descriptions to match their new slots and behavior.
- Added previously omitted Autofisher and Sieve loot entries to their recipe and How to Play tables.

### Visuals
- Updated the Behavior Pack and Resource Pack icons.
- Added reusable render scenes, render overrides and a catalog of block, machine, crop and compressed-block renders.
- Updated the shared glyph atlas and added a Pickaxe slot overlay.

## COMPATIBILITY
- Moved the `utilitycraft:link_node_io` component registration into UtilityCore while preserving the shared DoriosCore I/O interface.
- Updated DoriosLib to 2.1.0 with shared player-tracking helpers and matching type declarations.

## DEVELOPMENT
- Replaced the obsolete compressed-block Python script with the manifest-driven Node.js generator and audit workflow.
- Updated the workspace watch task from Dash Compiler to Regolith.
- Updated the release workflow to upload the minified release asset to CurseForge after GitHub release assets are built.
