import { quantile } from "./math.js";
import { numericColumns } from "./canonical.js";

export function validateDataset(ds) {
  const issues=[];
  const suggestions=[];
  for (const c of ds.columns) {
    const vals=ds.rows.map(r=>r[c.name]);
    const missing=vals.filter(v=>v===null).length;
    const rate=ds.rows.length ? missing/ds.rows.length : 0;
    if (rate>0) issues.push({level:rate>0.3?"warning":"info", code:"missing", column:c.name, message:`欠損 ${missing}件 (${(rate*100).toFixed(1)}%)`});
    const non=vals.filter(v=>v!==null);
    if (non.length && new Set(non.map(String)).size===1) issues.push({level:"warning",code:"constant",column:c.name,message:"値が一定です。分析変数には適しません。"});
  }

  const seen=new Set(), dup=[];
  ds.rows.forEach((r,i)=>{
    const key=JSON.stringify(r);
    if (seen.has(key)) dup.push(i+1); else seen.add(key);
  });
  if (dup.length) {
    issues.push({level:"warning",code:"duplicate_rows",message:`完全重複行 ${dup.length}件`});
    suggestions.push({action:"review_duplicates", destructive:true, message:"重複行の削除は自動実行しません。意味上の重複か確認してください。"});
  }

  for (const name of numericColumns(ds)) {
    const xs=ds.rows.map(r=>r[name]).filter(Number.isFinite);
    if (xs.length<4) continue;
    const q1=quantile(xs,0.25), q3=quantile(xs,0.75), iqr=q3-q1;
    const lo=q1-1.5*iqr, hi=q3+1.5*iqr;
    const out=xs.filter(x=>x<lo || x>hi).length;
    if (out) {
      issues.push({level:"info",code:"potential_outlier",column:name,message:`IQR基準の外れ候補 ${out}件`});
      suggestions.push({action:"review_outliers",column:name,destructive:true,message:"外れ値は自動削除しません。"});
    }
  }
  if (ds.rows.length<20) issues.push({level:"info",code:"small_sample",message:"標本数が20未満です。推測統計の解釈に注意してください。"});
  return {issues,suggestions,ready:ds.rows.length>0 && ds.columns.length>0};
}
