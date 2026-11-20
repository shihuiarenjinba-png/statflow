import { jStat } from "jstat";
import { mean, variance } from "../core/math.js";

function groupsFrom(ds, groupColumn, valueColumn) {
  const groups=new Map();
  for(const row of ds.rows) {
    const g=row[groupColumn], v=row[valueColumn];
    if(g===null || !Number.isFinite(v)) continue;
    const key=String(g);
    if(!groups.has(key)) groups.set(key,[]);
    groups.get(key).push(v);
  }
  return groups;
}
function median(xs){ const s=[...xs].sort((a,b)=>a-b),m=Math.floor(s.length/2);return s.length%2?s[m]:(s[m-1]+s[m])/2; }

export function welchTTest(ds, groupColumn, valueColumn) {
  const groups=groupsFrom(ds,groupColumn,valueColumn);
  if(groups.size!==2) throw new Error("Welch検定には2グループのカテゴリ列が必要です。");
  const [[g1,x1],[g2,x2]]=[...groups.entries()];
  if(x1.length<2||x2.length<2) throw new Error("各グループに2件以上の数値が必要です。");
  const m1=mean(x1),m2=mean(x2),v1=variance(x1),v2=variance(x2);
  const se2=v1/x1.length+v2/x2.length;
  if(se2===0) throw new Error("両グループの分散が0のためWelch検定を計算できません。");
  const t=(m1-m2)/Math.sqrt(se2);
  const df=(se2**2)/((v1/x1.length)**2/(x1.length-1)+(v2/x2.length)**2/(x2.length-1));
  const p=2*(1-jStat.studentt.cdf(Math.abs(t),df));
  return {method:"Welch two-sample t-test",groupColumn,valueColumn,groups:[{name:g1,n:x1.length,mean:m1},{name:g2,n:x2.length,mean:m2}],difference:m1-m2,t,df,p};
}

export function mannWhitneyU(ds, groupColumn, valueColumn) {
  const groups=groupsFrom(ds,groupColumn,valueColumn);
  if(groups.size!==2) throw new Error("Mann–Whitney U検定には2グループが必要です。");
  const [[g1,x1],[g2,x2]]=[...groups.entries()];
  if(x1.length<2||x2.length<2) throw new Error("各グループに2件以上の数値が必要です。");
  const items=[...x1.map((value,i)=>({value,id:`a${i}`,group:0})),...x2.map((value,i)=>({value,id:`b${i}`,group:1}))];
  const sorted=[...items].sort((a,b)=>a.value-b.value), rank=new Map(), ties=[];
  let i=0;
  while(i<sorted.length){let j=i+1;while(j<sorted.length&&sorted[j].value===sorted[i].value)j++;const avg=((i+1)+j)/2;if(j-i>1)ties.push(j-i);for(let k=i;k<j;k++)rank.set(sorted[k].id,avg);i=j;}
  const n1=x1.length,n2=x2.length,n=n1+n2;
  const r1=items.filter(x=>x.group===0).reduce((s,x)=>s+rank.get(x.id),0);
  const u1=r1-n1*(n1+1)/2,u2=n1*n2-u1,u=Math.min(u1,u2),meanU=n1*n2/2;
  const tieTerm=ties.reduce((s,t)=>s+(t**3-t),0);
  const varU=(n1*n2/12)*((n+1)-tieTerm/(n*(n-1)));
  if(varU<=0) throw new Error("順位の分散が0のためMann–Whitney U検定を計算できません。");
  const z=(Math.abs(u-meanU)-0.5)/Math.sqrt(varU);
  const p=Math.min(1,2*(1-jStat.normal.cdf(Math.abs(z),0,1)));
  return {method:"Mann–Whitney U test",groupColumn,valueColumn,U:u,z,p,groups:[{name:g1,n:n1,median:median(x1)},{name:g2,n:n2,median:median(x2)}]};
}

export function oneWayAnova(ds, groupColumn, valueColumn) {
  const groups=groupsFrom(ds,groupColumn,valueColumn);
  const entries=[...groups.entries()].filter(([,xs])=>xs.length>=2);
  if(entries.length<2) throw new Error("ANOVAには少なくとも2グループで各2件以上の観測が必要です。");
  const all=entries.flatMap(([,xs])=>xs), grand=mean(all);
  const ssBetween=entries.reduce((s,[,xs])=>s+xs.length*(mean(xs)-grand)**2,0);
  const ssWithin=entries.reduce((s,[,xs])=>{const m=mean(xs);return s+xs.reduce((a,x)=>a+(x-m)**2,0);},0);
  const dfBetween=entries.length-1,dfWithin=all.length-entries.length;
  if(dfWithin<=0||ssWithin===0) throw new Error("群内分散が0、または自由度不足のためANOVAを計算できません。");
  const F=(ssBetween/dfBetween)/(ssWithin/dfWithin),p=1-jStat.centralF.cdf(F,dfBetween,dfWithin);
  return {method:"One-way ANOVA",groupColumn,valueColumn,F,p,dfBetween,dfWithin,groups:entries.map(([name,xs])=>({name,n:xs.length,mean:mean(xs)}))};
}
