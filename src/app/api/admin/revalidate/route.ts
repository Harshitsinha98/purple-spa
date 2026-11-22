import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { handle, requireCaller } from "@/lib/server/caller";
import { CATALOG_TAG } from "@/lib/catalog";

/** Called by the admin panel after editing services or settings so the public site updates immediately. */
export const POST = handle(async () => {
  await requireCaller(["admin"]);
  revalidateTag(CATALOG_TAG, { expire: 0 });
  return NextResponse.json({ ok: true });
});
