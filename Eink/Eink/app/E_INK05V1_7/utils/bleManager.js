/**
 * BLE蓝牙管理工具类
 * 用于BLE设备的扫描、连接和通信
 */

class BLEManager {
	constructor() {
		this.isScanning = false;
		this.isConnected = false;
		this.connectedDevice = null;
		this.scannedDevices = [];
		this.services = [];
		this.characteristics = [];
		this.scanTimeout = null; // 扫描超时定时器
		this.permissionChecked = false; // 权限检查状态
		this.listenersRegistered = {
			deviceFound: false, // 设备发现监听器是否已注册
			connectionState: false // 连接状态监听器是否已注册
		};
		this.connectionStateListener = null; // 保存连接状态监听器引用
		this.deviceFoundListener = null; // 保存设备发现监听器引用
		this.adapterInitialized = false; // 适配器是否已初始化
		this.callbacks = {
			onDeviceFound: null,
			onDeviceConnected: null,
			onDeviceDisconnected: null,
			onServicesDiscovered: null,
			onError: null
		};
	}

	/**
	 * 检查蓝牙和位置权限
	 */
	async checkPermissions() {
		try {
			console.log('检查蓝牙权限...');
			
			// 检查蓝牙权限
			const bluetoothState = await new Promise((resolve, reject) => {
				uni.getBluetoothAdapterState({
					success: resolve,
					fail: reject
				});
			});
			console.log('蓝牙状态:', bluetoothState);
			
			if (!bluetoothState.available) {
				throw new Error('蓝牙未开启，请在设置中开启蓝牙');
			}
			
			// 检查位置权限（仅Android需要位置权限才能扫描BLE设备）
			// iOS和微信小程序不需要位置权限，跳过检查
			if (!this.isWeixinMP() && !this.isIOS()) {
				// Android平台需要位置权限
				try {
					console.log('Android平台：检查位置权限...');
					await new Promise((resolve, reject) => {
						uni.getLocation({
							type: 'wgs84',
							altitude: false,
							highAccuracyExpireTime: 1000,
							success: resolve,
							fail: reject
						});
					});
					console.log('位置权限检查通过');
				} catch (locationError) {
					console.warn('位置权限检查失败:', locationError);
					// 不强制要求位置权限，但给出提示
					console.log('位置权限可能不足，但继续尝试初始化蓝牙');
				}
			} else if (this.isIOS()) {
				console.log('iOS平台：跳过位置权限检查（iOS不需要位置权限使用蓝牙）');
			} else {
				console.log('微信小程序：跳过位置权限检查');
			}
			
			return true;
		} catch (error) {
			console.error('权限检查失败:', error);
			// 微信小程序特殊处理：如果获取状态失败，可能是适配器未初始化，不一定是错误
			if (this.isWeixinMP() && (error.errCode === 10000 || error.code === 10000)) {
				console.log('微信小程序：适配器可能未初始化，尝试初始化');
				return true; // 允许继续尝试初始化
			}
			throw error;
		}
	}

	/**
	 * 检查是否为微信小程序平台
	 */
	isWeixinMP() {
		// #ifdef MP-WEIXIN
		return true;
		// #endif
		// #ifndef MP-WEIXIN
		return false;
		// #endif
	}

	/**
	 * 检查是否为 iOS 平台
	 */
	isIOS() {
		// #ifdef APP-PLUS
		// #ifdef APP-PLUS-NVUE
		return plus.os.name === 'iOS';
		// #endif
		// #ifndef APP-PLUS-NVUE
		return uni.getSystemInfoSync().platform === 'ios';
		// #endif
		// #endif
		// #ifndef APP-PLUS
		return false;
		// #endif
	}

