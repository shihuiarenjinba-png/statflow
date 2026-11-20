import { describe, expect, it } from "vitest";
import { ingestRows } from "../src/core/ingest.js";
import { recommend } from "../src/analysis/recommender.js";
import { runAnalysis } from "../src/analysis/engine.js";
const ds=ingestRows([["x","y","group","segment"],[1,2,"A","X"],[2,4,"A","Y"],[3,7,"B","X"],[4,8,"B","Y"],[5,10,"B","Y"]]);
describe("auto/custom",()=>{
  it("overview -> descriptive",()=>expect(recommend(ds,"overview").method).toBe("descriptive"));
  it("two groups -> Welch",()=>expect(recommend(ds,"compare","y","group").method).toBe("welch"));
  it("drivers -> OLS",()=>expect(recommend(ds,"drivers","y").method).toBe("ols"));
  it("categorical -> chi-square",()=>expect(recommend(ds,"categorical",undefined,"group","segment").method).toBe("chisquare"));
  it("custom Lasso",()=>expect(runAnalysis(ds,{mode:"custom",method:"lasso",target:"y",predictors:["x"],lambda:.1}).result.method).toBe("Lasso regression"));
});
