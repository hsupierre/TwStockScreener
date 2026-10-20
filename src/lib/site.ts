export const siteConfig = {
  name: "台股選股",
  title: "台股選股｜基本面條件篩選上市櫃股票",
  description:
    "用本益比、殖利率、ROE、營收成長、負債比等基本面條件，快速篩選台灣上市櫃股票。資料來自證交所、櫃買中心與公開資訊觀測站。",
  locale: "zh_TW",
  dataSources: [
    { name: "臺灣證券交易所 OpenAPI", url: "https://openapi.twse.com.tw/" },
    { name: "證券櫃檯買賣中心 OpenAPI", url: "https://www.tpex.org.tw/openapi/" },
    { name: "公開資訊觀測站", url: "https://mops.twse.com.tw/" },
  ],
  disclaimer:
    "本站資料僅供參考，不構成任何投資建議或要約。資料可能有延遲或錯誤，投資前請自行查證，並自負盈虧。",
} as const;