	/**
	 * 检查是否在微信开发者工具的 Windows 平台上
	 * 微信开发者工具的蓝牙调试功能仅在 Mac 上支持
	 */
	isWindowsDevTools() {
		if (!this.isWeixinMP()) {
			return false;
		}
		try {
			const systemInfo = uni.getSystemInfoSync();
			// 检查平台信息，Windows 开发者工具会显示 Windows
			return systemInfo.platform === 'windows' || 
				   systemInfo.platform === 'win32' ||
				   (systemInfo.system && systemInfo.system.toLowerCase().includes('windows'));
		} catch (e) {
			return false;
		}
	}

	/**
	 * 检查错误是否为 Windows 平台不支持蓝牙的错误
	 */
	isWindowsBluetoothNotSupportedError(error) {
		if (!error) return false;
		const errMsg = error.errMsg || error.message || '';
		return errMsg.includes('Mac 以外的平台') || 
			   errMsg.includes('暂不支持') && errMsg.includes('Windows');
	}

	/**
	 * 简化的蓝牙初始化（跳过权限检查）
	 */
	async initBluetoothSimple() {
		try {
			console.log('开始简化蓝牙初始化...');
			
			// 微信小程序特殊处理：先检查系统蓝牙状态
			if (this.isWeixinMP()) {
				try {
					// 先尝试获取蓝牙适配器状态，检查系统蓝牙是否开启
					const stateRes = await new Promise((resolve, reject) => {
						uni.getBluetoothAdapterState({
							success: resolve,
							fail: reject
						});
					});
					
					if (!stateRes.available) {
						throw new Error('系统蓝牙未开启，请先在系统设置中开启蓝牙');
					}
					
					console.log('微信小程序：系统蓝牙已开启');
				} catch (stateError) {
					// 如果获取状态失败，可能是适配器未初始化，继续尝试初始化
					console.log('微信小程序：无法获取蓝牙状态，尝试初始化适配器');
				}
			}
			
			// 直接尝试打开蓝牙适配器
			await new Promise((resolve, reject) => {
				uni.openBluetoothAdapter({
					mode: 'central',
					success: (res) => {
						console.log('蓝牙适配器已打开', res);
						resolve(res);
					},
					fail: (err) => {
						console.error('打开蓝牙适配器失败:', err);
						// 微信小程序特殊错误处理
						if (this.isWeixinMP()) {
							// 检查是否为 Windows 平台不支持蓝牙的错误
							if (this.isWindowsBluetoothNotSupportedError(err)) {
								const windowsError = new Error('微信开发者工具的蓝牙调试功能仅在 Mac 系统上支持，Windows 系统暂不支持。请在 Mac 系统上使用微信开发者工具，或使用真机预览功能在 iOS/Android 设备上测试蓝牙功能。');
								windowsError.isWindowsBluetoothError = true;
								windowsError.originalError = err;
								reject(windowsError);
								return;
							}
							// 错误码 10001 表示适配器已初始化，可以继续
							if (err.errCode === 10001 || err.errCode === 10000) {
								console.log('微信小程序：适配器可能已初始化，继续检查状态');
								resolve();
							} else {
								reject(err);
							}
						} else {
							reject(err);
						}
					}
				});
			});
			
			// 等待适配器完全初始化
			await new Promise(resolve => setTimeout(resolve, 1000));
			
			// 检查蓝牙适配器状态
			const res = await new Promise((resolve, reject) => {
				uni.getBluetoothAdapterState({
					success: resolve,
					fail: reject
				});
			});
			console.log('蓝牙适配器状态:', res);
			
			if (!res.available) {
				throw new Error('蓝牙适配器不可用，请检查蓝牙是否已开启');
			}
			
			console.log('蓝牙简化初始化成功');
			return true;
		} catch (error) {
			console.error('简化蓝牙初始化失败:', error);
			// 检查是否为 Windows 平台不支持蓝牙的错误
			if (this.isWindowsBluetoothNotSupportedError(error) || error.isWindowsBluetoothError) {
				// 这个错误会在上层处理，直接返回 false
				return false;
			}
			// 微信小程序特殊错误处理
			if (this.isWeixinMP() && error.errCode) {
				console.error('微信小程序错误码:', error.errCode);
				if (error.errCode === 10001) {
					console.log('微信小程序：适配器已初始化，尝试继续');
					// 适配器可能已经初始化，尝试检查状态
					try {
						const stateRes = await new Promise((resolve, reject) => {
							uni.getBluetoothAdapterState({
								success: resolve,
								fail: reject
							});
						});
						if (stateRes.available) {
							console.log('微信小程序：适配器状态正常，初始化成功');
							return true;
						}
					} catch (e) {
						console.error('检查适配器状态失败:', e);
					}
				}
			}
			return false;
		}
	}

