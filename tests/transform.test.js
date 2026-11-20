import { describe, expect, it } from "vitest";
import { ingestRows } from "../src/core/ingest.js";
import { addLogTransform, suggestLogTransforms } from "../src/core/transform.js";
describe("log transforms",()=>{
  it("adds ln without replacing source",()=>{const ds=ingestRows([["x"],[1],[Math.E],[Math.E**2]]),out=addLogTransform(ds,"x","ln");expect(out.rows[1].x).toBe(Math.E);expect(out.rows[1].ln_x).toBeCloseTo(1,8);});
  it("rejects ln for zero",()=>{const ds=ingestRows([["x"],[0],[1],[2]]);expect(()=>addLogTransform(ds,"x","ln")).toThrow(/0以下/);});
  it("supports log1p for zero",()=>{const ds=ingestRows([["x"],[0],[1],[3]]);expect(addLogTransform(ds,"x","log1p").rows[0].log1p_x).toBe(0);});
  it("suggests log for strong right skew",()=>{const ds=ingestRows([["x"],[1],[1],[1],[1],[1],[1],[2],[50],[100]]);expect(suggestLogTransforms(ds).some(s=>s.column==="x")).toBe(true);});
});
