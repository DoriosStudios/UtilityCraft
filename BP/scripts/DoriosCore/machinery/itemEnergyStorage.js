import { buildEnergyLoreLine, RESOURCE_LORE_MARKERS } from "./resourceLore.js";

/** Durability-backed item energy. No item registry or dynamic energy properties. */
export class ItemEnergyStorage {
    static TAG = 'utilitycraft:energy_container';
    static ENERGY_PER_POINT = 100_000;
    static MARGIN = 100;

    /** Reads only; safe to construct in before-events. Caller must save the modified ItemStack. */
    constructor(item) {
        this.item = item;
        this.durability = item?.getComponent('minecraft:durability');
        this.isValid = !!(item?.hasTag(ItemEnergyStorage.TAG)
            && Number.isFinite(this.durability?.maxDurability)
            && this.durability.maxDurability > 2 * ItemEnergyStorage.MARGIN);
    }

    getCap() {
        return this.isValid
            ? (this.durability.maxDurability - 2 * ItemEnergyStorage.MARGIN) * ItemEnergyStorage.ENERGY_PER_POINT : 0;
    }

    get() {
        if (!this.isValid) return 0;
        const damage = this.durability.damage;
        if (!Number.isFinite(damage)) return 0;
        return Math.max(0, Math.min(this.getCap(),
            (this.durability.maxDurability - Math.ceil(damage) - ItemEnergyStorage.MARGIN) * ItemEnergyStorage.ENERGY_PER_POINT));
    }

    getFreeSpace() { return this.getCap() - this.get(); }

    /** Set a charge explicitly, rounding down. Intended for creation/migration. */
    set(amount) {
        if (!this.isValid || !Number.isFinite(amount)) return this.get();
        const energy = Math.floor(Math.max(0, Math.min(this.getCap(), amount)) / ItemEnergyStorage.ENERGY_PER_POINT) * ItemEnergyStorage.ENERGY_PER_POINT;
        this.durability.damage = this.durability.maxDurability - ItemEnergyStorage.MARGIN - energy / ItemEnergyStorage.ENERGY_PER_POINT;
        return energy;
    }

    /** Add only complete points and return the actual DE accepted. */
    add(amount) {
        if (!this.isValid || !Number.isFinite(amount) || amount <= 0) return 0;
        const current = this.get();
        const accepted = Math.floor(Math.min(amount, this.getFreeSpace()) / ItemEnergyStorage.ENERGY_PER_POINT) * ItemEnergyStorage.ENERGY_PER_POINT;
        if (accepted > 0) this.set(current + accepted);
        return accepted;
    }

    /** Debit complete points, rounding up; may exhaust the item, never break it. */
    consume(amount) {
        if (!this.isValid || !Number.isFinite(amount) || amount <= 0) return 0;
        const current = this.get();
        const used = Math.min(current, Math.ceil(amount / ItemEnergyStorage.ENERGY_PER_POINT) * ItemEnergyStorage.ENERGY_PER_POINT);
        if (used > 0) this.set(current - used);
        return used;
    }

    /** Clamp the visible bar and refresh its lore. Returns whether the item changed. */
    display() {
        if (!this.isValid) return false;
        const before = this.durability.damage;
        this.set(this.get());
        const prefix = '\u00a7r\u00a7bEnergy: ';
        const previous = this.item.getLore();
        const lore = previous.filter(line => !line.startsWith(prefix) && !line.startsWith(RESOURCE_LORE_MARKERS.energy));
        lore.push(buildEnergyLoreLine(this.get(), this.getCap()));
        const loreChanged = JSON.stringify(previous) !== JSON.stringify(lore);
        if (loreChanged) this.item.setLore(lore);
        return before !== this.durability.damage || loreChanged;
    }
}
