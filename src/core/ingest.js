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

export async function ingestFile(file, preferredSheet) {
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
  return {...canonicalizeTable(rawRows), source:{fileName:file.name, sheetNames}};
}

export function ingestRows(rows, name="in-memory") {
  return {...canonicalizeTable(rows), source:{fileName:name, sheetNames:[]}};
}
