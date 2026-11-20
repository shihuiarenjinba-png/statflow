import { quantile } from "./math.js";
import { numericColumns } from "./canonical.js";

function clamp(n,min,max){ return Math.max(min,Math.min(max,n)); }

export function validateDataset(ds) {
  const issues=[];
  const suggestions=[];
  const rows=ds.rows.length;
  const cols=ds.columns.length;
  const totalCells=Math.max(1,rows*cols);
  let missingCells=0;
  let constantColumns=0;
  let mixedNumericCells=0;

  for (const c of ds.columns) {
    const vals=ds.rows.map(r=>r[c.name]);
    const missing=vals.filter(v=>v===null).length;
    missingCells+=missing;
    const rate=rows ? missing/rows : 0;
    if (rate>0) {
      issues.push({
        level:rate>=0.5?"error":rate>=0.2?"warning":"info",
        code:"missing",
        column:c.name,
        message:`欠損 ${missing}件 (${(rate*100).toFixed(1)}%)`
      });
    }

    const non=vals.filter(v=>v!==null);
    if (non.length && new Set(non.map(String)).size===1) {
      constantColumns++;
      issues.push({level:"warning",code:"constant",column:c.name,message:"値が一定です。分析変数には適しません。"});
    }

    if (c.kind==="numeric") {
      const invalid=non.filter(v=>!Number.isFinite(v)).length;
      mixedNumericCells+=invalid;
      if (invalid) {
        issues.push({
          level:invalid/non.length>=0.1?"error":"warning",
          code:"mixed_numeric",
          column:c.name,
          message:`数値列に解釈できない値が ${invalid}件あります。元の値を保持したまま分析対象から除外される可能性があります。`
        });
        suggestions.push({
          action:"review_numeric_type",
          column:c.name,
          destructive:false,
          message:"数値として解釈できないセルを確認してください。自動で欠損値には置換していません。"
        });
      }
    }
  }

  const seen=new Set(), dup=[];
  ds.rows.forEach((r,i)=>{
    const key=JSON.stringify(r);
    if (seen.has(key)) dup.push(i+1); else seen.add(key);
  });
  const duplicateRate=rows ? dup.length/rows : 0;
  if (dup.length) {
    issues.push({
      level:duplicateRate>=0.2?"error":"warning",
      code:"duplicate_rows",
      message:`完全重複行 ${dup.length}件 (${(duplicateRate*100).toFixed(1)}%)`
    });
    suggestions.push({action:"review_duplicates", destructive:true, message:"重複行の削除は自動実行しません。意味上の重複か確認してください。"});
  }

  for (const name of numericColumns(ds)) {
    const xs=ds.rows.map(r=>r[name]).filter(Number.isFinite);
    if (xs.length<4) continue;
    const q1=quantile(xs,0.25), q3=quantile(xs,0.75), iqr=q3-q1;
    if (iqr===0) continue;
    const lo=q1-1.5*iqr, hi=q3+1.5*iqr;
    const out=xs.filter(x=>x<lo || x>hi).length;
    if (out) {
      issues.push({level:"info",code:"potential_outlier",column:name,message:`IQR基準の外れ候補 ${out}件`});
      suggestions.push({action:"review_outliers",column:name,destructive:true,message:"外れ値は自動削除しません。業務上妥当な値か確認してください。"});
    }
  }

  if (rows<10) issues.push({level:"warning",code:"small_sample",message:"標本数が10未満です。推測統計の結果は不安定になりやすいため注意してください。"});
  else if (rows<30) issues.push({level:"info",code:"small_sample",message:"標本数が30未満です。推測統計の解釈では標本数を考慮してください。"});

  if (cols>=rows && cols>3) {
    issues.push({level:"warning",code:"high_dimensional",message:"列数が観測数以上です。通常の回帰や多変量解析は不安定になる可能性があります。"});
  }

  const missingRate=missingCells/totalCells;
  const constantRate=cols ? constantColumns/cols : 0;
  const mixedRate=mixedNumericCells/totalCells;
  let score=100;
  score-=Math.min(40,missingRate*80);
  score-=Math.min(20,duplicateRate*50);
  score-=Math.min(20,constantRate*35);
  score-=Math.min(20,mixedRate*100);
  if (rows<10) score-=12;
  else if (rows<30) score-=5;
  if (cols>=rows && cols>3) score-=8;
  score=Math.round(clamp(score,0,100));

  const critical=[];
  if (rows<3) critical.push("観測数が3件未満です。");
  if (numericColumns(ds).length===0) critical.push("現在の統計モジュールで利用できる数値列がありません。");
  if (missingRate>=0.6) critical.push("データ全体の欠損率が60%以上です。");
  if (constantRate>=0.8 && cols>1) critical.push("大部分の列が一定値です。");

  const errorCount=issues.filter(i=>i.level==="error").length;
  const warningCount=issues.filter(i=>i.level==="warning").length;
  const gate=critical.length ? "block" : (score<80 || errorCount || warningCount ? "warn" : "pass");
  const label=gate==="pass" ? "分析準備良好" : gate==="warn" ? "注意して分析" : "分析前に要確認";

  const quality={
    score,
    gate,
    label,
    heuristic:true,
    metrics:{
      missingRate,
      duplicateRate,
      constantColumnRate:constantRate,
      mixedNumericRate:mixedRate,
      rows,
      columns:cols
    },
    counts:{errors:errorCount,warnings:warningCount,info:issues.filter(i=>i.level==="info").length},
    critical,
    message:gate==="pass"
      ? "大きな品質上の問題は検出されませんでした。"
      : gate==="warn"
        ? "分析は可能ですが、警告内容が結果に影響する可能性があります。"
        : "この状態では推測統計を開始せず、データ構造または品質を確認してください。"
  };

  return {
    issues,
    suggestions,
    quality,
    ready:rows>0 && cols>0,
    analysisAllowed:gate!=="block"
  };
}
