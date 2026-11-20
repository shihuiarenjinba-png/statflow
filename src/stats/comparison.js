import { jStat } from "jstat";
import { mean, variance } from "../core/math.js";

export function welchTTest(ds, groupColumn, valueColumn) {
  const groups=new Map();
  for (const row of ds.rows) {
    const g=row[groupColumn], v=row[valueColumn];
    if (g===null || !Number.isFinite(v)) continue;
    const k=String(g);
    if (!groups.has(k)) groups.set(k,[]);
    groups.get(k).push(v);
  }
  if (groups.size!==2) throw new Error("Welch検定には2グループのカテゴリ列が必要です。");
  const [[g1,x1],[g2,x2]]=[...groups.entries()];
  if (x1.length<2 || x2.length<2) throw new Error("各グループに2件以上の数値が必要です。");
  const m1=mean(x1),m2=mean(x2),v1=variance(x1),v2=variance(x2);
  const se2=v1/x1.length + v2/x2.length;
  const t=(m1-m2)/Math.sqrt(se2);
  const df=(se2**2)/((v1/x1.length)**2/(x1.length-1)+(v2/x2.length)**2/(x2.length-1));
  const p=2*(1-jStat.studentt.cdf(Math.abs(t),df));
  return {method:"Welch two-sample t-test",groupColumn,valueColumn,groups:[{name:g1,n:x1.length,mean:m1},{name:g2,n:x2.length,mean:m2}],difference:m1-m2,t,df,p};
}