	/**
	 * 初始化蓝牙适配器
	 */
	async initBluetooth() {
		try {
			// 如果适配器已经初始化，直接返回成功
			if (this.adapterInitialized) {
				console.log('蓝牙适配器已初始化，跳过重复初始化');
				return true;
			}

			console.log('开始初始化蓝牙适配器...');
			
			// 先尝试简化初始化
			const simpleSuccess = await this.initBluetoothSimple();
			if (simpleSuccess) {
				console.log('简化初始化成功');
				this.adapterInitialized = true;
				return true;
			}
			
			// 如果简化初始化失败，尝试完整初始化
			console.log('简化初始化失败，尝试完整初始化...');
			
			// 先检查权限
			await this.checkPermissions();
			
			// 尝试打开蓝牙适配器，添加重试机制
			let retryCount = 0;
			const maxRetries = 3;
			
			while (retryCount < maxRetries) {
				try {
					console.log(`第${retryCount + 1}次尝试打开蓝牙适配器...`);
					
					await new Promise((resolve, reject) => {
						uni.openBluetoothAdapter({
							mode: 'central',
							success: (res) => {
								console.log('蓝牙适配器已打开', res);
								resolve(res);
							},
							fail: (err) => {
								console.error('打开蓝牙适配器失败:', err);
								// 微信小程序特殊错误处理
								if (this.isWeixinMP()) {
									// 检查是否为 Windows 平台不支持蓝牙的错误
									if (this.isWindowsBluetoothNotSupportedError(err)) {
										const windowsError = new Error('微信开发者工具的蓝牙调试功能仅在 Mac 系统上支持，Windows 系统暂不支持。请在 Mac 系统上使用微信开发者工具，或使用真机预览功能在 iOS/Android 设备上测试蓝牙功能。');
										windowsError.isWindowsBluetoothError = true;
										windowsError.originalError = err;
										reject(windowsError);
										return;
									}
									// 错误码 10001 表示适配器已初始化，可以继续
									if (err.errCode === 10001 || err.errCode === 10000) {
										console.log('微信小程序：适配器可能已初始化，继续检查状态');
										resolve();
									} else {
										reject(err);
									}
								} else {
									reject(err);
								}
							}
						});
					});
					console.log('蓝牙适配器已打开');
					break;
				} catch (adapterError) {
					retryCount++;
					console.error(`第${retryCount}次尝试失败:`, adapterError);
					
					if (retryCount >= maxRetries) {
						throw adapterError;
					}
					
					// 等待一段时间后重试
					await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
				}
			}
			
			// 等待适配器完全初始化
			await new Promise(resolve => setTimeout(resolve, 1000));
			
			// 检查蓝牙适配器状态
			const res = await new Promise((resolve, reject) => {
				uni.getBluetoothAdapterState({
					success: resolve,
					fail: reject
				});
			});
			console.log('蓝牙适配器状态:', res);
			
			if (!res.available) {
				throw new Error('蓝牙适配器不可用，请检查蓝牙是否已开启');
			}
			
			this.adapterInitialized = true;
			console.log('蓝牙初始化成功');
			return true;
		} catch (error) {
			console.error('初始化蓝牙失败:', error);
			
			// 检查是否为 Windows 平台不支持蓝牙的错误
			if (this.isWindowsBluetoothNotSupportedError(error) || error.isWindowsBluetoothError) {
				const windowsError = {
					...error,
					message: error.message || '微信开发者工具的蓝牙调试功能仅在 Mac 系统上支持，Windows 系统暂不支持。请在 Mac 系统上使用微信开发者工具，或使用真机预览功能在 iOS/Android 设备上测试蓝牙功能。',
					isWindowsBluetoothError: true,
					originalError: error.originalError || error
				};
				this.triggerCallback('onError', windowsError);
				this.adapterInitialized = false;
				return false;
			}
			
			// 提供更详细的错误信息
			let errorMessage = '蓝牙初始化失败';
			const errorCode = error.code || error.errCode;
			
			if (errorCode === 10001) {
				// 微信小程序：10001 表示适配器已初始化，可能不是错误
				if (this.isWeixinMP()) {
					console.log('微信小程序：错误码10001，可能是适配器已初始化');
					// 尝试检查状态，如果可用则视为成功
					try {
						const stateRes = await new Promise((resolve, reject) => {
							uni.getBluetoothAdapterState({
								success: resolve,
								fail: reject
							});
						});
						if (stateRes.available) {
							console.log('微信小程序：适配器状态正常，初始化成功');
							this.adapterInitialized = true;
							return true;
						}
					} catch (e) {
						console.error('检查适配器状态失败:', e);
					}
				}
				errorMessage = '蓝牙权限被拒绝，请在设置中开启蓝牙权限';
			} else if (errorCode === 10000) {
				errorMessage = '蓝牙适配器未初始化，请检查蓝牙是否已开启';
			} else if (error.message && error.message.includes('蓝牙未开启')) {
				errorMessage = '蓝牙未开启，请先在手机设置中开启蓝牙';
			} else if (error.message && error.message.includes('位置权限')) {
				errorMessage = '位置权限不足，Android系统需要位置权限才能使用蓝牙';
			} else if (this.isWeixinMP() && error.errMsg) {
				// 微信小程序特殊错误信息
				if (error.errMsg.includes('not available')) {
					errorMessage = '蓝牙不可用，请确保系统蓝牙已开启';
				} else if (error.errMsg.includes('not support')) {
					errorMessage = '设备不支持蓝牙功能';
				} else {
					errorMessage = `蓝牙初始化失败：${error.errMsg}`;
				}
			}
			
			const detailedError = {
				...error,
				message: errorMessage,
				originalError: error
			};
			
			this.triggerCallback('onError', detailedError);
			this.adapterInitialized = false;
			return false;
		}
	}

