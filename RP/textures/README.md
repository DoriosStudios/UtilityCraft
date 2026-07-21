# Organización de texturas

Este directorio agrupa los recursos gráficos del Resource Pack según su función en el juego. La estructura y los nombres deben mantenerse consistentes para que los atlas, modelos, bloques y pantallas de UI puedan localizar cada archivo sin ambigüedades.

## Estructura principal

- `blocks/`: texturas usadas por bloques, geometrías y materiales del atlas de terreno.
- `entity/`: texturas de entidades. Su estructura se mantiene separada de los bloques.
- `items/`: iconos y texturas del atlas de ítems.
- `static/images/`: imágenes completas que pueden reutilizarse en guías, menús, quests, diagramas, recetas visuales y overlays.
- `ui/`: texturas funcionales de la interfaz, como barras, botones, slots, paneles y fondos.

Las imágenes de `static/images/` no pertenecen a una pantalla específica. Por eso no deben guardarse dentro de carpetas como `ui/wiki` o `ui/recipes`, aunque actualmente sean consumidas por esas interfaces.

## Organización de `blocks/`

Las categorías de bloques siguen estas reglas:

- `machines/`: texturas de máquinas. Las variantes se codifican en el nombre del archivo.
- `generators/`: generadores agrupados por familia, como `battery/`, `furnator/` o `cobblestone/`.
- `crops/`: cultivos y suelos, sin una carpeta independiente para cada cultivo.
- `materials/`: bloques de materiales, minerales procesados y bloques decorativos derivados de materiales.
- `spawners/`: texturas del sistema de spawners mecánicos; los archivos omiten el prefijo redundante `mechanical_spawner_`.
- `tubes/`, `hoppers/` y `ender_hopper/`: transporte de ítems, fluidos y energía.
- `sieve/`, `crucible/`, `tanks/`, `fan/`, `elevators/` y `bonsais/`: sistemas con un conjunto pequeño y bien definido de texturas.
- `compressed/`: variantes de bloques comprimidos; los archivos omiten los prefijos y sufijos redundantes `compressed_` y `_block`.
- `utility/`: bloques auxiliares que no pertenecen a una familia de maquinaria mayor.
- `misc/`: recursos excepcionales sin una familia jugable; no debe usarse como categoría predeterminada.

No se deben colocar PNG directamente en la raíz de `blocks/`. Cada textura nueva debe pertenecer a una categoría.

## Convención de nombres

Todos los archivos y directorios nuevos deben cumplir estas reglas:

1. Usar únicamente minúsculas.
2. Separar palabras con guion bajo (`snake_case`).
3. No usar espacios, guiones, paréntesis, acentos ni nombres en `CamelCase`.
4. Usar nombres descriptivos en inglés.
5. Colocar las variantes de lo general a lo específico.

Ejemplos:

```text
machines/assembler_on_north.png
machines/crusher_off_up.png
generators/battery/advanced_4_west.png
generators/furnator/basic_on_south.png
crops/amethyst_crop_1.png
static/images/sieve_scaling_render.png
```

Para máquinas, el orden recomendado es:

```text
<machine>_<state>_<face>.png
```

Para generadores con tier o nivel:

```text
<tier>_<level>_<state>_<face>.png
```

Los segmentos que no apliquen se omiten.

## Referencias que deben actualizarse

Mover o renombrar una textura exige actualizar todos sus consumidores. Antes de terminar un cambio, revisar:

- `terrain_texture.json` para texturas de bloques.
- `item_texture.json` para texturas de ítems.
- `flipbook_textures.json` para texturas animadas.
- JSON de bloques y sus `minecraft:material_instances`.
- Modelos, entidades, partículas y controladores de render.
- Archivos dentro de `RP/ui/` que usen rutas directas.
- Scripts o configuraciones que guarden rutas de imágenes.
- Otros proyectos que consuman recursos de UtilityCraft, especialmente el quest UI de UtilitySky-Core.

Las referencias normalmente omiten la extensión `.png`:

```json
{
	"texture": "textures/static/images/sieve_render"
}
```

No se debe conservar una copia antigua sólo para mantener una ruta anterior. La ruta del consumidor debe actualizarse al nombre canónico.

## Recursos antiguos

No se deben crear nuevas carpetas `old` dentro del Resource Pack publicado. Git mantiene el historial de los recursos eliminados. Si un archivo antiguo todavía debe conservarse, primero se mueve a su categoría real, se normaliza su nombre y se actualizan sus referencias.
