import { jStat } from "jstat";

export function chiSquareIndependence(ds, columnA, columnB) {
  if(!columnA||!columnB||columnA===columnB) throw new Error("異なる2つのカテゴリ列を選択してください。");
  const rows=[...new Set(ds.rows.map(r=>r[columnA]).filter(v=>v!==null).map(String))];
  const cols=[...new Set(ds.rows.map(r=>r[columnB]).filter(v=>v!==null).map(String))];
  if(rows.length<2||cols.length<2) throw new Error("カイ二乗検定には各変数で2カテゴリ以上が必要です。");
  const ri=Object.fromEntries(rows.map((v,i)=>[v,i])),ci=Object.fromEntries(cols.map((v,i)=>[v,i]));
  const counts=rows.map(()=>cols.map(()=>0));let n=0;
  for(const row of ds.rows){const a=row[columnA],b=row[columnB];if(a===null||b===null)continue;counts[ri[String(a)]][ci[String(b)]]++;n++;}
  const rt=counts.map(r=>r.reduce((s,x)=>s+x,0)),ct=cols.map((_,j)=>counts.reduce((s,r)=>s+r[j],0));
  let chi2=0,lowExpectedCells=0;
  for(let i=0;i<rows.length;i++)for(let j=0;j<cols.length;j++){const e=rt[i]*ct[j]/n;if(e<5)lowExpectedCells++;if(e>0)chi2+=(counts[i][j]-e)**2/e;}
  const df=(rows.length-1)*(cols.length-1),p=1-jStat.chisquare.cdf(chi2,df);
  return {method:"Chi-square test of independence",columns:[columnA,columnB],n,chi2,df,p,rows,cols,counts,lowExpectedCells};
}
