<template>
	<view class="page-container">
		<!-- 顶部区域 -->
		<view class="top-section">
			<text class="app-title">SWU电子座牌</text>
		</view>
		
		<!-- 选择框区域 -->
		<view class="selection-area">
			<!-- 墨水屏尺寸选择框 -->
			<view class="selection-box">
				<text class="selection-label">墨水屏尺寸选择</text>
				<view class="selection-content" @click="showSizeOptions">
					<text class="selection-text">{{selectedSize}}</text>
					<text class="dropdown-arrow">▼</text>
				</view>
				<!-- 尺寸选项下拉框 -->
				<view class="dropdown-options" v-if="showSizeDropdown">
					<view class="option-item" @click="selectSize('4.2英寸三色墨水屏')">
						<text>4.2英寸三色墨水屏</text>
					</view>
					<view class="option-item" @click="selectSize('7.5英寸三色墨水屏')">
						<text>7.5英寸三色墨水屏</text>
					</view>
				</view>
			</view>
			
			<!-- 蓝牙连接选择框 -->
			<view class="selection-box">
				<text class="selection-label">蓝牙连接</text>
				<view class="selection-content" @click="showBluetoothOptions">
					<text class="selection-text">{{selectedBluetooth}}</text>
					<text class="dropdown-arrow">▼</text>
				</view>
				<!-- 蓝牙选项下拉框 -->
				<view class="dropdown-options" v-if="showBluetoothDropdown">
					<view class="option-item" @click="startBluetoothScan" v-if="!isScanning && !isConnected">
						<text>扫描设备</text>
					</view>
					<view class="option-item" @click="retryInitBluetooth" v-if="!isScanning && !isConnected">
						<text class="retry-text">重新初始化蓝牙</text>
					</view>
					<view class="option-item scanning-item" v-if="isScanning">
						<view class="scanning-info">
							<view class="scanning-status">
								<text class="scanning-text">正在扫描</text>
								<view class="scanning-dots">
									<text class="dot">.</text>
									<text class="dot">.</text>
									<text class="dot">.</text>
								</view>
							</view>
						</view>
						<view class="stop-scan-btn" @click="stopBluetoothScan">
							<text class="stop-scan-text">停止</text>
						</view>
					</view>
					
					<!-- 设备列表滚动区域 -->
					<scroll-view 
						class="device-list-scroll" 
						scroll-y="true" 
						v-if="bluetoothDevices.length > 0"
					>
						<view 
							class="option-item device-item" 
							v-for="device in bluetoothDevices" 
							:key="device.deviceId"
							@click="connectBluetoothDevice(device)"
						>
							<view class="device-info">
								<text class="device-name">{{device.name || device.localName || '未知设备'}}</text>
								<text class="device-id">{{device.deviceId}}</text>
							</view>
							<view class="device-signal">
								<text class="device-rssi">{{device.RSSI}}dBm</text>
								<view class="signal-bar" :class="getSignalClass(device.RSSI)"></view>
							</view>
						</view>
					</scroll-view>
					
					<view class="option-item" @click="disconnectBluetooth" v-if="isConnected">
						<text>断开连接</text>
					</view>
					<view class="option-item" @click="discoverServices" v-if="isConnected">
						<text>发现服务</text>
					</view>
				</view>
			</view>
		</view>
		
		<!-- 底部跳转按钮 -->
		<view class="bottom-button" @click="goToTemplate">
			<text class="button-text">模板选择</text>
		</view>
	</view>
</template>

