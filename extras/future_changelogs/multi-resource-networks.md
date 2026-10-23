# Multi-resource networks: deferred beyond v3.6.0

Target: the next update after v3.6.0, subject to resolving and validating [PR #35](https://github.com/DoriosStudios/UtilityCraft/pull/35). These are draft notes for pending work, not features included in v3.6.0. Review them against the final implementation before moving them into a release changelog.

## Planned features

- Support multi-resource networks on compatible cables, importers and exporters supplied by extensions.
    - Items, liquids, gases and energy can share the same transport block.
    - Use a Wrench on a multi-resource cable face to disable individual resource channels.
    - Sneak and use a Wrench to select accepted colors from Default and the sixteen Minecraft colors.
    - Universal Cables start with only Default enabled; Default and White are separate choices.
    - Enabled colors join one shared network. An empty selection blocks pipe-to-pipe connections while retaining direct machine connections.
    - Multi-resource endpoints provide separate item, liquid and gas configuration menus, including importer filters.
    - Color selections and channel restrictions persist through reloads, piston movement and Copy/Paste Tool use.
- Provide accepted-color control translations and align them with all supported locales.

## Planned technical changes

- Share connection snapshots and neighboring-block reads across resource channels to optimize network topology and geometry updates.
- Provide generic multi-resource cable and endpoint components for extensions, plus `utilitycraft:register_pipe_resource` for additional face-configurable channels. Extensions provide routing for their own channels.
- Add explicit network-face policies through `networkFaces: "explicit"`, retaining fallback access for legacy machine configurations and Link Node overrides.
