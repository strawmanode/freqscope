# Aircraft 3D models (optional)

FreqScope renders known ICAO types in 3D when matching GLB files are present.
Without these files, aircraft still appear as 2D scope symbols.

These models are **not** part of the PolyForm-licensed FreqScope source code.
They are third-party assets under **GPLv2** (or upstream terms noted below).
Download them only if you accept those licenses.

## Quick setup (Flightradar24 models)

From the repository root:

```bash
npm run setup:models
```

This downloads and prepares the FR24 model set referenced in
`src/lib/aircraftModels.ts`, upgrades glTF 1.0 assets when needed, and applies
the Cesium orientation fix.

## C172 (manual)

`c172.glb` is **not** included in the FR24 download script. It comes from
FGMEMBERS / BelugaProject sources (GPLv2). Obtain and convert it separately,
then place the finished `c172.glb` in this directory.

- FGMEMBERS C172P source: <https://github.com/FGMEMBERS/c172p-detailed>

## Upstream licenses

| Asset set | Upstream | License |
| --- | --- | --- |
| Most airliner/GA meshes | [Flightradar24/fr24-3d-models](https://github.com/Flightradar24/fr24-3d-models) | GPLv2 (see upstream repo for exceptions) |
| C172 | [FGMEMBERS/c172p-detailed](https://github.com/FGMEMBERS/c172p-detailed) | GPLv2 |

Do not commit `.glb` files to the FreqScope repository. They are gitignored.
