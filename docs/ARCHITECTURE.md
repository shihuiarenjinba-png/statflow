# Architecture

## Core rule

Raw CSV/XLSX data must never be passed directly into a statistical module.

```
File
 -> ingest
 -> canonicalize
 -> validate
 -> Canonical Dataset v1.0
 -> analysis engine
 -> deterministic result
 -> explanation
 -> export
```

## Canonical Dataset

A canonical dataset contains:
- unique column names
- one row per observation
- explicit column kinds
- blank values represented as null
- numeric values represented as numbers
- ISO-like dates normalized conservatively
- an audit trail of safe normalization

The contract is intentionally small so every statistical module receives the same structure.

## Separation of concerns

- `src/core`: ingestion, normalization, validation, math primitives
- `src/stats`: deterministic statistical computations
- `src/analysis`: mode-aware recommendations and orchestration
- `src/exporter.js`: clean data and result export
- `src/main.js`: UI only

## Statistical correctness

The analysis engine must fail closed when preconditions are not satisfied.
A method should not silently drop an arbitrary variable or modify the user's source data.

## Local first

The foundation executes in-browser. A later server component may add accounts, saved recipes, AI explanations, or paid entitlements without changing the Canonical Dataset contract.
