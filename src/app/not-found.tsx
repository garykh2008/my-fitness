import Link from "next/link";

// 自訂 404。
//
// 這頁最常見的來源不是打錯網址，而是「按返回回到一個已經被刪掉的東西」——
// 刪掉訓練卡之後返回它的編輯頁、放棄訓練之後返回執行頁。
// 所以文案要講清楚這件事，並且一定要給得出去的路：
// PWA 全螢幕模式沒有瀏覽器的網址列，預設的 404 頁等於死路。

export default function NotFound() {
  return (
    <main className="shell notfound">
      <div className="eyebrow">404</div>
      <h1>找不到這個頁面</h1>

      <p className="thesis">
        最可能的原因是它已經被刪掉了 —— 例如剛剛刪除的訓練卡、
        或是放棄掉的那次訓練。返回鍵會回到已經不存在的東西。
      </p>

      <div className="notfound-actions">
        <Link href="/">
          <button className="btn primary" type="button">
            回訓練卡
          </button>
        </Link>
        <Link href="/exercises">
          <button className="btn ghost" type="button">
            去動作庫
          </button>
        </Link>
      </div>
    </main>
  );
}
