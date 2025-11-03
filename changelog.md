# UtilityCraft 3.2.1 | Patch Notes
---

## ADJUSTMENTS & IMPROVEMENTS

### Blocks & Generators
- **Wind Turbine**
  - Adjusted energy cap for *Ultimate tier* (now 50 % lower).  

### Compatibility
- **Dorios Excavate Integration**
  - Added block tags for `Machines`, `Generators`, `Containers`, and `Upgradable Blocks`.  
  - Added `scriptevent` support for breaking UtilityCraft structures (machines, generators, fluid tanks, etc.).  
  - Excavation events now respect **hammer** and **flint knife** components for custom loot behavior.  
  - Enables full Excavation support across UtilityCraft’s automation blocks.

### Machines
- **Assembler**
  - Updated production scaling:  
    - Speed 0 → 1 item  
    - Speed 1 → 2 items  
    - Speed 2–8 → `speed²` items per process  
  - The Assembler now increases **items per process** instead of raw rate speed.  
- **Seed Synthesizer**
  - Soils no longer increase yield amount.  
  - Instead, they now **reduce the energy cost** required for each synthesis process.

---

## BUG FIXES

- Fixed **Grass Block** sieve drop not being detected due to a typo in its block ID (recipe was not working at all).  
- Fixed **Infuser** not operating unless input matched catalyst’s required amount exactly.  
- Fixed **Cobblestone Generators** having incorrect mining tool type (now properly pickaxe-mineable).  
- Fixed **Sieve drops** with exaggerated drop probabilities.  
- Fixed **Mechanical Hopper & Upper** not picking up dropped items from the ground near their input position (now correctly pulls from a 1-block radius).  
- Fixed several **Integrated Storage** recipes that could not be crafted correctly.

---

## TECHNICAL
- Minor internal script cleanup for better cross-addon compatibility.  
- Improved Excavation-event routing for blocks using the `utilitycraft:hammer` and `utilitycraft:block_loot` components.

---

*UtilityCraft 3.2.1 focuses on bug fixing, balance adjustments, and improved compatibility with Dorios Excavate features.*
