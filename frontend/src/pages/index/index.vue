<template>
  <view class="container">
    <view class="header">
      <text class="header-title">Home Barista</text>
      <text class="header-subtitle">家庭冲煮计算器</text>
    </view>

    <!-- 1. 参数选择区 -->
    <view class="section card">
      <view class="section-title">冲煮参数</view>
      
      <view class="form-item">
        <text class="label">器具</text>
        <picker :range="tools" :value="tools.indexOf(config.tool)" @change="onToolChange">
          <view class="picker-value">{{ config.tool }} <text class="arrow">▼</text></view>
        </picker>
      </view>

      <view class="form-item">
        <text class="label">烘焙度</text>
        <view class="segmented-control">
          <view 
            v-for="level in roastLevels" 
            :key="level" 
            :class="['segment-item', config.roastLevel === level ? 'active' : '']"
            @click="config.roastLevel = level"
          >
            {{ level }}
          </view>
        </view>
      </view>

      <view class="form-item">
        <text class="label">处理法</text>
        <picker :range="methods" :value="methods.indexOf(config.processMethod)" @change="onMethodChange">
          <view class="picker-value">{{ config.processMethod }} <text class="arrow">▼</text></view>
        </picker>
      </view>

      <view class="form-item">
        <text class="label">款式</text>
        <picker :range="styles" :value="styles.indexOf(config.coffeeStyle)" @change="onStyleChange">
          <view class="picker-value">{{ config.coffeeStyle }} <text class="arrow">▼</text></view>
        </picker>
      </view>

      <!-- 确认按钮 -->
      <view class="confirm-wrapper">
        <button class="confirm-btn" @click="applyAISuggestion(true)">确认</button>
      </view>
    </view>

    <!-- 2. 动态计算与输入区 -->
    <view class="section card">
      <view class="section-title flex-between">
        <text>份量与比例</text>
        <view class="ai-btn" :class="{ 'is-loading': isAiLoading }" @click="applyAISuggestion">
          <text class="ai-icon">{{ isAiLoading ? '⏳' : '✨' }}</text>
          <text>{{ isAiLoading ? '计算中...' : 'AI 智能调优' }}</text>
        </view>
      </view>
      
      <view class="form-item">
        <text class="label">粉量 (g)</text>
        <view class="stepper">
          <view class="stepper-btn" @click="adjustWeight(-1)">-</view>
          <input class="stepper-input" type="number" v-model.number="config.coffeeWeight" />
          <view class="stepper-btn" @click="adjustWeight(1)">+</view>
        </view>
      </view>

      <view class="form-item">
        <text class="label">粉水比 (1:X)</text>
        <view class="ratio-control">
          <!-- 直接用 text 纯文本显示数值，彻底删掉 slider，用户无法修改 -->
          <text class="ratio-value" style="font-size: 18px; font-weight: bold; color: #D2B48C;">
            {{ config.customRatio || recipe.waterRatio }}
          </text>
        </view>
      </view>
    </view>  

    <!-- 3. 实时计算结果面板 -->
    <view class="result-panel card">
      <view class="result-header">
        <view class="result-main">
          <!-- 修改后：绑定动态计算的总水量 -->
<text class="result-value">{{ displayTotalWater }}</text>
          <text class="result-unit">g (总水量)</text>
        </view>
        <view class="result-side">
          <view class="side-item">
            <text class="side-label">水温</text>
            <text class="side-val">{{ recipe.waterTemp }}°C</text>
          </view>
          <view class="side-item">
            <text class="side-label">研磨</text>
            <text class="side-val">{{ recipe.grindSize }}</text>
          </view>
        </view>
      </view>

      <!-- 阶段步骤预览 -->
      <!-- 修改后：绑定动态缩放的步骤数组 -->
