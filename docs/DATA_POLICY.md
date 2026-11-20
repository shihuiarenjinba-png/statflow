# Data correction policy

StatFlow treats data cleaning as two different classes.

## Class A — safe structural normalization

Allowed automatically when reversible or semantically lossless:
- trim whitespace
- blank -> null
- unique header names
- unambiguous numeric string -> numeric value
- strict ISO-like date normalization

Every automatic change is recorded in the audit log.

## Class B — analysis-changing transformations

Never apply silently:
- imputation
- row deletion
- outlier deletion
- winsorization
- category consolidation
- unit conversion
- logarithmic transformation
- standardization of the persisted cleaned dataset
- feature deletion

These operations can change coefficients, p-values, distances, clusters, model selection, or downstream business conclusions.

StatFlow may recommend Class B operations, but execution must be explicit and the report must record them.
