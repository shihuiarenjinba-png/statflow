# StatFlow

StatFlow is a browser-first statistical workflow for people who want to move from messy CSV/XLSX data to an auditable analysis without stitching together multiple tools.

## Product flow

```
Upload
  ↓
Ingest
  ↓
Safe normalization
  ↓
Canonical Dataset
  ↓
Quality validation
  ↓
Analysis
  ↓
Interpretation
  ↓
Export
```

The **Canonical Dataset boundary is the contract**. Statistical modules never consume raw Excel/CSV directly.

## Modes

- **Basic** — goal-driven. Users choose what they want to know, not a statistical method.
- **Analyst** — method-driven, with assumptions and diagnostics exposed.
- **Advanced** — direct control of multivariate / regularized methods and tuning parameters.

See [docs/MODE_BOUNDARIES.md](docs/MODE_BOUNDARIES.md).

## Current analyses

- Descriptive statistics
- Pearson correlation
- Welch two-sample t-test
- Multiple OLS regression
- Ridge regression
- PCA with standardized numeric variables

## Data correction policy

StatFlow separates **lossless / structural normalization** from **analysis-changing transformations**.

Automatically allowed:
- trim column names and strings
- replace blank cells with null
- make duplicate/blank headers unique
- parse unambiguous numeric strings such as `1,200.5`
- parse ISO-like dates

Never automatic:
- missing-value imputation
- outlier deletion / winsorization
- category merging
- unit conversion
- log transform
- standardization for persisted cleaned data
- feature deletion

Analysis-changing operations must be explicit and auditable.

## Local-first

Raw files are processed in the browser. No upload API is required by this foundation.

## Development

```bash
npm install
npm test
npm run build
npm run dev
```

## Repository policy

Work is developed on feature branches and merged through pull requests. The initial product foundation lives on
`codex/statflow-foundation-20261120`.
