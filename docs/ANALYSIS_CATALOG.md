# StatFlow analysis catalog

## Auto mode
Auto mode chooses a conservative default from the user's goal and the detected data types.

- dataset overview -> descriptive statistics
- exactly 2 groups -> Welch two-sample t-test
- 3+ groups -> one-way ANOVA
- numeric relationships -> Pearson correlation
- categorical relationship -> chi-square test of independence
- numeric target drivers -> multiple OLS
- multivariate structure -> PCA

Auto mode may suggest alternatives, but never silently deletes observations, imputes missing values, or applies logarithms.

## Custom mode

### Basic
Descriptive statistics, Pearson correlation, Welch t-test, Mann–Whitney U, one-way ANOVA, chi-square independence.

### Intermediate
Spearman rank correlation, multiple OLS, PCA.

### Advanced
Ridge, Lasso, Elastic Net.

## Explicit transformations
StatFlow supports natural logarithm ln(x), base-10 log10(x), and log(1+x). A transform creates a derived column and preserves the original. No automatic offset is added to make invalid non-positive values fit a log transform.

Auto may recommend a log transform for a strongly right-skewed positive variable. Recommendations are advisory and never auto-applied.

## Limitations
Structural quality checks do not replace domain knowledge, study design, causal identification, or all method-specific assumptions. Future candidates include post-hoc comparisons, logistic regression, bootstrap confidence intervals, cross-validation/model comparison, time-series analysis, and richer assumption diagnostics.
