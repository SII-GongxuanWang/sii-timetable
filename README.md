# 每日课表

手机和桌面浏览器均可使用的实际日期课表，部署到 GitHub Pages。显示课程时间、教室、教师、调课或停课状态、下一次上课和周统计。

## 数据与隐私

课表按教务系统返回的具体日期保存，不生成每周重复规则。按中国标准时间显示课程状态。未同步日期不会误报为无课。

默认使用 AES-256-GCM 加密课表，并通过 PBKDF2-SHA256（600,000 次迭代）从口令派生密钥。解密在浏览器本地进行；口令不上传、不存储在网页代码中。`private/` 中的原始导出、明文数据和口令不纳入 Git。

这是一份数据快照，GitHub Pages 不会自动登录教务系统，也不会实时同步之后的选课、调课和停课。

## 本地运行

```sh
npm test
npm start
```

打开 http://127.0.0.1:4173 。没有依赖安装步骤。

## 更新课表

在自己的教务系统“我的课表”页面登录后，使用下方导出脚本，保存下载的 JSON 至 `private/source.json`。只访问当前账号课表接口，不导出认证信息。

```js
(async () => {
  let request;
  self.webpackChunkant_design_pro.push([
    [Date.now()],
    {},
    (r) => {
      request = r(51690).Z;
    },
  ]);
  const panel = await request("/studentTimetable/getTimetableDayPanel", {
    method: "POST",
    body: {},
  });
  const timetable = await request("/studentTimetable/getTimetableDayDataList", {
    method: "POST",
    body: {},
  });
  const blob = new Blob(
    [
      JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          panel: panel.data,
          timetable: timetable.data,
        },
        null,
        2,
      ),
    ],
    { type: "application/json" },
  );
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "sii-timetable-export.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
})();
```

上述模块标识来源于当前网站版本；网站升级后若导出失败，需要重新核对公开的前端代码。

```sh
node scripts/prepare-data.mjs private/source.json
npm test
git add schedule-data.json
git commit -m "Update timetable snapshot"
git push
```

第一次生成会创建随机查看口令，保存在 `private/passphrase.txt`；后续更新沿用该口令。需要公开数据时，必须明确选择并运行 `node scripts/prepare-data.mjs private/source.json --public`。

GitHub Pages 使用 `main` 分支根目录发布。没有第三方分析、外部字体或运行时依赖。
