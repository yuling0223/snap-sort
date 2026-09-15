import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function POST(req) {
  try {
    const { base64Image, mimeType } = await req.json();
    
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
      }
    });

    const prompt = `你是一個精準的 AI 智慧萃取助理。請深度分析這張圖片，並判定最適當的分類，回傳合法的 JSON 格式。

    【分類判定規則 (category)】：
    - "receipt": 適用於統一發票、超商收據、帳單、消費明細。
    - "whiteboard": 適用於待辦事項清單 (Todo list)、行程計畫、手寫清單。
    - "product": 適用於商品照片、網購截圖、標籤、有標價的物品。
    - "handwritten_note": 適用於筆記、手寫文字、學習筆記。
    - "other": 適用於傳單、名片、截圖或其他一般圖片。

    【各分類對應欄位要求（若找不到該資訊請直接留空字串 "" 或數字填 null）】：
    1. 若 category 為 "receipt":
       - title, merchant, date (YYYY-MM-DD), total_amount, items (包含 item_name 與 price)
    2. 若 category 為 "whiteboard":
       - title, tasks (字串陣列)
    3. 若 category 為 "product":
       - title, brand, product_name, price, features (字串陣列)
    4. 若 category 為 "handwritten_note" 或 "other":
       - title, summary, full_text (圖片內所有的完整文字內容)

    請確保 JSON 格式正確，且包含 category 欄位。`;

    const imageParts = [{ inlineData: { data: base64Image, mimeType } }];
    const result = await model.generateContent([prompt, ...imageParts]);
    const text = result.response.text();
    
    const parsedData = JSON.parse(text);
    return NextResponse.json(parsedData);

  } catch (error) {
    console.error("AI 解析發生例外狀況:", error);
    
    return NextResponse.json({
      category: "handwritten_note",
      title: "",
      summary: "",
      full_text: "",
      merchant: "",
      date: "",
      total_amount: "",
      items: [],
      brand: "",
      product_name: "",
      price: "",
      features: [],
      tasks: []
    });
  }
}