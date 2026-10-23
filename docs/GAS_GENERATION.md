# Gas generation

UtilityCraft owns the Electrolyzer, Chemical Converter and Basic/Advanced/Expert/Ultimate Gas Generators. Heavy Machinery extends the two processing recipe registries with HF electrolysis and the HF/Natural UF6 conversion recipes. Machine IDs, slots, I/O and Speed/Energy upgrades are preserved during migration. Their native crafts use Stabilized Obsidian Dust instead of the HM-only Energy Cell. This adds an Infuser processing step to the setup cost using existing UtilityCraft materials.

## Production routes

- Electrolyzer: 1,000 mB Water → 1,000 mB Hydrogen + 500 mB Oxygen; 512,000 DE. Gas input must be empty.
- Crusher: Charcoal → Charcoal Dust, using the existing recipe.
- Chemical Converter: 4 Charcoal Dust + 125 mB Hydrogen → 125 mB Methane; 32,000 DE. Liquid input must be empty.
- Feed Hydrogen directly to a Gas Generator, or convert it to Methane for higher output and fuel value.
- Route BOTH Electrolyzer outputs to separate gas networks. Store Oxygen or pipe it into a Gas Trash Can for continuous Hydrogen production. The Gas Trash Can accepts two gas types in separate tanks and empties every 10 ticks; a blocked Oxygen output still pauses electrolysis.

## Current balance

Rates and processing costs below are base values, before upgrades. Output rates are long-term averages while fuel, output space and energy transfer remain available.

| Tier | Hydrogen DE/t | Methane DE/t | Energy capacity DE | Gas capacity mB |
|---|---:|---:|---:|---:|
| Basic | 16 | 32 | 80,000 | 32,000 |
| Advanced | 64 | 128 | 320,000 | 128,000 |
| Expert | 256 | 512 | 1,280,000 | 512,000 |
| Ultimate | 1,600 | 3,200 | 8,000,000 | 3,200,000 |

Hydrogen provides 560 DE/mB; Methane provides 1,536 DE/mB. A 1,000 mB Hydrogen batch yields 560,000 DE gross and 48,000 DE after the 512,000 DE electrolysis cost. Converting that batch to Methane requires eight converter operations, consuming 32 Charcoal Dust and another 256,000 DE. The resulting 1,000 mB Methane yields 1,536,000 DE gross and 768,000 DE after electrolysis and conversion. These net values exclude charcoal preparation, transport and other auxiliary costs. Total yield and the generation rate are separate: lower tiers take longer to burn a batch.

Gas is stored in whole mB. The generator accumulates fractional burn progress, consumes whole mB and emits their full energy value in small pulses. This avoids losing fuel through rounding at low rates. Progress represents processing time only; there is no second tank or hidden fuel inventory. It stops when free energy capacity cannot hold a whole mB's yield. It uses the existing generator transfer behavior and transfers stored energy before processing fuel.

Each generator has one visible gas bar (slot 2), energy display, fuel time/value and I/O. Only one gas type fits at a time; emptying the tank permits switching. Unsupported gases are not consumed. The I/O panel exposes Default, Gas Fuel and Disabled. UI layout and capacities match the Magmator; block textures are independent temporary copies named gas_generator. Methane currently reuses copied Hydrogen bar/tank art under its own identifiers and texture paths.

## Crafting and localization

All six blocks have UtilityCraft Workbench and Crafter recipes. The Electrolyzer uses two Lead Plates, one Liquid Pipe, two Gas Pipes, two Expert Chips, one Machine Case and one Stabilized Obsidian Dust. The Chemical Converter uses four Lead Plates, one Gas Pipe, two Ultimate Chips, one Machine Case and one Stabilized Obsidian Dust.

Each Gas Generator uses a matching-tier Gas Tank and three matching-tier Chips. Basic uses a Furnace, two Gold Plates and two Lead Plates. Advanced uses the Basic Gas Generator, two Energized Iron Plates and two Lead Plates. Expert uses the Advanced Gas Generator, two Diamond Dust and two Lead Plates. Ultimate uses the Expert Gas Generator and four Netherite Plates.