<view class="steps-preview" v-if="displaySteps.length > 0">
  <view class="step-preview-item" v-for="(step, index) in displaySteps" :key="index">
          <text class="step-label">{{ step.label }}</text>
          <text class="step-info" v-if="'targetWeight' in step">{{ step.targetWeight }}g</text>
          <text class="step-info" v-else>{{ step.duration ? step.duration + 's' : '状态' }}</text>
        </view>
      </view>

      <!-- AI 额外建议 (风味与建议) -->
      <view class="ai-extra-info" v-if="aiAdvice || aiFlavorNotes.length > 0">
        <view class="flavor-tags" v-if="aiFlavorNotes.length > 0">
          <text class="flavor-tag" v-for="note in aiFlavorNotes" :key="note">{{ note }}</text>
        </view>
        <view class="ai-advice" v-if="aiAdvice">
          <text class="advice-label">✨ AI 建议：</text>
          <text>{{ aiAdvice }}</text>
        </view>
      </view>

      <!-- 奶咖额外信息 -->
      <view class="milk-info" v-if="recipe.milkInfo">
        <text class="milk-text">建议热牛奶: {{ recipe.milkInfo.milkWeight }}g</text>
        <text class="milk-text">奶泡: {{ recipe.milkInfo.foamThickness }}</text>
      </view>
    </view>

    <button class="start-btn" @click="startBrew">开始冲煮</button>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, watch, onMounted, computed } from 'vue'; // 👈 新增了 computed
import { BrewConfig, BrewTool, RoastLevel, ProcessMethod, CoffeeStyle, RecipeResult, PourOverStep } from '../../types/coffee';
import { fetchAISuggestion } from '../../utils/aiService';

const tools: BrewTool[] = ['手冲', '摩卡壶', '法压壶', '冷萃瓶'];
const roastLevels: RoastLevel[] = ['浅烘', '中烘', '深烘'];
const methods: ProcessMethod[] = ['水洗', '日晒', '蜜处理/厌氧'];
const styles: CoffeeStyle[] = ['手冲黑咖', '美式', '拿铁', '馥芮白', '卡布奇诺'];

const config = reactive<BrewConfig>({
  tool: '手冲',
  roastLevel: '中烘',
  processMethod: '水洗',
  coffeeStyle: '手冲黑咖',
  coffeeWeight: 15,
  customRatio: undefined
});

const recipe = reactive<RecipeResult>({
  waterRatio: 15,
  targetWater: 225,
  waterTemp: 92,
  grindSize: '中等研磨',
  steps: []
});

const aiFlavorNotes = ref<string[]>([]);
const aiAdvice = ref<string>('');

// 当器具改变时，处理款式和比例的自动联动
watch(() => config.tool, (newTool) => {
  if (newTool === '摩卡壶') {
    if (config.coffeeStyle === '手冲黑咖') config.coffeeStyle = '拿铁';
  } else if (newTool === '手冲') {
    config.coffeeStyle = '手冲黑咖';
  } else if (newTool === '法压壶' || newTool === '冷萃瓶') {
    config.coffeeStyle = '手冲黑咖';
  }
  aiFlavorNotes.value = [];
  aiAdvice.value = '';
});

let timer: any = null;
const debounceAI = () => {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    applyAISuggestion(false);
  }, 1000);
};

const onToolChange = (e: any) => {
  config.tool = tools[e.detail.value];
};

const onMethodChange = (e: any) => {
  config.processMethod = methods[e.detail.value];
};

const onStyleChange = (e: any) => {
  config.coffeeStyle = styles[e.detail.value];
};

const adjustWeight = (delta: number) => {
  config.coffeeWeight = Math.max(1, config.coffeeWeight + delta);
};

// ================= 新增：AI 状态与基准控制 =================
const isAiLoading = ref(false);
const isAiMode = ref(false); // 是否处于 AI 接管模式
const baseCoffeeWeight = ref(15); // 记录 AI 出结果瞬间的基准粉量
// =========================================================

const applyAISuggestion = async (showMask = true) => {
  if (showMask) uni.showLoading({ title: 'AI 智算中...', mask: true });
  isAiLoading.value = true;
  
  try {
    const suggestion = await fetchAISuggestion(config);
    if (suggestion) {
      recipe.waterRatio = suggestion.waterRatio;
      recipe.targetWater = suggestion.totalWater;
      recipe.waterTemp = suggestion.temp;
      recipe.grindSize = suggestion.grindSize;
      
      let currentTotal = 0;
      recipe.steps = suggestion.steps.map(s => {
        currentTotal += s.targetWater;
        return {
          label: s.name,
          description: s.instruction,
          duration: s.duration,
          targetWeight: currentTotal
        } as PourOverStep;
      });

      recipe.milkInfo = suggestion.milkRatio ? {
        milkWeight: suggestion.milkRatio.milkWeight,
        foamThickness: suggestion.milkRatio.foamThickness
      } : undefined;
      
      aiFlavorNotes.value = suggestion.flavorNotes;
      aiAdvice.value = suggestion.advice;
      
      config.customRatio = suggestion.waterRatio;

      // 👈 新增：开启 AI 模式，并锁定当前的基准粉量
      isAiMode.value = true;
      baseCoffeeWeight.value = config.coffeeWeight;
      
      if (showMask) uni.showToast({ title: 'AI 调优完成', icon: 'success' });
    } else {
      throw new Error('Fetch failed');
    }
  } catch (error) {
    console.error('AI Suggestion Error:', error);
    if (showMask) uni.showToast({ title: 'AI 调优失败', icon: 'none' });
  } finally {
    if (showMask) uni.hideLoading();
    isAiLoading.value = false;
  }
};

