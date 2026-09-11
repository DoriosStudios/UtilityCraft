# UtilityCraft Slot Color Registry

Most slot textures are 3x3 nineslice outlines with a transparent center.

All slot JSON files use:

```json
{
  "nineslice_size": 1,
  "base_size": [3, 3]
}
```

The outline shading follows the same pattern for every slot:

- Top and left edges: lighter shade
- Top-right and bottom-left corners: base color
- Right and bottom edges: darker shade
- Center pixel: transparent

## Resources

| Type | Texture | Hex | Minecraft Code |
|---|---|---:|---:|
| Items | `item_resource_slot.png` | `#47A036` | `§q` |
| Liquids | `liquid_resource_slot.png` | `#DDD605` | `§g` |
| Gases | `gas_resource_slot.png` | `#9A5CC6` | `§u` |
| Energy | `energy_slot.png` | `#2CBAA8` | `§s` |

## Function

| Type | Texture | Hex | Minecraft Code |
|---|---|---:|---:|
| Transparent grid fallback | `transparent_slot.png` | transparent | none |
| Default / Neutral | `default_slot.png`, `none_slot.png`, `normal_slot.png` | `#555555` | `§8` |
| Disabled | `disabled_slot.png` | black + hazard yellow | none |
| Input | `input_slot.png` | `#5555FF` | `§9` |
| Input Extra | `input_extra_slot.png` | `#55FFFF` | `§b` |
| Output | `output_slot.png` | `#FF5555` | `§c` |
| Upgrades | `upgrade_slot.png` | `#FF55FF` | `§d` |
| Fuel | `fuel_slot.png` | `#EB7114` | `§v` |
| Input + Output | `both_slot.png` | `#5555FF` + `#FF5555` | `§9` + `§c` |

`disabled_slot.png` is a static 18x18 outline. Its one-pixel border alternates
dark and hazard-yellow pixels continuously around a transparent center; it must
not have nineslice metadata or be stretched.