Gas Pipes, Gas Extractors and all four Gas Tank tiers also have Workbench recipes. The four resource Trash Cans have Workbench and Crafter recipes. Creative Tanks have no survival crafting recipes.

Electrolyzer and Chemical Converter appear under UC Machines; the four generators appear under UC Generators. Names and tooltips are available in all ten shipped locales: `en_US`, `fr_FR`, `de_DE`, `ru_RU`, `ja_JP`, `zh_CN`, `es_MX`, `es_ES`, `pt_BR` and `pt_PT`. Display names contain only the first line; additional descriptions use separate tooltip keys.

## Recipe extensions

The shared DoriosLib registry provides registerElectrolyzerRecipe and registerChemicalConverterRecipe. UC receives their script events into ID-keyed hashmaps using the existing registration queue; HM registers its nuclear recipes at world load. No HF, Fluorine, UF6 or HM-only ingredient is required for UC's standalone gas-generation chain.

## Resource disposal

Liquid Trash Can (yellow): two liquid tanks. Gas Trash Can (purple): two gas tanks. Energy Trash Can (cyan): one energy store. Ultimate Trash Can (red): 27 inventory slots, two liquid tanks, two gas tanks and one energy store. All variants reuse the Basic Trash Can geometry and texture with only green accents recolored.

The new variants have no interface or display items. Resources enter passively through connected transport; all supported stores clear every 10 ticks (0.5 seconds at 20 TPS), with liquid/gas types reset to empty. Each tank/store buffers up to 1,000,000,000 mB/DE between clears. Ultimate accepts items through normal item transport. There is no active pulling or exporting from these sinks. Breaking one removes its own entity without dropping stored contents. The original Basic Trash Can retains its existing behavior.

## Shared resource ownership

UtilityCraft owns the hidden bar items, textures and tank entities for the following resources migrated from Heavy Machinery. These storage definitions can be used without Heavy Machinery and do not add standalone survival production recipes. UC also supplies matching Creative Tanks and liquid buckets, including the Saline Coolant Bucket.

| Storage API | Exact type string |
|---|---|
| FluidStorage | `saline_coolant` |
| FluidStorage | `crude_oil` |
| FluidStorage | `diesel` |
| FluidStorage | `heavy_water` |
| FluidStorage | `petroleum` |
| FluidStorage | `sulfuric_acid` |
| GasStorage | `heated_saline_coolant_gas` |
| GasStorage | `fluorine_gas` |
| GasStorage | `hydrogen_fluoride_gas` |
| GasStorage | `natural_uranium_hexafluoride_gas` |
| GasStorage | `enriched_uranium_hexafluoride_gas` |
| GasStorage | `depleted_uranium_hexafluoride_gas` |
| GasStorage | `nuclear_waste_gas` |

Use these exact type strings and quantities in mB with the shared storage/recipe APIs. The type string has no namespace prefix. Storage displays resolve `utilitycraft:<type>_00` through `utilitycraft:<type>_48`; tank entities resolve `utilitycraft:fluid_tank_<type>` or `utilitycraft:gas_tank_<type>`. Addons consuming these resources should depend on UC and reuse its definitions rather than defining the same identifiers again.

Heavy Machinery supplies its advanced production and processing recipes. Other addons can provide their own producers and consumers using the same resource types. Transport still follows each machine's configured I/O and available capacity.

## Source files

- Native processing recipes: [Electrolyzer](../BP/scripts/config/recipes/electrolyzer.js) and [Chemical Converter](../BP/scripts/config/recipes/chemical_converter.js).
- Fuel values and burn behavior: [gas fuels](../BP/scripts/config/recipes/gas_fuel.js) and [Gas Generator component](../BP/scripts/machinery/generators/gas_generator.js).
- Tier rates and capacities: [Gas Generator blocks](../BP/blocks/machinery/generators/gas_generator/).
- Crafting: [machine recipes](../BP/recipes/machinery/machines/), [Gas Generator recipes](../BP/recipes/machinery/generators/gas_generator/) and [Crafter registry](../BP/scripts/config/recipes/crafter.js).
- Resource disposal: [Trash Can components](../BP/scripts/machinery/machines/trashCan.js).
