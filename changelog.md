This update fixes Copy/Paste Tool interactions and fluid transfers, expands network support for UtilityCraft extensions, and makes crafting recipes accept more material variants.

<!-- Upcoming release: v3.6.3. -->
<!-- Previous release: extras/past_changelogs/changelog_v3.6.2.md -->
<!-- Deferred work: extras/future_changelogs/multi-resource-networks.md. Add release entries only after implementation and in-game validation. -->

## ITEMS

- **Copy/Paste Tool**
    - Copies or pastes settings on compatible machines and blocks while standing or sneaking, without opening the machine inventory.
    - Opens its settings menu only when sneaking and interacting in the air.
    - Shows the selected Copy or Paste mode in the action bar while held, keeping result messages visible first.
    - Prevents duplicate actions from overlapping block and entity interactions.

## RECIPES

- **Bonsai**, **Sieve**, **Sink**, **Wooden AIOT**, and **Wooden Hammer** now accept planks through material tags. **Sieve** also accepts wooden slab variants.
- **Big Torch**, **Wooden Hammer**, and the log-based **Hopper**, **Stick**, and **Chest** recipes now accept logs through material tags, replacing separate wood-specific recipes for sticks and chests.
- **Smeltflare** charcoal production now accepts logs that can burn.
- **Smeltflare** and **Black Dye** crafting now use a shared coal tag to accept both coal and charcoal in a single recipe for each output.
- **Bomb**, **Dynamite**, **Grenade**, **Wool Seeds**, and the **Wool to String** recipe now accept any wool color.
- **Asphalt** now accepts both regular and red sand.
- **Stone AIOT** and **Stone Hammer** now accept vanilla stone tool materials in place of cobblestone.
- Updated recipe unlocks to recognize the corresponding material tags.

## UI/UX

- Updated **First Steps to Steel** with a Primitive Forge Bricks recipe image, clearer instructions for assembling its eight blocks, and a Stone Hammer illustration explaining how to obtain Iron Dust. Updated the guide text in all ten supported languages.
- Updated the **Copy/Paste Tool** tooltip in all ten supported languages to clarify that its settings menu opens when sneaking and interacting in the air.

## BUG FIXES

- **Fluid Tanks**
    - Fixed fluid type handling when transferring liquid into an empty tank, including transfers that completely empty the source tank.

## THIRD-PARTY / INTEGRATION

- External exporters receive item, liquid, and gas network routes through direct script events and save them in their own addon's dynamic properties. Their addon owns settings, upgrades, menus, and transfers. Liquid and gas networks now support directional importers.
- Pipes carrying multiple UC resource tags now combine their visible connections, so updating one resource no longer hides another resource's connection. Existing color matching and wrench face disconnections remain in effect.
- Energy networks now traverse extension cables tagged `dorios:energy` and `dorios:isTube`, using the existing color and directional connection rules. Compatible cables can connect directly to UtilityCraft Energy Cables without sharing their block identifier.
- Added the `utilitycraft:energy_relay` machine-entity role so extensions can receive and redistribute energy through UC-managed destinations. Wrench connection changes now notify extensions through `utilitycraft:pipe_face_update` without managing their custom networks.

Contributors: @Kauziin, @Milo504
