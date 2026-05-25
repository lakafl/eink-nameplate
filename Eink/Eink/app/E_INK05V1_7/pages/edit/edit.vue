<template>
	<view class="page-container">
		<!-- 顶部区域 -->
		<view class="top-section">
			<text class="app-title">4.2英寸模板编辑</text>
			<!-- 蓝牙状态显示 -->
			<view class="bluetooth-status" :class="{ 'connected': isBluetoothConnected }">
				<text class="status-icon">{{ isBluetoothConnected ? '●' : '○' }}</text>
				<text class="status-text">{{ isBluetoothConnected ? (connectedDeviceName || '已连接') : '请先在主页面连接蓝牙设备' }}</text>
				<button v-if="!isBluetoothConnected" class="connect-btn" @click="goToMainPage">
					返回主页面连接
				</button>
			</view>
		</view>
		
		<!-- 编辑区域 -->
		<view class="edit-area">
			<!-- 模板图片容器 -->
			<view class="template-container">
				<image class="template-image" src="/static/moban.jpg" mode="aspectFit"></image>
				
				<!-- 单位文字预览（顶部65px位置） -->
				<view 
					class="unit-text-preview"
					:style="{
						fontFamily: currentFont,
						fontSize: getUnitPreviewFontSizePx() + 'px',
						fontWeight: 'bold',
						textAlign: 'center'
					}"
				>
					{{ currentUnit && currentUnit.trim() ? currentUnit : '单位' }}
				</view>
				
				<!-- 姓名文字预览（175px位置） -->
				<view 
					class="name-text-preview"
					:style="{
						color: currentColor,
						fontFamily: currentFont,
						fontSize: getNamePreviewFontSizePx() + 'px',
						fontWeight: 'bold',
						textAlign: 'center'
					}"
				>
					{{ currentText && currentText.trim() ? currentText : '姓名' }}
				</view>
				
				<!-- 职务文字预览（190px位置） -->
				<view 
					class="position-text-preview"
					:style="{
						color: currentColor,
						fontFamily: currentFont,
						fontSize: getPositionPreviewFontSizePx() + 'px',
						fontWeight: 'bold',
						textAlign: 'center'
					}"
				>
					{{ currentPosition && currentPosition.trim() ? currentPosition : '职务' }}
				</view>
			</view>
			
			<!-- 隐藏的Canvas用于合并图层 -->
			<canvas 
				canvas-id="mergeCanvas" 
				class="hidden-canvas"
				style="width: 400px; height: 300px;"
			></canvas>
			
			<!-- 处理Canvas -->
			<canvas 
				canvas-id="processCanvas" 
				class="hidden-canvas"
				style="width: 400px; height: 300px;"
			></canvas>
		</view>
		
		<!-- 工具栏 -->
		<view class="toolbar">
			<!-- 单位输入区域（顶部22%） -->
			<view class="unit-input-section">
				<text class="input-label">单位</text>
				<input 
					class="text-input" 
					v-model="currentUnit" 
					placeholder="请输入单位"
					@input="updateCurrentUnit"
				/>
			</view>
			
			<!-- 姓名输入区域（底部78%） -->
			<view class="name-input-section">
				<text class="input-label">姓名</text>
				<input 
					class="text-input" 
					v-model="currentText" 
					placeholder="请输入姓名"
					@input="updateCurrentText"
				/>
			</view>
			
			<!-- 职务输入区域 -->
			<view class="position-input-section">
				<text class="input-label">职务</text>
				<input 
					class="text-input" 
					v-model="currentPosition" 
					placeholder="请输入职务"
					@input="updateCurrentPosition"
				/>
			</view>
			
			<!-- 单位字体大小调节 -->
			<view class="font-size-section">
				<text class="section-label">单位字体大小</text>
				<view class="font-size-control">
					<text class="size-label">小</text>
					<slider 
						class="font-size-slider"
						:value="currentUnitFontSize"
						:min="20"
						:max="60"
						:step="5"
						@change="onUnitFontSizeChange"
						activeColor="#87CEEB"
						backgroundColor="#e9ecef"
					/>
					<text class="size-label">大</text>
					<view class="size-display">{{ currentUnitFontSize }}px</view>
				</view>
			</view>
			
			<!-- 姓名字体大小调节 -->
			<view class="font-size-section">
				<text class="section-label">姓名字体大小</text>
				<view class="font-size-control">
					<text class="size-label">小</text>
					<slider 
						class="font-size-slider"
						:value="currentNameFontSize"
						:min="40"
						:max="120"
						:step="10"
						@change="onNameFontSizeChange"
						activeColor="#87CEEB"
						backgroundColor="#e9ecef"
					/>
					<text class="size-label">大</text>
					<view class="size-display">{{ currentNameFontSize }}px</view>
				</view>
			</view>
			
			<!-- 处理状态显示 -->
			<view class="processing-status" v-if="processedData.processing">
				<view class="processing-indicator">
					<text class="processing-text">正在处理图片...</text>
					<view class="loading-dots">
						<text class="dot">.</text>
						<text class="dot">.</text>
						<text class="dot">.</text>
					</view>
				</view>
			</view>
			
			
			<!-- 发送状态显示 -->
			<view class="sending-status" v-if="sendingData">
				<view class="sending-indicator">
					<text class="sending-text">正在发送数据...</text>
					<view class="progress-container">
						<view class="progress-bar">
							<view class="progress-fill" :style="{ width: sendProgress + '%' }"></view>
						</view>
						<text class="progress-text">{{ Math.round(sendProgress) }}%</text>
					</view>
				</view>
			</view>
			
			<!-- 操作按钮（仅保留发送） -->
			<view class="action-buttons">
				<button class="action-btn send-btn" @click="sendDataToDevice" :disabled="!processedData.blackWhiteArray || !processedData.redWhiteArray || !isBluetoothConnected || sendingData">
					{{ sendingData ? '发送中...' : '发送数据' }}
				</button>
			</view>
		</view>
	</view>
</template>

