# UtilityCraft v3.3.0
---

## REMOVALS
- Removed recipes for **Utility Table**, **Conveyors**, and **Fluid Pump**.

## FIXES
- Fixed Induction Anvil upgrades bug.
- Fixed mining time for Grinder.
- Fixed Steel Tools.
- Fixed an issue where the XP Condenser would not store XP.
- Fixed a bug where the hopper entity disappeared after being placed.
- Fixed a bug where pipes were not connecting.
- Elevator no longer sends a chat message when used.
- Updated Wind Turbine description to correct wrong values.

## ADDITIONS & IMPROVEMENTS

### Autofisher
- Added the **Autofisher** machine block.
- Added a full set of **fishing nets**: String, Copper, Iron, Golden, Emerald, Diamond, and Netherite tiers.
- Added a **custom Autofisher UI** (based on Autosieve).

### Item Transport
- Added **colored item conduits** and **item exporters**:
  - Blue, Red, Yellow, Purple, and Green (default).
- Added the **Item Importer**:
  - Does not use entities.
  - Accepts filter upgrades.
  - Includes a new filter-settings button that displays all filtered items with colors, consistent with exporters and conduits.
- Updated item catalog.

### Fluid System
- Added **colored fluid pipes**:
  - Yellow (default), Green, Red, Purple.
- Added **item extractors** for fluid/color pipe networks.
- Added support for **multiple fluid types in a single container**, used for machines such as the Thermal Reactor.

**Note:** Colored cables/pipes do not connect to different colors. This is intentional.

### Trash Can
- Implemented the **Trash Can** block:
  - Items inserted via conduits, machines, or manually are destroyed instantly.

### Internal Improvements
- Added support for **custom liquid items and containers** in `managers.js`.
- Moved pipe textures into a dedicated folder.
- Updated scripts and language files to reflect new systems and items.
