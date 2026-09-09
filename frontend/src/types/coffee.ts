/**
 * 核心数据类型定义
 */

// 1. 基础属性
export type RoastLevel = '浅烘' | '中烘' | '深烘';
export type ProcessMethod = '水洗' | '日晒' | '蜜处理/厌氧';
export type BrewTool = '手冲' | '摩卡壶' | '法压壶' | '冷萃瓶';
export type CoffeeStyle = '手冲黑咖' | '美式' | '拿铁' | '馥芮白' | '卡布奇诺';

// 2. 冲煮步骤多态接口
export interface BaseStep {
  label: string;
  description?: string;
  duration?: number; // 持续时间(秒)
}

// 手冲（滴滤）：包含各阶段累加目标注水量
export interface PourOverStep extends BaseStep {
  targetWeight: number; // 阶段累加目标注水量(克)
}

// 摩卡壶（加压）：强调状态变化与离火时间
export interface MokaStep extends BaseStep {
  // 摩卡壶可能不需要 targetWeight，主要看状态和时间
}

// 法压壶/冷萃：对应的浸泡与等待
export interface ImmersionStep extends BaseStep {
}

export type BrewStep = PourOverStep | MokaStep | ImmersionStep;

// 3. 实时计算配置与结果
export interface BrewConfig {
  tool: BrewTool;
  roastLevel: RoastLevel;
  processMethod: ProcessMethod;
  coffeeStyle: CoffeeStyle;
  coffeeWeight: number; // 用户输入的粉量，默认 15g
  customRatio?: number; // 用户微调的粉水比数值，如 15 代表 1:15
}

export interface RecipeResult {
  waterRatio: number;      // 最终采用的粉水比 (1:x)
  targetWater: number;      // 目标总水量 = coffeeWeight * waterRatio
  waterTemp: number;       // 建议水温
  grindSize: string;       // 建议研磨度
  steps: BrewStep[];       // 计算得出的步骤
  milkInfo?: {             // 针对奶咖的建议
    milkWeight: number;    // 建议热牛奶克数
    foamThickness: string; // 奶泡厚度说明
  };
}
