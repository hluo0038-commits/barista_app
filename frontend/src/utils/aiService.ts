// @ts-ignore
declare const uni: any;
import { BrewConfig } from '../types/coffee';
import { GROQ_API_KEY, GROQ_API_URL } from '../config/api';

export interface AISuggestion {
  waterRatio: number;
  totalWater: number;
  temp: number;
  grindSize: string;
  steps: {
    name: string;
    targetWater: number;
    duration: number;
    instruction: string;
  }[];
  milkRatio?: {
    milkWeight: number;
    foamThickness: string;
  } | null;
  flavorNotes: string[];
  advice: string;
}

export const fetchAISuggestion = async (config: BrewConfig): Promise<AISuggestion | null> => {
  // 确认日志也改过来了，方便你通过终端检查 Roo 有没有又乱改
  console.log("正在请求 AI 建议 (强制锁定模型: openai/gpt-oss-20b)...");
  
  // 核心优化：注入“硬性物理法则”与“动态步骤校验”
  const prompt = `你是一位极致严谨的专业咖啡冲煮大师。请根据以下用户参数，推荐一套冲煮方案：
器具: ${config.tool}
款式: ${config.coffeeStyle}
处理法: ${config.processMethod}
烘焙度: ${config.roastLevel}
粉量: ${config.coffeeWeight}g

【绝对冲煮公理】（你必须严格遵守，不可违背）：
1. 水温法则：烘焙度越深，水温必须越低！深烘焙必须在 80-85℃，中烘焙 86-91℃，浅烘焙 92-96℃。绝对不能给深烘焙推荐高温！
2. 器具步骤法则：
   - 如果器具是“手冲”，步骤必须包含：闷蒸(Bloom)、注水(可分2-3段)。
   - 如果器具是“意式”或“半自动”，步骤必须是：布粉、压粉、萃取，绝对不需要分段注水。
   - 如果器具是“法压壶”，步骤必须是：注水、搅拌、浸泡、缓慢压下。

【输出要求】：
请严格使用中文，返回纯 JSON 格式，不要包含任何 Markdown 标签（如 \`\`\`json ）。
JSON 必须包含以下精确的 Key：
{
  "waterRatio": 数字 (如 15，意式通常为2左右),
  "totalWater": 数字,
  "temp": 数字 (必须严格遵循上述烘焙度法则),
  "grindSize": "字符串 (如: 中细研磨)",
  "steps": [{ "name": "步骤名", "targetWater": 注入水量或目标液重, "duration": 持续秒数数字, "instruction": "简短说明" }],
  "milkRatio": { "milkWeight": 数字, "foamThickness": "字符串" } 或 null (仅奶咖款式需要),
  "flavorNotes": ["风味1", "风味2"],
  "advice": "大师建议"
}`;

  try {
    const res: any = await uni.request({
      url: GROQ_API_URL,
      method: 'POST',
      header: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}` 
      },
      data: {
        // 强制锁死模型
        model: "openai/gpt-oss-20b", 
        messages: [
          { role: "system", content: "你是一个严谨的咖啡大师，只能输出合法的JSON对象，绝对不要输出任何额外的说明文字或Markdown标记。" },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" },
        // 关键：将 Temperature 从 0.7 降到 0.3，降低幻觉，让它更死板地遵守规则
        temperature: 0.3
      }
    });

    if (res.statusCode !== 200) {
      console.error('Groq API Error:', res);
      return null;
    }

    const text = res.data?.choices?.[0]?.message?.content;
    if (!text) return null;

    return JSON.parse(text);
  } catch (error) {
    console.error('AI Service Failed:', error);
    return null;
  }
};