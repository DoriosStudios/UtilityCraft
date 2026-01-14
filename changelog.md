# UtilityCraft – Changelog

## User Changes

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
