export function editorialImageStyle(notes: string | null) {
  let value: { size?: string; align?: string } = {};
  try { value = JSON.parse(notes ?? "{}") ?? {}; } catch { /* legacy notes */ }
  return {
    size: ["small", "medium", "text"].includes(value.size ?? "") ? value.size! : "text",
    align: ["left", "center", "right"].includes(value.align ?? "") ? value.align! : "center",
  };
}

export async function validateEditorialImage(file: File) {
  if (!file.size || file.size > 3 * 1024 * 1024) throw new Error("Scegli un PNG/JPG fino a 3 MB.");
  const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const png = [137,80,78,71,13,10,26,10].every((n, i) => bytes[i] === n);
  const jpg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (png && file.type === "image/png") return { extension: "png", mimeType: "image/png" };
  if (jpg && file.type === "image/jpeg") return { extension: "jpg", mimeType: "image/jpeg" };
  throw new Error("Il file deve essere un'immagine PNG o JPG valida.");
}
