export function auditMarketUniverse(ds, keys, options={}) {
  const columns=Object.fromEntries(ds.columns.map(c=>[c.name,c]));
  const dateKey=keys.find(k=>columns[k]?.kind==="date" || /(date|time|日付|年月|時点)/i.test(k));
  const entityKey=keys.find(k=>k!==dateKey);
  const warnings=[];
  if(!dateKey || !entityKey) {
    warnings.push("市場パネルのユニバース監査には銘柄IDと日付の複合キーが必要です。");
    return {entityKey:entityKey||null,dateKey:dateKey||null,pointInTimeVerified:false,warnings};
  }

  const spans=new Map();
  for(const row of ds.rows) {
    const entity=row[entityKey], date=row[dateKey];
    if(entity===null||entity===undefined||date===null||date===undefined) continue;
    const e=String(entity), d=String(date);
    if(!spans.has(e)) spans.set(e,{first:d,last:d,count:0});
    const s=spans.get(e);
    if(d<s.first) s.first=d;
    if(d>s.last) s.last=d;
    s.count++;
  }
  const all=[...spans.values()];
  const globalFirst=all.length?all.reduce((m,s)=>s.first<m?s.first:m,all[0].first):null;
  const globalLast=all.length?all.reduce((m,s)=>s.last>m?s.last:m,all[0].last):null;
  const laterEntries=all.filter(s=>globalFirst&&s.first>globalFirst).length;
  const earlierExits=all.filter(s=>globalLast&&s.last<globalLast).length;
  const pointInTimeVerified=Boolean(options.pointInTimeUniverseVerified);

  if(!pointInTimeVerified) warnings.push("基準ファイルが各時点の全対象銘柄を含むpoint-in-timeユニバースか未確認です。現在上場銘柄だけから作った履歴ではサバイバーシップバイアスを除けません。");
  if(laterEntries) warnings.push("途中から観測が始まる銘柄があります。IPO・新規採用・データ開始時点を区別してください。");
  if(earlierExits) warnings.push("途中で観測が終わる銘柄があります。上場廃止・指数除外・欠測を区別し、行を自動削除しないでください。");

  return {
    entityKey,dateKey,pointInTimeVerified,
    entities:spans.size,
    globalFirst,globalLast,
    laterEntries,earlierExits,
    warnings
  };
}
