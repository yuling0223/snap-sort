import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function POST(req) {
  try {
    const { base64Image, mimeType } = await req.json();
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `你是一個精準的資料萃取助理。請分析這張圖片，判斷它屬於「receipt (收據)」、「whiteboard (白板)」、「handwritten_note (手寫筆記)」或「product (商品)」。
    - 若為 receipt：提取 date (YYYY-MM-DD), total_amount (總金額數字), merchant (商家名稱), items (包含 item_name 與 price 的物件陣列)。
    - 若為 whiteboard：提取 title (標題，若無明確標題請根據內容生成一個簡短建議標題), tasks (待辦字串陣列)。
    - 若為 handwritten_note：提取 title (標題，若無請根據內容生成建議標題), summary (一段話的重點摘要), full_text (完整文字內容)。
    - 若為 product：提取 brand (品牌), product_name (商品名稱), price (價格, 若無則填 null), features (特色字串陣列)。
    請嚴格以純 JSON 格式回傳，不要包含 markdown 標記 (如 \`\`\`json)，只需回傳物件本身。`;

    const imageParts = [{ inlineData: { data: base64Image, mimeType } }];
    const result = model.generateContent([prompt, ...imageParts]);
    const response = await result;
    const text = response.response.text();
    
    const cleanedText = text.replace(/```json/g, "").replace(/```/g, "").trim();
    
    return NextResponse.json(JSON.parse(cleanedText));
  } catch (error) {
    console.error("AI 解析失敗:", error);
    return NextResponse.json({ error: "圖片解析失敗，請重試" }, { status: 500 });
  }
}