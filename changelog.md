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
- Fixed Wind Turbine description displaying wrong values.
- Fixed a bug where generators that support fluids didn't open the transfer mode menu to switch modes.
- Fixed Bonsais & removed register logs when registering a recipe (console message removed).

## ADDITIONS & IMPROVEMENTS

### Autofisher
- Added the **Autofisher** machine block.
- Added a full set of **fishing nets**: String, Copper, Iron, Golden, Emerald, Diamond, and Netherite tiers.

### Item Transport
- Added **colored item conduits** and **item exporters**:
  - Blue, Red, Yellow, Purple, and Green (default).
- Added the **Item Importer**:
  - Accepts filter upgrades.
  - Includes a new filter-settings button that displays all filtered items with colors, consistent with exporters and conduits.

### Fluid System
- Added **colored fluid pipes**:
  - Yellow (default), Blue, Green, Red, Purple.
- Added **item extractors** for fluid/color pipe networks.
- Added support for **multiple fluid types in a single container**, used for machines such as the Thermal Reactor.
- Updated the machinery library to support multiple liquids inside a single container (generators, machines, tanks).

> **Note:** Colored cables/pipes do not connect to different colors. This is intentional to helps players organize cable networks more efficiently.

### Trash Can
- Implemented the **Trash Can** block:
  - Items inserted via conduits, machines, or manually are destroyed instantly.
