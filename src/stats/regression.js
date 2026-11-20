import { jStat } from "jstat";
import { mean, matMul, matVec, transpose, inverse, addDiagonal } from "../core/math.js";

function completeRows(ds,target,predictors) {
  return ds.rows.map(r=>({y:r[target],x:predictors.map(p=>r[p])}))
    .filter(r=>Number.isFinite(r.y)&&r.x.every(Number.isFinite));
}

function buildX(rows){ return rows.map(r=>[1,...r.x]); }

export function multipleOLS(ds,target,predictors) {
  const data=completeRows(ds,target,predictors);
  const p=predictors.length+1;
  if(data.length<=p) throw new Error("回帰に必要な完全観測数が不足しています。");
  const X=buildX(data), y=data.map(r=>r.y), Xt=transpose(X), XtX=matMul(Xt,X);
  let inv;
  try { inv=inverse(XtX); } catch { inv=inverse(addDiagonal(XtX,1e-9)); }
  const beta=matVec(inv, matVec(Xt,y));
  const fit=matVec(X,beta), resid=y.map((v,i)=>v-fit[i]), ym=mean(y);
  const sse=resid.reduce((s,e)=>s+e*e,0), sst=y.reduce((s,v)=>s+(v-ym)**2,0);
  const r2=sst?1-sse/sst:NaN, df=data.length-p, sigma2=sse/df;
  const se=inv.map((r,i)=>Math.sqrt(Math.max(0,r[i]*sigma2)));
  const terms=["Intercept",...predictors].map((term,i)=>{
    const t=beta[i]/se[i];
    const pv=2*(1-jStat.studentt.cdf(Math.abs(t),df));
    return {term,coefficient:beta[i],se:se[i],t,p:pv};
  });
  return {method:"Multiple OLS",target,predictors,n:data.length,r2,adjustedR2:1-(1-r2)*(data.length-1)/df,df,terms};
}

export function ridgeRegression(ds,target,predictors,lambda=1) {
  const data=completeRows(ds,target,predictors);
  if(data.length<=predictors.length+1) throw new Error("Ridge回帰に必要な完全観測数が不足しています。");
  const X=buildX(data), y=data.map(r=>r.y), Xt=transpose(X), XtX=matMul(Xt,X);
  const penalized=addDiagonal(XtX,lambda,true);
  const beta=matVec(inverse(penalized),matVec(Xt,y));
  const fit=matVec(X,beta), ym=mean(y);
  const sse=y.reduce((s,v,i)=>s+(v-fit[i])**2,0), sst=y.reduce((s,v)=>s+(v-ym)**2,0);
  return {method:"Ridge regression",target,predictors,lambda,n:data.length,r2:sst?1-sse/sst:NaN,terms:["Intercept",...predictors].map((term,i)=>({term,coefficient:beta[i]}))};
}
