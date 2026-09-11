# Gas generation

UtilityCraft owns the Electrolyzer, Chemical Converter and Basic/Advanced/Expert/Ultimate Gas Generators. Heavy Machinery extends the two processing recipe registries with HF electrolysis and the HF/Natural UF6 conversion recipes. Machine IDs, slots, I/O and Speed/Energy upgrades are preserved during migration. Their native crafts use Stabilized Obsidian Dust instead of the HM-only Energy Cell. This adds an Infuser processing step to the setup cost using existing UtilityCraft materials.

## Production routes

- Electrolyzer: 1,000 mB Water → 1,000 mB Hydrogen + 500 mB Oxygen; 512,000 DE. Gas input must be empty.
- Crusher: Charcoal → Charcoal Dust, using the existing recipe.
- Chemical Converter: 1 Charcoal Dust + 1,000 mB Hydrogen → 1,000 mB Methane; 256,000 DE. Liquid input must be empty.
- Feed Hydrogen directly to a Gas Generator, or convert it to Methane for higher output and fuel value.
- Route BOTH Electrolyzer outputs to separate gas networks. Store Oxygen or pipe it into a Gas Trash Can for continuous Hydrogen production. The Gas Trash Can accepts two gas types in separate tanks and empties every 10 ticks; a blocked Oxygen output still pauses electrolysis.

## Initial balance

| Tier | Hydrogen DE/t | Methane DE/t | Energy capacity DE | Gas capacity mB |
|---|---:|---:|---:|---:|
| Basic | 25 | 50 | 80,000 | 32,000 |
| Advanced | 100 | 200 | 320,000 | 128,000 |
| Expert | 400 | 800 | 1,280,000 | 512,000 |
| Ultimate | 2,500 | 5,000 | 8,000,000 | 3,200,000 |

Hydrogen provides 1,536 DE/mB; Methane provides 4,096 DE/mB. These are starting balance values for gameplay testing. A 1,000 mB Hydrogen batch yields 1.536 MDE gross and 1.024 MDE after electrolysis. Converting that batch to Methane yields 4.096 MDE gross and 3.328 MDE after electrolysis/conversion, before charcoal preparation, transport and other auxiliary costs. Both routes are intentionally profitable. Total yield and the generation rate are separate: lower tiers take longer to burn a batch.

Gas is stored in whole mB. The generator accumulates fractional burn progress, consumes whole mB and emits their full energy value in small pulses. This avoids losing fuel through rounding at low rates. Progress represents processing time only; there is no second tank or hidden fuel inventory. It stops when free energy capacity cannot hold a whole mB's yield. It uses the existing generator transfer behavior and transfers stored energy before processing fuel.

Each generator has one visible gas bar (slot 2), energy display, fuel time/value and I/O. Only one gas type fits at a time; emptying the tank permits switching. Unsupported gases are not consumed. The I/O panel exposes Default, Gas Fuel and Disabled. UI layout and capacities match the Magmator; block textures are independent temporary copies named gas_generator. Methane currently reuses copied Hydrogen bar/tank art under its own identifiers and texture paths.

All six blocks have Workbench and Crafter recipes. Generator recipes follow the Magmator tiers, substituting matching Gas Tanks, previous-tier Gas Generators and Lead Plates for Steel Plates. Electrolyzer and Chemical Converter appear under UC Machines; the four generators appear under UC Generators. Names/help cover English, Spanish and Portuguese.

## Recipe extensions

The shared DoriosLib registry provides registerElectrolyzerRecipe and registerChemicalConverterRecipe. UC receives their script events into ID-keyed hashmaps using the existing registration queue; HM registers its nuclear recipes at world load. No HF, Fluorine, UF6 or HM-only ingredient is required for UC's standalone gas-generation chain.

## Resource disposal

Liquid Trash Can (yellow): two liquid tanks. Gas Trash Can (purple): two gas tanks. Energy Trash Can (cyan): one energy store. Ultimate Trash Can (red): 27 inventory slots, two liquid tanks, two gas tanks and one energy store. All variants reuse the Basic Trash Can geometry and texture with only green accents recolored.

The new variants have no interface or display items. Resources enter passively through connected transport; all supported stores clear every 10 ticks (0.5 seconds at 20 TPS), with liquid/gas types reset to empty. Each tank/store buffers up to 1,000,000,000 mB/DE between clears. Ultimate accepts items through normal item transport. There is no active pulling or exporting from these sinks. Breaking one removes its own entity without dropping stored contents. The original Basic Trash Can retains its existing behavior.

## Shared resource ownership

UtilityCraft owns the hidden bar items, textures and tank entities for the following resources migrated from Heavy Machinery. These definitions can be used without Heavy Machinery; they do not add standalone production recipes or Creative inventory entries.

| Storage API | Exact type string |
|---|---|
| FluidStorage | `saline_coolant` |
| GasStorage | `fluorine_gas` |
| GasStorage | `hydrogen_fluoride_gas` |
| GasStorage | `natural_uranium_hexafluoride_gas` |
| GasStorage | `enriched_uranium_hexafluoride_gas` |
| GasStorage | `depleted_uranium_hexafluoride_gas` |
| GasStorage | `nuclear_waste_gas` |

Use these exact type strings and quantities in mB with the shared storage/recipe APIs. The type string has no namespace prefix. Storage displays resolve `utilitycraft:<type>_00` through `utilitycraft:<type>_48`; tank entities resolve `utilitycraft:fluid_tank_<type>` or `utilitycraft:gas_tank_<type>`. Addons consuming these resources should depend on UC and reuse its definitions rather than defining the same identifiers again.

Heavy Machinery retains its production and processing recipes, coolant efficiencies/tiers, Saline Coolant Bucket and Creative Tanks. Other addons can provide their own producers and consumers using the same resource types. Transport still follows each machine's configured I/O and available capacity.
