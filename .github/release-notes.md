# UtilityCraft v3.6.1

This update expands the Primitive Forge's smelting and output storage, refreshes machine recipe books, and fixes normal tank support for Crude Oil, Petroleum and Diesel.

<!-- Upcoming release: v3.6.1. -->
<!-- Previous release: extras/past_changelogs/changelog_v3.6.0.md -->
<!-- Deferred work: extras/future_changelogs/multi-resource-networks.md. Add release entries only after implementation and in-game validation. -->

## BLOCKS

- **Primitive Forge**
    - Expanded output storage from one slot to four slots arranged in a 2x2 grid.
    - Processing and automatic extraction now use all four output slots.
    - Both input slots can now smelt together in one shared cycle, processing one recipe per input instead of batches of up to four.
    - Brute Steel processing is also limited to one recipe per cycle.
    - Fuel burns at a constant rate while processing, matching the previous full Steel batch rate regardless of the recipe or number of occupied inputs.
    - Steel combinations retain priority over individual smelting and keep their existing processing time.

## UI/UX

- Machine containers now switch between entity interaction while standing and block selection while sneaking, keeping their original hitbox sizes.
- **Auto Sieve**
    - Added Lead Chunk and Deepslate Lead Chunk drops to the appropriate mesh and material tables.
- **Crusher and Electro Press**
    - Added the missing Lead and Uranium processing recipes to their recipe books.
- **Infuser**
    - Separated the two Stabilized Obsidian Dust recipes to show their different Amethyst Dust requirements.
- **Seed Synthesizer**
    - Added Sea Pickle to the recipe book.
    - Corrected the Golden Apple drop chance and resource-seed yield ranges to match actual processing.
    - Corrected soil speed values and clarified the energy-cost column.
- **Primitive Forge**
    - Added matching blue outlines to both ingredient slots and an orange outline to the fuel slot.
    - Added a red outline around the 2x2 output grid.

## BUG FIXES

- Fixed UtilityCraft reporting an outdated version to other addons during dependency checks.
- **Fluid Tanks**
    - Fixed normal tanks being unable to store and transfer Crude Oil, Petroleum and Diesel because their tank entities were missing.
