import { z } from "zod/v4";
import { NextResponse } from "next/server";

/**
 * リクエストボディをZodスキーマでバリデーションし、
 * 失敗時は400レスポンスを返す。
 */
export async function validateBody<T extends z.ZodType>(
  request: Request,
  schema: T
): Promise<
  | { success: true; data: z.infer<T> }
  | { success: false; response: NextResponse }
> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return {
      success: false,
      response: NextResponse.json(
        { error: "リクエストボディのパースに失敗しました" },
        { status: 400 }
      ),
    };
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    const messages = z.flattenError(result.error).formErrors;
    return {
      success: false,
      response: NextResponse.json(
        { error: "入力値が不正です", details: messages },
        { status: 400 }
      ),
    };
  }

  return { success: true, data: result.data };
}

export * from "./api";
