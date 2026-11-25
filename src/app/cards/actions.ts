"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { extractCardInfo } from "@/lib/gemini";
import { CARD_FIELDS, type CardFields } from "@/lib/card-fields";

export type ExtractResult = { fields: CardFields } | { error: string };

// ① 보관함에 올린 명함 사진을 AI에게 보여 주고, 칸별 정보를 받아 온다.
export async function extractCard(imagePaths: string[]): Promise<ExtractResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "다시 로그인해 주세요." };

  // 내 폴더의 사진만 허용 (보관함 자물쇠도 한 번 더 막아 준다)
  if (imagePaths.length === 0 || imagePaths.some((p) => !p.startsWith(`${user.id}/`))) {
    return { error: "사진을 찾을 수 없어요." };
  }

  try {
    const images = await Promise.all(
      imagePaths.map(async (path) => {
        const { data, error } = await supabase.storage.from("card-images").download(path);
        if (error || !data) throw new Error("download failed");
        const buffer = Buffer.from(await data.arrayBuffer());
        return { data: buffer.toString("base64"), mimeType: data.type || "image/jpeg" };
      }),
    );
    const fields = await extractCardInfo(images);
    return { fields };
  } catch (e) {
    console.error("extractCard failed:", e);
    return { error: "AI가 명함을 읽지 못했어요. 직접 입력하거나 다시 시도해 주세요." };
  }
}

export type SaveState = { error?: string } | undefined;

// ② 확인·수정한 내용을 명함 표(cards)에 저장한다.
export async function saveCard(_prev: SaveState, formData: FormData): Promise<SaveState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "다시 로그인해 주세요." };

  const text = (key: string) => {
    const v = String(formData.get(key) ?? "").trim();
    return v === "" ? null : v;
  };

  const row: Record<string, string | string[] | null> = {};
  for (const f of CARD_FIELDS) row[f.key] = text(f.key);

  if (!row.name && !row.company) {
    return { error: "이름이나 회사 중 하나는 입력해 주세요." };
  }

  row.memo = text("memo");
  row.tags = String(formData.get("tags") ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  for (const key of ["image_path", "image_back_path"]) {
    const p = text(key);
    row[key] = p && p.startsWith(`${user.id}/`) ? p : null;
  }

  const { error } = await supabase.from("cards").insert(row);
  if (error) {
    console.error("saveCard failed:", error);
    return { error: "저장하지 못했어요. 잠시 후 다시 시도해 주세요." };
  }

  redirect("/cards");
}
