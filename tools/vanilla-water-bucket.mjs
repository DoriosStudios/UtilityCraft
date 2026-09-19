import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

// Build-time reference only: never copy this vanilla asset into the resource pack.
export async function vanillaWaterBucket() {
    const relative = 'textures/items/bucket_water.png';
    let data;
    if (process.env.VANILLA_RESOURCE_PACK) {
        data = fs.readFileSync(path.join(process.env.VANILLA_RESOURCE_PACK, relative));
    } else {
        const url = `https://raw.githubusercontent.com/Mojang/bedrock-samples/v1.21.90.3/resource_pack/${relative}`;
        const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
        if (!response.ok) throw new Error(`Vanilla reference download failed (${response.status}); set VANILLA_RESOURCE_PACK to a local vanilla resource pack.`);
        data = Buffer.from(await response.arrayBuffer());
    }
    if (createHash('sha256').update(data).digest('hex') !== '53db72273ed5a8bba5bec6647b5d890754e27a9e7e4c5235e14e0a0b98411437')
        throw new Error('Vanilla water bucket reference changed; review the recolor baseline.');
    return data;
}