	/**
	 * 开始扫描BLE设备
	 * @param {number} duration 扫描持续时间(ms)
	 * @param {boolean} skipPermissionCheck 是否跳过权限检查
	 */
	async startScan(duration = 5000, skipPermissionCheck = false) {
		try {
			if (this.isScanning) {
				console.log('正在扫描中，请等待当前扫描完成');
				return false;
			}

			// 如果已经检查过权限，跳过权限检查
			if (!skipPermissionCheck && !this.permissionChecked) {
				console.log('首次扫描，检查权限...');
				await this.checkPermissions();
				this.permissionChecked = true;
			} else {
				console.log('跳过权限检查，直接开始扫描');
			}

			// 限制扫描时间，最大不超过10秒
			const maxDuration = Math.min(duration, 10000);
			console.log(`开始扫描BLE设备，持续${maxDuration/1000}秒...`);

			// 清空之前的扫描结果
			this.scannedDevices = [];

			// 开始扫描BLE设备
			await uni.startBluetoothDevicesDiscovery({
				allowDuplicatesKey: false,
				interval: 0
			});

			this.isScanning = true;

			// 只在第一次注册设备发现监听器，避免重复注册
			if (!this.listenersRegistered.deviceFound) {
				console.log('注册设备发现监听器');
				this.deviceFoundListener = (res) => {
					const devices = res.devices;
					devices.forEach(device => {
						if (this.isBLEDevice(device)) {
							console.log('发现BLE设备:', device);
							
							// 检查是否已存在该设备
							const existingDevice = this.scannedDevices.find(d => d.deviceId === device.deviceId);
							
							if (!existingDevice) {
								this.scannedDevices.push(device);
								this.triggerCallback('onDeviceFound', device);
							}
						}
					});
				};
				uni.onBluetoothDeviceFound(this.deviceFoundListener);
				this.listenersRegistered.deviceFound = true;
			}

			// 设置扫描超时，自动停止扫描
			this.scanTimeout = setTimeout(() => {
				console.log('扫描超时，自动停止扫描');
				this.stopScan();
			}, maxDuration);

			// 添加额外的安全机制：如果扫描超过15秒，强制停止
			setTimeout(() => {
				if (this.isScanning) {
					console.log('安全机制：强制停止扫描');
					this.stopScan();
				}
			}, 15000);

			return true;
		} catch (error) {
			console.error('开始扫描失败:', error);
			this.isScanning = false;
			this.triggerCallback('onError', error);
			return false;
		}
	}

