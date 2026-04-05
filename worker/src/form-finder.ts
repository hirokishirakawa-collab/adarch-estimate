import { type Page } from "playwright";

/**
 * ページにフォームがあるか確認し、なければ「お問い合わせ」リンクを探して遷移する。
 * 最終的にフォームがあるページのURLを返す。見つからなければnullを返す。
 */
export async function findContactFormUrl(page: Page): Promise<string | null> {
  console.log(`[form-finder] 開始 - 現在URL: ${page.url()}`);

  // Step 1: まずお問い合わせリンクがあるか探す（トップページの検索フォーム誤検出を防ぐ）
  const contactLink = await findContactLink(page);
  console.log(`[form-finder] contactLink: ${contactLink ?? "見つからず"}`);

  // お問い合わせリンクがあれば、そちらに遷移
  if (contactLink) {
    // 現在のURLがすでにcontact系なら遷移不要
    const currentUrl = page.url().toLowerCase();
    const isAlreadyContact =
      currentUrl.includes("contact") ||
      currentUrl.includes("inquiry") ||
      currentUrl.includes("toiawase") ||
      currentUrl.includes("page_id=");

    // リンク先が現在URLと同じなら遷移スキップ（同URL再遷移のエラー回避）
    const isSameUrl =
      contactLink.replace(/\/$/, "").toLowerCase() ===
      page.url().replace(/\/$/, "").toLowerCase();

    if (!isAlreadyContact && !isSameUrl) {
      try {
        console.log(`[form-finder] ${contactLink} に遷移中...`);
        await page.goto(contactLink, { waitUntil: "domcontentloaded", timeout: 60000 });
        await page.waitForTimeout(2000);
        console.log(`[form-finder] 遷移完了: ${page.url()}`);
      } catch (e) {
        console.log(`[form-finder] 遷移失敗: ${e instanceof Error ? e.message : String(e)}`);
        return null;
      }
    }

    const hasForm = await hasContactForm(page);
    console.log(`[form-finder] hasContactForm: ${hasForm}`);
    if (hasForm) {
      return page.url();
    }

    // さらにフォームページへのリンクを探す（「フォームはこちら」等）
    const deeperUrl = await findDeeperFormLink(page);
    console.log(`[form-finder] deeperUrl: ${deeperUrl ?? "なし"}`);
    if (deeperUrl) {
      try {
        await page.goto(deeperUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
        await page.waitForTimeout(2000);
        return page.url();
      } catch {
        return null;
      }
    }

    // お問い合わせページ自体を返す（フォームが動的に読み込まれる場合もある）
    return page.url();
  }

  // お問い合わせリンクがなければ、現在のページにフォームがあるかチェック
  const hasForm = await hasContactForm(page);
  console.log(`[form-finder] リンクなし、現在ページのフォーム: ${hasForm}`);
  if (hasForm) {
    return page.url();
  }

  return null;
}

/**
 * お問い合わせリンクを探す
 */
async function findContactLink(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    var keywords = [
      "お問い合わせ", "問い合わせ", "お問合せ", "問合せ",
      "contact", "inquiry", "お問合わせ",
      "ご相談", "資料請求", "メールでのお問い合わせ",
    ];

    var links = Array.from(document.querySelectorAll("a[href]"));

    for (var k = 0; k < keywords.length; k++) {
      var keyword = keywords[k].toLowerCase();
      for (var i = 0; i < links.length; i++) {
        var link = links[i] as HTMLAnchorElement;
        var text = (link.textContent || "").trim().toLowerCase();
        var href = link.getAttribute("href") || "";
        var ariaLabel = (link.getAttribute("aria-label") || "").toLowerCase();

        if (
          text.includes(keyword) ||
          ariaLabel.includes(keyword) ||
          href.toLowerCase().includes("contact") ||
          href.toLowerCase().includes("inquiry") ||
          href.toLowerCase().includes("toiawase") ||
          href.includes("forms.gle/") ||
          href.includes("docs.google.com/forms")
        ) {
          try {
            return new URL(href, window.location.origin).href;
          } catch {
            continue;
          }
        }
      }
    }

    return null;
  });
}

/**
 * フォームページへの深いリンクを探す
 */
async function findDeeperFormLink(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    var keywords = ["フォーム", "form", "メールで", "こちらから", "入力"];
    var links = Array.from(document.querySelectorAll("a[href]"));

    for (var k = 0; k < keywords.length; k++) {
      var keyword = keywords[k].toLowerCase();
      for (var i = 0; i < links.length; i++) {
        var link = links[i] as HTMLAnchorElement;
        var text = (link.textContent || "").trim().toLowerCase();
        if (text.includes(keyword)) {
          try {
            return new URL(link.getAttribute("href")!, window.location.origin).href;
          } catch {
            continue;
          }
        }
      }
    }
    return null;
  });
}

/**
 * ページにお問い合わせフォームがあるか判定
 */
async function hasContactForm(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    var forms = document.querySelectorAll("form");
    if (forms.length > 0) return true;
    var inputs = document.querySelectorAll("input, textarea, select");
    return inputs.length >= 1;
  });
}
