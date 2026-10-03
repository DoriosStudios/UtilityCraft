This update introduces gas processing and power generation, reworks early Steel and Water production, expands shared resources, and adds more control over machine I/O and multi-resource networks.

> [!WARNING]
> Early progression has changed: the Mortar now produces Water by grinding leaves as a placed block, and the Raw Iron, Coal and SmeltFlare crafting recipe for Brute Steel has been removed. Use the Primitive Forge to produce Brute Steel. Mortar, Crucible and Fan block states have also changed; retired states are not automatically migrated in existing worlds.

## HIGHLIGHTS

- Gas processing now includes the Electrolyzer, Chemical Converter and four Gas Generator tiers.
- Lead and Uranium materials, additional liquids and gases, and matching Creative Tanks are now available in UtilityCraft.
- Machine I/O now separates passive Default faces from fully Disabled faces.
- Mortar and Primitive Forge introduce new Water and Steel production steps.
- Multi-resource networks now support configurable channels and accepted colors on compatible Universal Cables and endpoints.

## BLOCKS

### Generators

- Added **Gas Generators** in Basic, Advanced, Expert and Ultimate tiers.
    - Burn Hydrogen or Methane to generate Dorios Energy.
    - **Basic:** 80 kDE energy capacity, 32 B gas capacity, and up to 32 DE/t with Methane.
    - **Advanced:** 320 kDE energy capacity, 128 B gas capacity, and up to 128 DE/t with Methane.
    - **Expert:** 1.28 MDE energy capacity, 512 B gas capacity, and up to 512 DE/t with Methane.
    - **Ultimate:** 8 MDE energy capacity, 3.2 KB gas capacity, and up to 3.2 kDE/t with Methane.
    - Hydrogen produces half the output rate of Methane in each tier.
- **Creative Battery**
    - Increased sustained network transfer from 10 kDE/t to 1 GDE/t.

### Machines

- Added **Chemical Converter** to UtilityCraft.
    - Combines item, liquid and gas inputs into a gas product, including native Methane production.
    - Includes one item input, one liquid tank, two gas tanks, two upgrade slots, and 8.192 MDE energy capacity.
- Added **Electrolyzer** to UtilityCraft.
    - Separates supported inputs into two gas products, including Hydrogen and Oxygen from Water.
    - Includes one liquid tank, three gas tanks, two upgrade slots, and 4.096 MDE energy capacity.
- Added **Primitive Forge**.
    - Automatically assembles from eight casing blocks placed as a solid 2x2x2 cube; the last placed block determines the front.
    - Produces Brute Steel from Iron Dust and Coal, Charcoal, Coal Dust or Charcoal Dust, using a separate solid-fuel slot.
    - Processes up to four Brute Steel recipes per eight-second batch, or up to four normal furnace recipes per two-second batch.
    - Uses 1,000 DE worth of solid fuel per recipe without requiring an energy network.
    - Preserves processing progress and returns stored ingredients, fuel and output when dismantled.
    - Includes lit front textures, flame and smoke effects while processing.
- **Machine I/O**
    - Default faces now accept external insertion and extraction through the machine's normal input and output groups without automatically pulling or pushing resources.
    - Disabled faces fully block item, liquid or gas access and appear last in the mode cycle.
- **Mechanical Spawner**
    - Stored essence can now be recovered with a Glass Bottle without sneaking; sneaking remains available for essence replacement.

### Mortar

- Reworked **Mortar** into a placeable block with an animated pestle and visible leaf and Water levels.
    - Insert leaves, then interact with an empty hand to turn the pestle.
    - Each full turn requires eight interactions and converts one leaf into 250 mB of Water.
    - Holds up to four combined units of leaves and Water; four crushed leaves fill one empty Bucket.
    - Added sound feedback for leaf insertion, grinding and Bucket collection.
    - Replaces the former Mortar item and its sapling-and-bottle Water recipe.

### Ores

- Added **Lead Ore** and **Deepslate Lead Ore**, including Raw Lead drops.
- Added **Deepslate Uranium Ore**, including Raw Uranium drops.

### Storage

- Added **Creative Tanks** for Crude Oil, Depleted Uranium Hexafluoride, Diesel, Enriched Uranium Hexafluoride, Fluorine, Heated Saline Coolant, Heavy Water, Hydrogen, Hydrogen Fluoride, Methane, Natural Uranium Hexafluoride, Nuclear Waste, Oxygen, Petroleum, Saline Coolant and Sulfuric Acid.
    - Provide an infinite supply of their respective liquid or gas.
- Added **Lead** and **Raw Lead Blocks**, plus **Uranium** and **Raw Uranium Blocks**, for material storage.
- Added **Nether Star Block** and four compressed variants: Compressed, Double Compressed, Triple Compressed and Quadruple Compressed.
    - Supports reversible compression and decompression.

### Networks