	/**
	 * 停止扫描
	 */
	async stopScan() {
		try {
			if (!this.isScanning) {
				console.log('当前没有在扫描');
				return;
			}

			console.log('正在停止扫描...');

			// 清除扫描超时定时器
			if (this.scanTimeout) {
				clearTimeout(this.scanTimeout);
				this.scanTimeout = null;
			}

			// 停止蓝牙设备发现
			await uni.stopBluetoothDevicesDiscovery();
			
			// 确保扫描状态被重置
			this.isScanning = false;
			
			console.log('扫描已停止');
		} catch (error) {
			console.error('停止扫描失败:', error);
			// 即使停止失败，也要重置状态
			this.isScanning = false;
			this.triggerCallback('onError', error);
		}
	}

	/**
	 * 判断是否为BLE设备
	 * @param {Object} device 设备信息
	 */
	isBLEDevice(device) {
		const name = device.name || '';
		const localName = device.localName || '';
		const deviceName = name || localName;

		// 放宽过滤条件，尽可能展示更多设备，避免不同手机厂商定制导致设备被误过滤
		// 1) 不再排除常见品牌名称
		// 2) 降低RSSI阈值以便弱信号环境也能看到设备
		// 3) 允许显示名称为Unknown/未知的广播（部分机型会这样上报）
		const hasAcceptableSignal = typeof device.RSSI === 'number' ? (device.RSSI > -95) : true;

		// 允许以下任一条件即可视为有效BLE设备：
		// - 有设备名，或
		// - 有localName，或
		// - 有广播serviceUuids，或
		// - 有manufacturerData（部分平台提供）
		const hasAnyIdentity = !!deviceName || 
			(Array.isArray(device.advertisServiceUUIDs) && device.advertisServiceUUIDs.length > 0) ||
			(device.manufacturerData != null);

		return hasAcceptableSignal && hasAnyIdentity;
	}

