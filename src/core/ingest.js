import * as XLSX from "xlsx";
import { canonicalizeTable } from "./canonical.js";

function parseCsvText(text) {
  const rows=[];
  let row=[], cell="", quoted=false;
  for (let i=0;i<text.length;i++) {
    const ch=text[i], next=text[i+1];
    if (quoted) {
      if (ch === '"' && next === '"') { cell+='"'; i++; }
      else if (ch === '"') quoted=false;
      else cell+=ch;
    } else if (ch === '"') quoted=true;
    else if (ch === ",") { row.push(cell); cell=""; }
    else if (ch === "\n") { row.push(cell.replace(/\r$/,"")); rows.push(row); row=[]; cell=""; }
    else cell+=ch;
  }
  if (cell.length || row.length) { row.push(cell.replace(/\r$/,"")); rows.push(row); }
  return rows;
}

function sheetToRows(workbook, sheetName) {
  const sheet=workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(sheet, {header:1, defval:"", raw:false});
}

export function prepareRawRows(rows, options={}) {
  if(!rows?.length) return [];
  const headerRow=Math.max(1,Math.floor(Number(options.headerRow)||1));
  const headerDepth=Math.max(1,Math.min(3,Math.floor(Number(options.combineHeaderRows)||1)));
  let out=rows.slice(headerRow-1).map(r=>Array.isArray(r)?[...r]:[]);
  if(out.length<headerDepth+1) throw new Error("指定した見出し行では、見出しとデータ行を確保できません。");
  if(headerDepth>1) {
    const width=Math.max(...out.slice(0,headerDepth).map(r=>r.length));
    const header=Array.from({length:width},(_,i)=>{
      const parts=[];
      for(let h=0;h<headerDepth;h++) {
        const value=String(out[h]?.[i] ?? "").trim();
        if(value && parts[parts.length-1]!==value) parts.push(value);
      }
      return parts.join(" / ");
    });
    out=[header,...out.slice(headerDepth)];
  }
  return out;
}

export function transposeRows(rows) {
  if (!rows?.length) return [];
  const width=Math.max(...rows.map(r=>Array.isArray(r)?r.length:0));
  return Array.from({length:width},(_,columnIndex)=>
    rows.map(row=>Array.isArray(row) ? (row[columnIndex] ?? "") : "")
  );
}

export async function ingestFile(file, preferredSheet, options={}) {
  if (!file) throw new Error("ファイルを選択してください。");
  const name=file.name.toLowerCase();
  let rawRows, sheetNames=[];
  if (name.endsWith(".csv") || name.endsWith(".txt")) {
    rawRows=parseCsvText(await file.text());
  } else if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const bytes=await file.arrayBuffer();
    const wb=XLSX.read(bytes, {type:"array", cellDates:true});
    sheetNames=wb.SheetNames;
    const selected=preferredSheet && wb.Sheets[preferredSheet] ? preferredSheet : wb.SheetNames[0];
    rawRows=sheetToRows(wb, selected);
  } else {
    throw new Error("CSV / XLSX / XLS のみ対応しています。");
  }
  if (!rawRows?.length) throw new Error("データが空です。");
  const transposed=Boolean(options.transpose);
  const preparedRows=prepareRawRows(rawRows,options);
  const analysisRows=transposed ? transposeRows(preparedRows) : preparedRows;
  return {
    ...canonicalizeTable(analysisRows),
    source:{fileName:file.name, sheetNames, transposed, rawPreparation:{headerRow:Math.max(1,Math.floor(Number(options.headerRow)||1)),combineHeaderRows:Math.max(1,Math.min(3,Math.floor(Number(options.combineHeaderRows)||1)))}}
  };
}

export function ingestRows(rows, name="in-memory", options={}) {
  const transposed=Boolean(options.transpose);
  const preparedRows=prepareRawRows(rows,options);
  return {
    ...canonicalizeTable(transposed ? transposeRows(preparedRows) : preparedRows),
    source:{fileName:name, sheetNames:[], transposed, rawPreparation:{headerRow:Math.max(1,Math.floor(Number(options.headerRow)||1)),combineHeaderRows:Math.max(1,Math.min(3,Math.floor(Number(options.combineHeaderRows)||1)))}}
  };
}
