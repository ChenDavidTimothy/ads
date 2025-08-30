## Batch Rendering v1 (Batchion)

- Batch node: logic category, input/output `object_stream`, property `key` (bindable).
- Behavior: tags objects with `batch=true` and `batchKey` (no duplication or visual changes).
- Validation: empty/whitespace key errors at execution with offending object IDs.
- Metadata propagation: `SceneObject` carries `batch` and `batchKey`; downstream nodes pass through.
- Scene executor: partitions by unique keys; renders each key with non-batched + matching objects; keys sorted; runtime IDs namespaced `baseId@key`.
- Filenames: `{key}.mp4` (sanitized); storage provider supports `outputBasename` and `outputSubdir`.
- Precedence: bindings remain authoritative; batch overrides UI deferred for v1 runtime; future-compatible.

### Recent Change

- Batch.key now resolves per object using binding precedence (byObject > global > literal). A single Batch node can tag many keys; no need for multiple nodes.
