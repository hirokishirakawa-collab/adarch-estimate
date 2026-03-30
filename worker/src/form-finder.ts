import { type Page } from "playwright";

/**
 * ページにフォームがあるか確認し、なければ「お問い合わせ」リンクを探して遷移する。
 * 最終的にフォームがあるページのURLを返す。見つからなければnullを返す。
 */
export async function findContactFormUrl(page: Page): Promise<string | null> {
  // Step 1: 現在のページにフォームがあるかチェック
  const hasForm = await page.evaluate(() => {
    const forms = document.querySelectorAll('form');
    const inputs = document.querySelectorAll('input[type="text"], input[type="email"], textarea');
    // フォームタグまたは入力フィールドが2つ以上あればフォームページと判断
    return forms.length > 0 && inputs.length >= 2;
  });

  if (hasForm) {
    return page.url(); // 既にフォームページ
  }

  // Step 2: お問い合わせリンクを探す
  const contactUrl = await page.evaluate(() => {
    const keywords = [
      'お問い合わせ', '問い合わせ', 'お問合せ', '問合せ',
      'contact', 'inquiry', 'お問合わせ',
      'ご相談', '資料請求', 'メールでのお問い合わせ',
    ];

    const links = Array.from(document.querySelectorAll('a[href]'));

    for (const keyword of keywords) {
      for (const link of links) {
        const text = (link.textContent || '').trim().toLowerCase();
        const href = link.getAttribute('href') || '';
        const ariaLabel = (link.getAttribute('aria-label') || '').toLowerCase();

        if (
          text.includes(keyword.toLowerCase()) ||
          ariaLabel.includes(keyword.toLowerCase()) ||
          href.toLowerCase().includes('contact') ||
          href.toLowerCase().includes('inquiry') ||
          href.toLowerCase().includes('toiawase')
        ) {
          // 相対URLを絶対URLに変換
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

  if (!contactUrl) {
    return null; // お問い合わせリンクが見つからない
  }

  // Step 3: お問い合わせページに遷移
  try {
    await page.goto(contactUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2000);

    // 遷移先にフォームがあるか確認
    const hasFormAfterNav = await page.evaluate(() => {
      const forms = document.querySelectorAll('form');
      const inputs = document.querySelectorAll('input[type="text"], input[type="email"], textarea');
      return forms.length > 0 || inputs.length >= 2;
    });

    if (hasFormAfterNav) {
      return page.url();
    }

    // Step 4: さらにフォームページへのリンクを探す（「フォームはこちら」等）
    const deeperUrl = await page.evaluate(() => {
      const keywords = ['フォーム', 'form', 'メールで', 'こちらから', '入力'];
      const links = Array.from(document.querySelectorAll('a[href]'));

      for (const keyword of keywords) {
        for (const link of links) {
          const text = (link.textContent || '').trim().toLowerCase();
          if (text.includes(keyword.toLowerCase())) {
            try {
              return new URL(link.getAttribute('href')!, window.location.origin).href;
            } catch {
              continue;
            }
          }
        }
      }
      return null;
    });

    if (deeperUrl) {
      await page.goto(deeperUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(2000);
      return page.url();
    }

    return contactUrl; // フォームは見つからなかったが、お問い合わせページを返す
  } catch {
    return null;
  }
}
