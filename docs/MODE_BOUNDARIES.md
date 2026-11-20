# Basic / Analyst / Advanced boundary

The boundary is based on **decision responsibility**, not simply whether a method sounds difficult.

## Basic

Audience: general business users and students who know the question but not the method.

UI language:
- understand the data
- compare two groups
- inspect relationships
- find drivers
- find major structure

The engine chooses conservative defaults and explains limitations.

## Analyst

Audience: users who understand common statistical methods.

Direct controls:
- descriptive statistics
- Pearson correlation
- Welch t-test
- OLS
- PCA

Assumptions and diagnostics stay visible. Destructive cleaning remains opt-in.

## Advanced

Audience: data scientists, researchers, quantitative analysts.

Direct controls begin with:
- Ridge regularization and lambda
- PCA configuration

Future expansion belongs here:
- Lasso / Elastic Net
- PLS / PLS-DA
- logistic models
- bootstrap
- cross validation
- robust covariance
- time-series models
- model comparison

## Rule of thumb

If choosing a parameter can materially alter the inferential or predictive conclusion, it should not be hidden in Basic mode.
