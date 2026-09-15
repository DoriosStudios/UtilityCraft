// Fuel recipes limit efficiency savings to keep their energy returns bounded.
// Recipes registered by addons retain their normal behavior unless they opt in.
export function applyRecipeEnergyLimit(machine, recipe) {
    const consumption = Math.max(machine.boosts.consumption, recipe.minimum_consumption ?? 0);
    if (consumption === machine.boosts.consumption) return;
    machine.boosts.consumption = consumption;
    machine.setRate(machine.settings.machine.rate_speed_base * machine.boosts.speed * consumption);
}
