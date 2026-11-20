import { numericColumns, categoricalColumns } from "../core/canonical.js";

export const GOALS = [
  ["overview","データ全体を把握したい"],
  ["compare","2グループを比較したい"],
  ["relationship","変数同士の関係を見たい"],
  ["drivers","何が目的変数に影響するか見たい"],
  ["structure","データの主要な構造を見たい"]
];

export function recommend(ds, goal, target, group) {
  const nums=numericColumns(ds), cats=categoricalColumns(ds);
  if(goal==="overview") return {method:"descriptive",reason:"数値列の分布と欠損をまず把握します。"};
  if(goal==="relationship") return {method:"correlation",reason:"数値変数間の線形関係を一覧化します。"};
  if(goal==="structure") return {method:"pca",reason:"複数の数値変数を標準化し、主要な変動方向を抽出します。"};
  if(goal==="compare") {
    const g=group || cats.find(c=>new Set(ds.rows.map(r=>r[c]).filter(v=>v!==null).map(String)).size===2);
    const y=target || nums[0];
    if(!g||!y) return {method:null,reason:"2値カテゴリ列と数値列が必要です。"};
    return {method:"welch",group:g,target:y,reason:"2グループの平均差を、等分散を仮定せず比較します。"};
  }
  if(goal==="drivers") {
    const y=target || nums[0], xs=nums.filter(n=>n!==y).slice(0,8);
    if(!y||!xs.length) return {method:null,reason:"目的変数と1列以上の説明変数が必要です。"};
    return {method:"ols",target:y,predictors:xs,reason:"目的変数と複数の数値説明変数の線形関係を推定します。"};
  }
  return {method:"descriptive",reason:"まず記述統計を確認します。"};
}
