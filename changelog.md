This update expands the Primitive Forge's output storage, clarifies its input, fuel and output slots, and fixes normal tank support for Crude Oil, Petroleum and Diesel.

<!-- Upcoming release: v3.6.1. -->
<!-- Previous release: extras/past_changelogs/changelog_v3.6.0.md -->
<!-- Deferred work: extras/future_changelogs/multi-resource-networks.md. Add release entries only after implementation and in-game validation. -->

## BLOCKS

- **Primitive Forge**
    - Expanded output storage from one slot to four slots arranged in a 2x2 grid.
    - Processing and automatic extraction now use all four output slots.

## UI/UX

- **Primitive Forge**
    - Added matching blue outlines to both ingredient slots and an orange outline to the fuel slot.
    - Added a red outline around the 2x2 output grid.

## BUG FIXES

- **Fluid Tanks**
    - Fixed normal tanks being unable to store and transfer Crude Oil, Petroleum and Diesel because their tank entities were missing.
