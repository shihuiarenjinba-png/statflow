import { describe, expect, it } from "vitest";
import { ingestRows } from "../src/core/ingest.js";
import { recommend } from "../src/analysis/recommender.js";
import { runAnalysis } from "../src/analysis/engine.js";

const ds=ingestRows([["x","y","group"],[1,2,"A"],[2,4,"A"],[3,7,"B"],[4,8,"B"],[5,10,"B"]]);

describe("mode boundaries",()=>{
  it("basic overview chooses descriptive",()=>expect(recommend(ds,"overview").method).toBe("descriptive"));
  it("basic compare chooses Welch when possible",()=>expect(recommend(ds,"compare","y","group").method).toBe("welch"));
  it("basic drivers chooses OLS",()=>expect(recommend(ds,"drivers","y").method).toBe("ols"));
  it("advanced can run ridge explicitly",()=>{
    const r=runAnalysis(ds,{mode:"advanced",method:"ridge",target:"y",predictors:["x"],lambda:2});
    expect(r.result.method).toBe("Ridge regression");
  });
});
