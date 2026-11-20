import { describe, expect, it } from "vitest";
import { ingestRows } from "../src/core/ingest.js";
import { detectCommonKeys, joinDatasets, joinMany } from "../src/prepare/join.js";
import { templateDefaults } from "../src/prepare/templates.js";

const base=ingestRows([
  ["ticker","date","ret"],
  ["A","2026-01-01",.01],
  ["B","2026-01-01",.02],
  ["C","2026-01-01",-.01]
]);
const factor=ingestRows([
  ["ticker","date","size"],
  ["A","2026-01-01",100],
  ["B","2026-01-01",200]
]);

describe("prepare and joins",()=>{
  it("detects common keys",()=>{
    expect(detectCommonKeys([base,factor])).toEqual(expect.arrayContaining(["ticker","date"]));
  });

  it("left join preserves base universe",()=>{
    const out=joinDatasets(base,factor,{keys:["ticker","date"],how:"left",marketSafe:true});
    expect(out.rows).toHaveLength(3);
    expect(out.rows.find(r=>r.ticker==="C").size).toBe(null);
    expect(out.prepareReport.leftOnly).toBe(1);
  });

  it("market-safe mode blocks inner join by default",()=>{
    expect(()=>joinDatasets(base,factor,{keys:["ticker","date"],how:"inner",marketSafe:true})).toThrow(/inner join/);
  });

  it("explicit risky inner join reports dropped rows",()=>{
    const out=joinDatasets(base,factor,{keys:["ticker","date"],how:"inner",marketSafe:true,allowSurvivorshipRisk:true});
    expect(out.rows).toHaveLength(2);
    expect(out.prepareReport.leftOnly).toBe(1);
    expect(out.prepareReport.warnings.length).toBeGreaterThan(0);
  });

  it("does not match missing keys to each other",()=>{
    const a=ingestRows([["id","x"],["A",1],["",2]]);
    const b=ingestRows([["id","z"],["A",10],["",20]]);
    const out=joinDatasets(a,b,{keys:["id"],how:"left"});
    expect(out.rows[1].z).toBe(null);
    expect(out.prepareReport.missingKeyRows.left).toBe(1);
    expect(out.prepareReport.missingKeyRows.right).toBe(1);
  });

  it("blocks duplicate-key many-to-many joins",()=>{
    const dup=ingestRows([
      ["ticker","date","x"],
      ["A","2026-01-01",1],
      ["A","2026-01-01",2]
    ]);
    expect(()=>joinDatasets(base,dup,{keys:["ticker","date"]})).toThrow(/一意ではありません/);
  });

  it("joins multiple datasets sequentially",()=>{
    const sector=ingestRows([
      ["ticker","date","sector"],
      ["A","2026-01-01","Tech"],
      ["B","2026-01-01","Bank"],
      ["C","2026-01-01","Retail"]
    ]);
    const out=joinMany([base,factor,sector],{keys:["ticker","date"],how:"left",marketSafe:true});
    expect(out.rows).toHaveLength(3);
    expect(out.rows.find(r=>r.ticker==="A").sector).toBe("Tech");
    expect(out.prepareReports).toHaveLength(2);
  });

  it("market template defaults to safe left join",()=>{
    const d=templateDefaults("market_panel");
    expect(d.join.how).toBe("left");
    expect(d.join.marketSafe).toBe(true);
  });
});
