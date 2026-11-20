# Prepare stage and bias-safe joins

StatFlow's deterministic pipeline is:

Upload -> Normalize -> Validate -> Prepare -> Transform -> Analyze -> Explain -> Export

There is no server-side AI dependency. Auto mode is a fixed rule engine.

## Why Prepare is separate

Normalize repairs safe structural issues. Prepare changes analytical structure and therefore must be explicit and auditable.

Prepare currently covers:
- explicit transpose template
- panel-data template
- multi-file lookup joins
- market-panel safe joins
- common-key discovery
- duplicate-key protection
- join-retention reporting

## Join policy

Default join for lookup/panel work is LEFT JOIN from a declared base dataset.

INNER JOIN is not a neutral cleaning operation. It changes the sample by retaining only observations present in every joined source.

For ordinary business datasets, users may choose inner join explicitly.

For market/stock-panel mode, inner join is blocked by default because retaining only securities that remain present across sources or dates can create survivorship/listing-selection bias.

An explicit override exists for expert use, but the output report records dropped base rows.

## Market panel requirements

Recommended keys:
- security identifier
- observation date

The base dataset should represent the intended universe at each point in time. Missing fundamentals, classifications, or auxiliary data should normally stay missing rather than cause automatic row deletion.

A safe join alone does not fully solve survivorship bias. Historical universe membership, delistings, ticker/security-ID changes, IPO dates, and data-source coverage still matter. StatFlow therefore treats market-safe joining as a guardrail, not proof of unbiased research.

## Join audit report

Every join records:
- join type
- key columns
- left/base rows
- right rows
- result rows
- matched rows
- left-only rows
- right-only rows
- retention ratio
- warnings

Many-to-many joins are stopped when the selected key is not unique on either side. Users must add a key or aggregate explicitly before continuing.
