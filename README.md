# 今晚食乜餸

一個為香港家庭而設的三語食譜 web app，支援繁體中文、English 及 Bahasa Indonesia 單語或雙語對照。包含 300 道菜、食材/菜系/標籤搜尋、蛋奶素替換和儲存在瀏覽器的「已煮」紀錄。

目前版本包括：

- 每道菜預設 3 人份，可在菜譜內調整至 1–8 人，材料會即時換算。
- 12 款焗飯及 56 款配合 Toshiba MX2-TT20SC 的蒸／焗／烤食譜。
- 器材只使用煎 Pan、中式鑊、MX2-TT20SC 及其合適器皿／配件。
- 素食模式優先用 Impossible-style 植物免治肉或植物肉條替代豬、牛、羊、雞；豆腐和菇菌為次選。
- 300 張菜式主圖及 1,857 張逐步教學圖均為實際、獨立的 WebP 檔案；每張由該菜式或完整步驟描述、主材料、動作、器具、火力／MX2 設定及熟度狀態產生，不再使用介面補圖或共用默認圖。
- 「已煮」紀錄同時保存當次人數及是否使用素食模式。

## 本機使用

```bash
npm install
npm run dev
```

完整檢查：

```bash
npm run check
```

圖片素材工作：

```bash
npm run images:manifest       # 建立 2,157 張圖片的逐項生成清單
npm run images:stage:check    # 檢查模型原圖、收據、比例、複雜度及重複
npm run images:check          # 檢查 production 圖片、來源、逐張 QA 及 SHA-256
```

圖片輸出在 `public/assets/generated/recipes/`，目前共 2,157 張（300
張主圖、1,857 張步驟圖），約 389 MiB。`npm run images:render` 只是一道
安全閘，會拒絕重新產生舊式 SVG／模板補圖。詳細規格見
[`docs/IMAGE_ASSET_SPEC.md`](docs/IMAGE_ASSET_SPEC.md)。

## GitHub Pages

此資料夾目前未初始化為 Git repository。首次發佈前：

1. 在本目錄執行 `git init`，加入並 commit 檔案，再連接你的 GitHub repository。
2. 把 repository 的預設 branch 設為 `main`。
3. 在 **Settings → Pages → Build and deployment** 選擇 **GitHub Actions**。
4. Push 到 `main` 後，`.github/workflows/deploy-pages.yml` 會自動建置和部署。

GitHub Actions 會按 repository 名稱設定 Vite `base`，所以 project page、
使用者網站和自訂網域都可正常載入資源。

## 私隱

已煮紀錄只儲存在目前瀏覽器的 `localStorage`，不會上傳伺服器。清除網站資料會同時清除紀錄。

## Toshiba MX2-TT20SC

食譜使用的模式、溫度、層位、水箱及器皿限制整理在
[`docs/TOSHIBA_MX2_NOTES.md`](docs/TOSHIBA_MX2_NOTES.md)。內容以官方產品頁、食譜書及使用說明書為依據，並改寫成三人家庭份量；不是原食譜書的逐字複製。
