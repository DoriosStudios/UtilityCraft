This update fixes Copy/Paste Tool interactions with machines and expands network support for UtilityCraft extensions.

<!-- Upcoming release: v3.6.3. -->
<!-- Previous release: extras/past_changelogs/changelog_v3.6.2.md -->
<!-- Deferred work: extras/future_changelogs/multi-resource-networks.md. Add release entries only after implementation and in-game validation. -->

## ITEMS

- **Copy/Paste Tool**
    - Copies or pastes settings on compatible machines and blocks while standing or sneaking, without opening the machine inventory.
    - Opens its settings menu only when sneaking and interacting in the air.
    - Shows the selected Copy or Paste mode in the action bar while held, keeping result messages visible first.
    - Prevents duplicate actions from overlapping block and entity interactions.

## UI/UX

- Updated **First Steps to Steel** with a Primitive Forge Bricks recipe image, clearer instructions for assembling its eight blocks, and a Stone Hammer illustration explaining how to obtain Iron Dust.

## THIRD-PARTY / INTEGRATION

- External exporters receive item, liquid, and gas network routes through direct script events and save them in their own addon's dynamic properties. Their addon owns settings, upgrades, menus, and transfers. Liquid and gas networks now support directional importers.
- Pipes carrying multiple UC resource tags now combine their visible connections, so updating one resource no longer hides another resource's connection. Existing color matching and wrench face disconnections remain in effect.
- Energy networks now traverse extension cables tagged `dorios:energy` and `dorios:isTube`, using the existing color and directional connection rules. Compatible cables can connect directly to UtilityCraft Energy Cables without sharing their block identifier.
- Added the `utilitycraft:energy_relay` machine-entity role so extensions can receive and redistribute energy through UC-managed destinations. Wrench connection changes now notify extensions through `utilitycraft:pipe_face_update` without managing their custom networks.
