# UtilityCraft 3.2.1 | Patch Notes
---

## FIXES & ADJUSTMENTS

### Blocks & Generators
- **Grass Block Sieve Recipe** corrected to yield proper drops.
- **Wind Turbine**
  - Adjusted energy cap for *Ultimate tier* (now 50 % lower) to prevent over-scaling with height.
- **Cobblestone Generators**
  - Corrected mining type; now properly harvestable with pickaxes.

### Compatibility
- **Dorios Excavate Integration**
  - Added block tags for `Machines`, `Generators`, `Containers`, and `Upgradable Blocks`.
  - Added `scriptevent` support for breaking UtilityCraft structures (machines, generators, fluid tanks, etc.).
  - Excavation events now respect **hammer** and **flint knife** components for custom loot behavior.
  - Enables full Excavation support across UtilityCraft’s automation blocks.

### Machines
- **Infuser**
  - Fixed bug preventing operation unless input matched catalyst’s required amount exactly.
- **Assembler**
  - Updated production scaling:  
    - Speed 0 → 1 item  
    - Speed 1 → 2 items  
    - Speed 2–8 → `speed²` items per process  
  - The Assembler now increases **items per process** instead of raw rate speed.

### Sieving
- Corrected several drop probabilities that were significantly higher than intended.

---

## TECHNICAL
- Minor internal script cleanup for better cross-addon compatibility.
- Improved Excavation-event routing for blocks using the `utilitycraft:hammer` and `utilitycraft:block_loot` components.

---

*UtilityCraft 3.2.1 focuses on bug fixing, balance adjustments, and improved compatibility with Dorios Excavate features.*
