# ItemEnergyStorage

`ItemEnergyStorage` is exported from DoriosCore in both UtilityCraft and Heavy
Machinery. It requires `utilitycraft:energy_container` and a durability component
with maximum durability greater than 200. No item registry or energy property is
used. The caller owns the ItemStack and must save it back after changes.

- One useful durability point stores 100,000 DE.
- The first and last 100 points are reserved.
- Capacity: `(maxDurability - 200) * 100,000`.
- Stored DE: `(maxDurability - damage - 100) * 100,000`, clamped to capacity.
- `add(amount)` rounds down to complete points and returns actual accepted DE.
- `consume(amount)` rounds up to complete points, capped at available DE, and
  returns actual consumed DE. A request below 100,000 DE still costs one point.
- `set(amount)` clamps and rounds down; intended for creation or migration.
- `display()` clamps the bar and updates only its own lore line. It returns whether
  the item changed. No modification is allowed during a before-event callback.

```js
const storage = new ItemEnergyStorage(item);
if (storage.isValid) {
    const accepted = storage.add(Math.min(machine.energy.get(), chargeBudget));
    // Debit exactly accepted DE, then persist item to its slot.
}
```

An item with maximum durability 10,200 holds 1,000,000,000 DE. Its visible
remaining durability ranges from 100 to 10,100. UtilityCraft's UtilityCore initializes
any tagged item with zero damage when it enters a player's inventory, leaving
100 remaining durability (zero energy). Initialization is deferred once from the
inventory-change event and rechecks the destination. Charged items are preserved.
Addons only need the tag and a valid durability component; no registration,
interval, per-item ID or legacy migration is needed. The raw storage class still
reads an undamaged item as full until this inventory initialization occurs.

Use zero native damage chance and no enchantable component for energy equipment.
The UC Induction Anvil and the shared durability repair helper reject this tag.
This class cannot distinguish a vanilla repair from a charge: both change
its authoritative durability. Same-item repair/combination in vanilla interfaces
must be checked in Minecraft; it is not blocked by this class. Preventing it would
need a separate engine-supported restriction or additional tracking.

Energy lore uses `buildEnergyLoreLine`, exactly like dropped machine blocks:
gray text, two leading spaces, and `Energy: stored/capacity`, without a percentage.
