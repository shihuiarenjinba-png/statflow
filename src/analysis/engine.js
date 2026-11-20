import { describeDataset } from "../stats/descriptive.js";
import { correlationMatrix, spearmanMatrix } from "../stats/correlation.js";
import { welchTTest, mannWhitneyU, oneWayAnova } from "../stats/comparison.js";
import { chiSquareIndependence } from "../stats/categorical.js";
import { multipleOLS, ridgeRegression, lassoRegression, elasticNetRegression } from "../stats/regression.js";
import { pca } from "../stats/pca.js";
import { recommend } from "./recommender.js";
import { validateDataset } from "../core/validation.js";

const autoMode=m=>m==="auto"||m==="basic"||!m;
const predictorsFor=(ds,target,max=20)=>ds.columns.filter(c=>c.kind==="numeric"&&c.name!==target).map(c=>c.name).slice(0,max);
const finiteParam=(value,fallback)=>{const n=Number(value);return Number.isFinite(n)?n:fallback;};
const cleanPredictors=(items,target)=>items.filter((v,i,a)=>v!==target&&a.indexOf(v)===i);

export function runAnalysis(ds,request){
  const mode=request.mode||"auto";let spec={...request};
  if(autoMode(mode)){const rec=recommend(ds,request.goal,request.target,request.group,request.group2);if(!rec.method)throw new Error(rec.reason);spec={...spec,...rec,recommendation:rec};}
  const validation=validateDataset(ds);
  const overview=spec.method==="descriptive"||(autoMode(mode)&&request.goal==="overview");
  if(validation.quality.gate==="block"&&!overview)throw new Error(`データ品質ゲートにより推測分析を停止しました。 ${validation.quality.critical.join(" ")}`);
  let result;
  switch(spec.method){
    case"descriptive":result=describeDataset(ds);break;
    case"correlation":result=correlationMatrix(ds);break;
    case"spearman":result=spearmanMatrix(ds);break;
    case"welch":result=welchTTest(ds,spec.group,spec.target);break;
    case"mannwhitney":result=mannWhitneyU(ds,spec.group,spec.target);break;
    case"anova":result=oneWayAnova(ds,spec.group,spec.target);break;
    case"chisquare":result=chiSquareIndependence(ds,spec.group,spec.group2);break;
    case"ols":{const predictors=cleanPredictors(spec.predictors?.length?spec.predictors:predictorsFor(ds,spec.target,12),spec.target);result=multipleOLS(ds,spec.target,predictors);spec={...spec,predictors};break;}
    case"ridge":{const predictors=cleanPredictors(spec.predictors?.length?spec.predictors:predictorsFor(ds,spec.target),spec.target);result=ridgeRegression(ds,spec.target,predictors,finiteParam(spec.lambda,1));spec={...spec,predictors};break;}
    case"lasso":{const predictors=cleanPredictors(spec.predictors?.length?spec.predictors:predictorsFor(ds,spec.target),spec.target);result=lassoRegression(ds,spec.target,predictors,finiteParam(spec.lambda,0.1));spec={...spec,predictors};break;}
    case"elasticnet":{const predictors=cleanPredictors(spec.predictors?.length?spec.predictors:predictorsFor(ds,spec.target),spec.target);result=elasticNetRegression(ds,spec.target,predictors,{lambda:finiteParam(spec.lambda,0.1),alpha:finiteParam(spec.alpha,0.5)});spec={...spec,predictors};break;}
    case"pca":result=pca(ds,spec.predictors,Number(spec.components)||5);break;
    default:throw new Error("未対応の分析手法です。");
  }
  return{result,spec,quality:validation.quality};
}

export function explain(r){
  if(Array.isArray(r))return`${r.length}個の数値変数について記述統計を計算しました。`;
  if(r.method==="Welch two-sample t-test")return`2群の平均差をWelch検定で比較しました。p=${r.p.toPrecision(3)}。`;
  if(r.method==="Mann–Whitney U test")return`2群の順位差をMann–Whitney U検定で比較しました。U=${r.U.toFixed(2)}、p=${r.p.toPrecision(3)}。`;
  if(r.method==="One-way ANOVA")return`${r.groups.length}群の平均差を一元配置ANOVAで比較しました。F=${r.F.toFixed(3)}、p=${r.p.toPrecision(3)}。`;
  if(r.method==="Chi-square test of independence")return`カテゴリ変数の独立性を検定しました。χ²=${r.chi2.toFixed(3)}、p=${r.p.toPrecision(3)}。${r.lowExpectedCells?"期待度数5未満のセルがあるため注意が必要です。":""}`;
  if(r.method==="Multiple OLS")return`完全観測${r.n}件で重回帰を実行しました。R²=${r.r2.toFixed(3)}。`;
  if(r.method==="Ridge regression")return`λ=${r.lambda} のRidge回帰です。`;
  if(r.method==="Lasso regression")return`λ=${r.lambda} のLasso回帰です。L1正則化で一部係数が0になる可能性があります。`;
  if(r.method==="Elastic Net regression"||r.method==="Ridge-like elastic net")return`λ=${r.lambda}、α=${r.alpha} のElastic Netです。`;
  if(r.method==="PCA")return`標準化後にPCAを実行しました。第1主成分の寄与率は${(r.components[0].explained*100).toFixed(1)}%です。`;
  if(r.method==="Spearman rank correlation")return`${r.variables.length}変数のSpearman順位相関です。`;
  if(r.matrix)return`${r.variables.length}変数のPearson相関行列です。`;
  return"分析を完了しました。";
}
