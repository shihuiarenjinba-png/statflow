import { numericColumns } from "./canonical.js";

function uniqueName(ds, base) {
  const used=new Set(ds.columns.map(c=>c.name));
  if(!used.has(base)) return base;
  let i=2;
  while(used.has(`${base}_${i}`)) i++;
  return `${base}_${i}`;
}

function skewness(xs) {
  if(xs.length<3) return NaN;
  const m=xs.reduce((s,x)=>s+x,0)/xs.length;
  const m2=xs.reduce((s,x)=>s+(x-m)**2,0)/xs.length;
  if(m2===0) return 0;
  const m3=xs.reduce((s,x)=>s+(x-m)**3,0)/xs.length;
  return m3/(m2**1.5);
}

export function suggestLogTransforms(ds) {
  const suggestions=[];
  for(const column of numericColumns(ds)) {
    const xs=ds.rows.map(r=>r[column]).filter(Number.isFinite);
    if(xs.length<8) continue;
    const skew=skewness(xs), min=Math.min(...xs);
    if(skew>1 && min>0) suggestions.push({
      column, transform:"ln", skewness:skew,
      reason:`正の値のみで右裾が長い分布です（歪度 ${skew.toFixed(2)}）。対数変換を検討できます。`
    });
    else if(skew>1 && min>=0) suggestions.push({
      column, transform:"log1p", skewness:skew,
      reason:`0を含む右裾の長い分布です（歪度 ${skew.toFixed(2)}）。log(1+x)を検討できます。`
    });
  }
  return suggestions;
}

export function addLogTransform(ds, column, transform="ln") {
  if(!numericColumns(ds).includes(column)) throw new Error("対数変換には数値列を選択してください。");
  const nonNull=ds.rows.map(r=>r[column]).filter(v=>v!==null);
  if(nonNull.some(v=>!Number.isFinite(v))) throw new Error("選択列に数値として解釈できない値があります。先にデータ品質警告を確認してください。");
  const fn=transform==="ln" ? Math.log : transform==="log10" ? Math.log10 : transform==="log1p" ? Math.log1p : null;
  if(!fn) throw new Error("未対応の対数変換です。");
  if(transform==="log1p") {
    if(nonNull.some(v=>v<0)) throw new Error("log(1+x) は現在0以上の値に限定しています。");
  } else if(nonNull.some(v=>v<=0)) {
    throw new Error("ln / log10 は0以下の値を含む列には適用できません。オフセットを自動追加することもしません。");
  }
  const prefix=transform==="ln"?"ln":transform==="log10"?"log10":"log1p";
  const name=uniqueName(ds,`${prefix}_${column}`);
  const rows=ds.rows.map(row=>({...row,[name]:row[column]===null?null:fn(row[column])}));
  const values=rows.map(r=>r[name]).filter(Number.isFinite);
  const columns=[...ds.columns,{
    name,kind:"numeric",nonNull:values.length,unique:new Set(values.map(String)).size,
    parseConfidence:1,derived:true,transform:{type:transform,source:column}
  }];
  return {
    ...ds,columns,rows,kinds:{...ds.kinds,[name]:"numeric"},
    meta:{...ds.meta,columnCount:columns.length},
    audit:[...ds.audit,{type:"manual_transform",transform,source:column,column:name,message:"ユーザー指定で派生列を作成。元列は保持。"}]
  };
}
