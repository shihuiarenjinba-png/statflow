import { numericColumns, categoricalColumns } from "../core/canonical.js";
export const GOALS=[["overview","データ全体を把握したい"],["compare","グループを比較したい"],["relationship","数値変数同士の関係を見たい"],["categorical","カテゴリ同士に関係があるか見たい"],["drivers","何が目的変数に影響するか見たい"],["structure","データの主要な構造を見たい"]];
const categoryCount=(ds,c)=>c?new Set(ds.rows.map(r=>r[c]).filter(v=>v!==null).map(String)).size:0;
export function recommend(ds,goal,target,group,group2){
  const nums=numericColumns(ds),cats=categoricalColumns(ds);
  if(goal==="overview")return{method:"descriptive",reason:"数値列の分布と欠損をまず把握します。"};
  if(goal==="relationship")return{method:"correlation",reason:"まずPearson相関で線形関係を一覧化します。",alternatives:["spearman"]};
  if(goal==="structure")return{method:"pca",reason:"複数の数値変数を標準化し、主要な変動方向を抽出します。"};
  if(goal==="categorical"){const a=group||cats[0],b=group2||cats.find(c=>c!==a);if(!a||!b)return{method:null,reason:"異なる2つのカテゴリ列が必要です。"};return{method:"chisquare",group:a,group2:b,reason:"2つのカテゴリ変数の独立性を確認します。"};}
  if(goal==="compare"){const g=group||cats[0],y=target||nums[0],k=categoryCount(ds,g);if(!g||!y)return{method:null,reason:"カテゴリ列と数値列が必要です。"};if(k===2)return{method:"welch",group:g,target:y,reason:"2グループなのでWelch検定を既定にします。",alternatives:["mannwhitney"]};if(k>=3)return{method:"anova",group:g,target:y,reason:"3グループ以上なので一元配置ANOVAを既定にします。"};return{method:null,reason:"比較には2グループ以上が必要です。"};}
  if(goal==="drivers"){const y=target||nums[0],xs=nums.filter(n=>n!==y).slice(0,8);if(!y||!xs.length)return{method:null,reason:"目的変数と1列以上の説明変数が必要です。"};return{method:"ols",target:y,predictors:xs,reason:"解釈しやすいOLSを既定にします。",alternatives:["ridge","lasso","elasticnet"]};}
  return{method:"descriptive",reason:"まず記述統計を確認します。"};
}
