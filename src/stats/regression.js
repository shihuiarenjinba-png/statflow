import { jStat } from "jstat";
import { mean, sd, matMul, matVec, transpose, inverse, addDiagonal } from "../core/math.js";

function completeRows(ds,target,predictors){return ds.rows.map(r=>({y:r[target],x:predictors.map(p=>r[p])})).filter(r=>Number.isFinite(r.y)&&r.x.every(Number.isFinite));}
function buildX(rows){return rows.map(r=>[1,...r.x]);}

export function multipleOLS(ds,target,predictors) {
  const data=completeRows(ds,target,predictors),p=predictors.length+1;
  if(data.length<=p) throw new Error("回帰に必要な完全観測数が不足しています。");
  const X=buildX(data),y=data.map(r=>r.y),Xt=transpose(X),XtX=matMul(Xt,X);
  let inv;try{inv=inverse(XtX);}catch{inv=inverse(addDiagonal(XtX,1e-9));}
  const beta=matVec(inv,matVec(Xt,y)),fit=matVec(X,beta),resid=y.map((v,i)=>v-fit[i]),ym=mean(y);
  const sse=resid.reduce((s,e)=>s+e*e,0),sst=y.reduce((s,v)=>s+(v-ym)**2,0),r2=sst?1-sse/sst:NaN,df=data.length-p,sigma2=sse/df;
  const se=inv.map((r,i)=>Math.sqrt(Math.max(0,r[i]*sigma2)));
  const terms=["Intercept",...predictors].map((term,i)=>{const t=beta[i]/se[i],pv=2*(1-jStat.studentt.cdf(Math.abs(t),df));return{term,coefficient:beta[i],se:se[i],t,p:pv};});
  return {method:"Multiple OLS",target,predictors,n:data.length,r2,adjustedR2:1-(1-r2)*(data.length-1)/df,df,terms};
}

export function ridgeRegression(ds,target,predictors,lambda=1) {
  const data=completeRows(ds,target,predictors);
  if(data.length<=predictors.length+1) throw new Error("Ridge回帰に必要な完全観測数が不足しています。");
  const X=buildX(data),y=data.map(r=>r.y),Xt=transpose(X),beta=matVec(inverse(addDiagonal(matMul(Xt,X),lambda,true)),matVec(Xt,y));
  const fit=matVec(X,beta),ym=mean(y),sse=y.reduce((s,v,i)=>s+(v-fit[i])**2,0),sst=y.reduce((s,v)=>s+(v-ym)**2,0);
  return {method:"Ridge regression",target,predictors,lambda,n:data.length,r2:sst?1-sse/sst:NaN,terms:["Intercept",...predictors].map((term,i)=>({term,coefficient:beta[i]}))};
}

function softThreshold(v,t){return v>t?v-t:v<-t?v+t:0;}

export function elasticNetRegression(ds,target,predictors,{lambda=0.1,alpha=0.5,maxIter=3000,tol=1e-8}={}) {
  lambda=Number(lambda);alpha=Number(alpha);
  if(!(lambda>=0)||!(alpha>=0&&alpha<=1)) throw new Error("Elastic Netは lambda>=0、0<=alpha<=1 が必要です。");
  const data=completeRows(ds,target,predictors);
  if(data.length<=predictors.length+1) throw new Error("正則化回帰に必要な完全観測数が不足しています。");
  const n=data.length,p=predictors.length,xMeans=Array.from({length:p},(_,j)=>mean(data.map(r=>r.x[j]))),xSds=Array.from({length:p},(_,j)=>sd(data.map(r=>r.x[j])));
  if(xSds.some(s=>!Number.isFinite(s)||s===0)) throw new Error("説明変数に分散0の列が含まれています。");
  const y=data.map(r=>r.y),ym=mean(y),yc=y.map(v=>v-ym),X=data.map(r=>r.x.map((v,j)=>(v-xMeans[j])/xSds[j])),beta=Array(p).fill(0),pred=Array(n).fill(0);
  for(let iter=0;iter<maxIter;iter++){let maxChange=0;for(let j=0;j<p;j++){let rho=0,z=0;for(let i=0;i<n;i++){const x=X[i][j],partial=yc[i]-(pred[i]-x*beta[j]);rho+=x*partial;z+=x*x;}rho/=n;z/=n;const next=softThreshold(rho,lambda*alpha)/(z+lambda*(1-alpha)),delta=next-beta[j];if(delta!==0)for(let i=0;i<n;i++)pred[i]+=X[i][j]*delta;beta[j]=next;maxChange=Math.max(maxChange,Math.abs(delta));}if(maxChange<tol)break;}
  const coef=beta.map((b,j)=>b/xSds[j]),intercept=ym-coef.reduce((s,b,j)=>s+b*xMeans[j],0),fit=data.map(r=>intercept+r.x.reduce((s,x,j)=>s+x*coef[j],0));
  const sse=y.reduce((s,v,i)=>s+(v-fit[i])**2,0),sst=y.reduce((s,v)=>s+(v-ym)**2,0);
  const method=alpha===1?"Lasso regression":alpha===0?"Ridge-like elastic net":"Elastic Net regression";
  return {method,target,predictors,lambda,alpha,n:data.length,r2:sst?1-sse/sst:NaN,terms:[{term:"Intercept",coefficient:intercept},...predictors.map((term,j)=>({term,coefficient:coef[j]}))]};
}
export const lassoRegression=(ds,target,predictors,lambda=0.1)=>elasticNetRegression(ds,target,predictors,{lambda,alpha:1});
