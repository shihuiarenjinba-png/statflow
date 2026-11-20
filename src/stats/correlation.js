import { mean } from "../core/math.js";
import { numericColumns } from "../core/canonical.js";

export function pearson(x,y) {
  const pairs=x.map((v,i)=>[v,y[i]]).filter(([a,b])=>Number.isFinite(a)&&Number.isFinite(b));
  if(pairs.length<3) return NaN;
  const xs=pairs.map(p=>p[0]), ys=pairs.map(p=>p[1]), mx=mean(xs), my=mean(ys);
  let num=0,dx=0,dy=0;
  for(let i=0;i<xs.length;i++){ const a=xs[i]-mx,b=ys[i]-my; num+=a*b; dx+=a*a; dy+=b*b; }
  return dx&&dy ? num/Math.sqrt(dx*dy) : NaN;
}

function ranks(values) {
  const indexed=values.map((v,i)=>({v,i})).sort((a,b)=>a.v-b.v);
  const out=Array(values.length);
  let i=0;
  while(i<indexed.length) {
    let j=i+1;
    while(j<indexed.length && indexed[j].v===indexed[i].v) j++;
    const avg=((i+1)+j)/2;
    for(let k=i;k<j;k++) out[indexed[k].i]=avg;
    i=j;
  }
  return out;
}

export function spearman(x,y) {
  const pairs=x.map((v,i)=>[v,y[i]]).filter(([a,b])=>Number.isFinite(a)&&Number.isFinite(b));
  if(pairs.length<3) return NaN;
  return pearson(ranks(pairs.map(p=>p[0])),ranks(pairs.map(p=>p[1])));
}

function matrixFor(ds, fn, method) {
  const names=numericColumns(ds);
  return {method,variables:names,matrix:names.map(a=>names.map(b=>fn(ds.rows.map(r=>r[a]),ds.rows.map(r=>r[b]))))};
}
export const correlationMatrix = ds => matrixFor(ds,pearson,"Pearson correlation");
export const spearmanMatrix = ds => matrixFor(ds,spearman,"Spearman rank correlation");
