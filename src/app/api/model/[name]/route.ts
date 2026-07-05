export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

// Map display names to safe filenames (matching download script output)
const MODEL_FILE_MAP: Record<string, string> = {
  "Ban Mai": "ban-mai",
  "Chiếu Thành": "chiu-thnh",
  "Duy Onyx (mới)": "duy-onyx-mi",
  "Duy Oryx": "duy-oryx",
  "Lạc Phi": "lc-phi",
  "Mai Phương": "mai-phng",
  "Minh Khang": "minh-khang",
  "Minh Quang": "minh-quang",
  "Mạnh Dũng": "mnh-dng",
  "Mỹ Tâm": "m-tm",
  "Mỹ Tâm Real": "m-tm-real",
  "Ngọc Huyền (mới)": "ngc-huyn-mi",
  "Ngọc Ngạn": "ngc-ngn",
  "Phương Trang": "phng-trang",
  "Thanh Phương Viettel": "thanh-phng-viettel",
  "Thiện Tâm": "thin-tm",
  "Trấn Thành": "trn-thnh",
  "Tài An": "ti-an",
  "Việt Thảo": "vit-tho",
};

const MODELS_DIR = join(process.cwd(), "public", "models", "vi");

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;

  // Parse: "Ban Mai.onnx" or "Ban Mai.onnx.json"
  const isJson = name.endsWith(".onnx.json");
  const isOnnx = name.endsWith(".onnx") && !isJson;

  if (!isOnnx && !isJson) {
    return NextResponse.json({ error: "Invalid file type" }, { status: 400 });
  }

  const modelName = isJson
    ? name.replace(".onnx.json", "")
    : name.replace(".onnx", "");

  const safeFilename = MODEL_FILE_MAP[modelName];
  if (!safeFilename) {
    return NextResponse.json({ error: `Model not found: ${modelName}` }, { status: 404 });
  }

  const ext = isJson ? ".onnx.json" : ".onnx";
  const filePath = join(MODELS_DIR, safeFilename + ext);

  if (!existsSync(filePath)) {
    return NextResponse.json({ error: "Model file not found on disk" }, { status: 404 });
  }

  const data = await readFile(filePath);
  const contentType = isJson ? "application/json" : "application/octet-stream";

  return new Response(data, {
    headers: {
      "Content-Type": contentType,
      "Content-Length": data.length.toString(),
      "Cache-Control": "public, max-age=604800, immutable",
    },
  });
}