onMounted(() => {
  applyAISuggestion(false);
});

// ================= 新增：动态等比缩放计算属性 =================
// 计算展示给用户的总水量
const displayTotalWater = computed(() => {
  if (isAiMode.value) {
    return Math.round(config.coffeeWeight * recipe.waterRatio);
  }
  return config.coffeeWeight * (config.customRatio || recipe.waterRatio);
});

// 计算展示给用户的各步骤水量
const displaySteps = computed(() => {
  if (isAiMode.value && recipe.steps.length > 0) {
    // 缩放比例 = 当前修改后的粉量 / AI给结果时的原始粉量
    const scale = config.coffeeWeight / baseCoffeeWeight.value;
    
    return recipe.steps.map(step => ({
      ...step,
      targetWeight: Math.round(step.targetWeight * scale) // 这里用你的 targetWeight 等比缩放
    }));
  }
  return recipe.steps;
});
// =========================================================

const startBrew = () => {
  const params = encodeURIComponent(JSON.stringify({
    config: { ...config },
    // 传给下一个页面的 recipe，水量必须是缩放后的最终版
    recipe: {
      ...recipe,
      targetWater: displayTotalWater.value,
      steps: displaySteps.value
    }
  }));
  uni.navigateTo({
    url: `/pages/timer/timer?data=${params}`
  });
};
</script>

<style scoped>
.container {
  padding: 30rpx;
  padding-bottom: 60rpx;
  background-color: #121212;
  min-height: 100vh;
  color: #e0e0e0;
}

.header {
  margin-top: 40rpx;
  margin-bottom: 50rpx;
  text-align: center;
}

.header-title {
  font-size: 52rpx;
  font-weight: bold;
  color: #D2B48C;
  display: block;
  letter-spacing: 4rpx;
}

.header-subtitle {
  font-size: 24rpx;
  color: #666;
  margin-top: 10rpx;
}

.card {
  background-color: #1e1e1e;
  border-radius: 24rpx;
  padding: 35rpx;
  margin-bottom: 30rpx;
  border: 1px solid #2a2a2a;
}

.section-title {
  font-size: 26rpx;
  color: #D2B48C;
  margin-bottom: 30rpx;
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 2rpx;
}

.flex-between {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.ai-btn {
  background: rgba(210, 180, 140, 0.15);
  padding: 8rpx 20rpx;
  border-radius: 30rpx;
  font-size: 22rpx;
  color: #D2B48C;
  border: 1px solid rgba(210, 180, 140, 0.3);
  display: flex;
  align-items: center;
  transition: all 0.3s;
}

.ai-btn.is-loading {
  opacity: 0.7;
  background: rgba(210, 180, 140, 0.05);
}

.ai-icon {
  margin-right: 6rpx;
}

.form-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 40rpx;
}

.form-item:last-child {
  margin-bottom: 0;
}

.label {
  font-size: 28rpx;
  color: #999;
}

.picker-value {
  font-size: 28rpx;
  color: #fff;
  background: #2a2a2a;
  padding: 12rpx 24rpx;
  border-radius: 12rpx;
  min-width: 160rpx;
  text-align: right;
}

.arrow {
  font-size: 18rpx;
  margin-left: 10rpx;
  color: #555;
}

.segmented-control {
  display: flex;
  background: #2a2a2a;
  border-radius: 12rpx;
  overflow: hidden;
  padding: 4rpx;
}

.segment-item {
  padding: 12rpx 24rpx;
  font-size: 24rpx;
  color: #888;
  transition: all 0.3s;
}

