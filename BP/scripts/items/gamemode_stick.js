function isCreativeMode(player) {
    const creativeCheck = player.isInCreative?.();
    if (typeof creativeCheck === 'boolean') return creativeCheck;

    const gameMode = player.getGameMode?.();
    return typeof gameMode === 'string' && gameMode.toLowerCase() === 'creative';
}

DoriosAPI.register.itemComponent('gamemode_stick', {
    onUse({ source }) {
        if (!source || source.typeId !== 'minecraft:player') return;

        const switchToCreative = !isCreativeMode(source);
        const targetMode = switchToCreative ? 'creative' : 'survival';

        try {
            source.runCommand(`gamemode ${targetMode} @s`);
        } catch {
            source.sendMessage('§cNão foi possível trocar o modo de jogo.');
            return;
        }

        source.sendMessage(`§aModo alterado para §f${switchToCreative ? 'Criativo' : 'Sobrevivência'}§a.`);
    }
});