- Added support for **Multi-Resource Networks** on compatible cables, importers and exporters supplied by extensions.
    - Items, liquids, gases and energy can share the same transport block.
    - Use a Wrench on a multi-resource cable face to disable individual resource channels.
    - Sneak and use a Wrench to select accepted colors from Default and the sixteen Minecraft colors.
    - Universal Cables start with only Default enabled; Default and White are separate choices.
    - Enabled colors join one shared network. An empty selection blocks pipe-to-pipe connections while retaining direct machine connections.
    - Multi-resource endpoints provide separate item, liquid and gas configuration menus, including importer filters.
    - Color selections and channel restrictions persist through reloads, piston movement and Copy/Paste Tool use.
- **Liquid and Gas Extractors**
    - Whitelist filters can recover selected resources from registered input tanks while still respecting explicitly Disabled faces.

### Automation

- Added **Energy**, **Gas**, **Liquid** and **Ultimate Trash Cans**.
    - Passively discard incoming resources every 10 ticks without opening an interface.
    - Liquid and Gas variants each accept two resource types at once; the Energy variant accepts Dorios Energy.
    - Ultimate combines item, liquid, gas and energy disposal, with 27 item slots and two tanks for each resource family.
- Renamed **Basic Trash Can** to **Item Trash Can**.

## ITEMS

- Added 1,000 mB **Buckets** for Crude Oil, Diesel, Heavy Water, Liquid Experience, Petroleum, Saline Coolant and Sulfuric Acid.
    - Can be filled and emptied through compatible liquid storage.

- Added **Lead Materials**: Raw Lead, Lead Ingots, Nuggets, Dust, Plates, Lead Chunks and Deepslate Lead Chunks.
- Added **Uranium Materials**: Raw Uranium, Uranium Ingots, Dust, Pellets and Deepslate Uranium Chunks.

## FLUIDS

- Added storage and interface support for **Crude Oil**, **Diesel**, **Heavy Water**, **Petroleum**, **Saline Coolant** and **Sulfuric Acid**.
- **Water**
    - Reduced its shared coolant efficiency from 1 to 0.5, retaining Tier 0.

## GASES

- Added storage and interface support for **Depleted Uranium Hexafluoride**, **Enriched Uranium Hexafluoride**, **Fluorine**, **Heated Saline Coolant**, **Hydrogen Fluoride**, **Natural Uranium Hexafluoride**, **Nuclear Waste** and **Oxygen**.
- Added **Hydrogen** and **Methane** storage and Gas Generator fuel support.
    - **Hydrogen:** 560 DE/mB.
    - **Methane:** 1,536 DE/mB.

## RECIPES

### Blocks

- Added Workbench and Crafter recipes for **Chemical Converter**, **Electrolyzer**, all four **Gas Generator** tiers, and the four new **Trash Can** variants.
- Added Workbench recipes for **Gas Pipes**, **Gas Extractors** and all four **Gas Tank** tiers, plus crafting-table color conversions for gas transport blocks.
    - Gas Pipes use Lead Nuggets and produce eight pipes per craft; Gas Pipe and Gas Extractor recipes unlock with Lead Ingots.
- Added **Nether Star Block** crafting from nine Nether Stars, with reverse crafting and four compression levels.
- Added **Primitive Forge** crafting from four Bricks, three Clay Balls and one Mud Brick Slab, producing four casings.
- Reworked **Liquid Tank** recipes to use Steel Plates, one Glass block and a Liquid Pipe; higher tiers require one tank from the previous tier.
    - New Gas Tank recipes follow the same progression using Lead Plates and Gas Pipes.
- Removed the **Brute Steel** crafting recipe using Raw Iron, Coal and SmeltFlare.

### Materials

- Added **Black Dye** crafting from Coal or Charcoal.
- Added **Lead** and **Uranium** smelting, storage-block crafting and reverse crafting recipes, plus Lead Ingot and Nugget conversions.

### Chemical Converter

- Added **Methane** production from four Charcoal Dust and 125 mB of Hydrogen, producing 125 mB of Methane for 32 kDE.
    - Efficiency savings for this recipe are capped at 20%.

### Crusher

- Added **Lead** and **Uranium** processing recipes for ores, raw materials, ingots and storage blocks, plus Lead Plates.
    - Ores and raw materials produce two Dust; ingots and Lead Plates produce one Dust.

### Electro Press

- Added reconstruction of **Lead Ore**, **Deepslate Lead Ore** and **Deepslate Uranium Ore** from four matching Chunks.
- Added **Lead Plate** and **Uranium Pellet** recipes from one matching Ingot.

### Electrolyzer

- Added **Water** electrolysis: 1,000 mB of Water produces 1,000 mB of Hydrogen and 500 mB of Oxygen for 512 kDE.
    - Efficiency savings for this recipe are capped at 20%.

### Sieve

- Added **Lead Chunks** from Gravel and **Deepslate Lead Chunks** from Crushed Cobbled Deepslate, requiring Golden Mesh tier or higher.
    - Each has a 4% base chance before mesh multipliers; compressed inputs produce nine Chunks per successful roll.

