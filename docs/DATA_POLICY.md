# Data correction and quality policy

StatFlow treats data cleaning as two different classes.

## Class A — safe structural normalization

Allowed automatically when reversible or semantically lossless:
- trim whitespace
- blank -> null
- unique header names
- unambiguous numeric string -> numeric value
- strict ISO-like date normalization
- optional row/column transpose when the user explicitly requests it

Every automatic change is recorded in the audit log.

A mostly numeric column is **not** allowed to silently turn an unparsable source value into a missing value. The original value is retained and a mixed-type warning is emitted.

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

## Data Quality Gate

Before analysis, StatFlow checks:
- missingness
- exact duplicate rows
- constant columns
- mixed values inside numeric columns
- sample size
- high-dimensional data
- IQR-based outlier candidates

The UI shows a 0–100 **StatFlow quality heuristic** and one of:
- PASS — analysis-ready under the checks currently implemented
- WARN — analysis can continue, but the warnings may materially affect interpretation
- BLOCK — descriptive review is allowed, but inferential analysis is stopped until the critical data issue is addressed

The score is a product diagnostic, not a formal statistical validity score and not a guarantee that a model is correctly specified.
