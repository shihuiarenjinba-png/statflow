import { describe, expect, it } from "vitest";
import { ingestRows } from "../src/core/ingest.js";
import { validateDataset } from "../src/core/validation.js";
import { runAnalysis } from "../src/analysis/engine.js";

describe("data quality gate",()=>{
  it("scores a clean dataset and exposes heuristic metadata",()=>{
    const rows=[["x","y"]];
    for(let i=1;i<=40;i++) rows.push([i,i*2+(i%3)]);
    const q=validateDataset(ingestRows(rows)).quality;
    expect(q.score).toBeGreaterThanOrEqual(80);
    expect(q.gate).toBe("pass");
    expect(q.heuristic).toBe(true);
  });

  it("warns about high missingness without auto-imputing",()=>{
    const ds=ingestRows([
      ["x","y"],
      [1,10],[2,""],[3,""],[4,40],[5,""],[6,60],[7,""],[8,80],[9,90],[10,100]
    ]);
    const v=validateDataset(ds);
    expect(v.issues.some(i=>i.code==="missing")).toBe(true);
    expect(ds.rows.filter(r=>r.y===null).length).toBe(4);
    expect(["warn","block"]).toContain(v.quality.gate);
  });

  it("preserves an unparsable value in a mostly numeric column and warns",()=>{
    const ds=ingestRows([
      ["x"],["1"],["2"],["3"],["4"],["5"],["6"],["7"],["8"],["9"],["bad"]
    ]);
    expect(ds.columns[0].kind).toBe("numeric");
    expect(ds.rows[9].x).toBe("bad");
    const v=validateDataset(ds);
    expect(v.issues.some(i=>i.code==="mixed_numeric")).toBe(true);
  });

  it("blocks inferential analysis for critically sparse data but permits overview",()=>{
    const ds=ingestRows([["x","y"],[1,""],["",""]]);
    const v=validateDataset(ds);
    expect(v.quality.gate).toBe("block");
    expect(()=>runAnalysis(ds,{mode:"analyst",method:"correlation"})).toThrow(/品質ゲート/);
    expect(()=>runAnalysis(ds,{mode:"analyst",method:"descriptive"})).not.toThrow();
  });

  it("warns when dimensionality is high relative to observations",()=>{
    const ds=ingestRows([
      ["a","b","c","d","e"],
      [1,2,3,4,5],
      [2,3,4,5,6],
      [3,4,5,6,7],
      [4,5,6,7,8]
    ]);
    const v=validateDataset(ds);
    expect(v.issues.some(i=>i.code==="high_dimensional")).toBe(true);
  });
});
