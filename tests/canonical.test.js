import { describe, expect, it } from "vitest";
import { ingestRows, transposeRows } from "../src/core/ingest.js";
import { validateDataset } from "../src/core/validation.js";

describe("canonical dataset",()=>{
  it("normalizes duplicate and blank headers",()=>{
    const ds=ingestRows([[" A ","A",""],[" 1 ","x",""]]);
    expect(ds.columns.map(c=>c.name)).toEqual(["A","A_2","Column_3"]);
  });
  it("trims strings and converts blanks to null",()=>{
    const ds=ingestRows([["name","value"],[" Alice ",""],["Bob","2"]]);
    expect(ds.rows[0].name).toBe("Alice");
    expect(ds.rows[0].value).toBe(null);
  });
  it("parses unambiguous numeric strings",()=>{
    const ds=ingestRows([["x"],["1,200"],["2,000"],["3000"]]);
    expect(ds.columns[0].kind).toBe("numeric");
    expect(ds.rows[0].x).toBe(1200);
  });
  it("does not convert percent strings automatically",()=>{
    const ds=ingestRows([["x"],["10%"],["20%"],["30%"]]);
    expect(ds.columns[0].kind).not.toBe("numeric");
  });
  it("flags duplicates without deleting them",()=>{
    const ds=ingestRows([["x","g"],["1","a"],["1","a"],["2","b"]]);
    const v=validateDataset(ds);
    expect(v.issues.some(x=>x.code==="duplicate_rows")).toBe(true);
    expect(ds.rows).toHaveLength(3);
  });
  it("transposes rectangular CSV-like rows",()=>{
    expect(transposeRows([["id","A","B"],["x",1,2],["y",3,4]])).toEqual([
      ["id","x","y"],["A",1,3],["B",2,4]
    ]);
  });
  it("can canonicalize a transposed input",()=>{
    const ds=ingestRows([["id","A","B"],["x",1,2],["y",3,4]],"matrix.csv",{transpose:true});
    expect(ds.source.transposed).toBe(true);
    expect(ds.columns.map(c=>c.name)).toEqual(["id","x","y"]);
    expect(ds.rows).toHaveLength(2);
  });
});
