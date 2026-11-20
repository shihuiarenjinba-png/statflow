import { describeDataset } from "../stats/descriptive.js";
import { correlationMatrix } from "../stats/correlation.js";
import { welchTTest } from "../stats/comparison.js";
import { multipleOLS, ridgeRegression } from "../stats/regression.js";
import { pca } from "../stats/pca.js";
import { recommend } from "./recommender.js";
import { validateDataset } from "../core/validation.js";

function isOverviewRequest(mode, request, spec) {
  return spec.method==="descriptive" || (mode==="basic" && request.goal==="overview");
}

export function runAnalysis(ds, request) {
  const mode=request.mode || "basic";
  let spec={...request};
  if(mode==="basic") {
    const rec=recommend(ds,request.goal,request.target,request.group);
    if(!rec.method) throw new Error(rec.reason);
    spec={...spec,...rec,recommendation:rec};
  }

  const validation=validateDataset(ds);
  if (validation.quality.gate==="block" && !isOverviewRequest(mode,request,spec)) {
    const detail=validation.quality.critical.join(" ");
    throw new Error(`データ品質ゲートにより推測分析を停止しました。${detail ? " "+detail : ""}`);
  }

  let result;
  switch(spec.method) {
    case "descriptive": result=describeDataset(ds); break;
    case "correlation": result=correlationMatrix(ds); break;
    case "welch": result=welchTTest(ds,spec.group,spec.target); break;
    case "ols": {
      const predictors=(spec.predictors?.length?spec.predictors:ds.columns.filter(c=>c.kind==="numeric"&&c.name!==spec.target).map(c=>c.name)).slice(0,12);
      result=multipleOLS(ds,spec.target,predictors);
      spec={...spec,predictors};
      break;
    }
    case "ridge": {
      const predictors=(spec.predictors?.length?spec.predictors:ds.columns.filter(c=>c.kind==="numeric"&&c.name!==spec.target).map(c=>c.name)).slice(0,20);
      result=ridgeRegression(ds,spec.target,predictors,Number(spec.lambda)||1);
      spec={...spec,predictors};
      break;
    }
    case "pca": result=pca(ds,spec.predictors,Number(spec.components)||5); break;
    default: throw new Error("未対応の分析手法です。");
  }

  return {result,spec,quality:validation.quality};
}

export function explain(result) {
  if(Array.isArray(result)) return `${result.length}個の数値変数について記述統計を計算しました。`;
  if(result.method==="Welch two-sample t-test") {
    const sig=result.p<0.05;
    return `2群の平均差は ${result.difference.toFixed(4)}、p=${result.p.toPrecision(3)} です。${sig?"5%水準では差が示唆されます。":"5%水準では明確な差を確認できません。"} 因果関係を意味しません。`;
  }
  if(result.method==="Multiple OLS") return `完全観測 ${result.n}件で重回帰を実行しました。R²=${result.r2.toFixed(3)}。係数は他の投入変数を一定とした条件付きの線形関係として解釈してください。`;
  if(result.method==="Ridge regression") return `λ=${result.lambda} のL2正則化回帰です。係数縮小により多重共線性や過学習を抑える方向のモデルです。p値の推測より予測・安定性を重視します。`;
  if(result.method==="PCA") return `標準化後にPCAを実行しました。第1主成分の寄与率は ${(result.components[0].explained*100).toFixed(1)}% です。主成分は元変数の線形結合です。`;
  if(result.matrix) return `${result.variables.length}変数のPearson相関行列です。相関は線形な関連を表し、因果関係を意味しません。`;
  return "分析を完了しました。";
}
