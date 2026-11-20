import { mean } from "../core/math.js";
import { numericColumns } from "../core/canonical.js";

export function pearson(x,y) {
  const pairs=x.map((v,i)=>[v,y[i]]).filter(([a,b])=>Number.isFinite(a)&&Number.isFinite(b));
  if (pairs.length<3) return NaN;
  const xs=pairs.map(p=>p[0]), ys=pairs.map(p=>p[1]), mx=mean(xs), my=mean(ys);
  let num=0,dx=0,dy=0;
  for(let i=0;i<xs.length;i++){ const a=xs[i]-mx,b=ys[i]-my; num+=a*b; dx+=a*a; dy+=b*b; }
  return dx&&dy ? num/Math.sqrt(dx*dy) : NaN;
}

export function correlationMatrix(ds) {
  const names=numericColumns(ds);
  return {
    variables:names,
    matrix:names.map(a=>names.map(b=>pearson(ds.rows.map(r=>r[a]),ds.rows.map(r=>r[b]))))
  };
}
