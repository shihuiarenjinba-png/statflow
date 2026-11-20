import { describe, expect, it } from "vitest";
import { ingestRows } from "../src/core/ingest.js";
import { describeDataset } from "../src/stats/descriptive.js";
import { correlationMatrix } from "../src/stats/correlation.js";
import { welchTTest } from "../src/stats/comparison.js";
import { multipleOLS, ridgeRegression } from "../src/stats/regression.js";
import { pca } from "../src/stats/pca.js";

const ds=ingestRows([
  ["x","z","y","group"],
  [1,2,5,"A"],[2,1,7,"A"],[3,2,11,"A"],[4,3,15,"B"],
  [5,4,19,"B"],[6,5,23,"B"],[7,6,27,"B"],[8,7,31,"B"]
]);

describe("statistics",()=>{
  it("describes numeric columns",()=>{ expect(describeDataset(ds).length).toBe(3); });
  it("creates symmetric correlation matrix",()=>{
    const c=correlationMatrix(ds);
    expect(c.matrix[0][1]).toBeCloseTo(c.matrix[1][0],10);
    expect(c.matrix[0][0]).toBeCloseTo(1,10);
  });
  it("runs Welch t-test",()=>{
    const r=welchTTest(ds,"group","y");
    expect(r.groups).toHaveLength(2);
    expect(r.p).toBeGreaterThanOrEqual(0);
    expect(r.p).toBeLessThanOrEqual(1);
  });
  it("runs multiple OLS",()=>{
    const r=multipleOLS(ds,"y",["x","z"]);
    expect(r.r2).toBeGreaterThan(0.95);
    expect(r.terms).toHaveLength(3);
  });
  it("runs ridge",()=>{
    const r=ridgeRegression(ds,"y",["x","z"],1);
    expect(r.lambda).toBe(1);
    expect(r.terms).toHaveLength(3);
  });
  it("runs standardized PCA",()=>{
    const r=pca(ds,["x","z","y"],3);
    expect(r.components).toHaveLength(3);
    const sum=r.components.reduce((s,c)=>s+c.explained,0);
    expect(sum).toBeCloseTo(1,5);
  });
});