<script>
	import bleManager from '@/utils/bleManager.js'
	
	export default {
		data() {
			return {
				selectedSize: '请选择尺寸',
				selectedBluetooth: '请选择蓝牙设备',
				showSizeDropdown: false,
				showBluetoothDropdown: false,
				bluetoothDevices: [],
				isScanning: false,
				isConnected: false,
				connectedDevice: null,
				services: [],
				characteristics: [],
				permissionChecked: false // 权限检查状态
			}
		},
		onLoad() {
			// 检查权限检查状态
			this.checkPermissionStatus();
			
			// 延迟初始化蓝牙
			// 微信小程序中，蓝牙初始化可能需要在用户交互中触发，但uni-app框架应该已处理
			setTimeout(() => {
				this.initBluetooth();
			}, 1000);
		},
		onShow() {
			// 页面显示时检查蓝牙状态
			// 如果之前初始化失败，可以在这里提示用户
			if (this.selectedBluetooth === '蓝牙初始化失败，点击重试' || 
			    this.selectedBluetooth === '蓝牙初始化错误，点击重试') {
				// 可以在这里添加提示，但不强制
			}
		},
		onUnload() {
			// 页面卸载时清理蓝牙资源
			bleManager.cleanup();
		},
		methods: {
			checkPermissionStatus() {
				// 从本地存储获取权限检查状态
				const permissionStatus = uni.getStorageSync('bluetooth_permission_checked');
				if (permissionStatus) {
					this.permissionChecked = true;
					console.log('权限已检查过，跳过权限提示');
				} else {
					console.log('首次使用，需要检查权限');
				}
			},
			savePermissionStatus() {
				// 保存权限检查状态到本地存储
				uni.setStorageSync('bluetooth_permission_checked', true);
				console.log('权限检查状态已保存');
			},
			showSizeOptions() {
				this.showSizeDropdown = !this.showSizeDropdown;
				this.showBluetoothDropdown = false;
			},
			showBluetoothOptions() {
				this.showBluetoothDropdown = !this.showBluetoothDropdown;
				this.showSizeDropdown = false;
			},
			selectSize(size) {
				this.selectedSize = size;
				this.showSizeDropdown = false;
			},
			async initBluetooth() {
				try {
					console.log('开始初始化蓝牙...');
					const success = await bleManager.initBluetooth();
					if (success) {
						console.log('蓝牙初始化成功');
						// 设置回调函数
						bleManager.setCallback('onDeviceFound', this.onDeviceFound);
						bleManager.setCallback('onDeviceConnected', this.onDeviceConnected);
						bleManager.setCallback('onDeviceDisconnected', this.onDeviceDisconnected);
						bleManager.setCallback('onServicesDiscovered', this.onServicesDiscovered);
						bleManager.setCallback('onError', this.onBluetoothError);
						
						// 初始化成功后更新状态
						this.selectedBluetooth = '蓝牙已就绪';
					} else {
						console.log('蓝牙初始化失败');
						this.selectedBluetooth = '蓝牙初始化失败，点击重试';
						// 微信小程序中，静默失败，不显示弹窗，让用户点击"重新初始化蓝牙"按钮
						// #ifndef MP-WEIXIN
						uni.showModal({
							title: '蓝牙初始化失败',
							content: '请检查设备蓝牙是否开启，或点击"重新初始化蓝牙"重试',
							showCancel: false
						});
						// #endif
					}
				} catch (error) {
					console.log('蓝牙初始化错误:', error);
					this.selectedBluetooth = '蓝牙初始化错误，点击重试';
					// 微信小程序中，静默失败，不显示弹窗
					// #ifndef MP-WEIXIN
					uni.showModal({
						title: '蓝牙初始化错误',
						content: '请确保设备支持蓝牙功能并已开启蓝牙，或点击"重新初始化蓝牙"重试',
						showCancel: false
					});
					// #endif
				}
			},
			async startBluetoothScan() {
				try {
					// 从bleManager获取实际扫描状态，确保状态同步
					const status = bleManager.getConnectionStatus();
					if (status.isScanning) {
						uni.showToast({
							title: '正在扫描中，请稍候',
							icon: 'none'
						});
						return;
					}

					// 如果已经检查过权限，直接开始扫描
					if (this.permissionChecked) {
						console.log('权限已检查过，直接开始扫描');
						this.bluetoothDevices = [];
						this.selectedBluetooth = '正在扫描...';
						
						const success = await bleManager.startScan(4000, true); // 跳过权限检查
						if (success) {
							// 同步状态
							this.isScanning = true;
						} else {
							this.isScanning = false;
							this.selectedBluetooth = '扫描失败';
						}
						
						// 添加扫描状态检查，确保扫描会停止
						setTimeout(() => {
							const currentStatus = bleManager.getConnectionStatus();
							if (currentStatus.isScanning) {
								console.log('扫描状态检查：强制停止扫描');
								this.stopBluetoothScan();
							}
						}, 6000); // 6秒后强制检查
					} else {
						// 首次扫描，显示权限检查提示
						uni.showModal({
							title: '权限检查',
							content: '请确保已开启蓝牙和位置权限，然后点击确定开始扫描',
							success: async (res) => {
								if (res.confirm) {
									this.permissionChecked = true; // 标记权限已检查
									this.savePermissionStatus(); // 保存权限检查状态
									this.bluetoothDevices = [];
									this.selectedBluetooth = '正在扫描...';
									
									// 设置更短的扫描时间，避免一直扫描
									const success = await bleManager.startScan(4000); // 4秒扫描时间
									if (success) {
										// 同步状态
										this.isScanning = true;
									} else {
										this.isScanning = false;
										this.selectedBluetooth = '扫描失败';
									}
									
									// 添加扫描状态检查，确保扫描会停止
									setTimeout(() => {
										const currentStatus = bleManager.getConnectionStatus();
										if (currentStatus.isScanning) {
											console.log('扫描状态检查：强制停止扫描');
											this.stopBluetoothScan();
										}
									}, 6000); // 6秒后强制检查
								}
							}
						});
					}
				} catch (error) {
					console.log('开始扫描失败:', error);
					uni.showToast({
						title: '扫描失败',
						icon: 'none'
					});
					this.isScanning = false;
				}
			},
			async stopBluetoothScan() {
				try {
					console.log('用户手动停止扫描');
					await bleManager.stopScan();
					// 同步状态
					const status = bleManager.getConnectionStatus();
					this.isScanning = status.isScanning;
					
					if (this.bluetoothDevices.length === 0) {
						this.selectedBluetooth = '未发现BLE设备';
					} else {
						this.selectedBluetooth = '选择设备';
					}
					
					console.log('扫描已停止，状态已更新');
				} catch (error) {
					console.log('停止扫描失败:', error);
					// 同步状态
					const status = bleManager.getConnectionStatus();
					this.isScanning = status.isScanning;
					this.selectedBluetooth = '扫描停止失败';
				}
			},
			async retryInitBluetooth() {
				uni.showLoading({
					title: '重新初始化蓝牙...'
				});
				
				try {
					await bleManager.cleanup();
					await new Promise(resolve => setTimeout(resolve, 1000));
					
					const success = await bleManager.initBluetooth();
					uni.hideLoading();
					
					if (success) {
						bleManager.setCallback('onDeviceFound', this.onDeviceFound);
						bleManager.setCallback('onDeviceConnected', this.onDeviceConnected);
						bleManager.setCallback('onDeviceDisconnected', this.onDeviceDisconnected);
						bleManager.setCallback('onServicesDiscovered', this.onServicesDiscovered);
						bleManager.setCallback('onError', this.onBluetoothError);
						
						uni.showToast({
							title: '蓝牙初始化成功',
							icon: 'success'
						});
					} else {
						uni.showModal({
							title: '蓝牙初始化失败',
							content: '请检查设备蓝牙是否开启，或重新启动应用',
							showCancel: false
						});
					}
				} catch (error) {
					uni.hideLoading();
					console.log('重新初始化蓝牙失败:', error);
					uni.showModal({
						title: '重新初始化失败',
						content: '请确保设备支持蓝牙功能并已开启蓝牙',
						showCancel: false
					});
				}
			},
			async connectBluetoothDevice(device) {
				try {
					uni.showLoading({
						title: '连接设备中...'
					});
					
					const success = await bleManager.connectDevice(device.deviceId);
					if (success) {
						// 同步连接状态
						const status = bleManager.getConnectionStatus();
						this.connectedDevice = device;
						this.isConnected = status.isConnected;
						this.selectedBluetooth = `已连接: ${device.name || device.localName || '未知设备'}`;
						
						// 保存连接信息到本地存储，供其他页面使用
						uni.setStorageSync('bluetooth_connected_device', {
							deviceId: device.deviceId,
							deviceName: device.name || device.localName || '未知设备',
							connected: true,
							connectTime: Date.now()
						});
						
						uni.hideLoading();
						uni.showToast({
							title: '连接成功',
							icon: 'success'
						});
						this.showBluetoothDropdown = false;
					} else {
						// 同步连接状态
						const status = bleManager.getConnectionStatus();
						this.isConnected = status.isConnected;
						uni.hideLoading();
						uni.showToast({
							title: '连接失败',
							icon: 'none'
						});
					}
				} catch (error) {
					console.log('连接设备失败:', error);
					// 同步连接状态
					const status = bleManager.getConnectionStatus();
					this.isConnected = status.isConnected;
					uni.hideLoading();
					uni.showToast({
						title: '连接失败',
						icon: 'none'
					});
				}
			},
			async disconnectBluetooth() {
				try {
					await bleManager.disconnectDevice();
					// 同步连接状态
					const status = bleManager.getConnectionStatus();
					this.connectedDevice = null;
					this.isConnected = status.isConnected;
					this.selectedBluetooth = '未连接';
					this.services = [];
					this.characteristics = [];
					
					// 清除本地存储的连接信息
					uni.removeStorageSync('bluetooth_connected_device');
					uni.showToast({
						title: '已断开连接',
						icon: 'success'
					});
					this.showBluetoothDropdown = false;
				} catch (error) {
					console.log('断开连接失败:', error);
					// 同步连接状态
					const status = bleManager.getConnectionStatus();
					this.isConnected = status.isConnected;
					uni.showToast({
						title: '断开连接失败',
						icon: 'none'
					});
				}
			},
			async discoverServices() {
				try {
					uni.showLoading({
						title: '发现目标服务中...'
					});
					
					const result = await bleManager.discoverServices();
					uni.hideLoading();
					
					if (result) {
						this.services = result.services;
						this.characteristics = result.characteristics;
						
						// 根据是否找到目标服务显示不同的提示
						if (result.targetServiceFound) {
							uni.showModal({
								title: '目标服务发现成功',
								content: `成功找到目标服务 4fafc201-1fb5-459e-8fcc-c5c9c331914b\n发现 ${result.services.length} 个服务，${result.characteristics.length} 个特征值`,
								showCancel: false
							});
						} else {
							uni.showModal({
								title: '目标服务未找到',
								content: `未找到目标服务 4fafc201-1fb5-459e-8fcc-c5c9c331914b\n但发现了 ${result.services.length} 个其他服务，${result.characteristics.length} 个特征值`,
								showCancel: false
							});
						}
						
						console.log('服务发现完成:', result);
					} else {
						uni.showToast({
							title: '服务发现失败',
							icon: 'none'
						});
					}
				} catch (error) {
					uni.hideLoading();
					console.log('服务发现失败:', error);
					uni.showToast({
						title: '服务发现失败',
						icon: 'none'
					});
				}
			},
			// 蓝牙回调函数
			onDeviceFound(device) {
				console.log('发现设备:', device);
				this.bluetoothDevices.push(device);
			},
			onDeviceConnected(data) {
				console.log('设备已连接:', data);
				// 同步连接状态
				const status = bleManager.getConnectionStatus();
				this.isConnected = status.isConnected;
			},
			onDeviceDisconnected(data) {
				console.log('设备已断开:', data);
				// 同步连接状态
				const status = bleManager.getConnectionStatus();
				this.connectedDevice = null;
				this.isConnected = status.isConnected;
				this.selectedBluetooth = '未连接';
				this.services = [];
				this.characteristics = [];
				// 清除本地存储的连接信息
				uni.removeStorageSync('bluetooth_connected_device');
			},
			onServicesDiscovered(data) {
				console.log('发现服务:', data);
				this.services = data.services;
				this.characteristics = data.characteristics;
				
				// 检查是否找到目标服务
				if (data.targetServiceFound) {
					uni.showModal({
						title: '目标服务已找到',
						content: `成功找到目标服务 4fafc201-1fb5-459e-8fcc-c5c9c331914b，发现 ${data.services.length} 个服务，${data.characteristics.length} 个特征值`,
						showCancel: false
					});
				} else {
					uni.showModal({
						title: '未找到目标服务',
						content: `未找到目标服务 4fafc201-1fb5-459e-8fcc-c5c9c331914b，但发现了 ${data.services.length} 个其他服务`,
						showCancel: false
					});
				}
			},
			getSignalClass(rssi) {
				if (rssi > -50) return 'signal-excellent';
				if (rssi > -70) return 'signal-good';
				if (rssi > -85) return 'signal-fair';
				return 'signal-poor';
			},
			onBluetoothError(error) {
				console.log('蓝牙错误:', error);
				
				// 检查是否为 Windows 平台不支持蓝牙的错误
				if (error.isWindowsBluetoothError || 
					(error.errMsg && error.errMsg.includes('Mac 以外的平台')) ||
					(error.message && error.message.includes('Mac 系统'))) {
					uni.showModal({
						title: '平台限制提示',
						content: '微信开发者工具的蓝牙调试功能仅在 Mac 系统上支持，Windows 系统暂不支持。\n\n解决方案：\n1. 在 Mac 系统上使用微信开发者工具进行调试\n2. 使用真机预览功能，在 iOS 或 Android 设备上测试蓝牙功能\n3. 使用微信开发者工具的"真机调试"功能',
						showCancel: false,
						confirmText: '我知道了'
					});
					return;
				}
				
				if (error.code === 10001) {
					uni.showModal({
						title: '蓝牙权限被拒绝',
						content: '请在系统设置中开启蓝牙权限，然后重新启动应用',
						showCancel: false
					});
				} else if (error.code === 10000) {
					uni.showToast({
						title: '蓝牙适配器未初始化',
						icon: 'none',
						duration: 2000
					});
				} else if (error.message && error.message.includes('蓝牙未开启')) {
					uni.showModal({
						title: '蓝牙未开启',
						content: '请先在手机设置中开启蓝牙功能，然后重新尝试',
						showCancel: false
					});
				} else if (error.message && error.message.includes('位置权限')) {
					uni.showModal({
						title: '位置权限不足',
						content: 'Android系统需要位置权限才能扫描BLE设备，请在设置中开启位置权限',
						showCancel: false
					});
				} else {
					uni.showToast({
						title: '蓝牙操作失败',
						icon: 'none',
						duration: 2000
					});
				}
			},
			goToTemplate() {
				// 根据选择的墨水屏尺寸决定跳转页面
				if (this.selectedSize === '4.2英寸三色墨水屏') {
					// 跳转到4.2英寸模板页面
					uni.navigateTo({
						url: '/pages/template/template',
						success: function(res) {
							console.log('跳转到4.2英寸模板页面成功');
						},
						fail: function(err) {
							console.log('跳转到4.2英寸模板页面失败:', err);
							uni.showToast({
								title: '页面跳转失败，请重新启动项目',
								icon: 'none',
								duration: 3000
							});
						}
					});
				} else if (this.selectedSize === '7.5英寸三色墨水屏') {
					// 跳转到7.5英寸模板页面
					uni.navigateTo({
						url: '/pages/template/template75',
						success: function(res) {
							console.log('跳转到7.5英寸模板页面成功');
						},
						fail: function(err) {
							console.log('跳转到7.5英寸模板页面失败:', err);
							uni.showToast({
								title: '页面跳转失败，请重新启动项目',
								icon: 'none',
								duration: 3000
							});
						}
					});
				} else {
					// 未选择尺寸时，跳转到空白页面
					uni.navigateTo({
						url: '/pages/template/blank',
						success: function(res) {
							console.log('跳转到空白页面成功');
						},
						fail: function(err) {
							console.log('跳转到空白页面失败:', err);
							uni.showToast({
								title: '页面跳转失败，请重新启动项目',
								icon: 'none',
								duration: 3000
							});
						}
					});
				}
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
		height: 15vh;
		background: linear-gradient(135deg, #87CEEB 0%, #B0E0E6 100%);
		border-radius: 0 0 30rpx 30rpx;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.1);
	}

	.app-title {
		font-size: 48rpx;
		font-weight: bold;
		color: #ffffff;
		text-shadow: 0 2rpx 4rpx rgba(0, 0, 0, 0.2);
	}

	/* 选择框区域样式 */
	.selection-area {
		flex: 1;
		padding: 40rpx 30rpx;
		display: flex;
		flex-direction: column;
		gap: 30rpx;
	}

	.selection-box {
		background-color: #ffffff;
		border-radius: 20rpx;
		padding: 30rpx;
		box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.08);
		position: relative;
	}

	.selection-label {
		font-size: 32rpx;
		color: #333333;
		font-weight: 600;
		margin-bottom: 20rpx;
		display: block;
	}

	.selection-content {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 20rpx;
		background-color: #f8f9fa;
		border-radius: 12rpx;
		border: 2rpx solid #e9ecef;
		transition: all 0.3s ease;
	}

	.selection-content:active {
		background-color: #e9ecef;
		border-color: #87CEEB;
	}

	.selection-text {
		font-size: 28rpx;
		color: #666666;
		flex: 1;
	}

	.dropdown-arrow {
		font-size: 24rpx;
		color: #999999;
		transition: transform 0.3s ease;
	}

	/* 下拉选项样式 */
	.dropdown-options {
		position: absolute;
		top: 100%;
		left: 30rpx;
		right: 30rpx;
		background-color: #ffffff;
		border-radius: 12rpx;
		box-shadow: 0 8rpx 24rpx rgba(0, 0, 0, 0.15);
		z-index: 100;
		overflow: hidden;
		margin-top: 10rpx;
		max-height: 600rpx; /* 限制最大高度 */
	}

	/* 设备列表滚动区域 */
	.device-list-scroll {
		max-height: 400rpx; /* 限制设备列表高度 */
		overflow-y: auto;
	}

	.option-item {
		padding: 24rpx 20rpx;
		border-bottom: 1rpx solid #f0f0f0;
		transition: background-color 0.2s ease;
	}

	.option-item:last-child {
		border-bottom: none;
	}

	.option-item:active {
		background-color: #f8f9fa;
	}

	.option-item text {
		font-size: 28rpx;
		color: #333333;
	}

	.scanning-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 20rpx;
	}

	.scanning-info {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
	}

	.scanning-status {
		display: flex;
		align-items: center;
	}

	.scanning-text {
		color: #87CEEB;
		font-weight: 600;
		font-size: 28rpx;
	}

	.scanning-dots {
		display: flex;
		margin-left: 8rpx;
	}

	.dot {
		color: #87CEEB;
		font-size: 32rpx;
		font-weight: bold;
		animation: scanning 1.5s infinite;
		margin-right: 4rpx;
	}

	.dot:nth-child(2) {
		animation-delay: 0.2s;
	}

	.dot:nth-child(3) {
		animation-delay: 0.4s;
	}

	@keyframes scanning {
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

	.stop-scan-btn {
		padding: 12rpx 20rpx;
		background-color: #ff6b6b;
		border-radius: 12rpx;
		transition: all 0.2s ease;
	}

	.stop-scan-btn:active {
		background-color: #ff5252;
		transform: scale(0.95);
	}

	.stop-scan-text {
		font-size: 24rpx;
		color: #ffffff;
		font-weight: 600;
	}

	.retry-text {
		color: #ff6b6b;
		font-weight: 600;
	}

	.device-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16rpx 20rpx; /* 减少内边距 */
		min-height: 80rpx; /* 设置最小高度 */
	}

	.device-info {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		margin-right: 20rpx; /* 添加右边距 */
	}

	.device-name {
		font-size: 26rpx; /* 稍微减小字体 */
		color: #333333;
		font-weight: 600;
		margin-bottom: 2rpx; /* 减少间距 */
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 300rpx; /* 限制设备名称宽度 */
	}

	.device-id {
		font-size: 18rpx; /* 减小字体 */
		color: #999999;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 300rpx; /* 限制设备ID宽度 */
	}

	.device-signal {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		flex-shrink: 0; /* 防止收缩 */
	}

	.device-rssi {
		font-size: 20rpx; /* 减小字体 */
		color: #666666;
		margin-bottom: 4rpx;
	}

	.signal-bar {
		width: 32rpx; /* 减小宽度 */
		height: 6rpx; /* 减小高度 */
		border-radius: 3rpx;
	}

	.signal-excellent {
		background-color: #4CAF50;
	}

	.signal-good {
		background-color: #8BC34A;
	}

	.signal-fair {
		background-color: #FF9800;
	}

	.signal-poor {
		background-color: #F44336;
	}


	/* 底部按钮样式 */
	.bottom-button {
		height: 8vh;
		background: linear-gradient(135deg, #87CEEB 0%, #B0E0E6 100%);
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 20rpx 20rpx 0 0;
		box-shadow: 0 -4rpx 12rpx rgba(0, 0, 0, 0.1);
		transition: all 0.3s ease;
	}

	.bottom-button:active {
		background: linear-gradient(135deg, #7BC4E8 0%, #A8D8E6 100%);
		transform: translateY(2rpx);
	}

	.button-text {
		font-size: 36rpx;
		font-weight: 600;
		color: #ffffff;
		text-shadow: 0 2rpx 4rpx rgba(0, 0, 0, 0.2);
	}
</style>
