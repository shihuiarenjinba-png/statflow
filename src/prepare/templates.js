export const PREPARE_TEMPLATES=[
  {
    id:"standard",
    label:"標準テーブル",
    description:"1行目が列名、1行=1観測の通常データ。安全な整形のみ行います。"
  },
  {
    id:"transposed",
    label:"転置テーブル",
    description:"変数が行方向に並ぶ表を明示的に転置してからCanonical Datasetへ変換します。"
  },
  {
    id:"panel",
    label:"時系列パネル",
    description:"ID×時点を複合キーとして扱う企業・店舗・患者などのパネルデータ向けです。"
  },
  {
    id:"market_panel",
    label:"市場/株価パネル（安全）",
    description:"銘柄ID×日付を基本キーとし、inner joinを既定禁止。基準ユニバースから消えた銘柄を欠損のまま保持します。"
  },
  {
    id:"multi_file_lookup",
    label:"複数ファイル属性結合",
    description:"共通IDでマスタ/属性ファイルをleft joinします。キー重複があれば停止します。"
  }
];

export function templateDefaults(id) {
  switch(id) {
    case "transposed": return {transpose:true};
    case "panel": return {join:{how:"left",marketSafe:false,requireCompositeKey:true}};
    case "market_panel": return {join:{how:"left",marketSafe:true,requireCompositeKey:true}};
    case "multi_file_lookup": return {join:{how:"left",marketSafe:false,requireCompositeKey:false}};
    default: return {transpose:false};
  }
}