.segment-item.active {
  background-color: #D2B48C;
  color: #121212;
  border-radius: 8rpx;
  font-weight: bold;
}

.stepper {
  display: flex;
  align-items: center;
  background: #2a2a2a;
  border-radius: 12rpx;
  padding: 4rpx;
}

.stepper-btn {
  width: 70rpx;
  height: 70rpx;
  line-height: 64rpx;
  text-align: center;
  font-size: 44rpx;
  color: #D2B48C;
}

.stepper-input {
  width: 90rpx;
  text-align: center;
  font-size: 32rpx;
  color: #fff;
  font-weight: bold;
}

.ratio-control {
  flex: 1;
  margin-left: 40rpx;
}

.ratio-slider {
  margin: 0;
}

.result-panel {
  background: linear-gradient(145deg, #2c1e14 0%, #1a1a1a 100%);
  border: 1px solid #3d2b1f;
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 40rpx;
}

.result-main {
  display: flex;
  align-items: baseline;
}

.result-value {
  font-size: 88rpx;
  font-weight: bold;
  color: #fff;
  line-height: 1;
}

.result-unit {
  font-size: 26rpx;
  color: #888;
  margin-left: 12rpx;
}

.side-item {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  margin-bottom: 16rpx;
}

.side-item:last-child {
  margin-bottom: 0;
}

.side-label {
  font-size: 20rpx;
  color: #666;
  text-transform: uppercase;
}

.side-val {
  font-size: 30rpx;
  color: #D2B48C;
  font-weight: 500;
}

.steps-preview {
  display: flex;
  justify-content: space-between;
  border-top: 1px solid #333;
  padding-top: 30rpx;
}

.step-preview-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
}

.step-label {
  font-size: 20rpx;
  color: #666;
  margin-bottom: 8rpx;
}

.step-info {
  font-size: 26rpx;
  color: #ddd;
  font-weight: 500;
}

.milk-info {
  margin-top: 30rpx;
  padding: 20rpx 24rpx;
  background: rgba(210, 180, 140, 0.08);
  border-radius: 16rpx;
  border-left: 6rpx solid #D2B48C;
}

.milk-text {
  display: block;
  font-size: 24rpx;
  color: #D2B48C;
  margin-bottom: 6rpx;
}

.ai-extra-info {
  margin-top: 30rpx;
  padding-top: 30rpx;
  border-top: 1px dashed #444;
}

.flavor-tags {
  display: flex;
  flex-wrap: wrap;
  margin-bottom: 20rpx;
}

.flavor-tag {
  background: rgba(210, 180, 140, 0.1);
  color: #D2B48C;
  font-size: 20rpx;
  padding: 4rpx 16rpx;
  border-radius: 20rpx;
  margin-right: 12rpx;
  margin-bottom: 10rpx;
  border: 1px solid rgba(210, 180, 140, 0.2);
}

.ai-advice {
  font-size: 24rpx;
  color: #aaa;
  line-height: 1.6;
  background: rgba(255, 255, 255, 0.03);
  padding: 16rpx;
  border-radius: 12rpx;
}

.advice-label {
  color: #D2B48C;
  font-weight: bold;
}

/* 确认按钮样式 */
.confirm-wrapper {
  display: flex;
  justify-content: center;
  margin-top: 30rpx;
  padding-top: 20rpx;
  border-top: 1px solid #2a2a2a;
}

.confirm-btn {
  background: #D2B48C;
  color: #121212;
  font-size: 28rpx;
  font-weight: bold;
  padding: 0 60rpx;
  height: 70rpx;
  line-height: 70rpx;
  border-radius: 35rpx;
  border: none;
}

.confirm-btn::after {
  border: none;
}

.confirm-btn:active {
  opacity: 0.8;
}

.start-btn {
  margin-top: 40rpx;
  background: linear-gradient(to right, #D2B48C, #B8860B);
  color: #121212;
  font-weight: bold;
  border-radius: 50rpx;
  height: 110rpx;
  line-height: 110rpx;
  font-size: 34rpx;
  box-shadow: 0 10rpx 30rpx rgba(210, 180, 140, 0.3);
  border: none;
}

.start-btn::after {
  border: none;
}

.start-btn:active {
  opacity: 0.9;
  transform: translateY(2rpx);
}
</style>
