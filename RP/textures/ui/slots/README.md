# UtilityCraft Slot Color Registry

Slot textures are 3x3 nineslice outlines with a transparent center.

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
| Default / Transparent | `default_slot.png` | transparent | none |
| None / Disabled | `none_slot.png`, `normal_slot.png` | `#555555` | `§8` |
| Input | `input_slot.png` | `#5555FF` | `§9` |
| Input Extra | `input_extra_slot.png` | `#55FFFF` | `§b` |
| Output | `output_slot.png` | `#FF5555` | `§c` |
| Upgrades | `upgrade_slot.png` | `#FF55FF` | `§d` |
| Fuel | `fuel_slot.png` | `#EB7114` | `§v` |
| Input + Output | `both_slot.png` | `#5555FF` + `#FF5555` | `§9` + `§c` |
