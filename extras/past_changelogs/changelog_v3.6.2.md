This update makes multiblock cells and machine modules available to UtilityCraft extensions, refreshes recipe books, and fixes hammer drops.

<!-- Upcoming release: v3.6.2. -->
<!-- Previous release: extras/past_changelogs/changelog_v3.6.1.md -->
<!-- Deferred work: extras/future_changelogs/multi-resource-networks.md. Add release entries only after implementation and in-game validation. -->

## BLOCKS

- Moved **Energy Cell**, **Liquid Cell**, **Gas Cell**, **Processing Module**, **Speed Module**, and **Efficiency Module** from Heavy Machinery into UtilityCraft.
    - Extensions can share these internal multiblock components without requiring Heavy Machinery.
    - Preserved existing block identifiers, textures, and component behavior.

## RECIPES

- **Multiblock Cells and Modules**
    - Workbench and Crafter recipes now use UtilityCraft materials without requiring Heavy Machinery.
    - Replaced Tin Plates with Iron Plates, Steel and Controller Casings with Machine Cases, and Charged Darloonite Crystals with Expert Chips.
    - Liquid and Gas Cells use their corresponding pipes instead of Steel Ports and retain their two Expert Tanks.

## UI/UX

- **Primitive Forge Bricks**
    - Renamed the building block from Primitive Forge to Primitive Forge Bricks.
    - Updated its inventory and held model to show the assembled forge as a complete 3D cube with 32x32 face textures and its front facing the inventory view.
    - Added a tooltip hint explaining how to obtain Iron Dust by using a hammer on Iron Ore.
- Added the shared cells and modules to UtilityCraft's Creative inventory, with names and tooltips in all ten supported languages.
- Added short tooltips explaining multiblock use and the function of each shared cell and machine module in all ten supported languages.
- Removed addon signatures from internal UI items so machine information panels and interface placeholders no longer display them.
- **Auto Sieve**
    - Removed Certus Quartz and Charged Certus Quartz from the recipe book while retaining their scripted drops for addon compatibility.
- **Auto Fisher**
    - Removed the Empty Liquid Capsule from the recipe book while retaining its scripted drop for addon compatibility.
- **Crusher and Electro Press**
    - Corrected Crusher recipe icons for Double, Triple and Quadruple Compressed Cobblestone.

## BUG FIXES

- **Hammers**
    - Fixed crushing ores that drop raw materials or gems, including deepslate variants, Lead and Uranium.
    - Recognize Silk Touch drops and replace only newly dropped quantities, preserving items already on the ground.
    - Apply the Crusher recipe once per block without multiplying its output by Fortune.

## THIRD-PARTY / INTEGRATION

- Added `TemperatureStorage` and `advanceTemperature` to DoriosCore so extensions can use persistent thermal storage, heat exchange calculations, and the shared temperature bar.
