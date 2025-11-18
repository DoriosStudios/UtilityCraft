export const ITEM_CONDUIT_COLORS = {
	green: [
		'utilitycraft:item_conduit',
		'utilitycraft:item_conduit_green'
	],
	blue: [
		'utilitycraft:item_conduit_blue'
	],
	yellow: [
		'utilitycraft:item_conduit_yellow'
	],
	red: [
		'utilitycraft:item_conduit_red'
	]
};

const TYPE_TO_COLOR = new Map();
for (const [color, ids] of Object.entries(ITEM_CONDUIT_COLORS)) {
	for (const id of ids) {
		TYPE_TO_COLOR.set(id, color);
	}
}

export const ITEM_CONDUIT_COLOR_PREFIX = 'col:';

export function listItemConduitColors() {
	return Object.keys(ITEM_CONDUIT_COLORS);
}

export function getItemConduitColorByTypeId(typeId) {
	if (!typeId) return null;
	return TYPE_TO_COLOR.get(typeId) ?? null;
}

export function isItemConduitType(typeId) {
	return TYPE_TO_COLOR.has(typeId);
}

export function getColorTagPrefix(color) {
	return `${ITEM_CONDUIT_COLOR_PREFIX}${color}|`;
}

export function getColorSpecificNodesKey(color) {
	return color ? `dorios:item_nodes_${color}` : 'dorios:item_nodes';
}

export function getUpdateNetworkTag(color) {
	return color ? `updateNetwork:${color}` : 'updateNetwork';
}