<script>
	import bleManager from '@/utils/bleManager.js'
	
	export default {
		data() {
			return {
				// 当前输入的文字
				currentText: '',
				// 当前输入的单位
				currentUnit: '',
				// 当前输入的职务
				currentPosition: '',
				// 当前字体（固定楷体）
				currentFont: 'STKaiti, KaiTi, 楷体, 楷体_GB2312, cursive',
				// 当前字体大小（固定100px）
				currentFontSize: 100,
				// 单位字体大小
				currentUnitFontSize: 40,
				// 姓名字体大小
				currentNameFontSize: 100,
				// 当前颜色（固定白色）
				currentColor: '#FFFFFF',
				// 合并后的图片数据
				mergedImageData: null,
				// 合并延迟定时器
				mergeTimeout: null,
				// 处理后的数据
				processedData: {
					blackWhiteArray: null,  // 黑白图层C数组
					redWhiteArray: null,   // 红白图层C数组
					processing: false       // 处理状态
				},
				// 蓝牙状态
				isBluetoothConnected: false,
				// 当前连接的设备ID
				currentDeviceId: null,
				// 连接的设备名称
				connectedDeviceName: null,
				// 发现的服务
				services: [],
				// 发现的特征值
				characteristics: [],
				// 数据发送状态
				sendingData: false,
				currentPacket: 0,
				totalPackets: 0,
				sendProgress: 0,
				// 发送队列
				sendQueue: [],
				isSending: false,
				// 自适应发送参数
				adaptiveTiming: {
					baseInterval: 200,        // 基础间隔时间（ms）
					currentInterval: 200,     // 当前间隔时间（ms）
					successCount: 0,          // 连续成功次数
					failureCount: 0,          // 连续失败次数
					minInterval: 100,         // 最小间隔时间（ms）
					maxInterval: 500,         // 最大间隔时间（ms）
					adjustmentStep: 50        // 调整步长（ms）
				},
				// 删除字体与颜色选项
				fontOptions: [],
				colorOptions: []
			}
		},
		onLoad() {
			// 页面加载时初始化
			this.loadTemplate();
			this.initBluetooth();
		},
		onShow() {
			// 页面显示时同步并尝试继承主页面的连接
			this.syncFromBleStatus();
			this.ensureConnectionFromCache();
		},
		onUnload() {
			// 页面卸载时清理蓝牙资源
			// 注意：uni-app的蓝牙事件监听在页面卸载时会自动清理
			// 不需要手动调用off方法
		},
		methods: {
			// 计算单位预览字体像素大小：基于模板预览显示大小进行比例缩放
			getUnitPreviewFontSizePx() {
				// 实际模板尺寸：400*300px，单位文字可调节字体大小
				// 根据模板预览容器的实际显示大小进行比例缩放
				try {
					const sys = uni.getSystemInfoSync();
					const containerWidth = sys.windowWidth - 40; // 减去左右padding
					const scale = containerWidth / 400; // 模板宽度缩放比例
					return Math.round(this.currentUnitFontSize * scale);
				} catch (e) {
					return this.currentUnitFontSize; // 兜底
				}
			},
			
			// 计算姓名预览字体像素大小：基于模板预览显示大小进行比例缩放
			getNamePreviewFontSizePx() {
				// 实际模板尺寸：400*300px，姓名文字可调节字体大小
				// 根据模板预览容器的实际显示大小进行比例缩放
				try {
					const sys = uni.getSystemInfoSync();
					const containerWidth = sys.windowWidth - 40; // 减去左右padding
					const scale = containerWidth / 400; // 模板宽度缩放比例
					return Math.round(this.currentNameFontSize * scale);
				} catch (e) {
					return this.currentNameFontSize; // 兜底
				}
			},
			
			// 计算职务预览字体像素大小：基于模板预览显示大小进行比例缩放
			getPositionPreviewFontSizePx() {
				// 实际模板尺寸：400*300px，职务文字使用50px
				// 根据模板预览容器的实际显示大小进行比例缩放
				try {
					const sys = uni.getSystemInfoSync();
					const containerWidth = sys.windowWidth - 40; // 减去左右padding
					const scale = containerWidth / 400; // 模板宽度缩放比例
					return Math.round(50 * scale);
				} catch (e) {
					return 50; // 兜底
				}
			},
			// 更新当前单位
			updateCurrentUnit() {
				// 实时更新预览，并在有文字时自动合并图层
				if (this.currentUnit.trim() || this.currentText.trim()) {
					// 延迟执行合并，避免频繁操作
					clearTimeout(this.mergeTimeout);
					this.mergeTimeout = setTimeout(() => {
						this.autoMergeLayers();
					}, 1000); // 1秒后自动合并
				}
			},
			
			// 更新当前文字
			updateCurrentText() {
				// 实时更新预览，并在有文字时自动合并图层
				if (this.currentUnit.trim() || this.currentText.trim() || this.currentPosition.trim()) {
					// 延迟执行合并，避免频繁操作
					clearTimeout(this.mergeTimeout);
					this.mergeTimeout = setTimeout(() => {
						this.autoMergeLayers();
					}, 1000); // 1秒后自动合并
				}
			},
			
			// 更新当前职务
			updateCurrentPosition() {
				// 实时更新预览，并在有文字时自动合并图层
				if (this.currentUnit.trim() || this.currentText.trim() || this.currentPosition.trim()) {
					// 延迟执行合并，避免频繁操作
					clearTimeout(this.mergeTimeout);
					this.mergeTimeout = setTimeout(() => {
						this.autoMergeLayers();
					}, 1000); // 1秒后自动合并
				}
			},
			
			// 单位字体大小拖动条变化处理
			onUnitFontSizeChange(e) {
				this.currentUnitFontSize = e.detail.value;
				// 字体大小改变时自动合并
				if (this.currentUnit.trim() || this.currentText.trim() || this.currentPosition.trim()) {
					clearTimeout(this.mergeTimeout);
					this.mergeTimeout = setTimeout(() => {
						this.autoMergeLayers();
					}, 500);
				}
			},
			
			// 姓名字体大小拖动条变化处理
			onNameFontSizeChange(e) {
				this.currentNameFontSize = e.detail.value;
				// 字体大小改变时自动合并
				if (this.currentText.trim() || this.currentUnit.trim() || this.currentPosition.trim()) {
					clearTimeout(this.mergeTimeout);
					this.mergeTimeout = setTimeout(() => {
						this.autoMergeLayers();
					}, 500);
				}
			},
			
			// 字体大小拖动条变化处理
			onFontSizeChange(e) {},
			
			// 选择字体
			selectFont(font) {},
			
			// 选择颜色
			selectColor(color) {},
			
			// 清空文字
			clearText() {
				this.currentText = '';
				clearTimeout(this.mergeTimeout);
				uni.showToast({
					title: '文字已清空',
					icon: 'success'
				});
			},
			
			// 自动合并图层（静默执行）
			async autoMergeLayers() {
				if (!this.currentUnit.trim() && !this.currentText.trim()) {
					return;
				}
				
				try {
					// 使用Canvas API合并文字和图片
					const canvasId = 'mergeCanvas';
					const ctx = uni.createCanvasContext(canvasId, this);
					
					// 获取模板图片信息
					const templateImage = '/static/moban.jpg';
					
					// 绘制模板图片
					ctx.drawImage(templateImage, 0, 0, 400, 300);
					
					ctx.setTextAlign('center');
					ctx.setTextBaseline('middle');
					
				// 绘制单位文字（从上往下38px位置，黑色字体，可调节字体大小）
				if (this.currentUnit.trim()) {
					ctx.setFontSize(this.currentUnitFontSize); // 单位文字使用可调节字体大小
					ctx.setFillStyle('#000000'); // 单位文字使用黑色
					ctx.font = `bold ${this.currentUnitFontSize}px ${this.currentFont}`; // 设置粗体
					ctx.fillText(this.currentUnit, 200, 38);
				}
					
				// 绘制姓名文字（165px位置，白色字体，可调节字体大小）
				if (this.currentText.trim()) {
					ctx.setFontSize(this.currentNameFontSize); // 姓名文字使用可调节字体大小
					ctx.setFillStyle('#FFFFFF'); // 姓名文字使用白色
					ctx.font = `bold ${this.currentNameFontSize}px ${this.currentFont}`; // 设置粗体
					ctx.fillText(this.currentText, 200, 165);
				}
					
				// 绘制职务文字（260px位置，白色字体，50px，粗体）
				if (this.currentPosition.trim()) {
					ctx.setFontSize(50); // 职务文字使用50px字体
					ctx.setFillStyle('#FFFFFF'); // 职务文字使用白色
					ctx.font = `bold 50px ${this.currentFont}`; // 设置粗体
					ctx.fillText(this.currentPosition, 200, 260);
				}
					
					// 执行绘制
					ctx.draw(false, () => {
						// 将Canvas转换为图片
						uni.canvasToTempFilePath({
							canvasId: canvasId,
							success: (res) => {
								this.mergedImageData = res.tempFilePath;
								// 只保存到内存，不保存到相册
								// 自动处理图片
								this.processImage();
							},
							fail: (err) => {
							}
						}, this);
					});
					
				} catch (error) {
				}
			},
			
			// 处理图片，分离图层
			async processImage() {
				if (!this.mergedImageData) {
					return;
				}
				
				this.processedData.processing = true;
				
				try {
					// 创建Canvas用于图片处理
					const processCanvasId = 'processCanvas';
					const ctx = uni.createCanvasContext(processCanvasId, this);
					
					// 设置Canvas尺寸为墨水屏尺寸 (400x300像素)
					const canvasWidth = 400;
					const canvasHeight = 300;
					
					// 绘制合并后的图片
					ctx.drawImage(this.mergedImageData, 0, 0, canvasWidth, canvasHeight);
					ctx.draw(false, () => {
						// 获取图片数据
						uni.canvasGetImageData({
							canvasId: processCanvasId,
							x: 0,
							y: 0,
							width: canvasWidth,
							height: canvasHeight,
							success: (imageData) => {
								
								
								// 转换为C数组
								this.convertToArrays(imageData.data, canvasWidth, canvasHeight);
								
								this.processedData.processing = false;
							},
							fail: (err) => {
								this.processedData.processing = false;
							}
						}, this);
					});
					
				} catch (error) {
					this.processedData.processing = false;
				}
			},
			
			
			// 转换为C数组
			convertToArrays(imageData, width, height) {
				
				// 计算每行需要的字节数 (每8个像素为1字节)
				const bytesPerRow = Math.ceil(width / 8);
				const totalBytes = bytesPerRow * height;
				
				
				// 转换黑白图层
				this.processedData.blackWhiteArray = this.pixelsToByteArray(imageData, width, height, 'blackWhite');
				
				// 转换红白图层
				this.processedData.redWhiteArray = this.pixelsToByteArray(imageData, width, height, 'redWhite');
				
			},
			
			// 将像素数据转换为字节数组
			pixelsToByteArray(imageData, width, height, type) {
				
				// 计算每行字节数
				const bytesPerRow = Math.ceil(width / 8);
				const totalBytes = bytesPerRow * height;
				const result = new Uint8Array(totalBytes);
				
				// 按行处理像素
				for (let y = 0; y < height; y++) {
					for (let x = 0; x < width; x += 8) {
						let byteValue = 0;
						
						// 处理每8个像素
						for (let bit = 0; bit < 8; bit++) {
							const pixelX = x + bit;
							if (pixelX < width) {
								const pixelIndex = (y * width + pixelX) * 4;
								const r = imageData[pixelIndex];
								const g = imageData[pixelIndex + 1];
								const b = imageData[pixelIndex + 2];
								const a = imageData[pixelIndex + 3];
								
								// 判断像素是否应该显示
								let shouldDisplay = false;
								
								if (type === 'blackWhite') {
									// 黑白图层：黑色像素显示，白色像素不显示
									shouldDisplay = r < 128 && g < 128 && b < 128 && a > 0;
								} else if (type === 'redWhite') {
									// 红白图层：红色像素显示，白色像素不显示
									shouldDisplay = r > 128 && g < 128 && b < 128 && a > 0;
								}
								
								// 设置对应的位 (从高位到低位)
								if (shouldDisplay) {
									byteValue |= (1 << (7 - bit));
								}
							}
						}
						
						// 存储字节值
						const byteIndex = y * bytesPerRow + Math.floor(x / 8);
						if (byteIndex < totalBytes) {
							result[byteIndex] = byteValue;
						}
					}
				}
				
				return result;
			},
			
			
			// 初始化蓝牙
			async initBluetooth() {
				try {
					// 统一使用 bleManager，避免多页面重复初始化
					const ok = await bleManager.initBluetooth();
					if (!ok) {
						uni.showToast({
							title: '蓝牙初始化失败',
							icon: 'none'
						});
						return;
					}
					this.bindBleCallbacks();
					await this.syncFromBleStatus();
					await this.ensureConnectionFromCache();
				} catch (error) {
					uni.showToast({
						title: '蓝牙初始化失败',
						icon: 'none'
					});
				}
			},
			// 统一绑定 bleManager 回调，保持状态同步
			bindBleCallbacks() {
				bleManager.setCallback('onDeviceConnected', (data) => {
					this.isBluetoothConnected = true;
					this.currentDeviceId = data?.deviceId || data?.connectedDevice || null;
					const cached = uni.getStorageSync('bluetooth_connected_device') || {};
					const deviceName = data?.deviceName || cached.deviceName || '已连接设备';
					this.connectedDeviceName = deviceName;
					if (this.currentDeviceId) {
						uni.setStorageSync('bluetooth_connected_device', {
							deviceId: this.currentDeviceId,
							deviceName,
							connected: true,
							connectTime: Date.now()
						});
					}
				});
				
				bleManager.setCallback('onDeviceDisconnected', () => {
					this.isBluetoothConnected = false;
					this.currentDeviceId = null;
					this.connectedDeviceName = null;
					this.services = [];
					this.characteristics = [];
					uni.removeStorageSync('bluetooth_connected_device');
				});
				
				bleManager.setCallback('onServicesDiscovered', (res) => {
					this.services = res?.services || [];
					this.characteristics = res?.characteristics || [];
				});
				
				bleManager.setCallback('onError', (err) => {
					console.log('蓝牙错误：', err);
				});
			},
			
			// 从 bleManager 同步一次状态
			syncFromBleStatus() {
				const status = bleManager.getConnectionStatus();
				this.isBluetoothConnected = status.isConnected;
				this.currentDeviceId = status.connectedDevice;
				this.services = status.services || [];
				this.characteristics = status.characteristics || [];
				if (status.connectedDevice && !this.connectedDeviceName) {
					const cached = uni.getStorageSync('bluetooth_connected_device');
					this.connectedDeviceName = cached?.deviceName || null;
				}
			},
			
			// 确保从主页面缓存继承或重连
			async ensureConnectionFromCache() {
				const cached = uni.getStorageSync('bluetooth_connected_device');
				const status = bleManager.getConnectionStatus();
				
				// 已连接则仅同步并补充服务
				if (status.isConnected) {
					this.isBluetoothConnected = true;
					this.currentDeviceId = status.connectedDevice;
					if (!this.connectedDeviceName && cached?.deviceName) {
						this.connectedDeviceName = cached.deviceName;
					}
					if (!this.services.length || !this.characteristics.length) {
						await this.refreshServices();
					}
					return;
				}
				
				// 尝试用缓存信息重连
				if (cached && cached.connected && cached.deviceId) {
					try {
						const ok = await bleManager.connectDevice(cached.deviceId);
						if (ok) {
							this.isBluetoothConnected = true;
							this.currentDeviceId = cached.deviceId;
							this.connectedDeviceName = cached.deviceName || '已连接设备';
							uni.setStorageSync('bluetooth_connected_device', {
								...cached,
								connected: true,
								connectTime: Date.now()
							});
							await this.refreshServices();
							return;
						}
					} catch (error) {
						console.log('缓存设备重连失败:', error);
					}
				}
				
				// 兜底：视为未连接
				this.isBluetoothConnected = false;
				this.currentDeviceId = null;
				this.connectedDeviceName = null;
			},
			
			// 重新发现服务/特征值
			async refreshServices() {
				if (!this.currentDeviceId) return;
				const res = await bleManager.discoverServices();
				if (res) {
					this.services = res.services || [];
					this.characteristics = res.characteristics || [];
					if (res.targetServiceFound) {
						uni.showToast({
							title: '已发现目标服务',
							icon: 'none'
						});
					}
				}
			},
			
			// 返回主页面
			goToMainPage() {
				uni.navigateBack({
					delta: 1,
					success: () => {
					},
					fail: (err) => {
						// 如果返回失败，尝试直接跳转到主页面
						uni.reLaunch({
							url: '/pages/index/index'
						});
					}
				});
			},
			
			// 自适应调整发送间隔时间
			adjustSendInterval(success) {
				if (success) {
					this.adaptiveTiming.successCount++;
					this.adaptiveTiming.failureCount = 0;
					
					// 连续成功3次后，尝试缩短间隔时间
					if (this.adaptiveTiming.successCount >= 3) {
						this.adaptiveTiming.currentInterval = Math.max(
							this.adaptiveTiming.minInterval,
							this.adaptiveTiming.currentInterval - this.adaptiveTiming.adjustmentStep
						);
						this.adaptiveTiming.successCount = 0;
						console.log(`发送成功，缩短间隔时间至: ${this.adaptiveTiming.currentInterval}ms`);
					}
				} else {
					this.adaptiveTiming.failureCount++;
					this.adaptiveTiming.successCount = 0;
					
					// 失败时立即增加间隔时间
					this.adaptiveTiming.currentInterval = Math.min(
						this.adaptiveTiming.maxInterval,
						this.adaptiveTiming.currentInterval + this.adaptiveTiming.adjustmentStep
					);
					console.log(`发送失败，增加间隔时间至: ${this.adaptiveTiming.currentInterval}ms`);
				}
			},
			
			// 重置自适应参数
			resetAdaptiveTiming() {
				this.adaptiveTiming.currentInterval = this.adaptiveTiming.baseInterval;
				this.adaptiveTiming.successCount = 0;
				this.adaptiveTiming.failureCount = 0;
			},
			
			// 发送数据到设备
			async sendDataToDevice() {
				if (!this.isBluetoothConnected) {
					uni.showToast({
						title: '蓝牙未连接',
						icon: 'none'
					});
					return;
				}
				
				if (!this.processedData.blackWhiteArray || !this.processedData.redWhiteArray) {
					uni.showToast({
						title: '没有可发送的数据',
						icon: 'none'
					});
					return;
				}
				
				this.sendingData = true;
				this.sendProgress = 0;
				// 重置自适应参数
				this.resetAdaptiveTiming();
				// 清空发送队列
				this.sendQueue = [];
				this.isSending = false;
				
				uni.showLoading({
					title: '正在发送数据...'
				});
				
				try {
					// 申请MTU
					const maxDataLength = await this.requestMTU(506);
					
					// 发送黑白数组
					await this.sendArrayData(this.processedData.blackWhiteArray, 0x25);
('黑白数组发送完成');
					
					// 发送红白数组
('开始发送红白数组...');
					await this.sendArrayData(this.processedData.redWhiteArray, 0x14);
('红白数组发送完成');
					
					// 发送尾包
('开始发送尾包...');
					await this.sendTailPacket();
('尾包发送完成');
					
					uni.hideLoading();
					uni.showToast({
						title: '数据发送完成',
						icon: 'success'
					});
					
('数据发送完成');
					
				} catch (error) {
					uni.hideLoading();
('发送数据失败:', error);
					uni.showModal({
						title: '发送失败',
						content: `发送数据失败: ${error.message || '未知错误'}`,
						showCancel: false
					});
				} finally {
					this.sendingData = false;
					this.currentPacket = 0;
					this.totalPackets = 0;
					this.sendProgress = 0;
				}
			},
			
			// 申请MTU
			async requestMTU(mtu) {
				try {
console.log(`尝试申请MTU到${mtu}字节`);
					
					if (!this.currentDeviceId) {
						throw new Error('没有设备ID，无法申请MTU');
					}
					
('MTU申请使用的设备ID:', this.currentDeviceId);
					
					// 使用uni-app的BLE API申请MTU
					const result = await new Promise((resolve, reject) => {
						uni.setBLEMTU({
							deviceId: this.currentDeviceId,
							mtu: mtu,
							success: (res) => {
('MTU申请成功:', res);
								resolve(res);
							},
							fail: (err) => {
('MTU申请失败:', err);
								reject(err);
							}
						});
					});
					
					// 如果申请成功，使用申请的MTU值
					const actualMTU = result.mtu || mtu;
console.log(`MTU申请成功，实际MTU: ${actualMTU}字节`);
					
					// 减去协议头尾的6个字节
					const maxDataLength = actualMTU - 6;
console.log(`可用数据长度: ${maxDataLength}字节`);
					
					return maxDataLength;
				} catch (error) {
('申请MTU失败:', error);
					
					// 如果申请失败，使用默认的MTU
					const maxDataLength = 506 - 6; // 506字节MTU减去6字节协议头尾
console.log(`使用默认MTU: ${maxDataLength}字节`);
					return maxDataLength;
				}
			},
			
			// 发送数组数据
			async sendArrayData(dataArray, dataType) {
				const totalLength = dataArray.length;
				
				// 使用506字节数据包
				const maxDataLength = 506 - 6; // 减去协议头尾6字节
				const totalPackets = Math.ceil(totalLength / maxDataLength);
				
console.log(`发送${dataType === 0x25 ? '黑白' : '红白'}数组，共${totalPackets}个包，每包${maxDataLength}字节`);
console.log(`数组总长度: ${totalLength}字节`);
				
				this.totalPackets = totalPackets;
				this.currentPacket = 0;
				
				// 使用队列机制，确保前一个写入操作完成后再发送下一个包
				for (let i = 0; i < totalPackets; i++) {
					const startIndex = i * maxDataLength;
					const endIndex = Math.min(startIndex + maxDataLength, totalLength);
					const packetData = dataArray.slice(startIndex, endIndex);
					
console.log(`发送第${i + 1}/${totalPackets}包，数据长度: ${packetData.length}字节`);
					
					// 构建数据包 - 数组包永远不是尾包，只有最后的尾包才是尾包
					const packet = this.buildDataPacket(packetData, dataType, false);
					
					// 等待前一个包发送完成后再发送下一个包
					await this.sendPacketWithQueue(packet);
					console.log(`第${i + 1}包发送成功`);
					
					// 记录发送成功，调整间隔时间
					this.adjustSendInterval(true);
					
					this.currentPacket = i + 1;
					// 更新进度：当前包数 / 总包数 * 100
					this.sendProgress = (this.currentPacket / this.totalPackets) * 100;
					
					// 使用自适应间隔时间
					await new Promise(resolve => setTimeout(resolve, this.adaptiveTiming.currentInterval));
				}
				
console.log(`${dataType === 0x25 ? '黑白' : '红白'}数组发送完成，共发送${totalPackets}个包`);
			},
			
			// 构建数据包
			buildDataPacket(data, dataType, isLastPacket) {
				// 数据包结构：0xAA + 尾包判断 + 数据类型 + 数据长度(2字节) + 数据 + 填充 + 0x63
				const packet = new Uint8Array(506);
				let index = 0;
				
				// 固定帧头
				packet[index++] = 0xAA;
				
				// 尾包判断位
				packet[index++] = isLastPacket ? 0xFF : 0x00;
				
				// 数据类型
				packet[index++] = dataType;
				
				// 有效数据长度（大端模式）
				const dataLength = data.length;
				packet[index++] = (dataLength >> 8) & 0xFF; // 高字节
				packet[index++] = dataLength & 0xFF;        // 低字节
				
				// 有效数据
				for (let i = 0; i < data.length; i++) {
					packet[index++] = data[i];
				}
				
				// 填充剩余字节为0x00
				while (index < 499) {
					packet[index++] = 0x00;
				}
				
				// 固定帧尾
				packet[index++] = 0x63;
				
console.log(`构建数据包: 长度=${packet.length}, 数据类型=0x${dataType.toString(16)}, 数据长度=${dataLength}, 尾包=${isLastPacket}`);
				
				return packet;
			},
			
			// 发送尾包
			async sendTailPacket() {
				// 尾包结构：0xAA + 0xFF + 0x00 + 0x00 + 0x00 + 填充 + 0x63
				const tailPacket = new Uint8Array(506);
				let index = 0;
				
				// 固定帧头
				tailPacket[index++] = 0xAA;
				
				// 尾包判断位
				tailPacket[index++] = 0xFF;
				
				// 数据类型（尾包）
				tailPacket[index++] = 0x00;
				
				// 有效数据长度（0）
				tailPacket[index++] = 0x00;
				tailPacket[index++] = 0x00;
				
				// 填充剩余字节为0x00
				while (index < 499) {
					tailPacket[index++] = 0x00;
				}
				
				// 固定帧尾
				tailPacket[index++] = 0x63;
				
				await this.sendPacketWithQueue(tailPacket);
('尾包发送完成');
			},
			
			// 使用队列机制发送数据包
			async sendPacketWithQueue(packet) {
				return new Promise((resolve, reject) => {
					// 将数据包添加到队列
					this.sendQueue.push({
						packet: packet,
						resolve: resolve,
						reject: reject
					});
					
					// 如果当前没有在发送，开始处理队列
					if (!this.isSending) {
						this.processSendQueue();
					}
				});
			},
			
			// 处理发送队列
			async processSendQueue() {
				if (this.isSending || this.sendQueue.length === 0) {
					return;
				}
				
				this.isSending = true;
				
				while (this.sendQueue.length > 0) {
					const { packet, resolve, reject } = this.sendQueue.shift();
					
					try {
						await this.sendPacket(packet);
						resolve();
						// 只在队列中还有数据包时才添加短暂延迟
						if (this.sendQueue.length > 0) {
							await new Promise(resolve => setTimeout(resolve, 50));
						}
					} catch (error) {
						reject(error);
					}
				}
				
				this.isSending = false;
			},
			
			// 发送单个数据包（带重试机制）
			async sendPacket(packet, retryCount = 0) {
				const maxRetries = 3; // 最大重试次数
				try {
					// 检查连接状态
					if (!this.isBluetoothConnected) {
						throw new Error('BLE设备未连接');
					}
					
					// 检查设备ID
					if (!this.currentDeviceId) {
						throw new Error('没有设备ID，请重新连接设备');
					}
					
					console.log('使用设备ID:', this.currentDeviceId);
					
					// 检查特征值
					if (!this.characteristics || this.characteristics.length === 0) {
						throw new Error('没有发现特征值，请确保已发现服务');
					}
					
					// 查找可写的特征值，优先使用writeNoResponse
					const writeableCharacteristics = this.characteristics.filter(char => {
(`检查特征值 ${char.uuid}:`, {
							properties: char.properties,
							hasWrite: char.properties && char.properties.write,
							hasWriteNoResponse: char.properties && char.properties.writeNoResponse
						});
						
						// 检查是否有写入相关的属性
						return char.properties && (char.properties.write || char.properties.writeNoResponse);
					});
					
					// 按优先级排序：writeNoResponse > write
					writeableCharacteristics.sort((a, b) => {
						const aHasWriteNoResponse = a.properties && a.properties.writeNoResponse;
						const bHasWriteNoResponse = b.properties && b.properties.writeNoResponse;
						
						if (aHasWriteNoResponse && !bHasWriteNoResponse) return -1;
						if (!aHasWriteNoResponse && bHasWriteNoResponse) return 1;
						return 0;
					});
					
('找到的可写特征值:', writeableCharacteristics);
					
					if (writeableCharacteristics.length === 0) {
						throw new Error('没有找到可写的特征值，请确保设备支持写入操作');
					}
					
					// 使用第一个可写的特征值
					const characteristic = writeableCharacteristics[0];
console.log(`使用可写特征值: ${characteristic.uuid}`);
(`特征值属性:`, characteristic.properties);
					
					// 将Uint8Array转换为ArrayBuffer
					const arrayBuffer = packet.buffer.slice(packet.byteOffset, packet.byteOffset + packet.byteLength);
					
					// 根据特征值属性选择合适的写入方式
					const useWriteNoResponse = characteristic.properties && characteristic.properties.writeNoResponse;
console.log(`使用写入方式: ${useWriteNoResponse ? 'writeNoResponse' : 'write'}`);
					
					// 使用uni-app原生方法写入特征值
					await new Promise((resolve, reject) => {
						uni.writeBLECharacteristicValue({
							deviceId: this.currentDeviceId,
							serviceId: characteristic.serviceId,
							characteristicId: characteristic.uuid,
							value: arrayBuffer,
							writeType: useWriteNoResponse ? 'writeNoResponse' : 'write',
							success: (res) => {
('写入特征值成功:', res);
								resolve(res);
							},
							fail: (err) => {
('写入特征值失败:', err);
								// 如果write失败，尝试writeNoResponse
								if (!useWriteNoResponse && characteristic.properties && characteristic.properties.writeNoResponse) {
('尝试使用writeNoResponse方式');
									uni.writeBLECharacteristicValue({
										deviceId: this.currentDeviceId,
										serviceId: characteristic.serviceId,
										characteristicId: characteristic.uuid,
										value: arrayBuffer,
										writeType: 'writeNoResponse',
										success: (res) => {
('使用writeNoResponse写入成功:', res);
											resolve(res);
										},
										fail: (err2) => {
('writeNoResponse也失败:', err2);
											reject(new Error(`写入失败: ${err.errMsg || err.message || '未知错误'}`));
										}
									});
								} else {
									reject(new Error(`写入失败: ${err.errMsg || err.message || '未知错误'}`));
								}
							}
						});
					});
					
console.log(`发送数据包成功，长度: ${packet.length}字节`);
					
				} catch (error) {
					console.log(`发送数据包失败 (尝试 ${retryCount + 1}/${maxRetries + 1}):`, error);
					
					// 如果是写入失败且还有重试次数，则重试
					if (retryCount < maxRetries && (
						error.message.includes('写入失败') || 
						error.message.includes('write') ||
						error.message.includes('characteristic')
					)) {
						// 记录发送失败，调整间隔时间
						this.adjustSendInterval(false);
						
						// 使用当前自适应间隔时间进行重试延迟
						const retryDelay = Math.max(this.adaptiveTiming.currentInterval * 2, 300);
						console.log(`等待 ${retryDelay}ms 后重试...`);
						await new Promise(resolve => setTimeout(resolve, retryDelay));
						return this.sendPacket(packet, retryCount + 1);
					}
					
					// 提供更详细的错误信息
					if (error.message.includes('特征值无法写入') || (error.message.includes('写入失败') && error.message.includes('特征值'))) {
						throw new Error('写入失败，请重启设备');
					} else if (error.message.includes('property not support')) {
						throw new Error('特征值不支持写入操作，请检查设备是否支持数据写入');
					} else if (error.message.includes('没有发现任何特征值')) {
						throw new Error('没有发现任何特征值，请确保：\n1. 设备已连接\n2. 已发现服务\n3. 设备支持写入操作');
					} else if (error.message.includes('没有找到可写的特征值')) {
						throw new Error('没有找到可写的特征值，请确保：\n1. 设备支持写入操作\n2. 特征值权限正确\n3. 服务已正确发现');
					} else {
						throw new Error(`发送失败 (已重试${retryCount}次): ${error.message}`);
					}
				}
			},
			
			// 加载模板
			loadTemplate() {
				// 固定默认设置，并设置初始占位文案
				this.currentFont = 'STKaiti, KaiTi, 楷体, 楷体_GB2312, cursive';
				this.currentFontSize = 100;
				this.currentColor = '#FFFFFF';
				if (!this.currentUnit) {
					this.currentUnit = '';
				}
				if (!this.currentText) {
					this.currentText = '';
				}
			},
			
			// 保存当前设置
			saveCurrentSettings() {
				const settings = {
					unit: this.currentUnit,
					text: this.currentText,
					position: this.currentPosition,
					font: 'STKaiti, KaiTi, 楷体, 楷体_GB2312, cursive',
					fontSize: 100,
					unitFontSize: this.currentUnitFontSize,
					nameFontSize: this.currentNameFontSize,
					color: '#FFFFFF'
				};
				uni.setStorageSync('template_text', settings);
			}
		},
		
		// 监听数据变化，自动保存设置
		watch: {
			currentUnit() {
				this.saveCurrentSettings();
			},
			currentText() {
				this.saveCurrentSettings();
			},
			currentPosition() {
				this.saveCurrentSettings();
			},
			currentUnitFontSize() {
				this.saveCurrentSettings();
			},
			currentNameFontSize() {
				this.saveCurrentSettings();
			},
			currentFont() {
				this.saveCurrentSettings();
			},
			currentFontSize() {
				this.saveCurrentSettings();
			},
			currentColor() {
				this.saveCurrentSettings();
			}
		}
	}
