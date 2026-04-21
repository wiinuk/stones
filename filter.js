const fs = require("fs");

// 設定
const inputFile = "stone_db.geojson";
const outputFile = "stone_db.filtered.geojson";
const targetCityCode = 6202; // 山形県米沢市の自治体コード
const targetCityName = "米沢市";

// 1. ファイルの読み込み
fs.readFile(inputFile, "utf8", (err, data) => {
  if (err) {
    console.error("ファイルの読み込みに失敗しました:", err);
    return;
  }

  try {
    const geojson = JSON.parse(data);

    // 2. 米沢市のデータのみをフィルタリング
    const filteredFeatures = geojson.features.filter((feature) => {
      const props = feature.properties;

      // 住所に「米沢市」が含まれる、または市町村コードが一致するか確認
      const matchAddress =
        props.address && props.address.includes(targetCityName);
      const matchCityCode = props.city_code === targetCityCode;

      return matchAddress || matchCityCode;
    });

    // 3. 新しいGeoJSONオブジェクトの作成
    const outputGeoJSON = {
      ...geojson,
      features: filteredFeatures,
    };

    // 4. ファイルの書き出し
    fs.writeFile(outputFile, JSON.stringify(outputGeoJSON, null, 2), (err) => {
      if (err) {
        console.error("書き出しに失敗しました:", err);
      } else {
        console.log(
          `抽出完了: ${filteredFeatures.length} 件のデータを ${outputFile} に保存しました。`,
        );
      }
    });
  } catch (parseErr) {
    console.error("JSONのパースに失敗しました:", parseErr);
  }
});