	/**
	 * 连接设备
	 * @param {string} deviceId 设备ID
	 */
	async connectDevice(deviceId) {
		try {
			if (this.isConnected) {
				console.log('已连接到设备，请先断开连接');
				return false;
			}

			console.log('正在连接设备:', deviceId);
			
			// 停止扫描
			if (this.isScanning) {
				await this.stopScan();
			}

			// 连接设备
			await uni.createBLEConnection({
				deviceId: deviceId
			});

			this.isConnected = true;
			this.connectedDevice = deviceId;
			console.log('设备连接成功');

			// 只在第一次注册连接状态监听器，避免重复注册
			if (!this.listenersRegistered.connectionState) {
				console.log('注册连接状态监听器');
				this.connectionStateListener = (res) => {
					console.log('连接状态变化:', res);
					// 只有当监听的设备ID匹配时才处理
					if (res.deviceId === this.connectedDevice) {
						if (!res.connected) {
							this.isConnected = false;
							this.connectedDevice = null;
							this.services = [];
							this.characteristics = [];
							this.triggerCallback('onDeviceDisconnected', res);
						}
					}
				};
				uni.onBLEConnectionStateChange(this.connectionStateListener);
				this.listenersRegistered.connectionState = true;
			}

			this.triggerCallback('onDeviceConnected', { deviceId });
			return true;
		} catch (error) {
			console.error('连接设备失败:', error);
			// 连接失败时重置状态
			this.isConnected = false;
			this.connectedDevice = null;
			this.triggerCallback('onError', error);
			return false;
		}
	}

	/**
	 * 断开设备连接
	 */
	async disconnectDevice() {
		try {
			if (!this.isConnected || !this.connectedDevice) {
				console.log('没有连接的设备');
				return;
			}

			const deviceIdToDisconnect = this.connectedDevice;
			
			await uni.closeBLEConnection({
				deviceId: deviceIdToDisconnect
			});

			// 重置连接相关状态
			this.isConnected = false;
			this.connectedDevice = null;
			this.services = [];
			this.characteristics = [];
			
			console.log('设备已断开连接');
		} catch (error) {
			console.error('断开连接失败:', error);
			// 即使断开失败，也要重置状态
			this.isConnected = false;
			this.connectedDevice = null;
			this.services = [];
			this.characteristics = [];
			this.triggerCallback('onError', error);
		}
	}

	/**
	 * 发现服务和特征值
	 */
	async discoverServices() {
		try {
			if (!this.isConnected) {
				throw new Error('设备未连接');
			}

			console.log('正在发现服务...');
			
			// 等待连接稳定
			await new Promise(resolve => setTimeout(resolve, 1000));
			
			// 获取服务
			const servicesRes = await uni.getBLEDeviceServices({
				deviceId: this.connectedDevice
			});

			// 目标服务UUID
			const targetServiceUUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
			
			// 过滤出目标服务
			const allServices = servicesRes.services;
			const targetServices = allServices.filter(service => 
				service.uuid.toLowerCase() === targetServiceUUID.toLowerCase()
			);
			
			console.log('所有发现的服务:', allServices);
			console.log('目标服务:', targetServices);
			
			// 如果找到目标服务，只处理目标服务
			if (targetServices.length > 0) {
				this.services = targetServices;
				console.log('找到目标服务，只处理目标服务');
			} else {
				this.services = allServices;
				console.log('未找到目标服务，处理所有服务');
			}

			// 获取每个服务的特征值
			this.characteristics = [];
			for (const service of this.services) {
				try {
					await new Promise(resolve => setTimeout(resolve, 200));
					
					const characteristicsRes = await uni.getBLEDeviceCharacteristics({
						deviceId: this.connectedDevice,
						serviceId: service.uuid
					});

					const serviceCharacteristics = characteristicsRes.characteristics.map(char => ({
						...char,
						serviceId: service.uuid,
						serviceName: service.isPrimary ? '主服务' : '辅助服务',
						isTargetService: service.uuid.toLowerCase() === targetServiceUUID.toLowerCase()
					}));

					this.characteristics.push(...serviceCharacteristics);
					console.log(`服务 ${service.uuid} 的特征值:`, serviceCharacteristics);
				} catch (charError) {
					console.warn(`获取服务 ${service.uuid} 特征值失败:`, charError);
				}
			}

			console.log('过滤后的特征值:', this.characteristics);
			this.triggerCallback('onServicesDiscovered', {
				services: this.services,
				characteristics: this.characteristics,
				targetServiceFound: targetServices.length > 0
			});

			return {
				services: this.services,
				characteristics: this.characteristics,
				targetServiceFound: targetServices.length > 0
			};
		} catch (error) {
			console.error('发现服务失败:', error);
			this.triggerCallback('onError', error);
			return null;
		}
	}