</script>

<style>
	.page-container {
		height: 100vh;
		display: flex;
		flex-direction: column;
		background-color: #f5f5f5;
	}

	/* 顶部区域样式 */
	.top-section {
		height: 12vh;
		background: linear-gradient(135deg, #87CEEB 0%, #B0E0E6 100%);
		border-radius: 0 0 30rpx 30rpx;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.1);
	}

	.app-title {
		font-size: 40rpx;
		font-weight: bold;
		color: #ffffff;
		text-shadow: 0 2rpx 4rpx rgba(0, 0, 0, 0.2);
	}

	/* 蓝牙状态样式 */
	.bluetooth-status {
		position: absolute;
		right: 30rpx;
		bottom: 20rpx;
		display: flex;
		align-items: center;
		gap: 8rpx;
		padding: 8rpx 16rpx;
		background-color: rgba(255, 255, 255, 0.2);
		border-radius: 20rpx;
		backdrop-filter: blur(10rpx);
	}

	.bluetooth-status.connected {
		background-color: rgba(76, 175, 80, 0.3);
	}

	.status-icon {
		font-size: 24rpx;
		color: #ffffff;
	}

	.bluetooth-status.connected .status-icon {
		color: #4CAF50;
	}

	.status-text {
		font-size: 20rpx;
		color: #ffffff;
		font-weight: 500;
	}

	.connect-btn {
		margin-left: 10rpx;
		padding: 4rpx 12rpx;
		background-color: #2196F3;
		color: #ffffff;
		border: none;
		border-radius: 12rpx;
		font-size: 18rpx;
		font-weight: 500;
	}

	/* 编辑区域样式 */
	.edit-area {
		flex: 1;
		padding: 20rpx;
		display: flex;
		justify-content: center;
		align-items: center;
	}

	.template-container {
		position: relative;
		width: 100%;
		max-width: 100%;
		height: calc(100vw * 0.75);
		border-radius: 20rpx;
		overflow: hidden;
		box-shadow: 0 8rpx 24rpx rgba(0, 0, 0, 0.15);
		background-color: #ffffff;
	}

	.template-image {
		width: 100%;
		height: 100%;
		object-fit: contain;
	}

	/* 单位文字预览样式（从上往下32px位置） */
	.unit-text-preview {
		position: absolute;
		top: 38px;
		left: 50%;
		transform: translate(-50%, -50%);
		pointer-events: none;
		user-select: none;
		text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.3);
		max-width: 90%;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		line-height: 1.2;
		color: #000000 !important; /* 单位文字使用黑色 */
	}

	/* 姓名文字预览样式（165px位置） */
	.name-text-preview {
		position: absolute;
		top: 165px;
		left: 50%;
		transform: translate(-50%, -50%);
		pointer-events: none;
		user-select: none;
		text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.3);
		max-width: 90%;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		line-height: 1.2;
	}

	/* 职务文字预览样式（260px位置） */
	.position-text-preview {
		position: absolute;
		top: 260px;
		left: 50%;
		transform: translate(-50%, -50%);
		pointer-events: none;
		user-select: none;
		text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.3);
		max-width: 90%;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		line-height: 1.2;
	}

	/* 隐藏的Canvas */
	.hidden-canvas {
		position: absolute;
		top: -9999px;
		left: -9999px;
		visibility: hidden;
	}

	/* 工具栏样式 */
	.toolbar {
		height: 50vh;
		background-color: #ffffff;
		border-radius: 30rpx 30rpx 0 0;
		padding: 30rpx;
		box-shadow: 0 -4rpx 12rpx rgba(0, 0, 0, 0.1);
		overflow-y: auto;
	}

	.unit-input-section {
		display: flex;
		align-items: center;
		justify-content: center;
		margin-bottom: 5rpx;
		padding: 5rpx 0;
	}

	.name-input-section {
		display: flex;
		align-items: center;
		justify-content: center;
		margin-bottom: 5rpx;
		padding: 5rpx 0;
	}

	.position-input-section {
		display: flex;
		align-items: center;
		justify-content: center;
		margin-bottom: 5rpx;
		padding: 5rpx 0;
	}

	.input-label {
		font-size: 28rpx;
		font-weight: 600;
		color: #333333;
		margin-right: 15rpx;
		width: 60rpx;
		text-align: right;
	}

	.text-input {
		width: 70%;
		max-width: 500rpx;
		height: 60rpx;
		padding: 0 20rpx;
		border: 2rpx solid #e9ecef;
		border-radius: 12rpx;
		font-size: 28rpx;
		background-color: #f8f9fa;
	}

	.section-label {
		font-size: 28rpx;
		font-weight: 600;
		color: #333333;
		margin-bottom: 20rpx;
		display: block;
	}

	.font-size-section, .font-section, .color-section {
		margin-bottom: 30rpx;
	}

	.font-size-control {
		display: flex;
		align-items: center;
		gap: 20rpx;
		margin-bottom: 15rpx;
	}

	.size-label {
		font-size: 24rpx;
		color: #666666;
		font-weight: 500;
		min-width: 60rpx;
		text-align: center;
	}

	.font-size-slider {
		flex: 1;
		height: 40rpx;
	}

	.size-display {
		font-size: 28rpx;
		font-weight: 600;
		color: #87CEEB;
		text-align: center;
		background-color: #f8f9fa;
		padding: 10rpx 20rpx;
		border-radius: 20rpx;
		border: 2rpx solid #87CEEB;
	}

	.font-options, .color-options {
		display: flex;
		flex-wrap: wrap;
		gap: 15rpx;
	}

	.font-option {
		padding: 15rpx 20rpx;
		border: 2rpx solid #e9ecef;
		border-radius: 12rpx;
		background-color: #f8f9fa;
		transition: all 0.2s ease;
	}

	.font-option.active {
		border-color: #87CEEB;
		background-color: #e3f2fd;
	}

	.font-preview {
		font-size: 24rpx;
		color: #333333;
	}

	.color-option {
		display: flex;
		align-items: center;
		padding: 15rpx 20rpx;
		border: 2rpx solid #e9ecef;
		border-radius: 12rpx;
		background-color: #f8f9fa;
		transition: all 0.2s ease;
	}

	.color-option.active {
		border-color: #87CEEB;
		background-color: #e3f2fd;
	}

	.color-circle {
		width: 30rpx;
		height: 30rpx;
		border-radius: 50%;
		margin-right: 15rpx;
		border: 2rpx solid #ddd;
	}

	.color-name {
		font-size: 24rpx;
		color: #333333;
	}

	.action-buttons {
		display: flex;
		gap: 20rpx;
		justify-content: space-between;
		margin-top: 30rpx;
		width: 100%;
	}

	.action-btn {
		flex: 1;
		height: 80rpx;
		border-radius: 12rpx;
		font-size: 28rpx;
		font-weight: 600;
		border: none;
		transition: all 0.2s ease;
	}

	.clear-btn {
		background-color: #ff6b6b;
		color: #ffffff;
	}


	.send-btn {
		background-color: #87CEEB;
		color: #ffffff;
	}

	.send-btn:disabled {
		background-color: #cccccc;
		color: #999999;
	}

	.action-btn:active {
		transform: scale(0.95);
	}
	
	/* 发送状态样式 */
	.sending-status {
		margin: 20rpx 0;
		padding: 20rpx;
		background-color: #f8f9fa;
		border-radius: 12rpx;
		border: 2rpx solid #87CEEB;
	}
	
	.sending-indicator {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 10rpx;
	}
	
	.sending-text {
		font-size: 28rpx;
		color: #87CEEB;
		font-weight: 600;
	}
	
	.progress-container {
		width: 100%;
		display: flex;
		align-items: center;
		gap: 15rpx;
		margin-top: 10rpx;
	}
	
	.progress-bar {
		flex: 1;
		height: 8rpx;
		background-color: #e9ecef;
		border-radius: 4rpx;
		overflow: hidden;
	}
	
	.progress-fill {
		height: 100%;
		background-color: #87CEEB;
		border-radius: 4rpx;
		transition: width 0.3s ease;
	}
	
	.progress-text {
		font-size: 24rpx;
		color: #87CEEB;
		font-weight: 600;
		min-width: 60rpx;
		text-align: center;
	}
	
	/* 处理状态样式 */
	.processing-status {
		margin: 20rpx 0;
		padding: 20rpx;
		background-color: #f8f9fa;
		border-radius: 12rpx;
		border: 2rpx solid #87CEEB;
	}
	
	.processing-indicator {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 15rpx;
	}
	
	.processing-text {
		font-size: 28rpx;
		color: #87CEEB;
		font-weight: 600;
	}
	
	.loading-dots {
		display: flex;
		gap: 4rpx;
	}
	
	.dot {
		font-size: 32rpx;
		color: #87CEEB;
		font-weight: bold;
		animation: loading 1.5s infinite;
	}
	
	.dot:nth-child(2) {
		animation-delay: 0.2s;
	}
	
	.dot:nth-child(3) {
		animation-delay: 0.4s;
	}
	
	@keyframes loading {
		0%, 20% {
			opacity: 0;
		}
		50% {
			opacity: 1;
		}
		100% {
			opacity: 0;
		}
	}
	
</style>