## UI/UX

- **Electrolyzer and Chemical Converter**
    - Added Recipe Books with item and resource icons, quantities in tooltips, and a paired output selector for the Electrolyzer.
    - Added distinct input outlines and I/O legends for item, liquid and gas inputs.
- **Machine and Generator Interfaces**
    - Compacted side tabs when Upgrades or I/O are unavailable and enlarged the Information panels to use the remaining space.
    - Added a distinct black-and-yellow outline for Disabled I/O faces.
    - Grouped I/O resource tabs without empty rows for unavailable resources.
- **Material Textures**
    - Updated Amethyst, Crying Obsidian, Diamond, Emerald, Obsidian, Quartz and Stabilized Obsidian Dust textures, plus Brute Steel artwork.
- **Resource Displays**
    - Added liquid and gas bars, tank visuals and icons for the new shared resources.
    - Liquid and gas tooltips now identify their resource category, including empty tanks.
- **Selection Feedback**
    - Added a personal outline for the block container being aimed at and a "Sneak to mine" prompt.
    - Sneaking hides the container hitbox so its block can be mined.
- **Tooltips and Guides**
    - Updated How to Play Water and Steel instructions with Mortar and assembled Primitive Forge illustrations.
    - Added a visual Primitive Forge Information panel showing the Brute Steel recipe and processing times.
    - Added Hammer conversion guidance, Tank capacity descriptions and Gas Pipe and Extractor tooltips.
    - Expanded translations for new content across the ten supported locales; accepted-color controls include English and Brazilian Portuguese translations.
    - Grouped Mortar and Primitive Forge under Basics in the Creative menu.
    - Standardized Quick Info to use the shared addon label while retaining each item and block tooltip's individual addon attribution.

## BUG FIXES

- Fixed **Assembler** crafting for outputs whose maximum stack size is below 64.
- Fixed **Induction Anvil** and ordinary durability repairs granting charge to energy-container items; the standard Anvil now directs these items to a Reinforced Induction Anvil.
- Fixed **Infuser** recipes for Rooted Dirt and Moss Block using an invalid Rooted Dirt identifier.
- Fixed **Liquid and Gas Displays** failing when storage capacity is zero; they now show an empty bar and 0%.
- Fixed **Machine Buttons** losing presses when their interface watcher was registered repeatedly.
- Fixed **Network Routing** applying the opposite north/south machine-face configuration; saved item, liquid and gas routes rebuild while preserving filters, enabled state and distribution mode.

## TECHNICAL CHANGES

- Reduced Mortar, Crucible and Fan block-state combinations to 480, 25 and 60; Mortar and Crucible processing progress and the Fan's selected range now persist by dimension and block coordinates.
- Shortened resource-bar asset paths while preserving item identifiers, atlas keys and image contents, and reused vanilla textures in place of five duplicate images.
- Optimized network topology and geometry updates by sharing connection snapshots and neighboring-block reads across resource channels.
- Updated shared DoriosCore multiblock handling to resolve only valid controller entities, clean up filled blocks before clearing structure bounds, and manage tagged component waterlogging.
- Reworked shared factory module scaling: doubling Processing and Speed modules together doubles throughput, while Efficiency modules save up to 75% of energy without reducing processing speed.
- Moved default solid fuels into the shared registration flow used by addon-provided fuels.

## THIRD-PARTY / INTEGRATION

- Added Electrolyzer and Chemical Converter recipe registration through `utilitycraft:register_electrolyzer_recipe` and `utilitycraft:register_chemical_converter_recipe`, with matching DoriosLib registrar helpers.
- Extended `utilitycraft:register_furnace_recipe` to support two-input Primitive Forge combinations alongside normal smelting recipes.
- Added generic multi-resource cable and endpoint components for extensions, plus `utilitycraft:register_pipe_resource` for additional face-configurable channels. Extensions provide routing for their own channels.
- Added explicit network-face policies through `networkFaces: "explicit"`, while retaining existing fallback access for legacy machine configurations and Link Node overrides.
- Added shared `ItemEnergyStorage` support for durability-backed energy items tagged `utilitycraft:energy_container`.
    - Fresh tagged items initialize empty when entering player inventories; charge uses 100,000 DE per durability point with 100-point safety margins.
- Added block-container selection support for entities in the `utilitycraft:block_container` family, including companion-addon containers, with an opt-out for addons that own virtual-inventory cleanup.
- Moved shared Lead, Uranium, liquid and gas definitions from Heavy Machinery into UtilityCraft while preserving identifiers. Heavy Machinery supplies Uranium sieve drops and advanced chemical and nuclear processing.
- Updated **Bountiful Crops** compatibility so crops accept soils at or above their required tier, and added **Pink Soil** support to the Seed Synthesizer when supplied by a companion addon.
- Updated **Link Node I/O** with separate Default and Disabled input/output choices; unconfigured nodes use the machine's declared fallback groups.

Contributors: @Kauziin, @Milo504
