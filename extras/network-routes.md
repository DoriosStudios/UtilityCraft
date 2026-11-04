# External network data

UC discovers item, liquid and gas networks normally. Native exporters retain
all existing persistence and settings. An exporter tagged
`dorios:external_transport` receives a direct `utilitycraft:network_data` event:

```json
{
  "key": "utilitycraft:ie:o:10,64,20",
  "dimensionId": "minecraft:overworld",
  "location": { "x": 10, "y": 64, "z": 20 },
  "data": { "version": 1, "source": null, "targets": [] }
}
```

The receiving addon uses the explicit dimension and location without parsing
the DP key. Only topology is sent: the source, target positions, access faces and any
importer positions. Importers are passive endpoints recorded in those routes;
UC does not create or send settings for external importers.

AT writes the document to its own world DP scope using UC's exporter storage
format (manifest, alternating generations and 24,000-character DP chunks).
Its exporter reads the saved routes. There are no subscriptions, revisions,
message queues or settings events between the packs.

## Addon-owned settings

AT keeps enable switches, distribution modes, filters and installed upgrades in
its own `ascendant:port_settings` DP records. Its menu writes those records
directly, and its port component installs and drops upgrades. Network updates
never replace local settings. Importer settings can be changed without a network.

AT applies its settings and importer filters when AT performs a transfer.
Settings belonging to another addon are not exchanged or enforced through this
route event. Machine/container I/O rules still come from the shared libraries.

UC handles network rebuilds after placement, breaking, wrench changes and
pistons. AT moves only its local settings/upgrades after a piston completes; it
waits for UC to supply the resulting routes. Energy and overclock remain separate.
