import "./style.css";
import "./analysis.css";
import { ingestFile } from "./core/ingest.js";
import { validateDataset } from "./core/validation.js";
import { numericColumns, categoricalColumns } from "./core/canonical.js";
import { addLogTransform, suggestLogTransforms } from "./core/transform.js";
import { detectCommonKeys, joinMany } from "./prepare/join.js";
import { PREPARE_TEMPLATES, templateDefaults } from "./prepare/templates.js";
import { GOALS } from "./analysis/recommender.js";
import { CUSTOM_METHODS } from "./analysis/catalog.js";
import { runAnalysis, explain } from "./analysis/engine.js";
import { canonicalCsv, downloadText } from "./exporter.js";

const app=document.querySelector("#app");
let dataset=null, validation=null, lastRun=null, currentFile=null;
let auxDatasets=[], prepareReports=[];
let prepareTemplate="standard";
let mode="auto", transposed=false, uiError="";

function esc(v){return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");}
function fmt(v){return typeof v==="number"?(Number.isFinite(v)?Number(v.toPrecision(5)).toString():"—"):(v??"—");}
function table(headers,rows){return `<div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(v=>`<td>${esc(fmt(v))}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;}
function qualityClass(g){return g==="pass"?"quality-pass":g==="warn"?"quality-warn":"quality-block";}
function methodOptions(){
  const levels=["Basic","Intermediate","Advanced"];
  return levels.map(level=>`<optgroup label="${level}">${CUSTOM_METHODS.filter(m=>m.level===level).map(m=>`<option value="${m.value}">${esc(m.label)}</option>`).join("")}</optgroup>`).join("");
}
function selectedPredictors(){
  const el=document.querySelector("#predictors");
  return el?[...el.selectedOptions].map(o=>o.value):undefined;
}

function resultHtml(run){
  const r=run.result;
  if(Array.isArray(r)) return table(["変数","n","欠損","平均","SD","Q1","中央値","Q3"],r.map(x=>[x.variable,x.n,x.missing,x.mean,x.sd,x.q1,x.median,x.q3]));
  if(r.matrix) return table(["",...r.variables],r.variables.map((v,i)=>[v,...r.matrix[i]]));
  if(r.method==="Welch two-sample t-test") return `<div class="metrics"><div><b>p</b><strong>${fmt(r.p)}</strong></div><div><b>t</b><strong>${fmt(r.t)}</strong></div></div>${table(["グループ","n","平均"],r.groups.map(g=>[g.name,g.n,g.mean]))}`;
  if(r.method==="Mann–Whitney U test") return `<div class="metrics"><div><b>p</b><strong>${fmt(r.p)}</strong></div><div><b>U</b><strong>${fmt(r.U)}</strong></div></div>${table(["グループ","n","中央値"],r.groups.map(g=>[g.name,g.n,g.median]))}`;
  if(r.method==="One-way ANOVA") return `<div class="metrics"><div><b>p</b><strong>${fmt(r.p)}</strong></div><div><b>F</b><strong>${fmt(r.F)}</strong></div></div>${table(["グループ","n","平均"],r.groups.map(g=>[g.name,g.n,g.mean]))}`;
  if(r.method==="Chi-square test of independence") return `<div class="metrics"><div><b>p</b><strong>${fmt(r.p)}</strong></div><div><b>χ²</b><strong>${fmt(r.chi2)}</strong></div><div><b>df</b><strong>${r.df}</strong></div></div>${table(["",...r.cols],r.rows.map((name,i)=>[name,...r.counts[i]]))}`;
  if(["Multiple OLS","Ridge regression","Lasso regression","Elastic Net regression","Ridge-like elastic net"].includes(r.method)){
    return `<div class="metrics"><div><b>n</b><strong>${r.n}</strong></div><div><b>R²</b><strong>${fmt(r.r2)}</strong></div>${r.adjustedR2!==undefined?`<div><b>Adj. R²</b><strong>${fmt(r.adjustedR2)}</strong></div>`:""}</div>${table(["項","係数",...(r.method==="Multiple OLS"?["SE","p"]:[])],r.terms.map(t=>[t.term,t.coefficient,...(r.method==="Multiple OLS"?[t.se,t.p]:[])]))}`;
  }
  if(r.method==="PCA") return `${table(["主成分","固有値","寄与率"],r.components.map(c=>[c.component,c.eigenvalue,`${(c.explained*100).toFixed(1)}%`]))}<h4>PC1 loadings</h4>${table(["変数","Loading"],r.components[0].loadings.map(x=>[x.variable,x.loading]))}`;
  return `<pre>${esc(JSON.stringify(r,null,2))}</pre>`;
}

async function loadCurrentFile(){
  if(!currentFile)return;
  uiError="";
  try{
    dataset=await ingestFile(currentFile,undefined,{transpose:transposed});
    validation=validateDataset(dataset);
    lastRun=null;
    auxDatasets=[];
    prepareReports=[];
  }catch(err){
    dataset=null;validation=null;lastRun=null;
    uiError=err?.message||"データの読み込みに失敗しました。";
  }
  render();
}

function render(){
  const nums=dataset?numericColumns(dataset):[];
  const cats=dataset?categoricalColumns(dataset):[];
  const quality=validation?.quality;
  const logSuggestions=dataset?suggestLogTransforms(dataset):[];
  const commonKeys=dataset&&auxDatasets.length?detectCommonKeys([dataset,...auxDatasets]):[];
  const prepareDefaults=templateDefaults(prepareTemplate);
  const marketSafe=Boolean(prepareDefaults.join?.marketSafe);
  app.innerHTML=`
    <header>
      <div><span class="eyebrow">RULE-BASED STATISTICS</span><h1>StatFlow</h1><p>Upload → Normalize → Validate → Prepare → Transform → Analyze → Explain → Export</p></div>
      <div class="mode-switch">${[["auto","Auto"],["custom","Custom"]].map(([m,l])=>`<button data-mode="${m}" class="${mode===m?"active":""}">${l}</button>`).join("")}</div>
    </header>
    <main>
      <aside>
        <div class="step done"><span>01</span><div><b>Upload</b><small>${dataset?esc(dataset.source.fileName):"CSV / Excel"}</small></div></div>
        <div class="step ${dataset?"done":""}"><span>02</span><div><b>Normalize</b><small>Canonical Dataset</small></div></div>
        <div class="step ${validation?"done":""}"><span>03</span><div><b>Validate</b><small>Quality gate</small></div></div>
        <div class="step ${dataset?"done":""}"><span>04</span><div><b>Prepare</b><small>Template / Join</small></div></div>
        <div class="step ${dataset?"done":""}"><span>05</span><div><b>Transform</b><small>Explicit only</small></div></div>
        <div class="step ${lastRun?"done":""}"><span>06</span><div><b>Analyze</b><small>Fixed rules / Custom</small></div></div>
        <div class="step ${lastRun?"done":""}"><span>07</span><div><b>Export</b><small>CSV / JSON</small></div></div>
      </aside>
      <section class="workspace">
        <div class="card upload-card"><div><h2>データを読み込む</h2><p>CSV / XLSX / XLSをブラウザ内で処理します。サーバーAIは使用しません。</p></div><div class="upload-actions">${dataset?`<button id="transpose" class="secondary">${transposed?"転置を戻す":"行列を転置"}</button>`:""}<label class="upload-button">ファイルを選択<input id="file" type="file" accept=".csv,.xlsx,.xls,.txt"></label></div></div>
        ${uiError?`<div class="inline-error"><b>処理を完了できませんでした</b><span>${esc(uiError)}</span></div>`:""}
        ${dataset?`
          <div class="grid">
            <div class="card"><span class="eyebrow">DATA CONTRACT</span><h3>Canonical Dataset v${dataset.contractVersion}</h3><div class="metrics"><div><b>Rows</b><strong>${dataset.meta.rowCount}</strong></div><div><b>Columns</b><strong>${dataset.meta.columnCount}</strong></div></div><div class="chips">${dataset.columns.map(c=>`<span>${esc(c.name)}<em>${esc(c.kind)}${c.derived?" · derived":""}</em></span>`).join("")}</div></div>
            <div class="card quality-card ${qualityClass(quality.gate)}"><div class="quality-head"><div><span class="eyebrow">DATA QUALITY</span><h3>${esc(quality.label)}</h3></div><div class="quality-score"><strong>${quality.score}</strong><span>/100</span></div></div><p>${esc(quality.message)}</p><div class="quality-meta"><span>欠損 ${(quality.metrics.missingRate*100).toFixed(1)}%</span><span>重複 ${(quality.metrics.duplicateRate*100).toFixed(1)}%</span><span>警告 ${quality.counts.warnings}</span><span>エラー ${quality.counts.errors}</span></div></div>
          </div>
          <div class="card"><span class="eyebrow">QUALITY DETAILS</span><h3>修正と警告</h3><div class="issues">${validation.issues.length?validation.issues.slice(0,12).map(i=>`<div class="issue ${i.level}"><b>${esc(i.column||i.code)}</b><span>${esc(i.message)}</span></div>`).join(""):'<p class="ok">大きな品質警告はありません。</p>'}</div><p class="guard">欠損補完・外れ値削除・重複削除など、結果を変える修正は自動実行しません。</p></div>

          <div class="card"><span class="eyebrow">PREPARE</span><h3>テンプレートと複数ファイル結合</h3>
            <p>整形後の分析構造を明示的に作ります。結合は固定ルールで実行し、行の脱落を監査します。</p>
            <div class="controls prepare-controls">
              <label>テンプレート<select id="prepareTemplate">\${PREPARE_TEMPLATES.map(t=>\`<option value="\${t.id}" \${t.id===prepareTemplate?"selected":""}>\${esc(t.label)}</option>\`).join("")}</select></label>
              <label>追加ファイル<input id="prepareFiles" type="file" accept=".csv,.xlsx,.xls,.txt" multiple></label>
              <label class="wide-control">共通キー<select id="prepareKeys" multiple>\${commonKeys.map(k=>\`<option value="\${esc(k)}" selected>\${esc(k)}</option>\`).join("")}</select></label>
              <label>Join<select id="joinHow"><option value="left" \${prepareDefaults.join?.how==="left"?"selected":""}>left（基準を保持）</option><option value="outer">outer（両方保持）</option><option value="inner">inner（共通のみ）</option></select></label>
              \${marketSafe?'<label class="risk-control"><input id="allowRiskyInner" type="checkbox">市場データで危険なinner joinを明示許可</label>':""}
              <button id="applyTemplate" class="secondary">テンプレート適用</button>
              <button id="runPrepare" class="primary" \${auxDatasets.length?"":"disabled"}>結合を実行</button>
            </div>
            <div class="prepare-status">
              <span>追加ファイル \${auxDatasets.length}件</span>
              \${prepareTemplate==="market_panel"?'<span class="market-guard">市場安全モード：inner joinは既定禁止</span>':""}
            </div>
            \${prepareReports.length?\`<div class="join-reports">\${prepareReports.map((r,i)=>\`<div><b>Join \${i+1}</b><span>\${esc(r.how)} / matched \${r.matched} / base-only \${r.leftOnly} / right-only \${r.rightOnly} / result \${r.resultRows}</span>\${r.warnings?.map(w=>\`<small>\${esc(w)}</small>\`).join("")||""}</div>\`).join("")}</div>\`:""}
          </div>

          <div class="card"><span class="eyebrow">OPTIONAL TRANSFORM</span><h3>対数変換</h3><p>元列を残したまま派生列を追加します。Autoでも自動適用しません。</p>
            ${logSuggestions.length?`<div class="transform-suggestions">${logSuggestions.slice(0,4).map(s=>`<div><b>${esc(s.column)}</b><span>${esc(s.reason)}</span></div>`).join("")}</div>`:'<p class="heuristic-note">現在、強い右歪みによる対数変換候補は検出されていません。</p>'}
            <div class="controls transform-controls"><label>数値列<select id="transformColumn">${nums.map(n=>`<option>${esc(n)}</option>`).join("")}</select></label><label>変換<select id="transformType"><option value="ln">ln(x)</option><option value="log10">log10(x)</option><option value="log1p">log(1+x)</option></select></label><button id="applyTransform" class="secondary">派生列を追加</button></div>
          </div>

          <div class="card"><span class="eyebrow">${mode.toUpperCase()} MODE</span><h2>${mode==="auto"?"目的から分析を選ぶ":"分析手法を自分で選ぶ"}</h2>
            ${quality.gate==="warn"?'<div class="analysis-warning">品質警告があります。結果の解釈前に確認してください。</div>':""}
            ${quality.gate==="block"?'<div class="analysis-block">品質ゲートはBLOCKです。記述統計以外を停止します。</div>':""}
            <div class="controls analysis-controls">
              ${mode==="auto"?`<label>目的<select id="goal">${GOALS.map(([v,l])=>`<option value="${v}">${esc(l)}</option>`).join("")}</select></label>`:`<label>手法<select id="method">${methodOptions()}</select></label>`}
              <label>数値目的変数<select id="target"><option value="">自動 / 未指定</option>${nums.map(n=>`<option>${esc(n)}</option>`).join("")}</select></label>
              <label>カテゴリ1<select id="group"><option value="">自動 / 未指定</option>${cats.map(n=>`<option>${esc(n)}</option>`).join("")}</select></label>
              <label>カテゴリ2<select id="group2"><option value="">自動 / 未指定</option>${cats.map(n=>`<option>${esc(n)}</option>`).join("")}</select></label>
              ${mode==="custom"?`<label class="wide-control">説明変数（複数選択）<select id="predictors" multiple>${nums.map(n=>`<option value="${esc(n)}">${esc(n)}</option>`).join("")}</select></label><label>λ<input id="lambda" type="number" min="0" step="0.05" value="0.1"></label><label>α<input id="alpha" type="number" min="0" max="1" step="0.1" value="0.5"></label>`:""}
              <button id="run" class="primary">分析を実行</button>
            </div>
            <p class="boundary">${mode==="auto"?"AutoはAIではなく固定ルールです。データ型と目的から保守的な手法を選び、対数化・削除・補完・標本変更は勝手に行いません。":"CustomはBasic / Intermediate / Advancedの手法を直接選択できます。"}</p>
          </div>

          ${lastRun?`<div class="card result-card"><span class="eyebrow">RESULT</span><h2>${esc(lastRun.result.method||"Descriptive statistics")}</h2>${lastRun.quality?.gate==="warn"?'<div class="result-caution">品質警告があるデータから計算されています。</div>':""}<div class="explanation">${esc(explain(lastRun.result))}</div>${resultHtml(lastRun)}</div>`:""}
          <div class="card export-card"><div><h3>Export</h3><p>派生列を含むCanonical CSVと分析結果JSONを保存できます。</p></div><div><button id="csvExport">Clean CSV</button><button id="jsonExport" ${lastRun?"":"disabled"}>Result JSON</button></div></div>
        `:""}
      </section>
    </main>`;

  document.querySelectorAll("[data-mode]").forEach(b=>b.onclick=()=>{mode=b.dataset.mode;lastRun=null;uiError="";render();});
  document.querySelector("#file").onchange=async e=>{currentFile=e.target.files?.[0]||null;transposed=false;await loadCurrentFile();};
  document.querySelector("#transpose")?.addEventListener("click",async()=>{transposed=!transposed;await loadCurrentFile();});
  if(dataset){
    document.querySelector("#prepareTemplate")?.addEventListener("change",e=>{prepareTemplate=e.target.value;prepareReports=[];uiError="";render();});
    document.querySelector("#prepareFiles")?.addEventListener("change",async e=>{
      try{
        auxDatasets=[];
        for(const file of [...(e.target.files||[])]) auxDatasets.push(await ingestFile(file));
        prepareReports=[];uiError="";
      }catch(err){auxDatasets=[];uiError=err?.message||"追加ファイルを読み込めませんでした。";}
      render();
    });
    document.querySelector("#applyTemplate")?.addEventListener("click",async()=>{
      try{
        if(prepareTemplate==="transposed"&&!transposed){transposed=true;await loadCurrentFile();return;}
        uiError="";
      }catch(err){uiError=err?.message||"テンプレートを適用できませんでした。";}
      render();
    });
    document.querySelector("#runPrepare")?.addEventListener("click",()=>{
      try{
        const keys=[...document.querySelector("#prepareKeys").selectedOptions].map(o=>o.value);
        const defaults=templateDefaults(prepareTemplate);
        if(defaults.join?.requireCompositeKey&&keys.length<2) throw new Error("このテンプレートでは2列以上の複合キーを選択してください。");
        const how=document.querySelector("#joinHow").value;
        dataset=joinMany([dataset,...auxDatasets],{
          keys,how,
          marketSafe:Boolean(defaults.join?.marketSafe),
          allowSurvivorshipRisk:Boolean(document.querySelector("#allowRiskyInner")?.checked)
        });
        prepareReports=dataset.prepareReports||[];
        auxDatasets=[];
        validation=validateDataset(dataset);
        lastRun=null;uiError="";
      }catch(err){uiError=err?.message||"データ結合を完了できませんでした。";}
      render();
    });
    document.querySelector("#applyTransform")?.addEventListener("click",()=>{
      try{
        dataset=addLogTransform(dataset,document.querySelector("#transformColumn").value,document.querySelector("#transformType").value);
        validation=validateDataset(dataset);lastRun=null;uiError="";
      }catch(err){uiError=err?.message||"変換できませんでした。";}
      render();
    });
    document.querySelector("#run").onclick=()=>{
      try{
        const req={mode,target:document.querySelector("#target").value||undefined,group:document.querySelector("#group").value||undefined,group2:document.querySelector("#group2").value||undefined};
        if(mode==="auto")req.goal=document.querySelector("#goal").value;
        else{
          req.method=document.querySelector("#method").value;
          req.predictors=selectedPredictors();
          req.lambda=document.querySelector("#lambda").value;
          req.alpha=document.querySelector("#alpha").value;
        }
        lastRun=runAnalysis(dataset,req);uiError="";
      }catch(err){lastRun=null;uiError=err?.message||"分析を完了できませんでした。";}
      render();
    };
    document.querySelector("#csvExport").onclick=()=>downloadText(canonicalCsv(dataset),"statflow-clean.csv","text/csv");
    document.querySelector("#jsonExport").onclick=()=>lastRun&&downloadText(JSON.stringify(lastRun,null,2),"statflow-result.json","application/json");
  }
}
render();
