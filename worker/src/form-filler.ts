import type { Page } from "playwright";
import type { FormField } from "./form-analyzer.js";

/**
 * Playwrightでフォームフィールドに値を入力する
 */
export async function fillForm(
  page: Page,
  fields: FormField[]
): Promise<{ filled: Record<string, string>; errors: string[] }> {
  const filled: Record<string, string> = {};
  const errors: string[] = [];

  for (const field of fields) {
    try {
      const el = page.locator(field.selector).first();

      // 要素の存在確認
      const count = await el.count();
      if (count === 0) {
        errors.push(`要素が見つかりません: ${field.selector}`);
        continue;
      }

      // 要素が表示されるまで最大5秒待つ
      try {
        await el.waitFor({ state: "visible", timeout: 5000 });
      } catch {
        errors.push(`要素が非表示: ${field.selector}`);
        continue;
      }

      switch (field.type) {
        case "text":
        case "email":
        case "tel":
          await el.fill(field.value);
          break;

        case "textarea":
          await el.fill(field.value);
          break;

        case "select":
          await el.selectOption(field.value);
          break;

        case "radio":
          await el.check();
          break;

        case "checkbox":
          await el.check();
          break;

        default:
          await el.fill(field.value);
      }

      filled[field.selector] = field.value;

      // 人間らしい入力間隔（100-300ms）
      await page.waitForTimeout(100 + Math.random() * 200);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${field.selector}: ${msg}`);
    }
  }

  return { filled, errors };
}

/**
 * 確認画面の最終送信ボタンをクリックする（2段階フォーム対応）
 */
export async function clickConfirmButton(page: Page): Promise<boolean> {
  try {
    const confirmSelectors = [
      'button:has-text("送信する")',
      'button:has-text("送信")',
      'input[type="submit"][value*="送信"]',
      'button:has-text("Submit")',
      'button:has-text("この内容で送信")',
      'button:has-text("上記の内容で送信")',
      'button:has-text("完了")',
      'input[type="submit"][value*="完了"]',
      'button:has-text("OK")',
      'a:has-text("送信する")',
      'a:has-text("送信")',
    ];

    for (const sel of confirmSelectors) {
      const btn = page.locator(sel).first();
      if ((await btn.count()) > 0 && (await btn.isVisible())) {
        await btn.click();
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * 送信ボタンをクリックする
 */
export async function clickSubmit(
  page: Page,
  submitSelector: string | null
): Promise<boolean> {
  try {
    if (submitSelector) {
      const btn = page.locator(submitSelector).first();
      if ((await btn.count()) > 0) {
        await btn.click();
        return true;
      }
    }

    // セレクタが見つからない場合、一般的な送信ボタンを探す
    const commonSelectors = [
      'button[type="submit"]',
      'input[type="submit"]',
      'button:has-text("送信")',
      'button:has-text("確認")',
      'button:has-text("Submit")',
      'input[value="送信"]',
      'input[value="確認"]',
      'a:has-text("送信")',
    ];

    for (const sel of commonSelectors) {
      const btn = page.locator(sel).first();
      if ((await btn.count()) > 0 && (await btn.isVisible())) {
        await btn.click();
        return true;
      }
    }

    return false;
  } catch (err) {
    console.error("[form-filler] 送信ボタンクリック失敗:", err);
    return false;
  }
}
