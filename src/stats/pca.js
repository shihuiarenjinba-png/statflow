import { mean, sd, transpose, matMul, jacobiEigen } from "../core/math.js";
import { numericColumns } from "../core/canonical.js";

export function pca(ds, selected, maxComponents=5) {
  const names=(selected?.length?selected:numericColumns(ds)).filter(Boolean);
  if(names.length<2) throw new Error("PCAには2列以上の数値変数が必要です。");
  const rows=ds.rows.filter(r=>names.every(n=>Number.isFinite(r[n])));
  if(rows.length<3) throw new Error("PCAには3件以上の完全観測が必要です。");
  const mus=names.map(n=>mean(rows.map(r=>r[n])));
  const sds=names.map(n=>sd(rows.map(r=>r[n])));
  if(sds.some(v=>!Number.isFinite(v)||v===0)) throw new Error("PCA対象に分散0の列が含まれています。");
  const Z=rows.map(r=>names.map((n,j)=>(r[n]-mus[j])/sds[j]));
  const cov=matMul(transpose(Z),Z).map(row=>row.map(v=>v/(Z.length-1)));
  const eig=jacobiEigen(cov);
  const order=eig.values.map((v,i)=>({v,i})).sort((a,b)=>b.v-a.v);
  const total=order.reduce((s,o)=>s+Math.max(0,o.v),0);
  const k=Math.min(maxComponents,names.length);
  const components=order.slice(0,k).map((o,idx)=>({
    component:`PC${idx+1}`,
    eigenvalue:o.v,
    explained:total?Math.max(0,o.v)/total:0,
    loadings:names.map((name,j)=>({variable:name,loading:eig.vectors[j][o.i]}))
  }));
  const scoreVectors=order.slice(0,Math.min(2,k)).map(o=>eig.vectors.map(r=>r[o.i]));
  const scores=Z.map((row,i)=>({row:i+1,...Object.fromEntries(scoreVectors.map((v,j)=>[`PC${j+1}`,row.reduce((s,x,m)=>s+x*v[m],0)]))}));
  return {method:"PCA",standardized:true,n:rows.length,variables:names,components,scores};
}
