<template>
	<view class="page-container">
		<!-- 顶部区域 -->
		<view class="top-section">
			<text class="app-title">7.5英寸模板编辑</text>
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
				<image class="template-image" src="/static/moban75.jpg" mode="aspectFit"></image>
				
				<!-- 中心文字预览 -->
				<view 
					class="center-text-preview"
					:style="{
						color: currentColor,
						fontFamily: currentFont,
						fontSize: (currentFontSize * 0.5) + 'px',
						textAlign: 'center'
					}"
					v-if="currentText"
				>
					{{ currentText }}
				</view>
			</view>
			
			<!-- 隐藏的Canvas用于合并图层 -->
			<canvas 
				canvas-id="mergeCanvas" 
				class="hidden-canvas"
				style="width: 800px; height: 480px;"
			></canvas>
			
			<!-- 处理Canvas -->
			<canvas 
				canvas-id="processCanvas" 
				class="hidden-canvas"
				style="width: 800px; height: 480px;"
			></canvas>
			<canvas 
				canvas-id="blackWhiteCanvas" 
				class="hidden-canvas"
				style="width: 800px; height: 480px;"
			></canvas>
			<canvas 
				canvas-id="redWhiteCanvas" 
				class="hidden-canvas"
				style="width: 800px; height: 480px;"
			></canvas>
		</view>
		
		<!-- 工具栏 -->
		<view class="toolbar">
			<!-- 文字输入区域 -->
			<view class="input-section">
				<input 
					class="text-input" 
					v-model="currentText" 
					placeholder="输入文字内容"
					@input="updateCurrentText"
				/>
			</view>
			
			<!-- 字体大小选择 -->
			<view class="font-size-section">
				<text class="section-label">字体大小</text>
				<view class="font-size-control">
					<button class="size-btn" @click="decreaseFontSize">-</button>
					<text class="size-display">{{ currentFontSize }}px</text>
					<button class="size-btn" @click="increaseFontSize">+</button>
				</view>
			</view>
			
			<!-- 字体选择 -->
			<view class="font-section">
				<text class="section-label">字体</text>
				<view class="font-options">
					<view 
						v-for="font in fontOptions" 
						:key="font.value"
						class="font-option"
						:class="{ 'active': currentFont === font.value }"
						@click="selectFont(font.value)"
					>
						<text class="font-preview" :style="{ fontFamily: font.value }">{{ font.name }}</text>
					</view>
				</view>
			</view>
			
			<!-- 颜色选择 -->
			<view class="color-section">
				<text class="section-label">颜色</text>
				<view class="color-options">
					<view 
						v-for="color in colorOptions" 
						:key="color.value"
						class="color-option"
						:class="{ 'active': currentColor === color.value }"
						@click="selectColor(color.value)"
					>
						<view class="color-circle" :style="{ backgroundColor: color.value }"></view>
						<text class="color-name">{{ color.name }}</text>
					</view>
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
					<text class="sending-progress">{{ currentPacket }}/{{ totalPackets }} 包</text>
					<view class="loading-dots">
						<text class="dot">.</text>
						<text class="dot">.</text>
						<text class="dot">.</text>
					</view>
				</view>
			</view>
			
			<!-- 操作按钮 -->
			<view class="action-buttons">
				<button class="action-btn clear-btn" @click="clearText">
					清空文字
				</button>
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
				// 当前字体
				currentFont: 'Arial',
				// 当前字体大小
				currentFontSize: 16,
				// 当前颜色
				currentColor: '#000000',
				// 合并后的图片数据
				mergedImageData: null,
				// 合并延迟定时器
				mergeTimeout: null,
				// 处理后的数据
				processedData: {
					blackWhiteImage: null,  // 黑白图片
					redWhiteImage: null,    // 红白图片（红色转为黑色）
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
				// 发送队列
				sendQueue: [],
				isSending: false,
				// 字体选项
				fontOptions: [
					{ name: 'Arial', value: 'Arial' },
					{ name: 'Times', value: 'Times New Roman' },
					{ name: 'Courier', value: 'Courier New' },
					{ name: 'Helvetica', value: 'Helvetica' },
					{ name: 'Georgia', value: 'Georgia' }
				],
				// 颜色选项
				colorOptions: [
					{ name: '黑色', value: '#000000' },
					{ name: '红色', value: '#FF0000' },
					{ name: '白色', value: '#FFFFFF' }
				]
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
			// 更新当前文字
			updateCurrentText() {
				// 实时更新预览，并在有文字时自动合并图层
				if (this.currentText.trim()) {
					// 延迟执行合并，避免频繁操作
					clearTimeout(this.mergeTimeout);
					this.mergeTimeout = setTimeout(() => {
						this.autoMergeLayers();
					}, 1000); // 1秒后自动合并
				}
			},
			
			// 增加字体大小
			increaseFontSize() {
				if (this.currentFontSize < 48) {
					this.currentFontSize += 2;
					// 字体大小改变时自动合并
					if (this.currentText.trim()) {
						clearTimeout(this.mergeTimeout);
						this.mergeTimeout = setTimeout(() => {
							this.autoMergeLayers();
						}, 500);
					}
				}
			},
			
			// 减少字体大小
			decreaseFontSize() {
				if (this.currentFontSize > 8) {
					this.currentFontSize -= 2;
					// 字体大小改变时自动合并
					if (this.currentText.trim()) {
						clearTimeout(this.mergeTimeout);
						this.mergeTimeout = setTimeout(() => {
							this.autoMergeLayers();
						}, 500);
					}
				}
			},
			
			// 选择字体
			selectFont(font) {
				this.currentFont = font;
				// 字体改变时自动合并
				if (this.currentText.trim()) {
					clearTimeout(this.mergeTimeout);
					this.mergeTimeout = setTimeout(() => {
						this.autoMergeLayers();
					}, 500);
				}
			},
			
			// 选择颜色
			selectColor(color) {
				this.currentColor = color;
				// 颜色改变时自动合并
				if (this.currentText.trim()) {
					clearTimeout(this.mergeTimeout);
					this.mergeTimeout = setTimeout(() => {
						this.autoMergeLayers();
					}, 500);
				}
			},
			
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
				if (!this.currentText.trim()) {
					return;
				}
				
				try {
					// 使用Canvas API合并文字和图片
					const canvasId = 'mergeCanvas';
					const ctx = uni.createCanvasContext(canvasId, this);
					
					// 获取模板图片信息
					const templateImage = '/static/moban75.jpg';
					
					// 绘制模板图片
					ctx.drawImage(templateImage, 0, 0, 800, 480);
					
					// 设置文字样式
					// 直接使用与CSS预览相同的字体大小
					ctx.setFontSize(this.currentFontSize);
					ctx.setFillStyle(this.currentColor);
					ctx.setTextAlign('center');
					ctx.setTextBaseline('middle');
					
					// 在中心位置绘制文字
					ctx.fillText(this.currentText, 400, 120);
					
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
					
					// 设置Canvas尺寸为墨水屏尺寸 (800x480像素)
					const canvasWidth = 800;
					const canvasHeight = 480;
					
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
								
								// 处理黑白图层 - 提取黑色像素
								this.createBlackWhiteImage(imageData.data, canvasWidth, canvasHeight);
								
								// 处理红白图层 - 提取红色像素并转为黑色
								this.createRedWhiteImage(imageData.data, canvasWidth, canvasHeight);
								
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
			
			// 创建黑白图片（提取黑色像素）
			createBlackWhiteImage(imageData, width, height) {
				const canvasId = 'blackWhiteCanvas';
				const ctx = uni.createCanvasContext(canvasId, this);
				
				// 清空画布并设置白色背景
				ctx.clearRect(0, 0, width, height);
				ctx.setFillStyle('#FFFFFF');
				ctx.fillRect(0, 0, width, height);
				
				// 遍历像素数据，提取黑色像素
				for (let y = 0; y < height; y++) {
					for (let x = 0; x < width; x++) {
						const index = (y * width + x) * 4;
						const r = imageData[index];
						const g = imageData[index + 1];
						const b = imageData[index + 2];
						const a = imageData[index + 3];
						
						// 判断是否为黑色像素 (RGB值都很低，且不是红色)
						const isBlack = r < 100 && g < 100 && b < 100 && a > 0;
						// 排除红色像素
						const isNotRed = !(r > 150 && g < 100 && b < 100);
						
						if (isBlack && isNotRed) {
							// 绘制黑色像素
							ctx.setFillStyle('#000000');
							ctx.fillRect(x, y, 1, 1);
						}
					}
				}
				
				// 绘制完成
				ctx.draw(false, () => {
					// 转换为图片
					uni.canvasToTempFilePath({
						canvasId: canvasId,
						success: (res) => {
							this.processedData.blackWhiteImage = res.tempFilePath;
						},
						fail: (err) => {
						}
					}, this);
				});
			},
			
			// 创建红白图片（提取红色像素并转为黑色）
			createRedWhiteImage(imageData, width, height) {
				const canvasId = 'redWhiteCanvas';
				const ctx = uni.createCanvasContext(canvasId, this);
				
				// 清空画布并设置白色背景
				ctx.clearRect(0, 0, width, height);
				ctx.setFillStyle('#FFFFFF');
				ctx.fillRect(0, 0, width, height);
				
				// 遍历像素数据，提取红色像素并转为黑色
				for (let y = 0; y < height; y++) {
					for (let x = 0; x < width; x++) {
						const index = (y * width + x) * 4;
						const r = imageData[index];
						const g = imageData[index + 1];
						const b = imageData[index + 2];
						const a = imageData[index + 3];
						
						// 判断是否为红色像素 (R值高，G和B值低)
						const isRed = r > 150 && g < 100 && b < 100 && a > 0;
						
						if (isRed) {
							// 将红色像素转为黑色
							ctx.setFillStyle('#000000');
							ctx.fillRect(x, y, 1, 1);
						}
					}
				}
				
				// 绘制完成
				ctx.draw(false, () => {
					// 转换为图片
					uni.canvasToTempFilePath({
						canvasId: canvasId,
						success: (res) => {
							this.processedData.redWhiteImage = res.tempFilePath;
						},
						fail: (err) => {
						}
					}, this);
				});
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
				}
			},
			
			// 申请MTU
			async requestMTU(mtu) {
				try {
(`尝试申请MTU到${mtu}字节`);
					
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
(`MTU申请成功，实际MTU: ${actualMTU}字节`);
					
					// 减去协议头尾的6个字节
					const maxDataLength = actualMTU - 6;
(`可用数据长度: ${maxDataLength}字节`);
					
					return maxDataLength;
				} catch (error) {
('申请MTU失败:', error);
					
					// 如果申请失败，使用默认的MTU
					const maxDataLength = 506 - 6; // 506字节MTU减去6字节协议头尾
(`使用默认MTU: ${maxDataLength}字节`);
					return maxDataLength;
				}
			},
			
			// 发送数组数据
			async sendArrayData(dataArray, dataType) {
				const totalLength = dataArray.length;
				
				// 使用506字节数据包
				const maxDataLength = 506 - 6; // 减去协议头尾6字节
				const totalPackets = Math.ceil(totalLength / maxDataLength);
				
(`发送${dataType === 0x25 ? '黑白' : '红白'}数组，共${totalPackets}个包，每包${maxDataLength}字节`);
(`数组总长度: ${totalLength}字节`);
				
				this.totalPackets = totalPackets;
				this.currentPacket = 0;
				
				// 使用队列机制，确保前一个写入操作完成后再发送下一个包
				for (let i = 0; i < totalPackets; i++) {
					const startIndex = i * maxDataLength;
					const endIndex = Math.min(startIndex + maxDataLength, totalLength);
					const packetData = dataArray.slice(startIndex, endIndex);
					
(`发送第${i + 1}/${totalPackets}包，数据长度: ${packetData.length}字节`);
					
					// 构建数据包 - 数组包永远不是尾包，只有最后的尾包才是尾包
					const packet = this.buildDataPacket(packetData, dataType, false);
					
					// 等待前一个包发送完成后再发送下一个包
					await this.sendPacketWithQueue(packet);
(`第${i + 1}包发送成功`);
					
					this.currentPacket = i + 1;
					
					// 包间延迟200ms
					await new Promise(resolve => setTimeout(resolve, 200));
				}
				
(`${dataType === 0x25 ? '黑白' : '红白'}数组发送完成，共发送${totalPackets}个包`);
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
				
(`构建数据包: 长度=${packet.length}, 数据类型=0x${dataType.toString(16)}, 数据长度=${dataLength}, 尾包=${isLastPacket}`);
				
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
					} catch (error) {
						reject(error);
					}
				}
				
				this.isSending = false;
			},
			
			// 发送单个数据包
			async sendPacket(packet) {
				try {
					// 检查连接状态
					if (!this.isBluetoothConnected) {
						throw new Error('BLE设备未连接');
					}
					
					// 检查设备ID
					if (!this.currentDeviceId) {
						throw new Error('没有设备ID，请重新连接设备');
					}
					
('使用设备ID:', this.currentDeviceId);
					
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
(`使用可写特征值: ${characteristic.uuid}`);
(`特征值属性:`, characteristic.properties);
					
					// 将Uint8Array转换为ArrayBuffer
					const arrayBuffer = packet.buffer.slice(packet.byteOffset, packet.byteOffset + packet.byteLength);
					
					// 根据特征值属性选择合适的写入方式
					const useWriteNoResponse = characteristic.properties && characteristic.properties.writeNoResponse;
(`使用写入方式: ${useWriteNoResponse ? 'writeNoResponse' : 'write'}`);
					
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
					
(`发送数据包成功，长度: ${packet.length}字节`);
					
				} catch (error) {
('发送数据包失败:', error);
					
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
						throw new Error(`发送失败: ${error.message}`);
					}
				}
			},
			
			// 加载模板
			loadTemplate() {
				// 加载保存的文字设置
				const savedText = uni.getStorageSync('template_text');
				if (savedText) {
					this.currentText = savedText.text || '';
					this.currentFont = savedText.font || 'Arial';
					this.currentFontSize = savedText.fontSize || 16;
					this.currentColor = savedText.color || '#000000';
				}
			},
			
			// 保存当前设置
			saveCurrentSettings() {
				const settings = {
					text: this.currentText,
					font: this.currentFont,
					fontSize: this.currentFontSize,
					color: this.currentColor
				};
				uni.setStorageSync('template_text', settings);
			}
		},
		
		// 监听数据变化，自动保存设置
		watch: {
			currentText() {
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
		max-width: 600rpx;
		height: 360rpx;
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

	/* 中心文字预览样式 */
	.center-text-preview {
		position: absolute;
		top: 25%;
		left: 50%;
		transform: translate(-50%, -50%);
		pointer-events: none;
		user-select: none;
		text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.3);
		max-width: 80%;
		word-wrap: break-word;
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

	.input-section {
		margin-bottom: 30rpx;
		display: flex;
		justify-content: center;
	}

	.text-input {
		width: 80%;
		max-width: 500rpx;
		height: 80rpx;
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
		justify-content: center;
		gap: 20rpx;
	}

	.size-btn {
		width: 60rpx;
		height: 60rpx;
		border-radius: 50%;
		background-color: #87CEEB;
		color: #ffffff;
		font-size: 32rpx;
		font-weight: bold;
		border: none;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s ease;
	}

	.size-btn:active {
		background-color: #7BC4E8;
		transform: scale(0.95);
	}

	.size-display {
		font-size: 28rpx;
		font-weight: 600;
		color: #333333;
		min-width: 80rpx;
		text-align: center;
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
	
	.sending-progress {
		font-size: 24rpx;
		color: #666;
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
