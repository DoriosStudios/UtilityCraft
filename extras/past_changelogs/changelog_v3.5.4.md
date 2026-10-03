# UtilityCraft v3.5.4

This update improves cross-addon machine-port compatibility, refreshes Simplified Chinese localization and removes obsolete Bountiful Crops compatibility blocks.

## HIGHLIGHTS
- Added shared link-node I/O registration to prevent machine-port conflicts across companion add-ons such as Heavy Machinery.
- Thoroughly revised and expanded the Simplified Chinese translation.
- Removed obsolete Bountiful Crops `*_crop` blocks while retaining the functional `*_seeds` blocks.

## CHANGED
- Replaced Electrolyzer, Chemical Converter and all four Gas Generator tier textures with the supplied 16x16 face sprites, including off/on states.
- Improved Simplified Chinese translations across machines, items, guides, recipes and Bountiful content.

## FIXED
- Removed the trailing _liquid suffix from liquid bar display names.
- Fixed fluid and gas input items without an output container not being consumed after successful insertion.

## COMPATIBILITY
- Added shared link-node I/O registration so every loaded DoriosCore runtime receives the same machine-port definitions, preventing conflicts with add-ons such as Heavy Machinery.
- Removed the 32 obsolete `*_crop` compatibility blocks and their runtime migration component, leaving only the functional `*_seeds` crop blocks.
