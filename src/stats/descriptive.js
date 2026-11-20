import { mean, sd, quantile } from "../core/math.js";
import { numericColumns } from "../core/canonical.js";

export function describeDataset(ds) {
  return numericColumns(ds).map(name=>{
    const xs=ds.rows.map(r=>r[name]).filter(Number.isFinite);
    return {
      variable:name,
      n:xs.length,
      missing:ds.rows.length-xs.length,
      mean:mean(xs),
      sd:sd(xs),
      min:xs.length?Math.min(...xs):NaN,
      q1:quantile(xs,0.25),
      median:quantile(xs,0.5),
      q3:quantile(xs,0.75),
      max:xs.length?Math.max(...xs):NaN
    };
  });
}
