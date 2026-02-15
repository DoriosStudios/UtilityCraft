# UtilityCraft – Changelog

## User Changes

### AIOTs
- AIOTs now support shovel-style pathing with area snow clearing (sneak to apply the area by default).
- Hoe tilling now includes podzol, mycelium, rooted dirt, and grass blocks (coarse dirt excluded).

---

### Smart Filter Upgrade
- The Smart Importer now supports **slot-based filtering**.
- Filters can be configured and controlled independently per slot.
- This is especially useful for machines with multiple inputs (e.g. Infusers), allowing items to be routed to the correct slots without conflicts.

---

### Colored Pipes Recipe Rework
- Colored pipe recipes were removed from the Workbench.
- Previously, these recipes could override the base pipe recipe, making crafting unreliable.
- Pipes can now be **colored or decolored directly in the Crafting Table**, ensuring consistent behavior.

---

### Refresh Speed Command
- Subpacks were replaced with a command-based system to control update speed.
- Use `/refreshspeed` to select a preset:
  - `lowest`
  - `low`
  - `normal`
  - `fast`
  - `fastest`
- A `custom` option is also available, allowing players to input a specific value.

---

### Redstone Integration
- Pistons now correctly update pipe networks.
- This allows players to control and segment pipe systems using redstone mechanics.

---

### Smelting Pickaxe Improvements
- Improved behavior and reliability of the Smelting Pickaxe.
- General performance and consistency adjustments.

---

### Fixes and Visual Updates
- Fixed Waycenter behavior.
- Updated wrench texture.
- Fixed the Dried Kelp Block recipe in the Electro Press.
- Updated textures for Steel materials.

---

## Developer Changes

### Tool Components Compatibility
- Updated `utilitycraft:hammer` script event handling to accept both `dorios:hammerBlock` and `dorios:hammerblock` event IDs.
- Improved hammer tier resolution for ScriptEvent flows:
  - Tries runtime component IDs by item namespace (not only `utilitycraft`),
  - Falls back to scanning available custom components ending with `:hammer`,
  - Avoids silent recipe failures when runtime tier metadata is unavailable.
- Updated `utilitycraft:dig_pebble` component with universal configuration support:
  - Added optional params `requireSneaking`, `blocks`, `drops`, `durabilityCost`, and `durabilityChance`.
  - Keeps current behavior as default when params are omitted.
- Standardized hammer item JSON fields to match the Ascendant Technology hammer schema.
  - Added missing hammer tags (`minecraft:is_pickaxe`, `minecraft:is_tool`, `utilitycraft:is_hammer`) to base hammers.
  - Fixed duplicated `minecraft:tags` in Diamond Hammer so tier and transformable tags are both preserved.

---

### AIOT Components (Items)
- Added `utilitycraft:shovel` item component for AIOTs.
  - Supports `size` and `sneakingMode` parameters (default `true` for shovel usage).
- Updated `utilitycraft:hoe` item component.
  - Added `sneakingMode` (default `false`) to control area behavior.
  - Expanded tillable blocks to include podzol, mycelium, rooted dirt, and grass blocks (coarse dirt excluded).

---

### Special Container Component (Blocks)
- Added a new block component to define **named slots or slot categories** for special containers.
- Enables the Smart Importer to correctly detect and target specific slots.
- Example:

```JSON
"utilitycraft:special_container": {
  "Input Slot": 3,
  "Catalyst Slot": 4
}
```
---

### ScriptEvent: Special Container Registration
- Added a ScriptEvent-based alternative to register special container slots dynamically.
- Provides the same functionality as the block component, but through scripting.
- Example:

```JS
system.sendScriptEvent(
  "utilitycraft:register_special_container_slots",
  JSON.stringify({
    "utilitycraft:alchemy_table": {
      "Input Slot": 3,
      "Catalyst Slot": 4
    },
    "utilitycraft:infusion_altar": {
      "Essence Slots": [5, 6, 7],
      "Core Slot": 8
    }
  })
);
```
---

### Cobble Generator Parameter Expansion
- Added `amount` and `material` parameters to `utilitycraft:cobble_generators`.
- Allows developers to use this system to create **custom block generators**.
- Example:

```JSON
"utilitycraft:cobble_generators": {
  "amount": 10,
  "material": "minecraft:netherite_block"
}
```
