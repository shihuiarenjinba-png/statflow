import "./style.css";
import { ingestFile } from "./core/ingest.js";
import { validateDataset } from "./core/validation.js";
import { numericColumns, categoricalColumns } from "./core/canonical.js";
import { GOALS } from "./analysis/recommender.js";
import { runAnalysis, explain } from "./analysis/engine.js";
import { canonicalCsv, downloadText } from "./exporter.js";

const app=document.querySelector("#app");
let dataset=null, validation=null, lastRun=null, currentFile=null;
let mode="basic", transposed=false, uiError="";

function esc(value){
  return String(value ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function fmt(v){
  if(typeof v==="number") return Number.isFinite(v)?(Math.abs(v)>=1000?v.toLocaleString():Number(v.toPrecision(5))).toString():"—";
  return v ?? "—";
}

function table(headers, rows){
  return `<div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(v=>`<td>${esc(fmt(v))}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

function qualityClass(gate){ return gate==="pass"?"quality-pass":gate==="warn"?"quality-warn":"quality-block"; }

function resultHtml(run){
  const r=run.result;
  if(Array.isArray(r)) return table(["変数","n","欠損","平均","SD","Q1","中央値","Q3"],r.map(x=>[x.variable,x.n,x.missing,x.mean,x.sd,x.q1,x.median,x.q3]));
  if(r.matrix) return table(["",...r.variables],r.variables.map((v,i)=>[v,...r.matrix[i]]));
  if(r.method==="Welch two-sample t-test") return `
    <div class="metrics"><div><b>p</b><strong>${esc(fmt(r.p))}</strong></div><div><b>t</b><strong>${esc(fmt(r.t))}</strong></div><div><b>df</b><strong>${esc(fmt(r.df))}</strong></div><div><b>差</b><strong>${esc(fmt(r.difference))}</strong></div></div>
    ${table(["グループ","n","平均"],r.groups.map(g=>[g.name,g.n,g.mean]))}`;
  if(r.method==="Multiple OLS"||r.method==="Ridge regression") return `
    <div class="metrics"><div><b>n</b><strong>${r.n}</strong></div><div><b>R²</b><strong>${esc(fmt(r.r2))}</strong></div>${r.adjustedR2!==undefined?`<div><b>Adj. R²</b><strong>${esc(fmt(r.adjustedR2))}</strong></div>`:""}</div>
    ${table(["項","係数",...(r.method==="Multiple OLS"?["SE","p"]:[])],r.terms.map(t=>[t.term,t.coefficient,...(r.method==="Multiple OLS"?[t.se,t.p]:[])]))}`;
  if(r.method==="PCA") return `
    ${table(["主成分","固有値","寄与率"],r.components.map(c=>[c.component,c.eigenvalue,`${(c.explained*100).toFixed(1)}%`]))}
    <h4>PC1 loadings</h4>
    ${table(["変数","Loading"],r.components[0].loadings.map(x=>[x.variable,x.loading]))}`;
  return `<pre>${esc(JSON.stringify(r,null,2))}</pre>`;
}

async function loadCurrentFile(){
  if(!currentFile) return;
  uiError="";
  try{
    dataset=await ingestFile(currentFile,undefined,{transpose:transposed});
    validation=validateDataset(dataset);
    lastRun=null;
  }catch(err){
    dataset=null;
    validation=null;
    lastRun=null;
    uiError=err?.message || "データの読み込みに失敗しました。";
  }
  render();
}

function render(){
  const nums=dataset?numericColumns(dataset):[];
  const cats=dataset?categoricalColumns(dataset):[];
  const safeCount=dataset?.audit?.filter(a=>!String(a.type).endsWith("_failed")).length||0;
  const quality=validation?.quality;

  app.innerHTML=`
    <header>
      <div><span class="eyebrow">AUTOMATED STATISTICS</span><h1>StatFlow</h1><p>Clean → Validate → Analyze → Explain → Export</p></div>
      <div class="mode-switch">
        ${["basic","analyst","advanced"].map(m=>`<button data-mode="${m}" class="${mode===m?"active":""}">${m[0].toUpperCase()+m.slice(1)}</button>`).join("")}
      </div>
    </header>
    <main>
      <aside>
        <div class="step done"><span>01</span><div><b>Upload</b><small>${dataset?esc(dataset.source.fileName):"CSV / Excel"}</small></div></div>
        <div class="step ${dataset?"done":""}"><span>02</span><div><b>Normalize</b><small>Canonical Dataset</small></div></div>
        <div class="step ${validation?"done":""}"><span>03</span><div><b>Validate</b><small>Quality gate</small></div></div>
        <div class="step ${lastRun?"done":""}"><span>04</span><div><b>Analyze</b><small>Mode-aware engine</small></div></div>
        <div class="step ${lastRun?"done":""}"><span>05</span><div><b>Export</b><small>Clean CSV / result JSON</small></div></div>
      </aside>
      <section class="workspace">
        <div class="card upload-card">
          <div><h2>データを読み込む</h2><p>Rawファイルはブラウザ内で処理します。CSV / XLSX / XLS。</p></div>
          <div class="upload-actions">
            ${dataset? `<button id="transpose" class="secondary">${transposed?"転置を戻す":"行列を転置"}</button>` : ""}
            <label class="upload-button">ファイルを選択<input id="file" type="file" accept=".csv,.xlsx,.xls,.txt"></label>
          </div>
        </div>
        ${uiError?`<div class="inline-error"><b>処理を完了できませんでした</b><span>${esc(uiError)}</span></div>`:""}
        ${dataset?`
          <div class="grid">
            <div class="card"><span class="eyebrow">DATA CONTRACT</span><h3>Canonical Dataset v${dataset.contractVersion}</h3>
              <div class="metrics"><div><b>Rows</b><strong>${dataset.meta.rowCount}</strong></div><div><b>Columns</b><strong>${dataset.meta.columnCount}</strong></div><div><b>Safe fixes</b><strong>${safeCount}</strong></div></div>
              <p class="orientation">${dataset.source.transposed?"転置済み：元データの列を観測方向として再解釈しています。":"通常方向：1行=1観測として解釈しています。"}</p>
              <div class="chips">${dataset.columns.map(c=>`<span>${esc(c.name)}<em>${esc(c.kind)}</em></span>`).join("")}</div>
            </div>
            <div class="card quality-card ${qualityClass(quality.gate)}">
              <div class="quality-head"><div><span class="eyebrow">DATA QUALITY</span><h3>${esc(quality.label)}</h3></div><div class="quality-score"><strong>${quality.score}</strong><span>/100</span></div></div>
              <p class="quality-message">${esc(quality.message)}</p>
              <div class="quality-meta"><span>欠損 ${(quality.metrics.missingRate*100).toFixed(1)}%</span><span>重複 ${(quality.metrics.duplicateRate*100).toFixed(1)}%</span><span>警告 ${quality.counts.warnings}</span><span>エラー ${quality.counts.errors}</span></div>
              <p class="heuristic-note">品質スコアはStatFlowの診断ヒューリスティックであり、統計的妥当性そのものを保証する値ではありません。</p>
            </div>
          </div>
          <div class="card"><span class="eyebrow">QUALITY DETAILS</span><h3>修正と警告</h3>
            <div class="issues">${validation.issues.length?validation.issues.slice(0,12).map(i=>`<div class="issue ${i.level}"><b>${esc(i.column||i.code)}</b><span>${esc(i.message)}</span></div>`).join(""):'<p class="ok">大きな品質警告はありません。</p>'}</div>
            ${validation.issues.length>12?`<p class="more-issues">ほか ${validation.issues.length-12}件の診断があります。</p>`:""}
            ${validation.suggestions.length?'<p class="guard">欠損補完・外れ値削除・重複削除など、分析結果を変える修正は自動実行していません。</p>':""}
            ${quality.critical.length?`<div class="critical-list">${quality.critical.map(x=>`<div>${esc(x)}</div>`).join("")}</div>`:""}
          </div>
          <div class="card">
            <span class="eyebrow">${mode.toUpperCase()} MODE</span>
            <h2>${mode==="basic"?"何を知りたいですか？":mode==="analyst"?"分析手法を選択":"高度分析を設定"}</h2>
            ${quality.gate==="warn"?'<div class="analysis-warning">このデータには品質上の注意点があります。結果を見る前に上の警告を確認してください。</div>':""}
            ${quality.gate==="block"?'<div class="analysis-block">品質ゲートはBLOCKです。記述統計による確認は可能ですが、それ以外の分析はデータ確認まで停止します。</div>':""}
            <div class="controls">
              ${mode==="basic"?`
                <label>目的<select id="goal">${GOALS.map(([v,l])=>`<option value="${v}">${esc(l)}</option>`).join("")}</select></label>
              `:`
                <label>手法<select id="method">
                  <option value="descriptive">記述統計</option><option value="correlation">Pearson相関</option><option value="welch">Welch t-test</option><option value="ols">OLS回帰</option><option value="pca">PCA</option>
                  ${mode==="advanced"?'<option value="ridge">Ridge回帰</option>':""}
                </select></label>
              `}
              <label>目的変数<select id="target"><option value="">自動</option>${nums.map(n=>`<option>${esc(n)}</option>`).join("")}</select></label>
              <label>グループ列<select id="group"><option value="">自動</option>${cats.map(n=>`<option>${esc(n)}</option>`).join("")}</select></label>
              ${mode==="advanced"?'<label>λ (Ridge)<input id="lambda" type="number" min="0.0001" step="0.1" value="1"></label>':""}
              <button id="run" class="primary">分析を実行</button>
            </div>
            <p class="boundary">${mode==="basic"?"手法選択を隠し、目的から安全な既定分析を選びます。":mode==="analyst"?"手法を直接選べますが、破壊的なデータ修正は自動化しません。":"正則化などのパラメータを明示的に操作します。結果責任を伴う設定を隠しません。"}</p>
          </div>
          ${lastRun?`
            <div class="card result-card"><span class="eyebrow">RESULT</span><h2>${esc(lastRun.result.method||"Descriptive statistics")}</h2>
              ${lastRun.quality?.gate==="warn"?'<div class="result-caution">注意：この結果は品質警告があるデータから計算されています。</div>':""}
              <div class="explanation">${esc(explain(lastRun.result))}</div>
              ${resultHtml(lastRun)}
            </div>`:""}
          <div class="card export-card"><div><h3>Export</h3><p>整形済みCanonical CSVと、最後の分析結果JSONを保存できます。</p></div>
            <div><button id="csvExport">Clean CSV</button><button id="jsonExport" ${lastRun?"":"disabled"}>Result JSON</button></div>
          </div>
        `:""}
      </section>
    </main>
  `;

  document.querySelectorAll("[data-mode]").forEach(b=>b.onclick=()=>{mode=b.dataset.mode;lastRun=null;uiError="";render();});
  document.querySelector("#file").onchange=async e=>{
    currentFile=e.target.files?.[0] || null;
    transposed=false;
    await loadCurrentFile();
  };
  document.querySelector("#transpose")?.addEventListener("click",async()=>{
    transposed=!transposed;
    await loadCurrentFile();
  });

  if(dataset){
    document.querySelector("#run").onclick=()=>{
      uiError="";
      try{
        const req={mode};
        if(mode==="basic") req.goal=document.querySelector("#goal").value;
        else req.method=document.querySelector("#method").value;
        req.target=document.querySelector("#target").value||undefined;
        req.group=document.querySelector("#group").value||undefined;
        if(mode==="advanced") req.lambda=document.querySelector("#lambda")?.value;
        lastRun=runAnalysis(dataset,req);
      }catch(err){
        lastRun=null;
        uiError=err?.message || "分析を完了できませんでした。";
      }
      render();
    };
    document.querySelector("#csvExport").onclick=()=>downloadText(canonicalCsv(dataset),"statflow-clean.csv","text/csv");
    document.querySelector("#jsonExport").onclick=()=>lastRun&&downloadText(JSON.stringify(lastRun,null,2),"statflow-result.json","application/json");
  }
}
render();
