import "./style.css";
import { ingestFile } from "./core/ingest.js";
import { validateDataset } from "./core/validation.js";
import { numericColumns, categoricalColumns } from "./core/canonical.js";
import { GOALS } from "./analysis/recommender.js";
import { runAnalysis, explain } from "./analysis/engine.js";
import { canonicalCsv, downloadText } from "./exporter.js";

const app=document.querySelector("#app");
let dataset=null, validation=null, lastRun=null;
let mode="basic";

function fmt(v){
  if(typeof v==="number") return Number.isFinite(v)?(Math.abs(v)>=1000?v.toLocaleString():Number(v.toPrecision(5))).toString():"—";
  return v ?? "—";
}

function table(headers, rows){
  return `<div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(v=>`<td>${fmt(v)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

function resultHtml(run){
  const r=run.result;
  if(Array.isArray(r)) return table(["変数","n","欠損","平均","SD","Q1","中央値","Q3"],r.map(x=>[x.variable,x.n,x.missing,x.mean,x.sd,x.q1,x.median,x.q3]));
  if(r.matrix) return table(["",...r.variables],r.variables.map((v,i)=>[v,...r.matrix[i]]));
  if(r.method==="Welch two-sample t-test") return `
    <div class="metrics"><div><b>p</b><strong>${fmt(r.p)}</strong></div><div><b>t</b><strong>${fmt(r.t)}</strong></div><div><b>df</b><strong>${fmt(r.df)}</strong></div><div><b>差</b><strong>${fmt(r.difference)}</strong></div></div>
    ${table(["グループ","n","平均"],r.groups.map(g=>[g.name,g.n,g.mean]))}`;
  if(r.method==="Multiple OLS"||r.method==="Ridge regression") return `
    <div class="metrics"><div><b>n</b><strong>${r.n}</strong></div><div><b>R²</b><strong>${fmt(r.r2)}</strong></div>${r.adjustedR2!==undefined?`<div><b>Adj. R²</b><strong>${fmt(r.adjustedR2)}</strong></div>`:""}</div>
    ${table(["項","係数",...(r.method==="Multiple OLS"?["SE","p"]:[])],r.terms.map(t=>[t.term,t.coefficient,...(r.method==="Multiple OLS"?[t.se,t.p]:[])]))}`;
  if(r.method==="PCA") return `
    ${table(["主成分","固有値","寄与率"],r.components.map(c=>[c.component,c.eigenvalue,`${(c.explained*100).toFixed(1)}%`]))}
    <h4>PC1 loadings</h4>
    ${table(["変数","Loading"],r.components[0].loadings.map(x=>[x.variable,x.loading]))}`;
  return `<pre>${JSON.stringify(r,null,2)}</pre>`;
}

function render(){
  const nums=dataset?numericColumns(dataset):[];
  const cats=dataset?categoricalColumns(dataset):[];
  const safeCount=dataset?.audit?.length||0;
  app.innerHTML=`
    <header>
      <div><span class="eyebrow">AUTOMATED STATISTICS</span><h1>StatFlow</h1><p>Clean → Validate → Analyze → Explain → Export</p></div>
      <div class="mode-switch">
        ${["basic","analyst","advanced"].map(m=>`<button data-mode="${m}" class="${mode===m?"active":""}">${m[0].toUpperCase()+m.slice(1)}</button>`).join("")}
      </div>
    </header>
    <main>
      <aside>
        <div class="step done"><span>01</span><div><b>Upload</b><small>${dataset?dataset.source.fileName:"CSV / Excel"}</small></div></div>
        <div class="step ${dataset?"done":""}"><span>02</span><div><b>Normalize</b><small>Canonical Dataset</small></div></div>
        <div class="step ${validation?"done":""}"><span>03</span><div><b>Validate</b><small>Quality & assumptions</small></div></div>
        <div class="step ${lastRun?"done":""}"><span>04</span><div><b>Analyze</b><small>Mode-aware engine</small></div></div>
        <div class="step ${lastRun?"done":""}"><span>05</span><div><b>Export</b><small>Clean CSV / result JSON</small></div></div>
      </aside>
      <section class="workspace">
        <div class="card upload-card">
          <div><h2>データを読み込む</h2><p>Rawファイルはブラウザ内で処理します。CSV / XLSX / XLS。</p></div>
          <label class="upload-button">ファイルを選択<input id="file" type="file" accept=".csv,.xlsx,.xls,.txt"></label>
        </div>
        ${dataset?`
          <div class="grid">
            <div class="card"><span class="eyebrow">DATA CONTRACT</span><h3>Canonical Dataset v${dataset.contractVersion}</h3>
              <div class="metrics"><div><b>Rows</b><strong>${dataset.meta.rowCount}</strong></div><div><b>Columns</b><strong>${dataset.meta.columnCount}</strong></div><div><b>Safe fixes</b><strong>${safeCount}</strong></div></div>
              <div class="chips">${dataset.columns.map(c=>`<span>${c.name}<em>${c.kind}</em></span>`).join("")}</div>
            </div>
            <div class="card"><span class="eyebrow">QUALITY</span><h3>修正と警告</h3>
              <div class="issues">${validation.issues.length?validation.issues.slice(0,8).map(i=>`<div class="issue ${i.level}"><b>${i.column||i.code}</b><span>${i.message}</span></div>`).join(""):'<p class="ok">重大な品質警告はありません。</p>'}</div>
              ${validation.suggestions.length?'<p class="guard">分析結果を変える修正は自動実行していません。</p>':""}
            </div>
          </div>
          <div class="card">
            <span class="eyebrow">${mode.toUpperCase()} MODE</span>
            <h2>${mode==="basic"?"何を知りたいですか？":mode==="analyst"?"分析手法を選択":"高度分析を設定"}</h2>
            <div class="controls">
              ${mode==="basic"?`
                <label>目的<select id="goal">${GOALS.map(([v,l])=>`<option value="${v}">${l}</option>`).join("")}</select></label>
              `:`
                <label>手法<select id="method">
                  <option value="descriptive">記述統計</option><option value="correlation">Pearson相関</option><option value="welch">Welch t-test</option><option value="ols">OLS回帰</option><option value="pca">PCA</option>
                  ${mode==="advanced"?'<option value="ridge">Ridge回帰</option>':""}
                </select></label>
              `}
              <label>目的変数<select id="target"><option value="">自動</option>${nums.map(n=>`<option>${n}</option>`).join("")}</select></label>
              <label>グループ列<select id="group"><option value="">自動</option>${cats.map(n=>`<option>${n}</option>`).join("")}</select></label>
              ${mode==="advanced"?'<label>λ (Ridge)<input id="lambda" type="number" min="0.0001" step="0.1" value="1"></label>':""}
              <button id="run" class="primary">分析を実行</button>
            </div>
            <p class="boundary">${mode==="basic"?"手法選択を隠し、目的から安全な既定分析を選びます。":mode==="analyst"?"手法を直接選べますが、破壊的なデータ修正は自動化しません。":"正則化などのパラメータを明示的に操作します。結果責任を伴う設定を隠しません。"}</p>
          </div>
          ${lastRun?`
            <div class="card result-card"><span class="eyebrow">RESULT</span><h2>${lastRun.result.method||"Descriptive statistics"}</h2>
              <div class="explanation">${explain(lastRun.result)}</div>
              ${resultHtml(lastRun)}
            </div>`:""}
          <div class="card export-card"><div><h3>Export</h3><p>整形済みCanonical CSVと、最後の分析結果JSONを保存できます。</p></div>
            <div><button id="csvExport">Clean CSV</button><button id="jsonExport" ${lastRun?"":"disabled"}>Result JSON</button></div>
          </div>
        `:""}
      </section>
    </main>
  `;

  document.querySelectorAll("[data-mode]").forEach(b=>b.onclick=()=>{mode=b.dataset.mode;lastRun=null;render();});
  document.querySelector("#file").onchange=async e=>{
    try{
      dataset=await ingestFile(e.target.files[0]);
      validation=validateDataset(dataset); lastRun=null; render();
    }catch(err){ alert(err.message); }
  };
  if(dataset){
    document.querySelector("#run").onclick=()=>{
      try{
        const req={mode};
        if(mode==="basic") req.goal=document.querySelector("#goal").value;
        else req.method=document.querySelector("#method").value;
        req.target=document.querySelector("#target").value||undefined;
        req.group=document.querySelector("#group").value||undefined;
        if(mode==="advanced") req.lambda=document.querySelector("#lambda")?.value;
        lastRun=runAnalysis(dataset,req); render();
      }catch(err){ alert(err.message); }
    };
    document.querySelector("#csvExport").onclick=()=>downloadText(canonicalCsv(dataset),"statflow-clean.csv","text/csv");
    document.querySelector("#jsonExport").onclick=()=>lastRun&&downloadText(JSON.stringify(lastRun,null,2),"statflow-result.json","application/json");
  }
}
render();