	/**
	 * 读取特征值
	 * @param {string} serviceId 服务ID
	 * @param {string} characteristicId 特征值ID
	 */
	async readCharacteristic(serviceId, characteristicId) {
		try {
			if (!this.isConnected) {
				throw new Error('设备未连接');
			}

			const res = await uni.readBLECharacteristicValue({
				deviceId: this.connectedDevice,
				serviceId: serviceId,
				characteristicId: characteristicId
			});

			console.log('读取特征值成功:', res);
			return res;
		} catch (error) {
			console.error('读取特征值失败:', error);
			this.triggerCallback('onError', error);
			return null;
		}
	}

	/**
	 * 写入特征值
	 * @param {string} serviceId 服务ID
	 * @param {string} characteristicId 特征值ID
	 * @param {ArrayBuffer} value 要写入的数据
	 */
	async writeCharacteristic(serviceId, characteristicId, value) {
		try {
			if (!this.isConnected) {
				throw new Error('设备未连接');
			}

			const res = await uni.writeBLECharacteristicValue({
				deviceId: this.connectedDevice,
				serviceId: serviceId,
				characteristicId: characteristicId,
				value: value
			});

			console.log('写入特征值成功:', res);
			return res;
		} catch (error) {
			console.error('写入特征值失败:', error);
			this.triggerCallback('onError', error);
			return null;
		}
	}

	/**
	 * 设置回调函数
	 * @param {string} event 事件名称
	 * @param {Function} callback 回调函数
	 */
	setCallback(event, callback) {
		this.callbacks[event] = callback;
	}

	/**
	 * 触发回调函数
	 * @param {string} event 事件名称
	 * @param {*} data 数据
	 */
	triggerCallback(event, data) {
		if (this.callbacks[event]) {
			this.callbacks[event](data);
		}
	}

	/**
	 * 获取扫描到的设备列表
	 */
	getScannedDevices() {
		return this.scannedDevices;
	}

	/**
	 * 获取连接状态
	 */
	getConnectionStatus() {
		return {
			isConnected: this.isConnected,
			isScanning: this.isScanning,
			connectedDevice: this.connectedDevice,
			services: this.services,
			characteristics: this.characteristics
		};
	}

	/**
	 * 清理资源（不关闭适配器，供多页面应用使用）
	 */
	async cleanup() {
		try {
			// 清除扫描超时定时器
			if (this.scanTimeout) {
				clearTimeout(this.scanTimeout);
				this.scanTimeout = null;
			}
			
			if (this.isScanning) {
				await this.stopScan();
			}
			if (this.isConnected) {
				await this.disconnectDevice();
			}
			
			// 重置监听器注册状态（但不清除监听器，因为uni-app可能不支持移除）
			// 注意：监听器会保留，但通过标志位可以避免重复注册
			
			console.log('蓝牙资源已清理（适配器未关闭）');
		} catch (error) {
			console.error('清理蓝牙资源失败:', error);
		}
	}

	/**
	 * 完全清理资源（包括关闭适配器，仅在应用退出时使用）
	 */
	async fullCleanup() {
		try {
			// 先执行普通清理
			await this.cleanup();
			
			// 关闭蓝牙适配器
			await uni.closeBluetoothAdapter();
			this.adapterInitialized = false;
			
			// 重置所有状态
			this.listenersRegistered = {
				deviceFound: false,
				connectionState: false
			};
			this.connectionStateListener = null;
			this.deviceFoundListener = null;
			
			console.log('蓝牙资源已完全清理（适配器已关闭）');
		} catch (error) {
			console.error('完全清理蓝牙资源失败:', error);
		}
	}
}

// 创建单例实例
const bleManager = new BLEManager();

export default bleManager;
