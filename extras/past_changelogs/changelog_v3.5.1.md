# UtilityCraft v3.5.1

This update expands Bountiful Crops integration, moves Silicon into UtilityCraft, improves machine interfaces and fixes Way Center teleportation.

## HIGHLIGHTS
- Added Bonsai support for all Bountiful Crops crops.
- Added Silicon and the Block of Silicon as native UtilityCraft materials.
- Added a dedicated Creative Battery interface.
- Improved machine side panels and made I/O panels adapt to their available resource types.
- Fixed Way Center teleportation to destinations in unloaded chunks.

---

## BLOCKS
### Bountiful Crops
- Added dedicated seed blocks for all 32 Bountiful Crops crops.
- Added Bonsai entities, models, visuals and localized names for every supported Bountiful Crops crop.
- Added automatic conversion of legacy crop blocks to the new seed block identifiers while preserving their block states.
- Fixed generated crop Bonsai definitions so their growth-time defaults remain valid.

### Materials
- Added the Block of Silicon.
- Added crafting recipes to compress nine Silicon into a Block of Silicon and decompress it back into nine Silicon.

## ITEMS
### Materials
- Added Silicon as a native UtilityCraft crafting material.
- Silicon is obtained by smelting Quartz Dust.

## MACHINES
### Creative Battery
- Added a dedicated interface with its energy display and information panel.

### Crusher
- Added a recipe to crush a Block of Silicon into nine Silicon.
- Added Silicon recipes to the in-machine Recipe Book.

### Electro Press
- Added a recipe to press nine Silicon into a Block of Silicon.
- Added the Silicon recipe to the in-machine Recipe Book.

### Furnace
- Added Quartz Dust processing into Silicon.
- UtilityCraft Quartz Dust now produces UtilityCraft Silicon instead of the Integrated Storage variant.

### Way Center
- Fixed teleports to Way Carpets and Way Centers in unloaded chunks being rejected before the destination could load.
- Destination validation now runs after teleportation, while still removing stale Way Carpet and Way Center links.
- Improved the formatting of Way Center, Way Carpet and Way Chip descriptions.

## UI/UX
### Machine Interfaces
- Improved shared machine side-panel layouts and positioning.
- Added clearer disabled overlays for unsupported upgrade slots.
- Added support for machines with a single dedicated upgrade slot.
- Added reload button textures and reusable interface controls.
- Machines without energy capacity no longer attempt to display an energy value when placed.

### I/O Configuration
- Made I/O configuration panels adapt to the Item, Liquid and Gas tabs supported by each machine.
- Improved the default I/O panel size, positioning, labels and close-button placement.

### Icons
- Added glyphs for Water, Lava, Milk, XP, Steam, Cryofluid, Liquified Aetherium and Dark Matter.
- Added generic compact Energy and Liquid icons and a Stack Upgrade icon.
- Added Ascendant Technology StatsCore glyphs for Crit Damage, Crit Chance, Crit Multiplier, Preserving, Ore Yield, Luck, Double Trouble, Triple Trouble, Evasion and Sweeping.
- Added Sneaking, Standing and question-mark glyphs.
