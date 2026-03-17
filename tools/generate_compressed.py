from __future__ import annotations

import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
TEXTURES_DIR = ROOT / "RP" / "textures" / "blocks" / "compressed_blocks"
BLOCKS_OUT = ROOT / "BP" / "blocks" / "compressed_blocks"
RECIPES_COMPRESS_OUT = ROOT / "BP" / "recipes" / "blocks" / "compressed_blocks" / "compress"
RECIPES_DECOMPRESS_OUT = ROOT / "BP" / "recipes" / "blocks" / "compressed_blocks" / "decompress"

BLOCK_FORMAT_VERSION = "1.21.100"
RECIPE_FORMAT_VERSION = "1.20.80"

SPEED_BY_TIER = {
	1: 2.0,  # compressed
	2: 3.0,  # double compressed
	3: 3.2,  # triple compressed
	4: 4.5,  # quadruple compressed
}

BASE_SOURCE_OVERRIDES = {
	# Vanilla nether "wood" full blocks are hyphae in identifiers.
	"crimson_wood": "minecraft:crimson_hyphae",
	"warped_wood": "minecraft:warped_hyphae",
}

TEXTURE_PATTERN = re.compile(r"^compressed_(?P<base>.+_wood)(?:_(?P<tier>[2-4]))?$")


def ensure_dirs() -> None:
	BLOCKS_OUT.mkdir(parents=True, exist_ok=True)
	RECIPES_COMPRESS_OUT.mkdir(parents=True, exist_ok=True)
	RECIPES_DECOMPRESS_OUT.mkdir(parents=True, exist_ok=True)


def compact_variant(base_name: str) -> str:
	variant = base_name.replace("_wood", "")
	return variant.replace("_", "")[:4]


def suffix_for_tier(tier: int) -> str:
	return "" if tier == 1 else f"_{tier}"


def filename_suffix_for_tier(tier: int) -> str:
	return "" if tier == 1 else str(tier)


def compressed_identifier(base_name: str, tier: int) -> str:
	return f"utilitycraft:compressed_{base_name}{suffix_for_tier(tier)}"


def decompressed_recipe_identifier(base_name: str, tier: int) -> str:
	return f"utilitycraft:decompressed_{base_name}{suffix_for_tier(tier)}"


def source_block_identifier(base_name: str) -> str:
	return BASE_SOURCE_OVERRIDES.get(base_name, f"minecraft:{base_name}")


def texture_key(base_name: str, tier: int) -> str:
	return f"utilitycraft_compressed_{base_name}{suffix_for_tier(tier)}"


def block_filename(base_name: str, tier: int) -> Path:
	return BLOCKS_OUT / f"compressed_{base_name}{suffix_for_tier(tier)}.json"


def recipe_compress_filename(base_name: str, tier: int) -> Path:
	short = compact_variant(base_name)
	return RECIPES_COMPRESS_OUT / f"c_{short}_wood{filename_suffix_for_tier(tier)}.json"


def recipe_decompress_filename(base_name: str, tier: int) -> Path:
	short = compact_variant(base_name)
	return RECIPES_DECOMPRESS_OUT / f"d_{short}_wood{filename_suffix_for_tier(tier)}.json"


def build_block_json(base_name: str, tier: int) -> dict:
	return {
		"format_version": BLOCK_FORMAT_VERSION,
		"minecraft:block": {
			"description": {
				"identifier": compressed_identifier(base_name, tier),
				"menu_category": {
					"category": "construction",
				},
			},
			"components": {
				"minecraft:geometry": "geometry.utilitycraft_block",
				"minecraft:material_instances": {
					"*": {
						"texture": texture_key(base_name, tier),
						"render_method": "alpha_test",
					},
				},
				"minecraft:destructible_by_mining": {
					"seconds_to_destroy": SPEED_BY_TIER[tier],
				},
				"tag:minecraft:is_axe_item_destructible": {},
				"tag:wood": {},
			},
		},
	}


def build_compress_recipe_json(base_name: str, tier: int) -> dict:
	ingredient_item = source_block_identifier(base_name) if tier == 1 else compressed_identifier(base_name, tier - 1)
	result_item = compressed_identifier(base_name, tier)

	return {
		"format_version": RECIPE_FORMAT_VERSION,
		"minecraft:recipe_shapeless": {
			"description": {
				"identifier": compressed_identifier(base_name, tier),
			},
			"tags": [
				"crafting_table",
			],
			"ingredients": [
				{
					"item": ingredient_item,
					"count": 9,
				},
			],
			"result": {
				"item": result_item,
			},
			"unlock": [
				{
					"item": ingredient_item,
				},
			],
		},
	}


def build_decompress_recipe_json(base_name: str, tier: int) -> dict:
	ingredient_item = compressed_identifier(base_name, tier)
	result_item = source_block_identifier(base_name) if tier == 1 else compressed_identifier(base_name, tier - 1)

	return {
		"format_version": RECIPE_FORMAT_VERSION,
		"minecraft:recipe_shapeless": {
			"description": {
				"identifier": decompressed_recipe_identifier(base_name, tier),
			},
			"tags": [
				"crafting_table",
			],
			"ingredients": [
				{
					"item": ingredient_item,
				},
			],
			"result": {
				"item": result_item,
				"count": 9,
			},
			"unlock": [
				{
					"item": ingredient_item,
				},
			],
		},
	}


def write_json(path: Path, data: dict) -> None:
	path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def find_wood_bases_from_textures() -> list[str]:
	found: set[str] = set()

	for png in TEXTURES_DIR.glob("compressed_*_wood*.png"):
		match = TEXTURE_PATTERN.match(png.stem)
		if not match:
			continue
		found.add(match.group("base"))

	return sorted(found)


def main() -> None:
	ensure_dirs()

	bases = find_wood_bases_from_textures()
	if not bases:
		print("No compressed *_wood textures found. Nothing to generate.")
		return

	generated_blocks = 0
	generated_compress_recipes = 0
	generated_decompress_recipes = 0

	for base_name in bases:
		for tier in (1, 2, 3, 4):
			write_json(block_filename(base_name, tier), build_block_json(base_name, tier))
			generated_blocks += 1

			write_json(recipe_compress_filename(base_name, tier), build_compress_recipe_json(base_name, tier))
			generated_compress_recipes += 1

			write_json(recipe_decompress_filename(base_name, tier), build_decompress_recipe_json(base_name, tier))
			generated_decompress_recipes += 1

	print(f"Wood bases found: {len(bases)}")
	print(f"Generated blocks: {generated_blocks}")
	print(f"Generated compress recipes: {generated_compress_recipes}")
	print(f"Generated decompress recipes: {generated_decompress_recipes}")


if __name__ == "__main__":
	main()