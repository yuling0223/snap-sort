import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function POST(req) {
  try {
    const { base64Image, mimeType } = await req.json();
    
    // 升級設定：強制模型只能回傳乾淨的 JSON 格式 (不用再手動過濾 markdown)
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
      }
    });

    // 升級指令：加入嚴格限制與防呆機制
    const prompt = `你是一個精準的資料萃取助理。請分析這張圖片，並嚴格依照以下規則回傳 JSON。
    規則 1: 必須包含 "category" 欄位，其值「絕對只能」是這四個之一："receipt", "whiteboard", "handwritten_note", "product"。
    規則 2: 如果圖片是傳單、名片、螢幕截圖或其他無法明確歸類的圖片，請強制設為 "handwritten_note" (當作一般文字筆記處理)。
    
    接著根據你選的 category 提供對應欄位：
    - 若為 receipt：提取 date (YYYY-MM-DD), total_amount (數字), merchant (商家名稱), items (包含 item_name 與 price 的陣列)。
    - 若為 whiteboard：提取 title (標題), tasks (待辦字串陣列)。
    - 若為 handwritten_note：提取 title (為這段內容下個標題), summary (重點摘要), full_text (完整文字內容)。
    - 若為 product：提取 brand (品牌), product_name (商品名稱), price (數字), features (特色字串陣列)。`;

    const imageParts = [{ inlineData: { data: base64Image, mimeType } }];
    const result = await model.generateContent([prompt, ...imageParts]);
    const text = result.response.text();
    
    // 因為已經設定了 responseMimeType，這裡可以直接解析，保證不會出錯
    return NextResponse.json(JSON.parse(text));
    
  } catch (error) {
    console.error("AI 解析失敗:", error);
    return NextResponse.json({ error: "圖片解析失敗，請重試" }, { status: 500 });
  }
}