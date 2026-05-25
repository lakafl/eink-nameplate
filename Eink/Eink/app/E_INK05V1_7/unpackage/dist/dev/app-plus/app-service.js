if (typeof Promise !== "undefined" && !Promise.prototype.finally) {
  Promise.prototype.finally = function(callback) {
    const promise = this.constructor;
    return this.then(
      (value) => promise.resolve(callback()).then(() => value),
      (reason) => promise.resolve(callback()).then(() => {
        throw reason;
      })
    );
  };
}
;
if (typeof uni !== "undefined" && uni && uni.requireGlobal) {
  const global = uni.requireGlobal();
  ArrayBuffer = global.ArrayBuffer;
  Int8Array = global.Int8Array;
  Uint8Array = global.Uint8Array;
  Uint8ClampedArray = global.Uint8ClampedArray;
  Int16Array = global.Int16Array;
  Uint16Array = global.Uint16Array;
  Int32Array = global.Int32Array;
  Uint32Array = global.Uint32Array;
  Float32Array = global.Float32Array;
  Float64Array = global.Float64Array;
  BigInt64Array = global.BigInt64Array;
  BigUint64Array = global.BigUint64Array;
}
;
if (uni.restoreGlobal) {
  uni.restoreGlobal(Vue, weex, plus, setTimeout, clearTimeout, setInterval, clearInterval);
}
(function(vue) {
  "use strict";
  function formatAppLog(type, filename, ...args) {
    if (uni.__log__) {
      uni.__log__(type, filename, ...args);
    } else {
      console[type].apply(console, [...args, filename]);
    }
  }
  class BLEManager {
    constructor() {
      this.isScanning = false;
      this.isConnected = false;
      this.connectedDevice = null;
      this.scannedDevices = [];
      this.services = [];
      this.characteristics = [];
      this.scanTimeout = null;
      this.permissionChecked = false;
      this.listenersRegistered = {
        deviceFound: false,
        // 设备发现监听器是否已注册
        connectionState: false
        // 连接状态监听器是否已注册
      };
      this.connectionStateListener = null;
      this.deviceFoundListener = null;
      this.adapterInitialized = false;
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
        formatAppLog("log", "at utils/bleManager.js:37", "检查蓝牙权限...");
        const bluetoothState = await new Promise((resolve, reject) => {
          uni.getBluetoothAdapterState({
            success: resolve,
            fail: reject
          });
        });
        formatAppLog("log", "at utils/bleManager.js:46", "蓝牙状态:", bluetoothState);
        if (!bluetoothState.available) {
          throw new Error("蓝牙未开启，请在设置中开启蓝牙");
        }
        if (!this.isWeixinMP()) {
          try {
            formatAppLog("log", "at utils/bleManager.js:57", "检查位置权限...");
            await new Promise((resolve, reject) => {
              uni.getLocation({
                type: "wgs84",
                altitude: false,
                highAccuracyExpireTime: 1e3,
                success: resolve,
                fail: reject
              });
            });
            formatAppLog("log", "at utils/bleManager.js:67", "位置权限检查通过");
          } catch (locationError) {
            formatAppLog("warn", "at utils/bleManager.js:69", "位置权限检查失败:", locationError);
            formatAppLog("log", "at utils/bleManager.js:71", "位置权限可能不足，但继续尝试初始化蓝牙");
          }
        } else {
          formatAppLog("log", "at utils/bleManager.js:74", "微信小程序：跳过位置权限检查");
        }
        return true;
      } catch (error) {
        formatAppLog("error", "at utils/bleManager.js:79", "权限检查失败:", error);
        if (this.isWeixinMP() && (error.errCode === 1e4 || error.code === 1e4)) {
          formatAppLog("log", "at utils/bleManager.js:82", "微信小程序：适配器可能未初始化，尝试初始化");
          return true;
        }
        throw error;
      }
    }
    /**
     * 检查是否为微信小程序平台
     */
    isWeixinMP() {
      return false;
    }
    /**
     * 简化的蓝牙初始化（跳过权限检查）
     */
    async initBluetoothSimple() {
      try {
        formatAppLog("log", "at utils/bleManager.js:106", "开始简化蓝牙初始化...");
        if (this.isWeixinMP()) {
          try {
            const stateRes = await new Promise((resolve, reject) => {
              uni.getBluetoothAdapterState({
                success: resolve,
                fail: reject
              });
            });
            if (!stateRes.available) {
              throw new Error("系统蓝牙未开启，请先在系统设置中开启蓝牙");
            }
            formatAppLog("log", "at utils/bleManager.js:123", "微信小程序：系统蓝牙已开启");
          } catch (stateError) {
            formatAppLog("log", "at utils/bleManager.js:126", "微信小程序：无法获取蓝牙状态，尝试初始化适配器");
          }
        }
        await new Promise((resolve, reject) => {
          uni.openBluetoothAdapter({
            mode: "central",
            success: (res2) => {
              formatAppLog("log", "at utils/bleManager.js:135", "蓝牙适配器已打开", res2);
              resolve(res2);
            },
            fail: (err) => {
              formatAppLog("error", "at utils/bleManager.js:139", "打开蓝牙适配器失败:", err);
              if (this.isWeixinMP()) {
                if (err.errCode === 10001 || err.errCode === 1e4) {
                  formatAppLog("log", "at utils/bleManager.js:144", "微信小程序：适配器可能已初始化，继续检查状态");
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
        await new Promise((resolve) => setTimeout(resolve, 1e3));
        const res = await new Promise((resolve, reject) => {
          uni.getBluetoothAdapterState({
            success: resolve,
            fail: reject
          });
        });
        formatAppLog("log", "at utils/bleManager.js:166", "蓝牙适配器状态:", res);
        if (!res.available) {
          throw new Error("蓝牙适配器不可用，请检查蓝牙是否已开启");
        }
        formatAppLog("log", "at utils/bleManager.js:172", "蓝牙简化初始化成功");
        return true;
      } catch (error) {
        formatAppLog("error", "at utils/bleManager.js:175", "简化蓝牙初始化失败:", error);
        if (this.isWeixinMP() && error.errCode) {
          formatAppLog("error", "at utils/bleManager.js:178", "微信小程序错误码:", error.errCode);
          if (error.errCode === 10001) {
            formatAppLog("log", "at utils/bleManager.js:180", "微信小程序：适配器已初始化，尝试继续");
            try {
              const stateRes = await new Promise((resolve, reject) => {
                uni.getBluetoothAdapterState({
                  success: resolve,
                  fail: reject
                });
              });
              if (stateRes.available) {
                formatAppLog("log", "at utils/bleManager.js:190", "微信小程序：适配器状态正常，初始化成功");
                return true;
              }
            } catch (e) {
              formatAppLog("error", "at utils/bleManager.js:194", "检查适配器状态失败:", e);
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
        if (this.adapterInitialized) {
          formatAppLog("log", "at utils/bleManager.js:209", "蓝牙适配器已初始化，跳过重复初始化");
          return true;
        }
        formatAppLog("log", "at utils/bleManager.js:213", "开始初始化蓝牙适配器...");
        const simpleSuccess = await this.initBluetoothSimple();
        if (simpleSuccess) {
          formatAppLog("log", "at utils/bleManager.js:218", "简化初始化成功");
          this.adapterInitialized = true;
          return true;
        }
        formatAppLog("log", "at utils/bleManager.js:224", "简化初始化失败，尝试完整初始化...");
        await this.checkPermissions();
        let retryCount = 0;
        const maxRetries = 3;
        while (retryCount < maxRetries) {
          try {
            formatAppLog("log", "at utils/bleManager.js:235", `第${retryCount + 1}次尝试打开蓝牙适配器...`);
            await new Promise((resolve, reject) => {
              uni.openBluetoothAdapter({
                mode: "central",
                success: (res2) => {
                  formatAppLog("log", "at utils/bleManager.js:241", "蓝牙适配器已打开", res2);
                  resolve(res2);
                },
                fail: (err) => {
                  formatAppLog("error", "at utils/bleManager.js:245", "打开蓝牙适配器失败:", err);
                  if (this.isWeixinMP()) {
                    if (err.errCode === 10001 || err.errCode === 1e4) {
                      formatAppLog("log", "at utils/bleManager.js:250", "微信小程序：适配器可能已初始化，继续检查状态");
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
            formatAppLog("log", "at utils/bleManager.js:261", "蓝牙适配器已打开");
            break;
          } catch (adapterError) {
            retryCount++;
            formatAppLog("error", "at utils/bleManager.js:265", `第${retryCount}次尝试失败:`, adapterError);
            if (retryCount >= maxRetries) {
              throw adapterError;
            }
            await new Promise((resolve) => setTimeout(resolve, 1e3 * retryCount));
          }
        }
        await new Promise((resolve) => setTimeout(resolve, 1e3));
        const res = await new Promise((resolve, reject) => {
          uni.getBluetoothAdapterState({
            success: resolve,
            fail: reject
          });
        });
        formatAppLog("log", "at utils/bleManager.js:286", "蓝牙适配器状态:", res);
        if (!res.available) {
          throw new Error("蓝牙适配器不可用，请检查蓝牙是否已开启");
        }
        this.adapterInitialized = true;
        formatAppLog("log", "at utils/bleManager.js:293", "蓝牙初始化成功");
        return true;
      } catch (error) {
        formatAppLog("error", "at utils/bleManager.js:296", "初始化蓝牙失败:", error);
        let errorMessage = "蓝牙初始化失败";
        const errorCode = error.code || error.errCode;
        if (errorCode === 10001) {
          if (this.isWeixinMP()) {
            formatAppLog("log", "at utils/bleManager.js:305", "微信小程序：错误码10001，可能是适配器已初始化");
            try {
              const stateRes = await new Promise((resolve, reject) => {
                uni.getBluetoothAdapterState({
                  success: resolve,
                  fail: reject
                });
              });
              if (stateRes.available) {
                formatAppLog("log", "at utils/bleManager.js:315", "微信小程序：适配器状态正常，初始化成功");
                this.adapterInitialized = true;
                return true;
              }
            } catch (e) {
              formatAppLog("error", "at utils/bleManager.js:320", "检查适配器状态失败:", e);
            }
          }
          errorMessage = "蓝牙权限被拒绝，请在设置中开启蓝牙权限";
        } else if (errorCode === 1e4) {
          errorMessage = "蓝牙适配器未初始化，请检查蓝牙是否已开启";
        } else if (error.message && error.message.includes("蓝牙未开启")) {
          errorMessage = "蓝牙未开启，请先在手机设置中开启蓝牙";
        } else if (error.message && error.message.includes("位置权限")) {
          errorMessage = "位置权限不足，Android系统需要位置权限才能使用蓝牙";
        } else if (this.isWeixinMP() && error.errMsg) {
          if (error.errMsg.includes("not available")) {
            errorMessage = "蓝牙不可用，请确保系统蓝牙已开启";
          } else if (error.errMsg.includes("not support")) {
            errorMessage = "设备不支持蓝牙功能";
          } else {
            errorMessage = `蓝牙初始化失败：${error.errMsg}`;
          }
        }
        const detailedError = {
          ...error,
          message: errorMessage,
          originalError: error
        };
        this.triggerCallback("onError", detailedError);
        this.adapterInitialized = false;
        return false;
      }
    }
    /**
     * 开始扫描BLE设备
     * @param {number} duration 扫描持续时间(ms)
     * @param {boolean} skipPermissionCheck 是否跳过权限检查
     */
    async startScan(duration = 5e3, skipPermissionCheck = false) {
      try {
        if (this.isScanning) {
          formatAppLog("log", "at utils/bleManager.js:361", "正在扫描中，请等待当前扫描完成");
          return false;
        }
        if (!skipPermissionCheck && !this.permissionChecked) {
          formatAppLog("log", "at utils/bleManager.js:367", "首次扫描，检查权限...");
          await this.checkPermissions();
          this.permissionChecked = true;
        } else {
          formatAppLog("log", "at utils/bleManager.js:371", "跳过权限检查，直接开始扫描");
        }
        const maxDuration = Math.min(duration, 1e4);
        formatAppLog("log", "at utils/bleManager.js:376", `开始扫描BLE设备，持续${maxDuration / 1e3}秒...`);
        this.scannedDevices = [];
        await uni.startBluetoothDevicesDiscovery({
          allowDuplicatesKey: false,
          interval: 0
        });
        this.isScanning = true;
        if (!this.listenersRegistered.deviceFound) {
          formatAppLog("log", "at utils/bleManager.js:391", "注册设备发现监听器");
          this.deviceFoundListener = (res) => {
            const devices = res.devices;
            devices.forEach((device) => {
              if (this.isBLEDevice(device)) {
                formatAppLog("log", "at utils/bleManager.js:396", "发现BLE设备:", device);
                const existingDevice = this.scannedDevices.find((d) => d.deviceId === device.deviceId);
                if (!existingDevice) {
                  this.scannedDevices.push(device);
                  this.triggerCallback("onDeviceFound", device);
                }
              }
            });
          };
          uni.onBluetoothDeviceFound(this.deviceFoundListener);
          this.listenersRegistered.deviceFound = true;
        }
        this.scanTimeout = setTimeout(() => {
          formatAppLog("log", "at utils/bleManager.js:414", "扫描超时，自动停止扫描");
          this.stopScan();
        }, maxDuration);
        setTimeout(() => {
          if (this.isScanning) {
            formatAppLog("log", "at utils/bleManager.js:421", "安全机制：强制停止扫描");
            this.stopScan();
          }
        }, 15e3);
        return true;
      } catch (error) {
        formatAppLog("error", "at utils/bleManager.js:428", "开始扫描失败:", error);
        this.isScanning = false;
        this.triggerCallback("onError", error);
        return false;
      }
    }
    /**
     * 停止扫描
     */
    async stopScan() {
      try {
        if (!this.isScanning) {
          formatAppLog("log", "at utils/bleManager.js:441", "当前没有在扫描");
          return;
        }
        formatAppLog("log", "at utils/bleManager.js:445", "正在停止扫描...");
        if (this.scanTimeout) {
          clearTimeout(this.scanTimeout);
          this.scanTimeout = null;
        }
        await uni.stopBluetoothDevicesDiscovery();
        this.isScanning = false;
        formatAppLog("log", "at utils/bleManager.js:459", "扫描已停止");
      } catch (error) {
        formatAppLog("error", "at utils/bleManager.js:461", "停止扫描失败:", error);
        this.isScanning = false;
        this.triggerCallback("onError", error);
      }
    }
    /**
     * 判断是否为BLE设备
     * @param {Object} device 设备信息
     */
    isBLEDevice(device) {
      const name = device.name || "";
      const localName = device.localName || "";
      const deviceName = name || localName;
      const hasAcceptableSignal = typeof device.RSSI === "number" ? device.RSSI > -95 : true;
      const hasAnyIdentity = !!deviceName || Array.isArray(device.advertisServiceUUIDs) && device.advertisServiceUUIDs.length > 0 || device.manufacturerData != null;
      return hasAcceptableSignal && hasAnyIdentity;
    }
    /**
     * 连接设备
     * @param {string} deviceId 设备ID
     */
    async connectDevice(deviceId) {
      try {
        if (this.isConnected) {
          formatAppLog("log", "at utils/bleManager.js:502", "已连接到设备，请先断开连接");
          return false;
        }
        formatAppLog("log", "at utils/bleManager.js:506", "正在连接设备:", deviceId);
        if (this.isScanning) {
          await this.stopScan();
        }
        await uni.createBLEConnection({
          deviceId
        });
        this.isConnected = true;
        this.connectedDevice = deviceId;
        formatAppLog("log", "at utils/bleManager.js:520", "设备连接成功");
        if (!this.listenersRegistered.connectionState) {
          formatAppLog("log", "at utils/bleManager.js:524", "注册连接状态监听器");
          this.connectionStateListener = (res) => {
            formatAppLog("log", "at utils/bleManager.js:526", "连接状态变化:", res);
            if (res.deviceId === this.connectedDevice) {
              if (!res.connected) {
                this.isConnected = false;
                this.connectedDevice = null;
                this.services = [];
                this.characteristics = [];
                this.triggerCallback("onDeviceDisconnected", res);
              }
            }
          };
          uni.onBLEConnectionStateChange(this.connectionStateListener);
          this.listenersRegistered.connectionState = true;
        }
        this.triggerCallback("onDeviceConnected", { deviceId });
        return true;
      } catch (error) {
        formatAppLog("error", "at utils/bleManager.js:545", "连接设备失败:", error);
        this.isConnected = false;
        this.connectedDevice = null;
        this.triggerCallback("onError", error);
        return false;
      }
    }
    /**
     * 断开设备连接
     */
    async disconnectDevice() {
      try {
        if (!this.isConnected || !this.connectedDevice) {
          formatAppLog("log", "at utils/bleManager.js:560", "没有连接的设备");
          return;
        }
        const deviceIdToDisconnect = this.connectedDevice;
        await uni.closeBLEConnection({
          deviceId: deviceIdToDisconnect
        });
        this.isConnected = false;
        this.connectedDevice = null;
        this.services = [];
        this.characteristics = [];
        formatAppLog("log", "at utils/bleManager.js:576", "设备已断开连接");
      } catch (error) {
        formatAppLog("error", "at utils/bleManager.js:578", "断开连接失败:", error);
        this.isConnected = false;
        this.connectedDevice = null;
        this.services = [];
        this.characteristics = [];
        this.triggerCallback("onError", error);
      }
    }
    /**
     * 发现服务和特征值
     */
    async discoverServices() {
      try {
        if (!this.isConnected) {
          throw new Error("设备未连接");
        }
        formatAppLog("log", "at utils/bleManager.js:597", "正在发现服务...");
        await new Promise((resolve) => setTimeout(resolve, 1e3));
        const servicesRes = await uni.getBLEDeviceServices({
          deviceId: this.connectedDevice
        });
        const targetServiceUUID = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
        const allServices = servicesRes.services;
        const targetServices = allServices.filter(
          (service) => service.uuid.toLowerCase() === targetServiceUUID.toLowerCase()
        );
        formatAppLog("log", "at utils/bleManager.js:616", "所有发现的服务:", allServices);
        formatAppLog("log", "at utils/bleManager.js:617", "目标服务:", targetServices);
        if (targetServices.length > 0) {
          this.services = targetServices;
          formatAppLog("log", "at utils/bleManager.js:622", "找到目标服务，只处理目标服务");
        } else {
          this.services = allServices;
          formatAppLog("log", "at utils/bleManager.js:625", "未找到目标服务，处理所有服务");
        }
        this.characteristics = [];
        for (const service of this.services) {
          try {
            await new Promise((resolve) => setTimeout(resolve, 200));
            const characteristicsRes = await uni.getBLEDeviceCharacteristics({
              deviceId: this.connectedDevice,
              serviceId: service.uuid
            });
            const serviceCharacteristics = characteristicsRes.characteristics.map((char) => ({
              ...char,
              serviceId: service.uuid,
              serviceName: service.isPrimary ? "主服务" : "辅助服务",
              isTargetService: service.uuid.toLowerCase() === targetServiceUUID.toLowerCase()
            }));
            this.characteristics.push(...serviceCharacteristics);
            formatAppLog("log", "at utils/bleManager.js:647", `服务 ${service.uuid} 的特征值:`, serviceCharacteristics);
          } catch (charError) {
            formatAppLog("warn", "at utils/bleManager.js:649", `获取服务 ${service.uuid} 特征值失败:`, charError);
          }
        }
        formatAppLog("log", "at utils/bleManager.js:653", "过滤后的特征值:", this.characteristics);
        this.triggerCallback("onServicesDiscovered", {
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
        formatAppLog("error", "at utils/bleManager.js:666", "发现服务失败:", error);
        this.triggerCallback("onError", error);
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
          throw new Error("设备未连接");
        }
        const res = await uni.readBLECharacteristicValue({
          deviceId: this.connectedDevice,
          serviceId,
          characteristicId
        });
        formatAppLog("log", "at utils/bleManager.js:689", "读取特征值成功:", res);
        return res;
      } catch (error) {
        formatAppLog("error", "at utils/bleManager.js:692", "读取特征值失败:", error);
        this.triggerCallback("onError", error);
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
          throw new Error("设备未连接");
        }
        const res = await uni.writeBLECharacteristicValue({
          deviceId: this.connectedDevice,
          serviceId,
          characteristicId,
          value
        });
        formatAppLog("log", "at utils/bleManager.js:717", "写入特征值成功:", res);
        return res;
      } catch (error) {
        formatAppLog("error", "at utils/bleManager.js:720", "写入特征值失败:", error);
        this.triggerCallback("onError", error);
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
        formatAppLog("log", "at utils/bleManager.js:787", "蓝牙资源已清理（适配器未关闭）");
      } catch (error) {
        formatAppLog("error", "at utils/bleManager.js:789", "清理蓝牙资源失败:", error);
      }
    }
    /**
     * 完全清理资源（包括关闭适配器，仅在应用退出时使用）
     */
    async fullCleanup() {
      try {
        await this.cleanup();
        await uni.closeBluetoothAdapter();
        this.adapterInitialized = false;
        this.listenersRegistered = {
          deviceFound: false,
          connectionState: false
        };
        this.connectionStateListener = null;
        this.deviceFoundListener = null;
        formatAppLog("log", "at utils/bleManager.js:813", "蓝牙资源已完全清理（适配器已关闭）");
      } catch (error) {
        formatAppLog("error", "at utils/bleManager.js:815", "完全清理蓝牙资源失败:", error);
      }
    }
  }
  const bleManager = new BLEManager();
  const _export_sfc = (sfc, props) => {
    const target = sfc.__vccOpts || sfc;
    for (const [key, val] of props) {
      target[key] = val;
    }
    return target;
  };
  const _sfc_main$9 = {
    data() {
      return {
        selectedSize: "请选择尺寸",
        selectedBluetooth: "请选择蓝牙设备",
        showSizeDropdown: false,
        showBluetoothDropdown: false,
        bluetoothDevices: [],
        isScanning: false,
        isConnected: false,
        connectedDevice: null,
        services: [],
        characteristics: [],
        permissionChecked: false
        // 权限检查状态
      };
    },
    onLoad() {
      this.checkPermissionStatus();
      setTimeout(() => {
        this.initBluetooth();
      }, 1e3);
    },
    onShow() {
      if (this.selectedBluetooth === "蓝牙初始化失败，点击重试" || this.selectedBluetooth === "蓝牙初始化错误，点击重试")
        ;
    },
    onUnload() {
      bleManager.cleanup();
    },
    methods: {
      checkPermissionStatus() {
        const permissionStatus = uni.getStorageSync("bluetooth_permission_checked");
        if (permissionStatus) {
          this.permissionChecked = true;
          formatAppLog("log", "at pages/index/index.vue:146", "权限已检查过，跳过权限提示");
        } else {
          formatAppLog("log", "at pages/index/index.vue:148", "首次使用，需要检查权限");
        }
      },
      savePermissionStatus() {
        uni.setStorageSync("bluetooth_permission_checked", true);
        formatAppLog("log", "at pages/index/index.vue:154", "权限检查状态已保存");
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
          formatAppLog("log", "at pages/index/index.vue:170", "开始初始化蓝牙...");
          const success = await bleManager.initBluetooth();
          if (success) {
            formatAppLog("log", "at pages/index/index.vue:173", "蓝牙初始化成功");
            bleManager.setCallback("onDeviceFound", this.onDeviceFound);
            bleManager.setCallback("onDeviceConnected", this.onDeviceConnected);
            bleManager.setCallback("onDeviceDisconnected", this.onDeviceDisconnected);
            bleManager.setCallback("onServicesDiscovered", this.onServicesDiscovered);
            bleManager.setCallback("onError", this.onBluetoothError);
            this.selectedBluetooth = "蓝牙已就绪";
          } else {
            formatAppLog("log", "at pages/index/index.vue:184", "蓝牙初始化失败");
            this.selectedBluetooth = "蓝牙初始化失败，点击重试";
            uni.showModal({
              title: "蓝牙初始化失败",
              content: '请检查设备蓝牙是否开启，或点击"重新初始化蓝牙"重试',
              showCancel: false
            });
          }
        } catch (error) {
          formatAppLog("log", "at pages/index/index.vue:196", "蓝牙初始化错误:", error);
          this.selectedBluetooth = "蓝牙初始化错误，点击重试";
          uni.showModal({
            title: "蓝牙初始化错误",
            content: '请确保设备支持蓝牙功能并已开启蓝牙，或点击"重新初始化蓝牙"重试',
            showCancel: false
          });
        }
      },
      async startBluetoothScan() {
        try {
          const status = bleManager.getConnectionStatus();
          if (status.isScanning) {
            uni.showToast({
              title: "正在扫描中，请稍候",
              icon: "none"
            });
            return;
          }
          if (this.permissionChecked) {
            formatAppLog("log", "at pages/index/index.vue:222", "权限已检查过，直接开始扫描");
            this.bluetoothDevices = [];
            this.selectedBluetooth = "正在扫描...";
            const success = await bleManager.startScan(4e3, true);
            if (success) {
              this.isScanning = true;
            } else {
              this.isScanning = false;
              this.selectedBluetooth = "扫描失败";
            }
            setTimeout(() => {
              const currentStatus = bleManager.getConnectionStatus();
              if (currentStatus.isScanning) {
                formatAppLog("log", "at pages/index/index.vue:239", "扫描状态检查：强制停止扫描");
                this.stopBluetoothScan();
              }
            }, 6e3);
          } else {
            uni.showModal({
              title: "权限检查",
              content: "请确保已开启蓝牙和位置权限，然后点击确定开始扫描",
              success: async (res) => {
                if (res.confirm) {
                  this.permissionChecked = true;
                  this.savePermissionStatus();
                  this.bluetoothDevices = [];
                  this.selectedBluetooth = "正在扫描...";
                  const success = await bleManager.startScan(4e3);
                  if (success) {
                    this.isScanning = true;
                  } else {
                    this.isScanning = false;
                    this.selectedBluetooth = "扫描失败";
                  }
                  setTimeout(() => {
                    const currentStatus = bleManager.getConnectionStatus();
                    if (currentStatus.isScanning) {
                      formatAppLog("log", "at pages/index/index.vue:269", "扫描状态检查：强制停止扫描");
                      this.stopBluetoothScan();
                    }
                  }, 6e3);
                }
              }
            });
          }
        } catch (error) {
          formatAppLog("log", "at pages/index/index.vue:278", "开始扫描失败:", error);
          uni.showToast({
            title: "扫描失败",
            icon: "none"
          });
          this.isScanning = false;
        }
      },
      async stopBluetoothScan() {
        try {
          formatAppLog("log", "at pages/index/index.vue:288", "用户手动停止扫描");
          await bleManager.stopScan();
          const status = bleManager.getConnectionStatus();
          this.isScanning = status.isScanning;
          if (this.bluetoothDevices.length === 0) {
            this.selectedBluetooth = "未发现BLE设备";
          } else {
            this.selectedBluetooth = "选择设备";
          }
          formatAppLog("log", "at pages/index/index.vue:300", "扫描已停止，状态已更新");
        } catch (error) {
          formatAppLog("log", "at pages/index/index.vue:302", "停止扫描失败:", error);
          const status = bleManager.getConnectionStatus();
          this.isScanning = status.isScanning;
          this.selectedBluetooth = "扫描停止失败";
        }
      },
      async retryInitBluetooth() {
        uni.showLoading({
          title: "重新初始化蓝牙..."
        });
        try {
          await bleManager.cleanup();
          await new Promise((resolve) => setTimeout(resolve, 1e3));
          const success = await bleManager.initBluetooth();
          uni.hideLoading();
          if (success) {
            bleManager.setCallback("onDeviceFound", this.onDeviceFound);
            bleManager.setCallback("onDeviceConnected", this.onDeviceConnected);
            bleManager.setCallback("onDeviceDisconnected", this.onDeviceDisconnected);
            bleManager.setCallback("onServicesDiscovered", this.onServicesDiscovered);
            bleManager.setCallback("onError", this.onBluetoothError);
            uni.showToast({
              title: "蓝牙初始化成功",
              icon: "success"
            });
          } else {
            uni.showModal({
              title: "蓝牙初始化失败",
              content: "请检查设备蓝牙是否开启，或重新启动应用",
              showCancel: false
            });
          }
        } catch (error) {
          uni.hideLoading();
          formatAppLog("log", "at pages/index/index.vue:341", "重新初始化蓝牙失败:", error);
          uni.showModal({
            title: "重新初始化失败",
            content: "请确保设备支持蓝牙功能并已开启蓝牙",
            showCancel: false
          });
        }
      },
      async connectBluetoothDevice(device) {
        try {
          uni.showLoading({
            title: "连接设备中..."
          });
          const success = await bleManager.connectDevice(device.deviceId);
          if (success) {
            const status = bleManager.getConnectionStatus();
            this.connectedDevice = device;
            this.isConnected = status.isConnected;
            this.selectedBluetooth = `已连接: ${device.name || device.localName || "未知设备"}`;
            uni.setStorageSync("bluetooth_connected_device", {
              deviceId: device.deviceId,
              deviceName: device.name || device.localName || "未知设备",
              connected: true,
              connectTime: Date.now()
            });
            uni.hideLoading();
            uni.showToast({
              title: "连接成功",
              icon: "success"
            });
            this.showBluetoothDropdown = false;
          } else {
            const status = bleManager.getConnectionStatus();
            this.isConnected = status.isConnected;
            uni.hideLoading();
            uni.showToast({
              title: "连接失败",
              icon: "none"
            });
          }
        } catch (error) {
          formatAppLog("log", "at pages/index/index.vue:388", "连接设备失败:", error);
          const status = bleManager.getConnectionStatus();
          this.isConnected = status.isConnected;
          uni.hideLoading();
          uni.showToast({
            title: "连接失败",
            icon: "none"
          });
        }
      },
      async disconnectBluetooth() {
        try {
          await bleManager.disconnectDevice();
          const status = bleManager.getConnectionStatus();
          this.connectedDevice = null;
          this.isConnected = status.isConnected;
          this.selectedBluetooth = "未连接";
          this.services = [];
          this.characteristics = [];
          uni.removeStorageSync("bluetooth_connected_device");
          uni.showToast({
            title: "已断开连接",
            icon: "success"
          });
          this.showBluetoothDropdown = false;
        } catch (error) {
          formatAppLog("log", "at pages/index/index.vue:418", "断开连接失败:", error);
          const status = bleManager.getConnectionStatus();
          this.isConnected = status.isConnected;
          uni.showToast({
            title: "断开连接失败",
            icon: "none"
          });
        }
      },
      async discoverServices() {
        try {
          uni.showLoading({
            title: "发现目标服务中..."
          });
          const result = await bleManager.discoverServices();
          uni.hideLoading();
          if (result) {
            this.services = result.services;
            this.characteristics = result.characteristics;
            if (result.targetServiceFound) {
              uni.showModal({
                title: "目标服务发现成功",
                content: `成功找到目标服务 4fafc201-1fb5-459e-8fcc-c5c9c331914b
发现 ${result.services.length} 个服务，${result.characteristics.length} 个特征值`,
                showCancel: false
              });
            } else {
              uni.showModal({
                title: "目标服务未找到",
                content: `未找到目标服务 4fafc201-1fb5-459e-8fcc-c5c9c331914b
但发现了 ${result.services.length} 个其他服务，${result.characteristics.length} 个特征值`,
                showCancel: false
              });
            }
            formatAppLog("log", "at pages/index/index.vue:456", "服务发现完成:", result);
          } else {
            uni.showToast({
              title: "服务发现失败",
              icon: "none"
            });
          }
        } catch (error) {
          uni.hideLoading();
          formatAppLog("log", "at pages/index/index.vue:465", "服务发现失败:", error);
          uni.showToast({
            title: "服务发现失败",
            icon: "none"
          });
        }
      },
      // 蓝牙回调函数
      onDeviceFound(device) {
        formatAppLog("log", "at pages/index/index.vue:474", "发现设备:", device);
        this.bluetoothDevices.push(device);
      },
      onDeviceConnected(data) {
        formatAppLog("log", "at pages/index/index.vue:478", "设备已连接:", data);
        const status = bleManager.getConnectionStatus();
        this.isConnected = status.isConnected;
      },
      onDeviceDisconnected(data) {
        formatAppLog("log", "at pages/index/index.vue:484", "设备已断开:", data);
        const status = bleManager.getConnectionStatus();
        this.connectedDevice = null;
        this.isConnected = status.isConnected;
        this.selectedBluetooth = "未连接";
        this.services = [];
        this.characteristics = [];
        uni.removeStorageSync("bluetooth_connected_device");
      },
      onServicesDiscovered(data) {
        formatAppLog("log", "at pages/index/index.vue:496", "发现服务:", data);
        this.services = data.services;
        this.characteristics = data.characteristics;
        if (data.targetServiceFound) {
          uni.showModal({
            title: "目标服务已找到",
            content: `成功找到目标服务 4fafc201-1fb5-459e-8fcc-c5c9c331914b，发现 ${data.services.length} 个服务，${data.characteristics.length} 个特征值`,
            showCancel: false
          });
        } else {
          uni.showModal({
            title: "未找到目标服务",
            content: `未找到目标服务 4fafc201-1fb5-459e-8fcc-c5c9c331914b，但发现了 ${data.services.length} 个其他服务`,
            showCancel: false
          });
        }
      },
      getSignalClass(rssi) {
        if (rssi > -50)
          return "signal-excellent";
        if (rssi > -70)
          return "signal-good";
        if (rssi > -85)
          return "signal-fair";
        return "signal-poor";
      },
      onBluetoothError(error) {
        formatAppLog("log", "at pages/index/index.vue:522", "蓝牙错误:", error);
        if (error.code === 10001) {
          uni.showModal({
            title: "蓝牙权限被拒绝",
            content: "请在系统设置中开启蓝牙权限，然后重新启动应用",
            showCancel: false
          });
        } else if (error.code === 1e4) {
          uni.showToast({
            title: "蓝牙适配器未初始化",
            icon: "none",
            duration: 2e3
          });
        } else if (error.message && error.message.includes("蓝牙未开启")) {
          uni.showModal({
            title: "蓝牙未开启",
            content: "请先在手机设置中开启蓝牙功能，然后重新尝试",
            showCancel: false
          });
        } else if (error.message && error.message.includes("位置权限")) {
          uni.showModal({
            title: "位置权限不足",
            content: "Android系统需要位置权限才能扫描BLE设备，请在设置中开启位置权限",
            showCancel: false
          });
        } else {
          uni.showToast({
            title: "蓝牙操作失败",
            icon: "none",
            duration: 2e3
          });
        }
      },
      goToTemplate() {
        if (this.selectedSize === "4.2英寸三色墨水屏") {
          uni.navigateTo({
            url: "/pages/template/template",
            success: function(res) {
              formatAppLog("log", "at pages/index/index.vue:563", "跳转到4.2英寸模板页面成功");
            },
            fail: function(err) {
              formatAppLog("log", "at pages/index/index.vue:566", "跳转到4.2英寸模板页面失败:", err);
              uni.showToast({
                title: "页面跳转失败，请重新启动项目",
                icon: "none",
                duration: 3e3
              });
            }
          });
        } else if (this.selectedSize === "7.5英寸三色墨水屏") {
          uni.navigateTo({
            url: "/pages/template/template75",
            success: function(res) {
              formatAppLog("log", "at pages/index/index.vue:579", "跳转到7.5英寸模板页面成功");
            },
            fail: function(err) {
              formatAppLog("log", "at pages/index/index.vue:582", "跳转到7.5英寸模板页面失败:", err);
              uni.showToast({
                title: "页面跳转失败，请重新启动项目",
                icon: "none",
                duration: 3e3
              });
            }
          });
        } else {
          uni.navigateTo({
            url: "/pages/template/blank",
            success: function(res) {
              formatAppLog("log", "at pages/index/index.vue:595", "跳转到空白页面成功");
            },
            fail: function(err) {
              formatAppLog("log", "at pages/index/index.vue:598", "跳转到空白页面失败:", err);
              uni.showToast({
                title: "页面跳转失败，请重新启动项目",
                icon: "none",
                duration: 3e3
              });
            }
          });
        }
      }
    }
  };
  function _sfc_render$8(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock("view", { class: "page-container" }, [
      vue.createCommentVNode(" 顶部区域 "),
      vue.createElementVNode("view", { class: "top-section" }, [
        vue.createElementVNode("text", { class: "app-title" }, "SWU电子座牌")
      ]),
      vue.createCommentVNode(" 选择框区域 "),
      vue.createElementVNode("view", { class: "selection-area" }, [
        vue.createCommentVNode(" 墨水屏尺寸选择框 "),
        vue.createElementVNode("view", { class: "selection-box" }, [
          vue.createElementVNode("text", { class: "selection-label" }, "墨水屏尺寸选择"),
          vue.createElementVNode("view", {
            class: "selection-content",
            onClick: _cache[0] || (_cache[0] = (...args) => $options.showSizeOptions && $options.showSizeOptions(...args))
          }, [
            vue.createElementVNode(
              "text",
              { class: "selection-text" },
              vue.toDisplayString($data.selectedSize),
              1
              /* TEXT */
            ),
            vue.createElementVNode("text", { class: "dropdown-arrow" }, "▼")
          ]),
          vue.createCommentVNode(" 尺寸选项下拉框 "),
          $data.showSizeDropdown ? (vue.openBlock(), vue.createElementBlock("view", {
            key: 0,
            class: "dropdown-options"
          }, [
            vue.createElementVNode("view", {
              class: "option-item",
              onClick: _cache[1] || (_cache[1] = ($event) => $options.selectSize("4.2英寸三色墨水屏"))
            }, [
              vue.createElementVNode("text", null, "4.2英寸三色墨水屏")
            ]),
            vue.createElementVNode("view", {
              class: "option-item",
              onClick: _cache[2] || (_cache[2] = ($event) => $options.selectSize("7.5英寸三色墨水屏"))
            }, [
              vue.createElementVNode("text", null, "7.5英寸三色墨水屏")
            ])
          ])) : vue.createCommentVNode("v-if", true)
        ]),
        vue.createCommentVNode(" 蓝牙连接选择框 "),
        vue.createElementVNode("view", { class: "selection-box" }, [
          vue.createElementVNode("text", { class: "selection-label" }, "蓝牙连接"),
          vue.createElementVNode("view", {
            class: "selection-content",
            onClick: _cache[3] || (_cache[3] = (...args) => $options.showBluetoothOptions && $options.showBluetoothOptions(...args))
          }, [
            vue.createElementVNode(
              "text",
              { class: "selection-text" },
              vue.toDisplayString($data.selectedBluetooth),
              1
              /* TEXT */
            ),
            vue.createElementVNode("text", { class: "dropdown-arrow" }, "▼")
          ]),
          vue.createCommentVNode(" 蓝牙选项下拉框 "),
          $data.showBluetoothDropdown ? (vue.openBlock(), vue.createElementBlock("view", {
            key: 0,
            class: "dropdown-options"
          }, [
            !$data.isScanning && !$data.isConnected ? (vue.openBlock(), vue.createElementBlock("view", {
              key: 0,
              class: "option-item",
              onClick: _cache[4] || (_cache[4] = (...args) => $options.startBluetoothScan && $options.startBluetoothScan(...args))
            }, [
              vue.createElementVNode("text", null, "扫描设备")
            ])) : vue.createCommentVNode("v-if", true),
            !$data.isScanning && !$data.isConnected ? (vue.openBlock(), vue.createElementBlock("view", {
              key: 1,
              class: "option-item",
              onClick: _cache[5] || (_cache[5] = (...args) => $options.retryInitBluetooth && $options.retryInitBluetooth(...args))
            }, [
              vue.createElementVNode("text", { class: "retry-text" }, "重新初始化蓝牙")
            ])) : vue.createCommentVNode("v-if", true),
            $data.isScanning ? (vue.openBlock(), vue.createElementBlock("view", {
              key: 2,
              class: "option-item scanning-item"
            }, [
              vue.createElementVNode("view", { class: "scanning-info" }, [
                vue.createElementVNode("view", { class: "scanning-status" }, [
                  vue.createElementVNode("text", { class: "scanning-text" }, "正在扫描"),
                  vue.createElementVNode("view", { class: "scanning-dots" }, [
                    vue.createElementVNode("text", { class: "dot" }, "."),
                    vue.createElementVNode("text", { class: "dot" }, "."),
                    vue.createElementVNode("text", { class: "dot" }, ".")
                  ])
                ])
              ]),
              vue.createElementVNode("view", {
                class: "stop-scan-btn",
                onClick: _cache[6] || (_cache[6] = (...args) => $options.stopBluetoothScan && $options.stopBluetoothScan(...args))
              }, [
                vue.createElementVNode("text", { class: "stop-scan-text" }, "停止")
              ])
            ])) : vue.createCommentVNode("v-if", true),
            vue.createCommentVNode(" 设备列表滚动区域 "),
            $data.bluetoothDevices.length > 0 ? (vue.openBlock(), vue.createElementBlock("scroll-view", {
              key: 3,
              class: "device-list-scroll",
              "scroll-y": "true"
            }, [
              (vue.openBlock(true), vue.createElementBlock(
                vue.Fragment,
                null,
                vue.renderList($data.bluetoothDevices, (device) => {
                  return vue.openBlock(), vue.createElementBlock("view", {
                    class: "option-item device-item",
                    key: device.deviceId,
                    onClick: ($event) => $options.connectBluetoothDevice(device)
                  }, [
                    vue.createElementVNode("view", { class: "device-info" }, [
                      vue.createElementVNode(
                        "text",
                        { class: "device-name" },
                        vue.toDisplayString(device.name || device.localName || "未知设备"),
                        1
                        /* TEXT */
                      ),
                      vue.createElementVNode(
                        "text",
                        { class: "device-id" },
                        vue.toDisplayString(device.deviceId),
                        1
                        /* TEXT */
                      )
                    ]),
                    vue.createElementVNode("view", { class: "device-signal" }, [
                      vue.createElementVNode(
                        "text",
                        { class: "device-rssi" },
                        vue.toDisplayString(device.RSSI) + "dBm",
                        1
                        /* TEXT */
                      ),
                      vue.createElementVNode(
                        "view",
                        {
                          class: vue.normalizeClass(["signal-bar", $options.getSignalClass(device.RSSI)])
                        },
                        null,
                        2
                        /* CLASS */
                      )
                    ])
                  ], 8, ["onClick"]);
                }),
                128
                /* KEYED_FRAGMENT */
              ))
            ])) : vue.createCommentVNode("v-if", true),
            $data.isConnected ? (vue.openBlock(), vue.createElementBlock("view", {
              key: 4,
              class: "option-item",
              onClick: _cache[7] || (_cache[7] = (...args) => $options.disconnectBluetooth && $options.disconnectBluetooth(...args))
            }, [
              vue.createElementVNode("text", null, "断开连接")
            ])) : vue.createCommentVNode("v-if", true),
            $data.isConnected ? (vue.openBlock(), vue.createElementBlock("view", {
              key: 5,
              class: "option-item",
              onClick: _cache[8] || (_cache[8] = (...args) => $options.discoverServices && $options.discoverServices(...args))
            }, [
              vue.createElementVNode("text", null, "发现服务")
            ])) : vue.createCommentVNode("v-if", true)
          ])) : vue.createCommentVNode("v-if", true)
        ])
      ]),
      vue.createCommentVNode(" 底部跳转按钮 "),
      vue.createElementVNode("view", {
        class: "bottom-button",
        onClick: _cache[9] || (_cache[9] = (...args) => $options.goToTemplate && $options.goToTemplate(...args))
      }, [
        vue.createElementVNode("text", { class: "button-text" }, "模板选择")
      ])
    ]);
  }
  const PagesIndexIndex = /* @__PURE__ */ _export_sfc(_sfc_main$9, [["render", _sfc_render$8], ["__file", "D:/A/UniProject/E_INK05V1_6/pages/index/index.vue"]]);
  const _imports_0$4 = "/static/moban.jpg";
  const _imports_0$3 = "/static/moban2.jpg";
  const _imports_0$2 = "/static/moban4.jpg";
  const _imports_0$1 = "/static/moban3.jpg";
  const _sfc_main$8 = {
    data() {
      return {
        overlayFontSize: 36,
        unitOverlayFontSize: 24,
        nameOverlayFontSize: 36,
        positionOverlayFontSize: 18,
        kaitiFont: "STKaiti, KaiTi, 楷体, 楷体_GB2312, cursive"
      };
    },
    onLoad() {
      this.computeOverlayFont();
    },
    methods: {
      computeOverlayFont() {
        try {
          const sys = uni.getSystemInfoSync();
          const rpx2px = sys.windowWidth / 750;
          const maxCardWidthPx = 500 * rpx2px;
          const pagePaddingPx = 30 * rpx2px;
          const cardPaddingPx = 20 * rpx2px;
          const containerWidthPx = Math.min(maxCardWidthPx, sys.windowWidth - 2 * pagePaddingPx);
          const previewWidthPx = Math.max(0, containerWidthPx - 2 * cardPaddingPx);
          const ratio = previewWidthPx > 0 ? previewWidthPx / sys.windowWidth : 0;
          this.overlayFontSize = Math.max(12, Math.round(100 * ratio));
          this.unitOverlayFontSize = Math.max(8, Math.round(40 * ratio));
          this.nameOverlayFontSize = Math.max(12, Math.round(100 * ratio));
          this.positionOverlayFontSize = Math.max(10, Math.round(50 * ratio));
        } catch (e) {
          this.overlayFontSize = 36;
          this.unitOverlayFontSize = 24;
          this.nameOverlayFontSize = 36;
          this.positionOverlayFontSize = 30;
        }
      },
      goToHome() {
        uni.navigateBack({
          delta: 1,
          success: function(res) {
          },
          fail: function(err) {
            uni.reLaunch({
              url: "/pages/index/index"
            });
          }
        });
      },
      selectTemplate(templateName, editPageUrl) {
        uni.setStorageSync("selected_template", templateName);
        uni.navigateTo({
          url: editPageUrl,
          success: function(res) {
          },
          fail: function(err) {
            uni.showToast({
              title: "页面跳转失败",
              icon: "none"
            });
          }
        });
      },
      onImageError(e) {
        uni.showToast({
          title: "图片加载失败",
          icon: "none"
        });
      }
    }
  };
  function _sfc_render$7(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock("view", { class: "page-container" }, [
      vue.createCommentVNode(" 顶部区域 "),
      vue.createElementVNode("view", { class: "top-section" }, [
        vue.createElementVNode("text", { class: "app-title" }, "4.2英寸模板选择")
      ]),
      vue.createCommentVNode(" 模板选择区域 "),
      vue.createElementVNode("view", { class: "template-selection-area" }, [
        vue.createElementVNode("view", {
          class: "template-option",
          onClick: _cache[0] || (_cache[0] = ($event) => $options.selectTemplate("moban.jpg", "/pages/edit/edit"))
        }, [
          vue.createElementVNode("view", { class: "preview-wrapper" }, [
            vue.createElementVNode("image", {
              class: "template-preview",
              src: _imports_0$4,
              mode: "aspectFit"
            }),
            vue.createCommentVNode(" 单位文字叠加 "),
            vue.createElementVNode(
              "view",
              {
                class: "unit-text-overlay",
                style: vue.normalizeStyle({ fontSize: $data.unitOverlayFontSize + "px", fontFamily: $data.kaitiFont, fontWeight: "bold" })
              },
              "单位",
              4
              /* STYLE */
            ),
            vue.createCommentVNode(" 姓名文字叠加 "),
            vue.createElementVNode(
              "view",
              {
                class: "name-text-overlay",
                style: vue.normalizeStyle({ fontSize: $data.nameOverlayFontSize + "px", fontFamily: $data.kaitiFont, fontWeight: "bold" })
              },
              "姓名",
              4
              /* STYLE */
            ),
            vue.createCommentVNode(" 职务文字叠加 "),
            vue.createElementVNode(
              "view",
              {
                class: "position-text-overlay",
                style: vue.normalizeStyle({ fontSize: $data.positionOverlayFontSize + "px", fontFamily: $data.kaitiFont, fontWeight: "bold" })
              },
              "职务",
              4
              /* STYLE */
            )
          ])
        ]),
        vue.createElementVNode("view", {
          class: "template-option",
          onClick: _cache[1] || (_cache[1] = ($event) => $options.selectTemplate("moban2.jpg", "/pages/edit/edit2"))
        }, [
          vue.createElementVNode("view", { class: "preview-wrapper" }, [
            vue.createElementVNode("image", {
              class: "template-preview",
              src: _imports_0$3,
              mode: "aspectFit"
            }),
            vue.createElementVNode(
              "view",
              {
                class: "center-text-overlay",
                style: vue.normalizeStyle({ fontSize: $data.overlayFontSize + "px", fontFamily: $data.kaitiFont, fontWeight: "bold" })
              },
              "姓名",
              4
              /* STYLE */
            )
          ])
        ]),
        vue.createElementVNode("view", {
          class: "template-option",
          onClick: _cache[2] || (_cache[2] = ($event) => $options.selectTemplate("moban4.jpg", "/pages/edit/edit4"))
        }, [
          vue.createElementVNode("view", { class: "preview-wrapper" }, [
            vue.createElementVNode("image", {
              class: "template-preview",
              src: _imports_0$2,
              mode: "aspectFit"
            }),
            vue.createCommentVNode(" 单位文字叠加 "),
            vue.createElementVNode(
              "view",
              {
                class: "unit-text-overlay",
                style: vue.normalizeStyle({ fontSize: $data.unitOverlayFontSize + "px", fontFamily: "楷体, KaiTi, STKaiti, 楷体_GB2312, cursive", fontWeight: "bold" })
              },
              "单位",
              4
              /* STYLE */
            ),
            vue.createCommentVNode(" 姓名文字叠加 "),
            vue.createElementVNode(
              "view",
              {
                class: "name-text-overlay",
                style: vue.normalizeStyle({ fontSize: $data.nameOverlayFontSize + "px", fontFamily: "楷体, KaiTi, STKaiti, 楷体_GB2312, cursive", fontWeight: "bold" })
              },
              "姓名",
              4
              /* STYLE */
            ),
            vue.createCommentVNode(" 职位文字叠加 "),
            vue.createElementVNode(
              "view",
              {
                class: "position-text-overlay",
                style: vue.normalizeStyle({ fontSize: $data.positionOverlayFontSize + "px", fontFamily: "楷体, KaiTi, STKaiti, 楷体_GB2312, cursive", fontWeight: "bold" })
              },
              "职位",
              4
              /* STYLE */
            )
          ])
        ]),
        vue.createElementVNode("view", {
          class: "template-option",
          onClick: _cache[3] || (_cache[3] = ($event) => $options.selectTemplate("moban3.jpg", "/pages/edit/edit3"))
        }, [
          vue.createElementVNode("view", { class: "preview-wrapper" }, [
            vue.createElementVNode("image", {
              class: "template-preview",
              src: _imports_0$1,
              mode: "aspectFit"
            }),
            vue.createCommentVNode(" 单位文字叠加 "),
            vue.createElementVNode(
              "view",
              {
                class: "unit-text-overlay",
                style: vue.normalizeStyle({ fontSize: $data.unitOverlayFontSize + "px", fontFamily: $data.kaitiFont, fontWeight: "bold" })
              },
              "单位",
              4
              /* STYLE */
            ),
            vue.createCommentVNode(" 姓名文字叠加 "),
            vue.createElementVNode(
              "view",
              {
                class: "name-text-overlay",
                style: vue.normalizeStyle({ fontSize: $data.nameOverlayFontSize + "px", fontFamily: $data.kaitiFont, fontWeight: "bold" })
              },
              "姓名",
              4
              /* STYLE */
            )
          ])
        ])
      ]),
      vue.createCommentVNode(" 底部返回按钮 "),
      vue.createElementVNode("view", {
        class: "bottom-button",
        onClick: _cache[4] || (_cache[4] = (...args) => $options.goToHome && $options.goToHome(...args))
      }, [
        vue.createElementVNode("text", { class: "button-text" }, "主页")
      ])
    ]);
  }
  const PagesTemplateTemplate = /* @__PURE__ */ _export_sfc(_sfc_main$8, [["render", _sfc_render$7], ["__file", "D:/A/UniProject/E_INK05V1_6/pages/template/template.vue"]]);
  const _imports_0 = "/static/moban75.jpg";
  const _sfc_main$7 = {
    data() {
      return {};
    },
    onLoad() {
    },
    methods: {
      goToHome() {
        uni.navigateBack({
          delta: 1,
          success: function(res) {
          },
          fail: function(err) {
            uni.reLaunch({
              url: "/pages/index/index"
            });
          }
        });
      },
      goToEdit() {
        uni.navigateTo({
          url: "/pages/edit/edit75",
          success: function(res) {
          },
          fail: function(err) {
            uni.showToast({
              title: "页面跳转失败",
              icon: "none"
            });
          }
        });
      },
      onImageError(e) {
        uni.showToast({
          title: "图片加载失败",
          icon: "none"
        });
      }
    }
  };
  function _sfc_render$6(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock("view", { class: "page-container" }, [
      vue.createCommentVNode(" 顶部区域 "),
      vue.createElementVNode("view", { class: "top-section" }, [
        vue.createElementVNode("text", { class: "app-title" }, "SWU_EPAPER")
      ]),
      vue.createCommentVNode(" 模板图片区域 "),
      vue.createElementVNode("view", { class: "template-area" }, [
        vue.createElementVNode(
          "image",
          {
            class: "template-image",
            src: _imports_0,
            mode: "aspectFit",
            onError: _cache[0] || (_cache[0] = (...args) => $options.onImageError && $options.onImageError(...args)),
            onClick: _cache[1] || (_cache[1] = (...args) => $options.goToEdit && $options.goToEdit(...args))
          },
          null,
          32
          /* NEED_HYDRATION */
        )
      ]),
      vue.createCommentVNode(" 底部返回按钮 "),
      vue.createElementVNode("view", {
        class: "bottom-button",
        onClick: _cache[2] || (_cache[2] = (...args) => $options.goToHome && $options.goToHome(...args))
      }, [
        vue.createElementVNode("text", { class: "button-text" }, "HOMEpage")
      ])
    ]);
  }
  const PagesTemplateTemplate75 = /* @__PURE__ */ _export_sfc(_sfc_main$7, [["render", _sfc_render$6], ["__file", "D:/A/UniProject/E_INK05V1_6/pages/template/template75.vue"]]);
  const _sfc_main$6 = {
    data() {
      return {};
    },
    onLoad() {
    },
    methods: {
      goToHome() {
        uni.navigateBack({
          delta: 1,
          success: function(res) {
          },
          fail: function(err) {
            uni.reLaunch({
              url: "/pages/index/index"
            });
          }
        });
      }
    }
  };
  function _sfc_render$5(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock("view", { class: "page-container" }, [
      vue.createCommentVNode(" 顶部区域 "),
      vue.createElementVNode("view", { class: "top-section" }, [
        vue.createElementVNode("text", { class: "app-title" }, "SWU_EPAPER")
      ]),
      vue.createCommentVNode(" 空白内容区域 "),
      vue.createElementVNode("view", { class: "blank-area" }, [
        vue.createElementVNode("view", { class: "blank-content" }, [
          vue.createElementVNode("text", { class: "blank-title" }, "请先选择墨水屏尺寸")
        ])
      ]),
      vue.createCommentVNode(" 底部返回按钮 "),
      vue.createElementVNode("view", {
        class: "bottom-button",
        onClick: _cache[0] || (_cache[0] = (...args) => $options.goToHome && $options.goToHome(...args))
      }, [
        vue.createElementVNode("text", { class: "button-text" }, "HOMEpage")
      ])
    ]);
  }
  const PagesTemplateBlank = /* @__PURE__ */ _export_sfc(_sfc_main$6, [["render", _sfc_render$5], ["__file", "D:/A/UniProject/E_INK05V1_6/pages/template/blank.vue"]]);
  const _sfc_main$5 = {
    data() {
      return {
        // 当前输入的文字
        currentText: "",
        // 当前输入的单位
        currentUnit: "",
        // 当前输入的职务
        currentPosition: "",
        // 当前字体（固定楷体）
        currentFont: "STKaiti, KaiTi, 楷体, 楷体_GB2312, cursive",
        // 当前字体大小（固定100px）
        currentFontSize: 100,
        // 单位字体大小
        currentUnitFontSize: 40,
        // 姓名字体大小
        currentNameFontSize: 100,
        // 当前颜色（固定白色）
        currentColor: "#FFFFFF",
        // 合并后的图片数据
        mergedImageData: null,
        // 合并延迟定时器
        mergeTimeout: null,
        // 处理后的数据
        processedData: {
          blackWhiteArray: null,
          // 黑白图层C数组
          redWhiteArray: null,
          // 红白图层C数组
          processing: false
          // 处理状态
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
          baseInterval: 200,
          // 基础间隔时间（ms）
          currentInterval: 200,
          // 当前间隔时间（ms）
          successCount: 0,
          // 连续成功次数
          failureCount: 0,
          // 连续失败次数
          minInterval: 100,
          // 最小间隔时间（ms）
          maxInterval: 500,
          // 最大间隔时间（ms）
          adjustmentStep: 50
          // 调整步长（ms）
        },
        // 删除字体与颜色选项
        fontOptions: [],
        colorOptions: []
      };
    },
    onLoad() {
      this.loadTemplate();
      this.initBluetooth();
    },
    onShow() {
      this.checkBluetoothStatus();
    },
    onUnload() {
    },
    methods: {
      // 计算单位预览字体像素大小：基于模板预览显示大小进行比例缩放
      getUnitPreviewFontSizePx() {
        try {
          const sys = uni.getSystemInfoSync();
          const containerWidth = sys.windowWidth - 40;
          const scale = containerWidth / 400;
          return Math.round(this.currentUnitFontSize * scale);
        } catch (e) {
          return this.currentUnitFontSize;
        }
      },
      // 计算姓名预览字体像素大小：基于模板预览显示大小进行比例缩放
      getNamePreviewFontSizePx() {
        try {
          const sys = uni.getSystemInfoSync();
          const containerWidth = sys.windowWidth - 40;
          const scale = containerWidth / 400;
          return Math.round(this.currentNameFontSize * scale);
        } catch (e) {
          return this.currentNameFontSize;
        }
      },
      // 计算职务预览字体像素大小：基于模板预览显示大小进行比例缩放
      getPositionPreviewFontSizePx() {
        try {
          const sys = uni.getSystemInfoSync();
          const containerWidth = sys.windowWidth - 40;
          const scale = containerWidth / 400;
          return Math.round(50 * scale);
        } catch (e) {
          return 50;
        }
      },
      // 更新当前单位
      updateCurrentUnit() {
        if (this.currentUnit.trim() || this.currentText.trim()) {
          clearTimeout(this.mergeTimeout);
          this.mergeTimeout = setTimeout(() => {
            this.autoMergeLayers();
          }, 1e3);
        }
      },
      // 更新当前文字
      updateCurrentText() {
        if (this.currentUnit.trim() || this.currentText.trim() || this.currentPosition.trim()) {
          clearTimeout(this.mergeTimeout);
          this.mergeTimeout = setTimeout(() => {
            this.autoMergeLayers();
          }, 1e3);
        }
      },
      // 更新当前职务
      updateCurrentPosition() {
        if (this.currentUnit.trim() || this.currentText.trim() || this.currentPosition.trim()) {
          clearTimeout(this.mergeTimeout);
          this.mergeTimeout = setTimeout(() => {
            this.autoMergeLayers();
          }, 1e3);
        }
      },
      // 单位字体大小拖动条变化处理
      onUnitFontSizeChange(e) {
        this.currentUnitFontSize = e.detail.value;
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
        if (this.currentText.trim() || this.currentUnit.trim() || this.currentPosition.trim()) {
          clearTimeout(this.mergeTimeout);
          this.mergeTimeout = setTimeout(() => {
            this.autoMergeLayers();
          }, 500);
        }
      },
      // 字体大小拖动条变化处理
      onFontSizeChange(e) {
      },
      // 选择字体
      selectFont(font) {
      },
      // 选择颜色
      selectColor(color) {
      },
      // 清空文字
      clearText() {
        this.currentText = "";
        clearTimeout(this.mergeTimeout);
        uni.showToast({
          title: "文字已清空",
          icon: "success"
        });
      },
      // 自动合并图层（静默执行）
      async autoMergeLayers() {
        if (!this.currentUnit.trim() && !this.currentText.trim()) {
          return;
        }
        try {
          const canvasId = "mergeCanvas";
          const ctx = uni.createCanvasContext(canvasId, this);
          const templateImage = "/static/moban.jpg";
          ctx.drawImage(templateImage, 0, 0, 400, 300);
          ctx.setTextAlign("center");
          ctx.setTextBaseline("middle");
          if (this.currentUnit.trim()) {
            ctx.setFontSize(this.currentUnitFontSize);
            ctx.setFillStyle("#000000");
            ctx.font = `bold ${this.currentUnitFontSize}px ${this.currentFont}`;
            ctx.fillText(this.currentUnit, 200, 38);
          }
          if (this.currentText.trim()) {
            ctx.setFontSize(this.currentNameFontSize);
            ctx.setFillStyle("#FFFFFF");
            ctx.font = `bold ${this.currentNameFontSize}px ${this.currentFont}`;
            ctx.fillText(this.currentText, 200, 165);
          }
          if (this.currentPosition.trim()) {
            ctx.setFontSize(50);
            ctx.setFillStyle("#FFFFFF");
            ctx.font = `bold 50px ${this.currentFont}`;
            ctx.fillText(this.currentPosition, 200, 260);
          }
          ctx.draw(false, () => {
            uni.canvasToTempFilePath({
              canvasId,
              success: (res) => {
                this.mergedImageData = res.tempFilePath;
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
          const processCanvasId = "processCanvas";
          const ctx = uni.createCanvasContext(processCanvasId, this);
          const canvasWidth = 400;
          const canvasHeight = 300;
          ctx.drawImage(this.mergedImageData, 0, 0, canvasWidth, canvasHeight);
          ctx.draw(false, () => {
            uni.canvasGetImageData({
              canvasId: processCanvasId,
              x: 0,
              y: 0,
              width: canvasWidth,
              height: canvasHeight,
              success: (imageData) => {
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
        this.processedData.blackWhiteArray = this.pixelsToByteArray(imageData, width, height, "blackWhite");
        this.processedData.redWhiteArray = this.pixelsToByteArray(imageData, width, height, "redWhite");
      },
      // 将像素数据转换为字节数组
      pixelsToByteArray(imageData, width, height, type) {
        const bytesPerRow = Math.ceil(width / 8);
        const totalBytes = bytesPerRow * height;
        const result = new Uint8Array(totalBytes);
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x += 8) {
            let byteValue = 0;
            for (let bit = 0; bit < 8; bit++) {
              const pixelX = x + bit;
              if (pixelX < width) {
                const pixelIndex = (y * width + pixelX) * 4;
                const r = imageData[pixelIndex];
                const g = imageData[pixelIndex + 1];
                const b = imageData[pixelIndex + 2];
                const a = imageData[pixelIndex + 3];
                let shouldDisplay = false;
                if (type === "blackWhite") {
                  shouldDisplay = r < 128 && g < 128 && b < 128 && a > 0;
                } else if (type === "redWhite") {
                  shouldDisplay = r > 128 && g < 128 && b < 128 && a > 0;
                }
                if (shouldDisplay) {
                  byteValue |= 1 << 7 - bit;
                }
              }
            }
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
          await this.startBluetoothAdapter();
          const adapterState = await this.checkBluetoothAdapterState();
          if (!adapterState.available) {
            uni.showToast({
              title: "蓝牙不可用",
              icon: "none"
            });
            return;
          }
          this.setupBluetoothListeners();
          await this.checkExistingConnection();
        } catch (error) {
          uni.showToast({
            title: "蓝牙初始化失败",
            icon: "none"
          });
        }
      },
      // 启动蓝牙适配器
      async startBluetoothAdapter() {
        return new Promise((resolve, reject) => {
          uni.openBluetoothAdapter({
            success: (res) => {
              resolve(res);
            },
            fail: (err) => {
              if (err.errCode === 10001) {
                resolve();
              } else {
                reject(err);
              }
            }
          });
        });
      },
      // 返回主页面
      goToMainPage() {
        uni.navigateBack({
          delta: 1,
          success: () => {
          },
          fail: (err) => {
            uni.reLaunch({
              url: "/pages/index/index"
            });
          }
        });
      },
      // 检查蓝牙适配器状态
      async checkBluetoothAdapterState() {
        return new Promise((resolve) => {
          uni.getBluetoothAdapterState({
            success: (res) => {
              resolve({
                available: res.available,
                discovering: res.discovering
              });
            },
            fail: (err) => {
              resolve({ available: false, discovering: false });
            }
          });
        });
      },
      // 设置蓝牙事件监听
      setupBluetoothListeners() {
        uni.onBluetoothDeviceFound((res) => {
          this.onBluetoothDeviceFound(res);
        });
        uni.onBLECharacteristicValueChange((res) => {
          this.onBLECharacteristicValueChange(res);
        });
      },
      // 检查现有连接
      async checkExistingConnection() {
        try {
          const storedConnection = uni.getStorageSync("bluetooth_connected_device");
          if (storedConnection && storedConnection.connected) {
            this.currentDeviceId = storedConnection.deviceId;
            this.connectedDeviceName = storedConnection.deviceName;
            this.isBluetoothConnected = true;
            const connectedDevices = await this.getConnectedDevices();
            const isStillConnected = connectedDevices.some((device) => device.deviceId === storedConnection.deviceId);
            if (isStillConnected) {
              await this.autoDiscoverServices();
              return;
            } else {
              uni.removeStorageSync("bluetooth_connected_device");
              this.isBluetoothConnected = false;
              this.currentDeviceId = null;
              this.connectedDeviceName = null;
            }
          } else {
            this.isBluetoothConnected = false;
          }
        } catch (error) {
          this.isBluetoothConnected = false;
        }
      },
      // 获取已连接的设备
      async getConnectedDevices() {
        return new Promise((resolve) => {
          uni.getConnectedBluetoothDevices({
            services: [],
            success: (res) => {
              resolve(res.devices || []);
            },
            fail: (err) => {
              resolve([]);
            }
          });
        });
      },
      // 蓝牙设备发现回调
      onBluetoothDeviceFound(res) {
        uni.stopBluetoothDevicesDiscovery();
        uni.hideLoading();
      },
      // 特征值变化回调
      onBLECharacteristicValueChange(res) {
      },
      // 自动发现服务
      async autoDiscoverServices() {
        try {
          if (!this.currentDeviceId) {
            return;
          }
          await this.discoverServices();
        } catch (error) {
        }
      },
      // 发现服务
      async discoverServices() {
        return new Promise((resolve, reject) => {
          uni.getBLEDeviceServices({
            deviceId: this.currentDeviceId,
            success: (res) => {
              this.services = res.services;
              this.discoverCharacteristics();
              resolve(res);
            },
            fail: (err) => {
              reject(err);
            }
          });
        });
      },
      // 发现特征值
      async discoverCharacteristics() {
        if (!this.services || this.services.length === 0) {
          return;
        }
        this.characteristics = [];
        for (const service of this.services) {
          await this.getCharacteristicsForService(service.uuid);
        }
        this.characteristics.filter((char) => {
          const hasWrite = char.properties && (char.properties.write || char.properties.writeNoResponse);
          return hasWrite;
        });
      },
      // 获取服务的特征值
      async getCharacteristicsForService(serviceId) {
        return new Promise((resolve) => {
          uni.getBLEDeviceCharacteristics({
            deviceId: this.currentDeviceId,
            serviceId,
            success: (res) => {
              const characteristics = res.characteristics.map((char) => ({
                ...char,
                serviceId
              }));
              this.characteristics.push(...characteristics);
              resolve(res);
            },
            fail: (err) => {
              resolve(null);
            }
          });
        });
      },
      // 检查蓝牙状态
      checkBluetoothStatus() {
        try {
          if (this.currentDeviceId && this.isBluetoothConnected) {
          } else {
            this.isBluetoothConnected = false;
          }
        } catch (error) {
        }
      },
      // 自适应调整发送间隔时间
      adjustSendInterval(success) {
        if (success) {
          this.adaptiveTiming.successCount++;
          this.adaptiveTiming.failureCount = 0;
          if (this.adaptiveTiming.successCount >= 3) {
            this.adaptiveTiming.currentInterval = Math.max(
              this.adaptiveTiming.minInterval,
              this.adaptiveTiming.currentInterval - this.adaptiveTiming.adjustmentStep
            );
            this.adaptiveTiming.successCount = 0;
            formatAppLog("log", "at pages/edit/edit.vue:837", `发送成功，缩短间隔时间至: ${this.adaptiveTiming.currentInterval}ms`);
          }
        } else {
          this.adaptiveTiming.failureCount++;
          this.adaptiveTiming.successCount = 0;
          this.adaptiveTiming.currentInterval = Math.min(
            this.adaptiveTiming.maxInterval,
            this.adaptiveTiming.currentInterval + this.adaptiveTiming.adjustmentStep
          );
          formatAppLog("log", "at pages/edit/edit.vue:848", `发送失败，增加间隔时间至: ${this.adaptiveTiming.currentInterval}ms`);
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
            title: "蓝牙未连接",
            icon: "none"
          });
          return;
        }
        if (!this.processedData.blackWhiteArray || !this.processedData.redWhiteArray) {
          uni.showToast({
            title: "没有可发送的数据",
            icon: "none"
          });
          return;
        }
        this.sendingData = true;
        this.sendProgress = 0;
        this.resetAdaptiveTiming();
        this.sendQueue = [];
        this.isSending = false;
        uni.showLoading({
          title: "正在发送数据..."
        });
        try {
          const maxDataLength = await this.requestMTU(506);
          await this.sendArrayData(this.processedData.blackWhiteArray, 37);
          "黑白数组发送完成";
          "开始发送红白数组...";
          await this.sendArrayData(this.processedData.redWhiteArray, 20);
          "红白数组发送完成";
          "开始发送尾包...";
          await this.sendTailPacket();
          "尾包发送完成";
          uni.hideLoading();
          uni.showToast({
            title: "数据发送完成",
            icon: "success"
          });
          "数据发送完成";
        } catch (error) {
          uni.hideLoading();
          uni.showModal({
            title: "发送失败",
            content: `发送数据失败: ${error.message || "未知错误"}`,
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
          formatAppLog("log", "at pages/edit/edit.vue:934", `尝试申请MTU到${mtu}字节`);
          if (!this.currentDeviceId) {
            throw new Error("没有设备ID，无法申请MTU");
          }
          "MTU申请使用的设备ID:", this.currentDeviceId;
          const result = await new Promise((resolve, reject) => {
            uni.setBLEMTU({
              deviceId: this.currentDeviceId,
              mtu,
              success: (res) => {
                "MTU申请成功:", res;
                resolve(res);
              },
              fail: (err) => {
                "MTU申请失败:", err;
                reject(err);
              }
            });
          });
          const actualMTU = result.mtu || mtu;
          formatAppLog("log", "at pages/edit/edit.vue:960", `MTU申请成功，实际MTU: ${actualMTU}字节`);
          const maxDataLength = actualMTU - 6;
          formatAppLog("log", "at pages/edit/edit.vue:964", `可用数据长度: ${maxDataLength}字节`);
          return maxDataLength;
        } catch (error) {
          const maxDataLength = 506 - 6;
          formatAppLog("log", "at pages/edit/edit.vue:972", `使用默认MTU: ${maxDataLength}字节`);
          return maxDataLength;
        }
      },
      // 发送数组数据
      async sendArrayData(dataArray, dataType) {
        const totalLength = dataArray.length;
        const maxDataLength = 506 - 6;
        const totalPackets = Math.ceil(totalLength / maxDataLength);
        formatAppLog("log", "at pages/edit/edit.vue:985", `发送${dataType === 37 ? "黑白" : "红白"}数组，共${totalPackets}个包，每包${maxDataLength}字节`);
        formatAppLog("log", "at pages/edit/edit.vue:986", `数组总长度: ${totalLength}字节`);
        this.totalPackets = totalPackets;
        this.currentPacket = 0;
        for (let i = 0; i < totalPackets; i++) {
          const startIndex = i * maxDataLength;
          const endIndex = Math.min(startIndex + maxDataLength, totalLength);
          const packetData = dataArray.slice(startIndex, endIndex);
          formatAppLog("log", "at pages/edit/edit.vue:997", `发送第${i + 1}/${totalPackets}包，数据长度: ${packetData.length}字节`);
          const packet = this.buildDataPacket(packetData, dataType, false);
          await this.sendPacketWithQueue(packet);
          formatAppLog("log", "at pages/edit/edit.vue:1004", `第${i + 1}包发送成功`);
          this.adjustSendInterval(true);
          this.currentPacket = i + 1;
          this.sendProgress = this.currentPacket / this.totalPackets * 100;
          await new Promise((resolve) => setTimeout(resolve, this.adaptiveTiming.currentInterval));
        }
        formatAppLog("log", "at pages/edit/edit.vue:1017", `${dataType === 37 ? "黑白" : "红白"}数组发送完成，共发送${totalPackets}个包`);
      },
      // 构建数据包
      buildDataPacket(data, dataType, isLastPacket) {
        const packet = new Uint8Array(506);
        let index = 0;
        packet[index++] = 170;
        packet[index++] = isLastPacket ? 255 : 0;
        packet[index++] = dataType;
        const dataLength = data.length;
        packet[index++] = dataLength >> 8 & 255;
        packet[index++] = dataLength & 255;
        for (let i = 0; i < data.length; i++) {
          packet[index++] = data[i];
        }
        while (index < 499) {
          packet[index++] = 0;
        }
        packet[index++] = 99;
        formatAppLog("log", "at pages/edit/edit.vue:1053", `构建数据包: 长度=${packet.length}, 数据类型=0x${dataType.toString(16)}, 数据长度=${dataLength}, 尾包=${isLastPacket}`);
        return packet;
      },
      // 发送尾包
      async sendTailPacket() {
        const tailPacket = new Uint8Array(506);
        let index = 0;
        tailPacket[index++] = 170;
        tailPacket[index++] = 255;
        tailPacket[index++] = 0;
        tailPacket[index++] = 0;
        tailPacket[index++] = 0;
        while (index < 499) {
          tailPacket[index++] = 0;
        }
        tailPacket[index++] = 99;
        await this.sendPacketWithQueue(tailPacket);
      },
      // 使用队列机制发送数据包
      async sendPacketWithQueue(packet) {
        return new Promise((resolve, reject) => {
          this.sendQueue.push({
            packet,
            resolve,
            reject
          });
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
            if (this.sendQueue.length > 0) {
              await new Promise((resolve2) => setTimeout(resolve2, 50));
            }
          } catch (error) {
            reject(error);
          }
        }
        this.isSending = false;
      },
      // 发送单个数据包（带重试机制）
      async sendPacket(packet, retryCount = 0) {
        const maxRetries = 3;
        try {
          if (!this.isBluetoothConnected) {
            throw new Error("BLE设备未连接");
          }
          if (!this.currentDeviceId) {
            throw new Error("没有设备ID，请重新连接设备");
          }
          formatAppLog("log", "at pages/edit/edit.vue:1146", "使用设备ID:", this.currentDeviceId);
          if (!this.characteristics || this.characteristics.length === 0) {
            throw new Error("没有发现特征值，请确保已发现服务");
          }
          const writeableCharacteristics = this.characteristics.filter((char) => {
            `检查特征值 ${char.uuid}:`, {
              properties: char.properties,
              hasWrite: char.properties && char.properties.write,
              hasWriteNoResponse: char.properties && char.properties.writeNoResponse
            };
            return char.properties && (char.properties.write || char.properties.writeNoResponse);
          });
          writeableCharacteristics.sort((a, b) => {
            const aHasWriteNoResponse = a.properties && a.properties.writeNoResponse;
            const bHasWriteNoResponse = b.properties && b.properties.writeNoResponse;
            if (aHasWriteNoResponse && !bHasWriteNoResponse)
              return -1;
            if (!aHasWriteNoResponse && bHasWriteNoResponse)
              return 1;
            return 0;
          });
          "找到的可写特征值:", writeableCharacteristics;
          if (writeableCharacteristics.length === 0) {
            throw new Error("没有找到可写的特征值，请确保设备支持写入操作");
          }
          const characteristic = writeableCharacteristics[0];
          formatAppLog("log", "at pages/edit/edit.vue:1183", `使用可写特征值: ${characteristic.uuid}`);
          `特征值属性:`, characteristic.properties;
          const arrayBuffer = packet.buffer.slice(packet.byteOffset, packet.byteOffset + packet.byteLength);
          const useWriteNoResponse = characteristic.properties && characteristic.properties.writeNoResponse;
          formatAppLog("log", "at pages/edit/edit.vue:1191", `使用写入方式: ${useWriteNoResponse ? "writeNoResponse" : "write"}`);
          await new Promise((resolve, reject) => {
            uni.writeBLECharacteristicValue({
              deviceId: this.currentDeviceId,
              serviceId: characteristic.serviceId,
              characteristicId: characteristic.uuid,
              value: arrayBuffer,
              writeType: useWriteNoResponse ? "writeNoResponse" : "write",
              success: (res) => {
                "写入特征值成功:", res;
                resolve(res);
              },
              fail: (err) => {
                "写入特征值失败:", err;
                if (!useWriteNoResponse && characteristic.properties && characteristic.properties.writeNoResponse) {
                  "尝试使用writeNoResponse方式";
                  uni.writeBLECharacteristicValue({
                    deviceId: this.currentDeviceId,
                    serviceId: characteristic.serviceId,
                    characteristicId: characteristic.uuid,
                    value: arrayBuffer,
                    writeType: "writeNoResponse",
                    success: (res) => {
                      "使用writeNoResponse写入成功:", res;
                      resolve(res);
                    },
                    fail: (err2) => {
                      "writeNoResponse也失败:", err2;
                      reject(new Error(`写入失败: ${err.errMsg || err.message || "未知错误"}`));
                    }
                  });
                } else {
                  reject(new Error(`写入失败: ${err.errMsg || err.message || "未知错误"}`));
                }
              }
            });
          });
          formatAppLog("log", "at pages/edit/edit.vue:1232", `发送数据包成功，长度: ${packet.length}字节`);
        } catch (error) {
          formatAppLog("log", "at pages/edit/edit.vue:1235", `发送数据包失败 (尝试 ${retryCount + 1}/${maxRetries + 1}):`, error);
          if (retryCount < maxRetries && (error.message.includes("写入失败") || error.message.includes("write") || error.message.includes("characteristic"))) {
            this.adjustSendInterval(false);
            const retryDelay = Math.max(this.adaptiveTiming.currentInterval * 2, 300);
            formatAppLog("log", "at pages/edit/edit.vue:1248", `等待 ${retryDelay}ms 后重试...`);
            await new Promise((resolve) => setTimeout(resolve, retryDelay));
            return this.sendPacket(packet, retryCount + 1);
          }
          if (error.message.includes("特征值无法写入") || error.message.includes("写入失败") && error.message.includes("特征值")) {
            throw new Error("写入失败，请重启设备");
          } else if (error.message.includes("property not support")) {
            throw new Error("特征值不支持写入操作，请检查设备是否支持数据写入");
          } else if (error.message.includes("没有发现任何特征值")) {
            throw new Error("没有发现任何特征值，请确保：\n1. 设备已连接\n2. 已发现服务\n3. 设备支持写入操作");
          } else if (error.message.includes("没有找到可写的特征值")) {
            throw new Error("没有找到可写的特征值，请确保：\n1. 设备支持写入操作\n2. 特征值权限正确\n3. 服务已正确发现");
          } else {
            throw new Error(`发送失败 (已重试${retryCount}次): ${error.message}`);
          }
        }
      },
      // 加载模板
      loadTemplate() {
        this.currentFont = "STKaiti, KaiTi, 楷体, 楷体_GB2312, cursive";
        this.currentFontSize = 100;
        this.currentColor = "#FFFFFF";
        if (!this.currentUnit) {
          this.currentUnit = "";
        }
        if (!this.currentText) {
          this.currentText = "";
        }
      },
      // 保存当前设置
      saveCurrentSettings() {
        const settings = {
          unit: this.currentUnit,
          text: this.currentText,
          position: this.currentPosition,
          font: "STKaiti, KaiTi, 楷体, 楷体_GB2312, cursive",
          fontSize: 100,
          unitFontSize: this.currentUnitFontSize,
          nameFontSize: this.currentNameFontSize,
          color: "#FFFFFF"
        };
        uni.setStorageSync("template_text", settings);
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
  };
  function _sfc_render$4(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock("view", { class: "page-container" }, [
      vue.createCommentVNode(" 顶部区域 "),
      vue.createElementVNode("view", { class: "top-section" }, [
        vue.createElementVNode("text", { class: "app-title" }, "4.2英寸模板编辑"),
        vue.createCommentVNode(" 蓝牙状态显示 "),
        vue.createElementVNode(
          "view",
          {
            class: vue.normalizeClass(["bluetooth-status", { "connected": $data.isBluetoothConnected }])
          },
          [
            vue.createElementVNode(
              "text",
              { class: "status-icon" },
              vue.toDisplayString($data.isBluetoothConnected ? "●" : "○"),
              1
              /* TEXT */
            ),
            vue.createElementVNode(
              "text",
              { class: "status-text" },
              vue.toDisplayString($data.isBluetoothConnected ? $data.connectedDeviceName || "已连接" : "请先在主页面连接蓝牙设备"),
              1
              /* TEXT */
            ),
            !$data.isBluetoothConnected ? (vue.openBlock(), vue.createElementBlock("button", {
              key: 0,
              class: "connect-btn",
              onClick: _cache[0] || (_cache[0] = (...args) => $options.goToMainPage && $options.goToMainPage(...args))
            }, " 返回主页面连接 ")) : vue.createCommentVNode("v-if", true)
          ],
          2
          /* CLASS */
        )
      ]),
      vue.createCommentVNode(" 编辑区域 "),
      vue.createElementVNode("view", { class: "edit-area" }, [
        vue.createCommentVNode(" 模板图片容器 "),
        vue.createElementVNode("view", { class: "template-container" }, [
          vue.createElementVNode("image", {
            class: "template-image",
            src: _imports_0$4,
            mode: "aspectFit"
          }),
          vue.createCommentVNode(" 单位文字预览（顶部65px位置） "),
          vue.createElementVNode(
            "view",
            {
              class: "unit-text-preview",
              style: vue.normalizeStyle({
                fontFamily: $data.currentFont,
                fontSize: $options.getUnitPreviewFontSizePx() + "px",
                fontWeight: "bold",
                textAlign: "center"
              })
            },
            vue.toDisplayString($data.currentUnit && $data.currentUnit.trim() ? $data.currentUnit : "单位"),
            5
            /* TEXT, STYLE */
          ),
          vue.createCommentVNode(" 姓名文字预览（175px位置） "),
          vue.createElementVNode(
            "view",
            {
              class: "name-text-preview",
              style: vue.normalizeStyle({
                color: $data.currentColor,
                fontFamily: $data.currentFont,
                fontSize: $options.getNamePreviewFontSizePx() + "px",
                fontWeight: "bold",
                textAlign: "center"
              })
            },
            vue.toDisplayString($data.currentText && $data.currentText.trim() ? $data.currentText : "姓名"),
            5
            /* TEXT, STYLE */
          ),
          vue.createCommentVNode(" 职务文字预览（190px位置） "),
          vue.createElementVNode(
            "view",
            {
              class: "position-text-preview",
              style: vue.normalizeStyle({
                color: $data.currentColor,
                fontFamily: $data.currentFont,
                fontSize: $options.getPositionPreviewFontSizePx() + "px",
                fontWeight: "bold",
                textAlign: "center"
              })
            },
            vue.toDisplayString($data.currentPosition && $data.currentPosition.trim() ? $data.currentPosition : "职务"),
            5
            /* TEXT, STYLE */
          )
        ]),
        vue.createCommentVNode(" 隐藏的Canvas用于合并图层 "),
        vue.createElementVNode("canvas", {
          "canvas-id": "mergeCanvas",
          class: "hidden-canvas",
          style: { "width": "400px", "height": "300px" }
        }),
        vue.createCommentVNode(" 处理Canvas "),
        vue.createElementVNode("canvas", {
          "canvas-id": "processCanvas",
          class: "hidden-canvas",
          style: { "width": "400px", "height": "300px" }
        })
      ]),
      vue.createCommentVNode(" 工具栏 "),
      vue.createElementVNode("view", { class: "toolbar" }, [
        vue.createCommentVNode(" 单位输入区域（顶部22%） "),
        vue.createElementVNode("view", { class: "unit-input-section" }, [
          vue.createElementVNode("text", { class: "input-label" }, "单位"),
          vue.withDirectives(vue.createElementVNode(
            "input",
            {
              class: "text-input",
              "onUpdate:modelValue": _cache[1] || (_cache[1] = ($event) => $data.currentUnit = $event),
              placeholder: "请输入单位",
              onInput: _cache[2] || (_cache[2] = (...args) => $options.updateCurrentUnit && $options.updateCurrentUnit(...args))
            },
            null,
            544
            /* NEED_HYDRATION, NEED_PATCH */
          ), [
            [vue.vModelText, $data.currentUnit]
          ])
        ]),
        vue.createCommentVNode(" 姓名输入区域（底部78%） "),
        vue.createElementVNode("view", { class: "name-input-section" }, [
          vue.createElementVNode("text", { class: "input-label" }, "姓名"),
          vue.withDirectives(vue.createElementVNode(
            "input",
            {
              class: "text-input",
              "onUpdate:modelValue": _cache[3] || (_cache[3] = ($event) => $data.currentText = $event),
              placeholder: "请输入姓名",
              onInput: _cache[4] || (_cache[4] = (...args) => $options.updateCurrentText && $options.updateCurrentText(...args))
            },
            null,
            544
            /* NEED_HYDRATION, NEED_PATCH */
          ), [
            [vue.vModelText, $data.currentText]
          ])
        ]),
        vue.createCommentVNode(" 职务输入区域 "),
        vue.createElementVNode("view", { class: "position-input-section" }, [
          vue.createElementVNode("text", { class: "input-label" }, "职务"),
          vue.withDirectives(vue.createElementVNode(
            "input",
            {
              class: "text-input",
              "onUpdate:modelValue": _cache[5] || (_cache[5] = ($event) => $data.currentPosition = $event),
              placeholder: "请输入职务",
              onInput: _cache[6] || (_cache[6] = (...args) => $options.updateCurrentPosition && $options.updateCurrentPosition(...args))
            },
            null,
            544
            /* NEED_HYDRATION, NEED_PATCH */
          ), [
            [vue.vModelText, $data.currentPosition]
          ])
        ]),
        vue.createCommentVNode(" 单位字体大小调节 "),
        vue.createElementVNode("view", { class: "font-size-section" }, [
          vue.createElementVNode("text", { class: "section-label" }, "单位字体大小"),
          vue.createElementVNode("view", { class: "font-size-control" }, [
            vue.createElementVNode("text", { class: "size-label" }, "小"),
            vue.createElementVNode("slider", {
              class: "font-size-slider",
              value: $data.currentUnitFontSize,
              min: 20,
              max: 60,
              step: 5,
              onChange: _cache[7] || (_cache[7] = (...args) => $options.onUnitFontSizeChange && $options.onUnitFontSizeChange(...args)),
              activeColor: "#87CEEB",
              backgroundColor: "#e9ecef"
            }, null, 40, ["value"]),
            vue.createElementVNode("text", { class: "size-label" }, "大"),
            vue.createElementVNode(
              "view",
              { class: "size-display" },
              vue.toDisplayString($data.currentUnitFontSize) + "px",
              1
              /* TEXT */
            )
          ])
        ]),
        vue.createCommentVNode(" 姓名字体大小调节 "),
        vue.createElementVNode("view", { class: "font-size-section" }, [
          vue.createElementVNode("text", { class: "section-label" }, "姓名字体大小"),
          vue.createElementVNode("view", { class: "font-size-control" }, [
            vue.createElementVNode("text", { class: "size-label" }, "小"),
            vue.createElementVNode("slider", {
              class: "font-size-slider",
              value: $data.currentNameFontSize,
              min: 40,
              max: 120,
              step: 10,
              onChange: _cache[8] || (_cache[8] = (...args) => $options.onNameFontSizeChange && $options.onNameFontSizeChange(...args)),
              activeColor: "#87CEEB",
              backgroundColor: "#e9ecef"
            }, null, 40, ["value"]),
            vue.createElementVNode("text", { class: "size-label" }, "大"),
            vue.createElementVNode(
              "view",
              { class: "size-display" },
              vue.toDisplayString($data.currentNameFontSize) + "px",
              1
              /* TEXT */
            )
          ])
        ]),
        vue.createCommentVNode(" 处理状态显示 "),
        $data.processedData.processing ? (vue.openBlock(), vue.createElementBlock("view", {
          key: 0,
          class: "processing-status"
        }, [
          vue.createElementVNode("view", { class: "processing-indicator" }, [
            vue.createElementVNode("text", { class: "processing-text" }, "正在处理图片..."),
            vue.createElementVNode("view", { class: "loading-dots" }, [
              vue.createElementVNode("text", { class: "dot" }, "."),
              vue.createElementVNode("text", { class: "dot" }, "."),
              vue.createElementVNode("text", { class: "dot" }, ".")
            ])
          ])
        ])) : vue.createCommentVNode("v-if", true),
        vue.createCommentVNode(" 发送状态显示 "),
        $data.sendingData ? (vue.openBlock(), vue.createElementBlock("view", {
          key: 1,
          class: "sending-status"
        }, [
          vue.createElementVNode("view", { class: "sending-indicator" }, [
            vue.createElementVNode("text", { class: "sending-text" }, "正在发送数据..."),
            vue.createElementVNode("view", { class: "progress-container" }, [
              vue.createElementVNode("view", { class: "progress-bar" }, [
                vue.createElementVNode(
                  "view",
                  {
                    class: "progress-fill",
                    style: vue.normalizeStyle({ width: $data.sendProgress + "%" })
                  },
                  null,
                  4
                  /* STYLE */
                )
              ]),
              vue.createElementVNode(
                "text",
                { class: "progress-text" },
                vue.toDisplayString(Math.round($data.sendProgress)) + "%",
                1
                /* TEXT */
              )
            ])
          ])
        ])) : vue.createCommentVNode("v-if", true),
        vue.createCommentVNode(" 操作按钮（仅保留发送） "),
        vue.createElementVNode("view", { class: "action-buttons" }, [
          vue.createElementVNode("button", {
            class: "action-btn send-btn",
            onClick: _cache[9] || (_cache[9] = (...args) => $options.sendDataToDevice && $options.sendDataToDevice(...args)),
            disabled: !$data.processedData.blackWhiteArray || !$data.processedData.redWhiteArray || !$data.isBluetoothConnected || $data.sendingData
          }, vue.toDisplayString($data.sendingData ? "发送中..." : "发送数据"), 9, ["disabled"])
        ])
      ])
    ]);
  }
  const PagesEditEdit = /* @__PURE__ */ _export_sfc(_sfc_main$5, [["render", _sfc_render$4], ["__file", "D:/A/UniProject/E_INK05V1_6/pages/edit/edit.vue"]]);
  const _sfc_main$4 = {
    data() {
      return {
        // 当前输入的文字
        currentText: "",
        // 当前字体（固定楷体）
        currentFont: "STKaiti, KaiTi, 楷体, 楷体_GB2312, cursive",
        // 当前字体大小（固定100px）
        currentFontSize: 100,
        // 姓名字体大小
        currentNameFontSize: 100,
        // 当前颜色（固定白色）
        currentColor: "#FFFFFF",
        // 合并后的图片数据
        mergedImageData: null,
        // 合并延迟定时器
        mergeTimeout: null,
        // 处理后的数据
        processedData: {
          blackWhiteArray: null,
          // 黑白图层C数组
          redWhiteArray: null,
          // 红白图层C数组
          processing: false
          // 处理状态
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
          baseInterval: 200,
          // 基础间隔时间（ms）
          currentInterval: 200,
          // 当前间隔时间（ms）
          successCount: 0,
          // 连续成功次数
          failureCount: 0,
          // 连续失败次数
          minInterval: 100,
          // 最小间隔时间（ms）
          maxInterval: 500,
          // 最大间隔时间（ms）
          adjustmentStep: 50
          // 调整步长（ms）
        },
        // 删除字体与颜色选项
        fontOptions: [],
        colorOptions: []
      };
    },
    onLoad() {
      this.loadTemplate();
      this.initBluetooth();
    },
    onShow() {
      this.checkBluetoothStatus();
    },
    onUnload() {
    },
    methods: {
      // 检测文字是否包含英文字符
      hasEnglishText(text) {
        if (!text)
          return false;
        return /[a-zA-Z0-9]/.test(text);
      },
      // 根据文字内容获取合适的字体
      getFontForText(text) {
        if (this.hasEnglishText(text)) {
          return 'Arial, Helvetica, "Helvetica Neue", sans-serif';
        } else {
          return "STKaiti, KaiTi, 楷体, 楷体_GB2312, cursive";
        }
      },
      // 计算预览字体像素大小：基于屏幕宽度相对400px画布的放大比例
      getPreviewFontSizePx() {
        try {
          const sys = uni.getSystemInfoSync();
          const scale = sys.windowWidth / 400;
          return Math.round(this.currentNameFontSize * scale);
        } catch (e) {
          return this.currentNameFontSize;
        }
      },
      // 计算文字宽度（像素）
      measureTextWidth(text, fontSize, fontFamily) {
        let width = 0;
        for (let i = 0; i < text.length; i++) {
          const char = text[i];
          if (/[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef]/.test(char)) {
            width += fontSize;
          } else {
            width += fontSize * 0.6;
          }
        }
        return width;
      },
      // 将文字分割成多行（支持手动换行和自动换行）
      getTextLines() {
        if (!this.currentText || !this.currentText.trim()) {
          return ["姓名"];
        }
        const manualLines = this.currentText.split("\n");
        const maxWidth = 380;
        const fontSize = this.currentNameFontSize;
        const finalLines = [];
        manualLines.forEach((manualLine) => {
          if (!manualLine.trim()) {
            finalLines.push("");
            return;
          }
          const autoWrappedLines = this.autoWrapText(manualLine.trim(), maxWidth, fontSize);
          finalLines.push(...autoWrappedLines);
        });
        return finalLines.length > 0 ? finalLines : ["姓名"];
      },
      // 自动换行处理（将单行文字按宽度分割）
      autoWrapText(text, maxWidth, fontSize) {
        const lines = [];
        let currentLine = "";
        for (let i = 0; i < text.length; i++) {
          const char = text[i];
          const testLine = currentLine + char;
          const testWidth = this.measureTextWidth(testLine, fontSize, this.currentFont);
          if (testWidth <= maxWidth) {
            currentLine = testLine;
          } else {
            if (currentLine) {
              lines.push(currentLine);
              currentLine = char;
            } else {
              currentLine = char;
            }
          }
        }
        if (currentLine) {
          lines.push(currentLine);
        }
        return lines.length > 0 ? lines : [""];
      },
      // 更新当前文字
      updateCurrentText() {
        if (this.currentText.trim()) {
          clearTimeout(this.mergeTimeout);
          this.mergeTimeout = setTimeout(() => {
            this.autoMergeLayers();
          }, 1e3);
        }
      },
      // 姓名字体大小拖动条变化处理
      onNameFontSizeChange(e) {
        this.currentNameFontSize = e.detail.value;
        if (this.currentText.trim()) {
          clearTimeout(this.mergeTimeout);
          this.mergeTimeout = setTimeout(() => {
            this.autoMergeLayers();
          }, 500);
        }
      },
      // 字体大小拖动条变化处理
      onFontSizeChange(e) {
        this.currentFontSize = e.detail.value;
        if (this.currentText.trim()) {
          clearTimeout(this.mergeTimeout);
          this.mergeTimeout = setTimeout(() => {
            this.autoMergeLayers();
          }, 500);
        }
      },
      // 选择字体
      selectFont(font) {
      },
      // 选择颜色
      selectColor(color) {
      },
      // 清空文字
      clearText() {
        this.currentText = "";
        clearTimeout(this.mergeTimeout);
        uni.showToast({
          title: "文字已清空",
          icon: "success"
        });
      },
      // 自动合并图层（静默执行）
      async autoMergeLayers() {
        if (!this.currentText.trim()) {
          return;
        }
        try {
          const canvasId = "mergeCanvas";
          const ctx = uni.createCanvasContext(canvasId, this);
          const templateImage = "/static/moban2.jpg";
          ctx.drawImage(templateImage, 0, 0, 400, 300);
          const textLines = this.getTextLinesForCanvas();
          const fontForText = this.getFontForText(this.currentText);
          ctx.setFontSize(this.currentNameFontSize);
          ctx.font = `bold ${this.currentNameFontSize}px ${fontForText}`;
          ctx.setFillStyle("#FFFFFF");
          ctx.setTextAlign("center");
          ctx.setTextBaseline("middle");
          const lineHeight = this.currentNameFontSize * 1.2;
          const totalHeight = textLines.length * lineHeight;
          const startY = 155 - (totalHeight - lineHeight) / 2;
          textLines.forEach((line, index) => {
            if (line.trim()) {
              const lineFont = this.getFontForText(line);
              ctx.font = `bold ${this.currentNameFontSize}px ${lineFont}`;
              const y = startY + index * lineHeight;
              ctx.fillText(line, 200, y);
            }
          });
          ctx.draw(false, () => {
            uni.canvasToTempFilePath({
              canvasId,
              success: (res) => {
                this.mergedImageData = res.tempFilePath;
                this.processImage();
              },
              fail: (err) => {
              }
            }, this);
          });
        } catch (error) {
        }
      },
      // 为Canvas绘制获取换行后的文字行数组（支持手动换行和自动换行）
      getTextLinesForCanvas() {
        if (!this.currentText || !this.currentText.trim()) {
          return [];
        }
        const manualLines = this.currentText.split("\n");
        const maxWidth = 380;
        const fontSize = this.currentNameFontSize;
        const finalLines = [];
        manualLines.forEach((manualLine) => {
          if (!manualLine.trim()) {
            finalLines.push("");
            return;
          }
          const autoWrappedLines = this.autoWrapText(manualLine.trim(), maxWidth, fontSize);
          finalLines.push(...autoWrappedLines);
        });
        return finalLines;
      },
      // 处理图片，分离图层
      async processImage() {
        if (!this.mergedImageData) {
          return;
        }
        this.processedData.processing = true;
        try {
          const processCanvasId = "processCanvas";
          const ctx = uni.createCanvasContext(processCanvasId, this);
          const canvasWidth = 400;
          const canvasHeight = 300;
          ctx.drawImage(this.mergedImageData, 0, 0, canvasWidth, canvasHeight);
          ctx.draw(false, () => {
            uni.canvasGetImageData({
              canvasId: processCanvasId,
              x: 0,
              y: 0,
              width: canvasWidth,
              height: canvasHeight,
              success: (imageData) => {
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
        this.processedData.blackWhiteArray = this.pixelsToByteArray(imageData, width, height, "blackWhite");
        this.processedData.redWhiteArray = this.pixelsToByteArray(imageData, width, height, "redWhite");
      },
      // 将像素数据转换为字节数组
      pixelsToByteArray(imageData, width, height, type) {
        const bytesPerRow = Math.ceil(width / 8);
        const totalBytes = bytesPerRow * height;
        const result = new Uint8Array(totalBytes);
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x += 8) {
            let byteValue = 0;
            for (let bit = 0; bit < 8; bit++) {
              const pixelX = x + bit;
              if (pixelX < width) {
                const pixelIndex = (y * width + pixelX) * 4;
                const r = imageData[pixelIndex];
                const g = imageData[pixelIndex + 1];
                const b = imageData[pixelIndex + 2];
                const a = imageData[pixelIndex + 3];
                let shouldDisplay = false;
                if (type === "blackWhite") {
                  shouldDisplay = r < 128 && g < 128 && b < 128 && a > 0;
                } else if (type === "redWhite") {
                  shouldDisplay = r > 128 && g < 128 && b < 128 && a > 0;
                }
                if (shouldDisplay) {
                  byteValue |= 1 << 7 - bit;
                }
              }
            }
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
          await this.startBluetoothAdapter();
          const adapterState = await this.checkBluetoothAdapterState();
          if (!adapterState.available) {
            uni.showToast({
              title: "蓝牙不可用",
              icon: "none"
            });
            return;
          }
          this.setupBluetoothListeners();
          await this.checkExistingConnection();
        } catch (error) {
          uni.showToast({
            title: "蓝牙初始化失败",
            icon: "none"
          });
        }
      },
      // 启动蓝牙适配器
      async startBluetoothAdapter() {
        return new Promise((resolve, reject) => {
          uni.openBluetoothAdapter({
            success: (res) => {
              resolve(res);
            },
            fail: (err) => {
              if (err.errCode === 10001) {
                resolve();
              } else {
                reject(err);
              }
            }
          });
        });
      },
      // 返回主页面
      goToMainPage() {
        uni.navigateBack({
          delta: 1,
          success: () => {
          },
          fail: (err) => {
            uni.reLaunch({
              url: "/pages/index/index"
            });
          }
        });
      },
      // 检查蓝牙适配器状态
      async checkBluetoothAdapterState() {
        return new Promise((resolve) => {
          uni.getBluetoothAdapterState({
            success: (res) => {
              resolve({
                available: res.available,
                discovering: res.discovering
              });
            },
            fail: (err) => {
              resolve({ available: false, discovering: false });
            }
          });
        });
      },
      // 设置蓝牙事件监听
      setupBluetoothListeners() {
        uni.onBluetoothDeviceFound((res) => {
          this.onBluetoothDeviceFound(res);
        });
        uni.onBLECharacteristicValueChange((res) => {
          this.onBLECharacteristicValueChange(res);
        });
      },
      // 检查现有连接
      async checkExistingConnection() {
        try {
          const storedConnection = uni.getStorageSync("bluetooth_connected_device");
          if (storedConnection && storedConnection.connected) {
            this.currentDeviceId = storedConnection.deviceId;
            this.connectedDeviceName = storedConnection.deviceName;
            this.isBluetoothConnected = true;
            const connectedDevices = await this.getConnectedDevices();
            const isStillConnected = connectedDevices.some((device) => device.deviceId === storedConnection.deviceId);
            if (isStillConnected) {
              await this.autoDiscoverServices();
              return;
            } else {
              uni.removeStorageSync("bluetooth_connected_device");
              this.isBluetoothConnected = false;
              this.currentDeviceId = null;
              this.connectedDeviceName = null;
            }
          } else {
            this.isBluetoothConnected = false;
          }
        } catch (error) {
          this.isBluetoothConnected = false;
        }
      },
      // 获取已连接的设备
      async getConnectedDevices() {
        return new Promise((resolve) => {
          uni.getConnectedBluetoothDevices({
            services: [],
            success: (res) => {
              resolve(res.devices || []);
            },
            fail: (err) => {
              resolve([]);
            }
          });
        });
      },
      // 蓝牙设备发现回调
      onBluetoothDeviceFound(res) {
        uni.stopBluetoothDevicesDiscovery();
        uni.hideLoading();
      },
      // 特征值变化回调
      onBLECharacteristicValueChange(res) {
      },
      // 自动发现服务
      async autoDiscoverServices() {
        try {
          if (!this.currentDeviceId) {
            return;
          }
          await this.discoverServices();
        } catch (error) {
        }
      },
      // 发现服务
      async discoverServices() {
        return new Promise((resolve, reject) => {
          uni.getBLEDeviceServices({
            deviceId: this.currentDeviceId,
            success: (res) => {
              this.services = res.services;
              this.discoverCharacteristics();
              resolve(res);
            },
            fail: (err) => {
              reject(err);
            }
          });
        });
      },
      // 发现特征值
      async discoverCharacteristics() {
        if (!this.services || this.services.length === 0) {
          return;
        }
        this.characteristics = [];
        for (const service of this.services) {
          await this.getCharacteristicsForService(service.uuid);
        }
        this.characteristics.filter((char) => {
          const hasWrite = char.properties && (char.properties.write || char.properties.writeNoResponse);
          return hasWrite;
        });
      },
      // 获取服务的特征值
      async getCharacteristicsForService(serviceId) {
        return new Promise((resolve) => {
          uni.getBLEDeviceCharacteristics({
            deviceId: this.currentDeviceId,
            serviceId,
            success: (res) => {
              const characteristics = res.characteristics.map((char) => ({
                ...char,
                serviceId
              }));
              this.characteristics.push(...characteristics);
              resolve(res);
            },
            fail: (err) => {
              resolve(null);
            }
          });
        });
      },
      // 检查蓝牙状态
      checkBluetoothStatus() {
        try {
          if (this.currentDeviceId && this.isBluetoothConnected) {
          } else {
            this.isBluetoothConnected = false;
          }
        } catch (error) {
        }
      },
      // 自适应调整发送间隔时间
      adjustSendInterval(success) {
        if (success) {
          this.adaptiveTiming.successCount++;
          this.adaptiveTiming.failureCount = 0;
          if (this.adaptiveTiming.successCount >= 3) {
            this.adaptiveTiming.currentInterval = Math.max(
              this.adaptiveTiming.minInterval,
              this.adaptiveTiming.currentInterval - this.adaptiveTiming.adjustmentStep
            );
            this.adaptiveTiming.successCount = 0;
            formatAppLog("log", "at pages/edit/edit2.vue:843", `发送成功，缩短间隔时间至: ${this.adaptiveTiming.currentInterval}ms`);
          }
        } else {
          this.adaptiveTiming.failureCount++;
          this.adaptiveTiming.successCount = 0;
          this.adaptiveTiming.currentInterval = Math.min(
            this.adaptiveTiming.maxInterval,
            this.adaptiveTiming.currentInterval + this.adaptiveTiming.adjustmentStep
          );
          formatAppLog("log", "at pages/edit/edit2.vue:854", `发送失败，增加间隔时间至: ${this.adaptiveTiming.currentInterval}ms`);
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
            title: "蓝牙未连接",
            icon: "none"
          });
          return;
        }
        if (!this.processedData.blackWhiteArray || !this.processedData.redWhiteArray) {
          uni.showToast({
            title: "没有可发送的数据",
            icon: "none"
          });
          return;
        }
        this.sendingData = true;
        this.sendProgress = 0;
        this.resetAdaptiveTiming();
        this.sendQueue = [];
        this.isSending = false;
        uni.showLoading({
          title: "正在发送数据..."
        });
        try {
          const maxDataLength = await this.requestMTU(506);
          await this.sendArrayData(this.processedData.blackWhiteArray, 37);
          "黑白数组发送完成";
          "开始发送红白数组...";
          await this.sendArrayData(this.processedData.redWhiteArray, 20);
          "红白数组发送完成";
          "开始发送尾包...";
          await this.sendTailPacket();
          "尾包发送完成";
          uni.hideLoading();
          uni.showToast({
            title: "数据发送完成",
            icon: "success"
          });
          "数据发送完成";
        } catch (error) {
          uni.hideLoading();
          uni.showModal({
            title: "发送失败",
            content: `发送数据失败: ${error.message || "未知错误"}`,
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
          formatAppLog("log", "at pages/edit/edit2.vue:940", `尝试申请MTU到${mtu}字节`);
          if (!this.currentDeviceId) {
            throw new Error("没有设备ID，无法申请MTU");
          }
          "MTU申请使用的设备ID:", this.currentDeviceId;
          const result = await new Promise((resolve, reject) => {
            uni.setBLEMTU({
              deviceId: this.currentDeviceId,
              mtu,
              success: (res) => {
                "MTU申请成功:", res;
                resolve(res);
              },
              fail: (err) => {
                "MTU申请失败:", err;
                reject(err);
              }
            });
          });
          const actualMTU = result.mtu || mtu;
          formatAppLog("log", "at pages/edit/edit2.vue:966", `MTU申请成功，实际MTU: ${actualMTU}字节`);
          const maxDataLength = actualMTU - 6;
          formatAppLog("log", "at pages/edit/edit2.vue:970", `可用数据长度: ${maxDataLength}字节`);
          return maxDataLength;
        } catch (error) {
          const maxDataLength = 506 - 6;
          formatAppLog("log", "at pages/edit/edit2.vue:978", `使用默认MTU: ${maxDataLength}字节`);
          return maxDataLength;
        }
      },
      // 发送数组数据
      async sendArrayData(dataArray, dataType) {
        const totalLength = dataArray.length;
        const maxDataLength = 506 - 6;
        const totalPackets = Math.ceil(totalLength / maxDataLength);
        formatAppLog("log", "at pages/edit/edit2.vue:991", `发送${dataType === 37 ? "黑白" : "红白"}数组，共${totalPackets}个包，每包${maxDataLength}字节`);
        formatAppLog("log", "at pages/edit/edit2.vue:992", `数组总长度: ${totalLength}字节`);
        this.totalPackets = totalPackets;
        this.currentPacket = 0;
        for (let i = 0; i < totalPackets; i++) {
          const startIndex = i * maxDataLength;
          const endIndex = Math.min(startIndex + maxDataLength, totalLength);
          const packetData = dataArray.slice(startIndex, endIndex);
          formatAppLog("log", "at pages/edit/edit2.vue:1003", `发送第${i + 1}/${totalPackets}包，数据长度: ${packetData.length}字节`);
          const packet = this.buildDataPacket(packetData, dataType, false);
          await this.sendPacketWithQueue(packet);
          formatAppLog("log", "at pages/edit/edit2.vue:1010", `第${i + 1}包发送成功`);
          this.adjustSendInterval(true);
          this.currentPacket = i + 1;
          this.sendProgress = this.currentPacket / this.totalPackets * 100;
          await new Promise((resolve) => setTimeout(resolve, this.adaptiveTiming.currentInterval));
        }
        formatAppLog("log", "at pages/edit/edit2.vue:1023", `${dataType === 37 ? "黑白" : "红白"}数组发送完成，共发送${totalPackets}个包`);
      },
      // 构建数据包
      buildDataPacket(data, dataType, isLastPacket) {
        const packet = new Uint8Array(506);
        let index = 0;
        packet[index++] = 170;
        packet[index++] = isLastPacket ? 255 : 0;
        packet[index++] = dataType;
        const dataLength = data.length;
        packet[index++] = dataLength >> 8 & 255;
        packet[index++] = dataLength & 255;
        for (let i = 0; i < data.length; i++) {
          packet[index++] = data[i];
        }
        while (index < 499) {
          packet[index++] = 0;
        }
        packet[index++] = 99;
        formatAppLog("log", "at pages/edit/edit2.vue:1059", `构建数据包: 长度=${packet.length}, 数据类型=0x${dataType.toString(16)}, 数据长度=${dataLength}, 尾包=${isLastPacket}`);
        return packet;
      },
      // 发送尾包
      async sendTailPacket() {
        const tailPacket = new Uint8Array(506);
        let index = 0;
        tailPacket[index++] = 170;
        tailPacket[index++] = 255;
        tailPacket[index++] = 0;
        tailPacket[index++] = 0;
        tailPacket[index++] = 0;
        while (index < 499) {
          tailPacket[index++] = 0;
        }
        tailPacket[index++] = 99;
        await this.sendPacketWithQueue(tailPacket);
      },
      // 使用队列机制发送数据包
      async sendPacketWithQueue(packet) {
        return new Promise((resolve, reject) => {
          this.sendQueue.push({
            packet,
            resolve,
            reject
          });
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
            if (this.sendQueue.length > 0) {
              await new Promise((resolve2) => setTimeout(resolve2, 50));
            }
          } catch (error) {
            reject(error);
          }
        }
        this.isSending = false;
      },
      // 发送单个数据包（带重试机制）
      async sendPacket(packet, retryCount = 0) {
        const maxRetries = 3;
        try {
          if (!this.isBluetoothConnected) {
            throw new Error("BLE设备未连接");
          }
          if (!this.currentDeviceId) {
            throw new Error("没有设备ID，请重新连接设备");
          }
          "使用设备ID:", this.currentDeviceId;
          if (!this.characteristics || this.characteristics.length === 0) {
            throw new Error("没有发现特征值，请确保已发现服务");
          }
          const writeableCharacteristics = this.characteristics.filter((char) => {
            `检查特征值 ${char.uuid}:`, {
              properties: char.properties,
              hasWrite: char.properties && char.properties.write,
              hasWriteNoResponse: char.properties && char.properties.writeNoResponse
            };
            return char.properties && (char.properties.write || char.properties.writeNoResponse);
          });
          writeableCharacteristics.sort((a, b) => {
            const aHasWriteNoResponse = a.properties && a.properties.writeNoResponse;
            const bHasWriteNoResponse = b.properties && b.properties.writeNoResponse;
            if (aHasWriteNoResponse && !bHasWriteNoResponse)
              return -1;
            if (!aHasWriteNoResponse && bHasWriteNoResponse)
              return 1;
            return 0;
          });
          "找到的可写特征值:", writeableCharacteristics;
          if (writeableCharacteristics.length === 0) {
            throw new Error("没有找到可写的特征值，请确保设备支持写入操作");
          }
          const characteristic = writeableCharacteristics[0];
          formatAppLog("log", "at pages/edit/edit2.vue:1189", `使用可写特征值: ${characteristic.uuid}`);
          `特征值属性:`, characteristic.properties;
          const arrayBuffer = packet.buffer.slice(packet.byteOffset, packet.byteOffset + packet.byteLength);
          const useWriteNoResponse = characteristic.properties && characteristic.properties.writeNoResponse;
          formatAppLog("log", "at pages/edit/edit2.vue:1197", `使用写入方式: ${useWriteNoResponse ? "writeNoResponse" : "write"}`);
          await new Promise((resolve, reject) => {
            uni.writeBLECharacteristicValue({
              deviceId: this.currentDeviceId,
              serviceId: characteristic.serviceId,
              characteristicId: characteristic.uuid,
              value: arrayBuffer,
              writeType: useWriteNoResponse ? "writeNoResponse" : "write",
              success: (res) => {
                "写入特征值成功:", res;
                resolve(res);
              },
              fail: (err) => {
                "写入特征值失败:", err;
                if (!useWriteNoResponse && characteristic.properties && characteristic.properties.writeNoResponse) {
                  "尝试使用writeNoResponse方式";
                  uni.writeBLECharacteristicValue({
                    deviceId: this.currentDeviceId,
                    serviceId: characteristic.serviceId,
                    characteristicId: characteristic.uuid,
                    value: arrayBuffer,
                    writeType: "writeNoResponse",
                    success: (res) => {
                      "使用writeNoResponse写入成功:", res;
                      resolve(res);
                    },
                    fail: (err2) => {
                      "writeNoResponse也失败:", err2;
                      reject(new Error(`写入失败: ${err.errMsg || err.message || "未知错误"}`));
                    }
                  });
                } else {
                  reject(new Error(`写入失败: ${err.errMsg || err.message || "未知错误"}`));
                }
              }
            });
          });
          formatAppLog("log", "at pages/edit/edit2.vue:1238", `发送数据包成功，长度: ${packet.length}字节`);
        } catch (error) {
          formatAppLog("log", "at pages/edit/edit2.vue:1241", `发送数据包失败 (尝试 ${retryCount + 1}/${maxRetries + 1}):`, error);
          if (retryCount < maxRetries && (error.message.includes("写入失败") || error.message.includes("write") || error.message.includes("characteristic"))) {
            this.adjustSendInterval(false);
            const retryDelay = Math.max(this.adaptiveTiming.currentInterval * 2, 300);
            formatAppLog("log", "at pages/edit/edit2.vue:1254", `等待 ${retryDelay}ms 后重试...`);
            await new Promise((resolve) => setTimeout(resolve, retryDelay));
            return this.sendPacket(packet, retryCount + 1);
          }
          if (error.message.includes("特征值无法写入") || error.message.includes("写入失败") && error.message.includes("特征值")) {
            throw new Error("写入失败，请重启设备");
          } else if (error.message.includes("property not support")) {
            throw new Error("特征值不支持写入操作，请检查设备是否支持数据写入");
          } else if (error.message.includes("没有发现任何特征值")) {
            throw new Error("没有发现任何特征值，请确保：\n1. 设备已连接\n2. 已发现服务\n3. 设备支持写入操作");
          } else if (error.message.includes("没有找到可写的特征值")) {
            throw new Error("没有找到可写的特征值，请确保：\n1. 设备支持写入操作\n2. 特征值权限正确\n3. 服务已正确发现");
          } else {
            throw new Error(`发送失败 (已重试${retryCount}次): ${error.message}`);
          }
        }
      },
      // 加载模板
      loadTemplate() {
        this.currentFont = "STKaiti, KaiTi, 楷体, 楷体_GB2312, cursive";
        this.currentFontSize = 100;
        this.currentColor = "#FFFFFF";
        if (!this.currentText) {
          this.currentText = "";
        }
      },
      // 保存当前设置
      saveCurrentSettings() {
        const settings = {
          text: this.currentText,
          font: "STKaiti, KaiTi, 楷体, 楷体_GB2312, cursive",
          fontSize: 100,
          nameFontSize: this.currentNameFontSize,
          color: "#FFFFFF"
        };
        uni.setStorageSync("template_text", settings);
      }
    },
    // 监听数据变化，自动保存设置
    watch: {
      currentText() {
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
  };
  function _sfc_render$3(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock("view", { class: "page-container" }, [
      vue.createCommentVNode(" 顶部区域 "),
      vue.createElementVNode("view", { class: "top-section" }, [
        vue.createElementVNode("text", { class: "app-title" }, "4.2英寸模板编辑"),
        vue.createCommentVNode(" 蓝牙状态显示 "),
        vue.createElementVNode(
          "view",
          {
            class: vue.normalizeClass(["bluetooth-status", { "connected": $data.isBluetoothConnected }])
          },
          [
            vue.createElementVNode(
              "text",
              { class: "status-icon" },
              vue.toDisplayString($data.isBluetoothConnected ? "●" : "○"),
              1
              /* TEXT */
            ),
            vue.createElementVNode(
              "text",
              { class: "status-text" },
              vue.toDisplayString($data.isBluetoothConnected ? $data.connectedDeviceName || "已连接" : "请先在主页面连接蓝牙设备"),
              1
              /* TEXT */
            ),
            !$data.isBluetoothConnected ? (vue.openBlock(), vue.createElementBlock("button", {
              key: 0,
              class: "connect-btn",
              onClick: _cache[0] || (_cache[0] = (...args) => $options.goToMainPage && $options.goToMainPage(...args))
            }, " 返回主页面连接 ")) : vue.createCommentVNode("v-if", true)
          ],
          2
          /* CLASS */
        )
      ]),
      vue.createCommentVNode(" 编辑区域 "),
      vue.createElementVNode("view", { class: "edit-area" }, [
        vue.createCommentVNode(" 模板图片容器 "),
        vue.createElementVNode("view", { class: "template-container" }, [
          vue.createElementVNode("image", {
            class: "template-image",
            src: _imports_0$3,
            mode: "aspectFit"
          }),
          vue.createCommentVNode(" 中心文字预览（支持多行） "),
          vue.createElementVNode(
            "view",
            {
              class: "center-text-preview",
              style: vue.normalizeStyle({
                color: $data.currentColor,
                fontFamily: $options.getFontForText($data.currentText),
                fontSize: $options.getPreviewFontSizePx() + "px",
                fontWeight: "bold",
                textAlign: "center"
              })
            },
            [
              (vue.openBlock(true), vue.createElementBlock(
                vue.Fragment,
                null,
                vue.renderList($options.getTextLines(), (line, index) => {
                  return vue.openBlock(), vue.createElementBlock(
                    "text",
                    {
                      key: index,
                      class: vue.normalizeClass(["text-line", { "empty-line": !line.trim() }])
                    },
                    vue.toDisplayString(line || " "),
                    3
                    /* TEXT, CLASS */
                  );
                }),
                128
                /* KEYED_FRAGMENT */
              ))
            ],
            4
            /* STYLE */
          )
        ]),
        vue.createCommentVNode(" 隐藏的Canvas用于合并图层 "),
        vue.createElementVNode("canvas", {
          "canvas-id": "mergeCanvas",
          class: "hidden-canvas",
          style: { "width": "400px", "height": "300px" }
        }),
        vue.createCommentVNode(" 处理Canvas "),
        vue.createElementVNode("canvas", {
          "canvas-id": "processCanvas",
          class: "hidden-canvas",
          style: { "width": "400px", "height": "300px" }
        })
      ]),
      vue.createCommentVNode(" 工具栏 "),
      vue.createElementVNode("view", { class: "toolbar" }, [
        vue.createCommentVNode(" 文字输入区域 "),
        vue.createElementVNode("view", { class: "input-section" }, [
          vue.createElementVNode("text", { class: "input-label" }, "姓名"),
          vue.withDirectives(vue.createElementVNode(
            "textarea",
            {
              class: "text-input textarea-input",
              "onUpdate:modelValue": _cache[1] || (_cache[1] = ($event) => $data.currentText = $event),
              placeholder: "请输入姓名（支持回车换行）",
              onInput: _cache[2] || (_cache[2] = (...args) => $options.updateCurrentText && $options.updateCurrentText(...args)),
              "auto-height": true,
              maxlength: 100
            },
            null,
            544
            /* NEED_HYDRATION, NEED_PATCH */
          ), [
            [vue.vModelText, $data.currentText]
          ])
        ]),
        vue.createCommentVNode(" 姓名字体大小调节 "),
        vue.createElementVNode("view", { class: "font-size-section" }, [
          vue.createElementVNode("text", { class: "section-label" }, "姓名字体大小"),
          vue.createElementVNode("view", { class: "font-size-control" }, [
            vue.createElementVNode("text", { class: "size-label" }, "小"),
            vue.createElementVNode("slider", {
              class: "font-size-slider",
              value: $data.currentNameFontSize,
              min: 40,
              max: 150,
              step: 5,
              onChange: _cache[3] || (_cache[3] = (...args) => $options.onNameFontSizeChange && $options.onNameFontSizeChange(...args)),
              activeColor: "#87CEEB",
              backgroundColor: "#e9ecef"
            }, null, 40, ["value"]),
            vue.createElementVNode("text", { class: "size-label" }, "大"),
            vue.createElementVNode(
              "view",
              { class: "size-display" },
              vue.toDisplayString($data.currentNameFontSize) + "px",
              1
              /* TEXT */
            )
          ])
        ]),
        vue.createCommentVNode(" 处理状态显示 "),
        $data.processedData.processing ? (vue.openBlock(), vue.createElementBlock("view", {
          key: 0,
          class: "processing-status"
        }, [
          vue.createElementVNode("view", { class: "processing-indicator" }, [
            vue.createElementVNode("text", { class: "processing-text" }, "正在处理图片..."),
            vue.createElementVNode("view", { class: "loading-dots" }, [
              vue.createElementVNode("text", { class: "dot" }, "."),
              vue.createElementVNode("text", { class: "dot" }, "."),
              vue.createElementVNode("text", { class: "dot" }, ".")
            ])
          ])
        ])) : vue.createCommentVNode("v-if", true),
        vue.createCommentVNode(" 发送状态显示 "),
        $data.sendingData ? (vue.openBlock(), vue.createElementBlock("view", {
          key: 1,
          class: "sending-status"
        }, [
          vue.createElementVNode("view", { class: "sending-indicator" }, [
            vue.createElementVNode("text", { class: "sending-text" }, "正在发送数据..."),
            vue.createElementVNode("view", { class: "progress-container" }, [
              vue.createElementVNode("view", { class: "progress-bar" }, [
                vue.createElementVNode(
                  "view",
                  {
                    class: "progress-fill",
                    style: vue.normalizeStyle({ width: $data.sendProgress + "%" })
                  },
                  null,
                  4
                  /* STYLE */
                )
              ]),
              vue.createElementVNode(
                "text",
                { class: "progress-text" },
                vue.toDisplayString(Math.round($data.sendProgress)) + "%",
                1
                /* TEXT */
              )
            ])
          ])
        ])) : vue.createCommentVNode("v-if", true),
        vue.createCommentVNode(" 操作按钮（仅保留发送） "),
        vue.createElementVNode("view", { class: "action-buttons" }, [
          vue.createElementVNode("button", {
            class: "action-btn send-btn",
            onClick: _cache[4] || (_cache[4] = (...args) => $options.sendDataToDevice && $options.sendDataToDevice(...args)),
            disabled: !$data.processedData.blackWhiteArray || !$data.processedData.redWhiteArray || !$data.isBluetoothConnected || $data.sendingData
          }, vue.toDisplayString($data.sendingData ? "发送中..." : "发送数据"), 9, ["disabled"])
        ])
      ])
    ]);
  }
  const PagesEditEdit2 = /* @__PURE__ */ _export_sfc(_sfc_main$4, [["render", _sfc_render$3], ["__file", "D:/A/UniProject/E_INK05V1_6/pages/edit/edit2.vue"]]);
  const _sfc_main$3 = {
    data() {
      return {
        // 当前输入的文字
        currentText: "",
        // 当前输入的单位
        currentUnit: "",
        // 当前字体（固定楷体）
        currentFont: "STKaiti, KaiTi, 楷体, 楷体_GB2312, cursive",
        // 当前字体大小（固定100px）
        currentFontSize: 100,
        // 单位字体大小
        currentUnitFontSize: 50,
        // 姓名字体大小
        currentNameFontSize: 100,
        // 当前颜色（固定白色）
        currentColor: "#FFFFFF",
        // 合并后的图片数据
        mergedImageData: null,
        // 合并延迟定时器
        mergeTimeout: null,
        // 处理后的数据
        processedData: {
          blackWhiteArray: null,
          // 黑白图层C数组
          redWhiteArray: null,
          // 红白图层C数组
          processing: false
          // 处理状态
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
          baseInterval: 200,
          // 基础间隔时间（ms）
          currentInterval: 200,
          // 当前间隔时间（ms）
          successCount: 0,
          // 连续成功次数
          failureCount: 0,
          // 连续失败次数
          minInterval: 100,
          // 最小间隔时间（ms）
          maxInterval: 500,
          // 最大间隔时间（ms）
          adjustmentStep: 50
          // 调整步长（ms）
        },
        // 删除字体与颜色选项
        fontOptions: [],
        colorOptions: []
      };
    },
    onLoad() {
      this.loadTemplate();
      this.initBluetooth();
    },
    onShow() {
      this.checkBluetoothStatus();
    },
    onUnload() {
    },
    methods: {
      // 计算单位预览字体像素大小：基于屏幕宽度相对400px画布的放大比例
      getUnitPreviewFontSizePx() {
        try {
          const sys = uni.getSystemInfoSync();
          const scale = sys.windowWidth / 400;
          return Math.round(this.currentUnitFontSize * scale);
        } catch (e) {
          return this.currentUnitFontSize;
        }
      },
      // 计算姓名预览字体像素大小：基于屏幕宽度相对400px画布的放大比例
      getNamePreviewFontSizePx() {
        try {
          const sys = uni.getSystemInfoSync();
          const scale = sys.windowWidth / 400;
          return Math.round(this.currentNameFontSize * scale);
        } catch (e) {
          return this.currentNameFontSize;
        }
      },
      // 更新当前单位
      updateCurrentUnit() {
        if (this.currentUnit.trim() || this.currentText.trim()) {
          clearTimeout(this.mergeTimeout);
          this.mergeTimeout = setTimeout(() => {
            this.autoMergeLayers();
          }, 1e3);
        }
      },
      // 更新当前文字
      updateCurrentText() {
        if (this.currentText.trim() || this.currentUnit.trim()) {
          clearTimeout(this.mergeTimeout);
          this.mergeTimeout = setTimeout(() => {
            this.autoMergeLayers();
          }, 1e3);
        }
      },
      // 单位字体大小拖动条变化处理
      onUnitFontSizeChange(e) {
        this.currentUnitFontSize = e.detail.value;
        if (this.currentUnit.trim() || this.currentText.trim()) {
          clearTimeout(this.mergeTimeout);
          this.mergeTimeout = setTimeout(() => {
            this.autoMergeLayers();
          }, 500);
        }
      },
      // 姓名字体大小拖动条变化处理
      onNameFontSizeChange(e) {
        this.currentNameFontSize = e.detail.value;
        if (this.currentText.trim() || this.currentUnit.trim()) {
          clearTimeout(this.mergeTimeout);
          this.mergeTimeout = setTimeout(() => {
            this.autoMergeLayers();
          }, 500);
        }
      },
      // 字体大小拖动条变化处理
      onFontSizeChange(e) {
        this.currentFontSize = e.detail.value;
        if (this.currentText.trim()) {
          clearTimeout(this.mergeTimeout);
          this.mergeTimeout = setTimeout(() => {
            this.autoMergeLayers();
          }, 500);
        }
      },
      // 选择字体
      selectFont(font) {
      },
      // 选择颜色
      selectColor(color) {
      },
      // 清空文字
      clearText() {
        this.currentText = "";
        clearTimeout(this.mergeTimeout);
        uni.showToast({
          title: "文字已清空",
          icon: "success"
        });
      },
      // 自动合并图层（静默执行）
      async autoMergeLayers() {
        if (!this.currentText.trim() && !this.currentUnit.trim()) {
          return;
        }
        try {
          const canvasId = "mergeCanvas";
          const ctx = uni.createCanvasContext(canvasId, this);
          const templateImage = "/static/moban3.jpg";
          ctx.drawImage(templateImage, 0, 0, 400, 300);
          try {
            const sys = uni.getSystemInfoSync();
            const scale = sys.windowWidth / 400;
            if (this.currentUnit.trim()) {
              ctx.setFontSize(Math.round(this.currentUnitFontSize * scale));
              ctx.setFillStyle("#FFFFFF");
              ctx.setTextAlign("center");
              ctx.setTextBaseline("middle");
              ctx.font = `bold ${Math.round(this.currentUnitFontSize * scale)}px ${this.currentFont}`;
              ctx.fillText(this.currentUnit, 200, 38);
            }
            if (this.currentText.trim()) {
              ctx.setFontSize(Math.round(this.currentNameFontSize * scale));
              ctx.setFillStyle("#000000");
              ctx.setTextAlign("center");
              ctx.setTextBaseline("middle");
              ctx.font = `bold ${Math.round(this.currentNameFontSize * scale)}px ${this.currentFont}`;
              ctx.fillText(this.currentText, 200, 175);
            }
          } catch (e) {
            if (this.currentUnit.trim()) {
              ctx.setFontSize(this.currentUnitFontSize);
              ctx.setFillStyle("#FFFFFF");
              ctx.setTextAlign("center");
              ctx.setTextBaseline("middle");
              ctx.font = `bold ${this.currentUnitFontSize}px ${this.currentFont}`;
              ctx.fillText(this.currentUnit, 200, 32);
            }
            if (this.currentText.trim()) {
              ctx.setFontSize(this.currentNameFontSize);
              ctx.setFillStyle("#000000");
              ctx.setTextAlign("center");
              ctx.setTextBaseline("middle");
              ctx.font = `bold ${this.currentNameFontSize}px ${this.currentFont}`;
              ctx.fillText(this.currentText, 200, 160);
            }
          }
          ctx.draw(false, () => {
            uni.canvasToTempFilePath({
              canvasId,
              success: (res) => {
                this.mergedImageData = res.tempFilePath;
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
          const processCanvasId = "processCanvas";
          const ctx = uni.createCanvasContext(processCanvasId, this);
          const canvasWidth = 400;
          const canvasHeight = 300;
          ctx.drawImage(this.mergedImageData, 0, 0, canvasWidth, canvasHeight);
          ctx.draw(false, () => {
            uni.canvasGetImageData({
              canvasId: processCanvasId,
              x: 0,
              y: 0,
              width: canvasWidth,
              height: canvasHeight,
              success: (imageData) => {
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
        this.processedData.blackWhiteArray = this.pixelsToByteArray(imageData, width, height, "blackWhite");
        this.processedData.redWhiteArray = this.pixelsToByteArray(imageData, width, height, "redWhite");
      },
      // 将像素数据转换为字节数组
      pixelsToByteArray(imageData, width, height, type) {
        const bytesPerRow = Math.ceil(width / 8);
        const totalBytes = bytesPerRow * height;
        const result = new Uint8Array(totalBytes);
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x += 8) {
            let byteValue = 0;
            for (let bit = 0; bit < 8; bit++) {
              const pixelX = x + bit;
              if (pixelX < width) {
                const pixelIndex = (y * width + pixelX) * 4;
                const r = imageData[pixelIndex];
                const g = imageData[pixelIndex + 1];
                const b = imageData[pixelIndex + 2];
                const a = imageData[pixelIndex + 3];
                let shouldDisplay = false;
                if (type === "blackWhite") {
                  shouldDisplay = r < 128 && g < 128 && b < 128 && a > 0;
                } else if (type === "redWhite") {
                  shouldDisplay = r > 128 && g < 128 && b < 128 && a > 0;
                }
                if (shouldDisplay) {
                  byteValue |= 1 << 7 - bit;
                }
              }
            }
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
          await this.startBluetoothAdapter();
          const adapterState = await this.checkBluetoothAdapterState();
          if (!adapterState.available) {
            uni.showToast({
              title: "蓝牙不可用",
              icon: "none"
            });
            return;
          }
          this.setupBluetoothListeners();
          await this.checkExistingConnection();
        } catch (error) {
          uni.showToast({
            title: "蓝牙初始化失败",
            icon: "none"
          });
        }
      },
      // 启动蓝牙适配器
      async startBluetoothAdapter() {
        return new Promise((resolve, reject) => {
          uni.openBluetoothAdapter({
            success: (res) => {
              resolve(res);
            },
            fail: (err) => {
              if (err.errCode === 10001) {
                resolve();
              } else {
                reject(err);
              }
            }
          });
        });
      },
      // 返回主页面
      goToMainPage() {
        uni.navigateBack({
          delta: 1,
          success: () => {
          },
          fail: (err) => {
            uni.reLaunch({
              url: "/pages/index/index"
            });
          }
        });
      },
      // 检查蓝牙适配器状态
      async checkBluetoothAdapterState() {
        return new Promise((resolve) => {
          uni.getBluetoothAdapterState({
            success: (res) => {
              resolve({
                available: res.available,
                discovering: res.discovering
              });
            },
            fail: (err) => {
              resolve({ available: false, discovering: false });
            }
          });
        });
      },
      // 设置蓝牙事件监听
      setupBluetoothListeners() {
        uni.onBluetoothDeviceFound((res) => {
          this.onBluetoothDeviceFound(res);
        });
        uni.onBLECharacteristicValueChange((res) => {
          this.onBLECharacteristicValueChange(res);
        });
      },
      // 检查现有连接
      async checkExistingConnection() {
        try {
          const storedConnection = uni.getStorageSync("bluetooth_connected_device");
          if (storedConnection && storedConnection.connected) {
            this.currentDeviceId = storedConnection.deviceId;
            this.connectedDeviceName = storedConnection.deviceName;
            this.isBluetoothConnected = true;
            const connectedDevices = await this.getConnectedDevices();
            const isStillConnected = connectedDevices.some((device) => device.deviceId === storedConnection.deviceId);
            if (isStillConnected) {
              await this.autoDiscoverServices();
              return;
            } else {
              uni.removeStorageSync("bluetooth_connected_device");
              this.isBluetoothConnected = false;
              this.currentDeviceId = null;
              this.connectedDeviceName = null;
            }
          } else {
            this.isBluetoothConnected = false;
          }
        } catch (error) {
          this.isBluetoothConnected = false;
        }
      },
      // 获取已连接的设备
      async getConnectedDevices() {
        return new Promise((resolve) => {
          uni.getConnectedBluetoothDevices({
            services: [],
            success: (res) => {
              resolve(res.devices || []);
            },
            fail: (err) => {
              resolve([]);
            }
          });
        });
      },
      // 蓝牙设备发现回调
      onBluetoothDeviceFound(res) {
        uni.stopBluetoothDevicesDiscovery();
        uni.hideLoading();
      },
      // 特征值变化回调
      onBLECharacteristicValueChange(res) {
      },
      // 自动发现服务
      async autoDiscoverServices() {
        try {
          if (!this.currentDeviceId) {
            return;
          }
          await this.discoverServices();
        } catch (error) {
        }
      },
      // 发现服务
      async discoverServices() {
        return new Promise((resolve, reject) => {
          uni.getBLEDeviceServices({
            deviceId: this.currentDeviceId,
            success: (res) => {
              this.services = res.services;
              this.discoverCharacteristics();
              resolve(res);
            },
            fail: (err) => {
              reject(err);
            }
          });
        });
      },
      // 发现特征值
      async discoverCharacteristics() {
        if (!this.services || this.services.length === 0) {
          return;
        }
        this.characteristics = [];
        for (const service of this.services) {
          await this.getCharacteristicsForService(service.uuid);
        }
        this.characteristics.filter((char) => {
          const hasWrite = char.properties && (char.properties.write || char.properties.writeNoResponse);
          return hasWrite;
        });
      },
      // 获取服务的特征值
      async getCharacteristicsForService(serviceId) {
        return new Promise((resolve) => {
          uni.getBLEDeviceCharacteristics({
            deviceId: this.currentDeviceId,
            serviceId,
            success: (res) => {
              const characteristics = res.characteristics.map((char) => ({
                ...char,
                serviceId
              }));
              this.characteristics.push(...characteristics);
              resolve(res);
            },
            fail: (err) => {
              resolve(null);
            }
          });
        });
      },
      // 检查蓝牙状态
      checkBluetoothStatus() {
        try {
          if (this.currentDeviceId && this.isBluetoothConnected) {
          } else {
            this.isBluetoothConnected = false;
          }
        } catch (error) {
        }
      },
      // 自适应调整发送间隔时间
      adjustSendInterval(success) {
        if (success) {
          this.adaptiveTiming.successCount++;
          this.adaptiveTiming.failureCount = 0;
          if (this.adaptiveTiming.successCount >= 3) {
            this.adaptiveTiming.currentInterval = Math.max(
              this.adaptiveTiming.minInterval,
              this.adaptiveTiming.currentInterval - this.adaptiveTiming.adjustmentStep
            );
            this.adaptiveTiming.successCount = 0;
            formatAppLog("log", "at pages/edit/edit3.vue:808", `发送成功，缩短间隔时间至: ${this.adaptiveTiming.currentInterval}ms`);
          }
        } else {
          this.adaptiveTiming.failureCount++;
          this.adaptiveTiming.successCount = 0;
          this.adaptiveTiming.currentInterval = Math.min(
            this.adaptiveTiming.maxInterval,
            this.adaptiveTiming.currentInterval + this.adaptiveTiming.adjustmentStep
          );
          formatAppLog("log", "at pages/edit/edit3.vue:819", `发送失败，增加间隔时间至: ${this.adaptiveTiming.currentInterval}ms`);
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
            title: "蓝牙未连接",
            icon: "none"
          });
          return;
        }
        if (!this.processedData.blackWhiteArray || !this.processedData.redWhiteArray) {
          uni.showToast({
            title: "没有可发送的数据",
            icon: "none"
          });
          return;
        }
        this.sendingData = true;
        this.sendProgress = 0;
        this.resetAdaptiveTiming();
        this.sendQueue = [];
        this.isSending = false;
        uni.showLoading({
          title: "正在发送数据..."
        });
        try {
          const maxDataLength = await this.requestMTU(506);
          await this.sendArrayData(this.processedData.blackWhiteArray, 37);
          "黑白数组发送完成";
          "开始发送红白数组...";
          await this.sendArrayData(this.processedData.redWhiteArray, 20);
          "红白数组发送完成";
          "开始发送尾包...";
          await this.sendTailPacket();
          "尾包发送完成";
          uni.hideLoading();
          uni.showToast({
            title: "数据发送完成",
            icon: "success"
          });
          "数据发送完成";
        } catch (error) {
          uni.hideLoading();
          uni.showModal({
            title: "发送失败",
            content: `发送数据失败: ${error.message || "未知错误"}`,
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
          formatAppLog("log", "at pages/edit/edit3.vue:905", `尝试申请MTU到${mtu}字节`);
          if (!this.currentDeviceId) {
            throw new Error("没有设备ID，无法申请MTU");
          }
          "MTU申请使用的设备ID:", this.currentDeviceId;
          const result = await new Promise((resolve, reject) => {
            uni.setBLEMTU({
              deviceId: this.currentDeviceId,
              mtu,
              success: (res) => {
                "MTU申请成功:", res;
                resolve(res);
              },
              fail: (err) => {
                "MTU申请失败:", err;
                reject(err);
              }
            });
          });
          const actualMTU = result.mtu || mtu;
          formatAppLog("log", "at pages/edit/edit3.vue:931", `MTU申请成功，实际MTU: ${actualMTU}字节`);
          const maxDataLength = actualMTU - 6;
          formatAppLog("log", "at pages/edit/edit3.vue:935", `可用数据长度: ${maxDataLength}字节`);
          return maxDataLength;
        } catch (error) {
          const maxDataLength = 506 - 6;
          formatAppLog("log", "at pages/edit/edit3.vue:943", `使用默认MTU: ${maxDataLength}字节`);
          return maxDataLength;
        }
      },
      // 发送数组数据
      async sendArrayData(dataArray, dataType) {
        const totalLength = dataArray.length;
        const maxDataLength = 506 - 6;
        const totalPackets = Math.ceil(totalLength / maxDataLength);
        formatAppLog("log", "at pages/edit/edit3.vue:956", `发送${dataType === 37 ? "黑白" : "红白"}数组，共${totalPackets}个包，每包${maxDataLength}字节`);
        formatAppLog("log", "at pages/edit/edit3.vue:957", `数组总长度: ${totalLength}字节`);
        this.totalPackets = totalPackets;
        this.currentPacket = 0;
        for (let i = 0; i < totalPackets; i++) {
          const startIndex = i * maxDataLength;
          const endIndex = Math.min(startIndex + maxDataLength, totalLength);
          const packetData = dataArray.slice(startIndex, endIndex);
          formatAppLog("log", "at pages/edit/edit3.vue:968", `发送第${i + 1}/${totalPackets}包，数据长度: ${packetData.length}字节`);
          const packet = this.buildDataPacket(packetData, dataType, false);
          await this.sendPacketWithQueue(packet);
          formatAppLog("log", "at pages/edit/edit3.vue:975", `第${i + 1}包发送成功`);
          this.adjustSendInterval(true);
          this.currentPacket = i + 1;
          this.sendProgress = this.currentPacket / this.totalPackets * 100;
          await new Promise((resolve) => setTimeout(resolve, this.adaptiveTiming.currentInterval));
        }
        formatAppLog("log", "at pages/edit/edit3.vue:988", `${dataType === 37 ? "黑白" : "红白"}数组发送完成，共发送${totalPackets}个包`);
      },
      // 构建数据包
      buildDataPacket(data, dataType, isLastPacket) {
        const packet = new Uint8Array(506);
        let index = 0;
        packet[index++] = 170;
        packet[index++] = isLastPacket ? 255 : 0;
        packet[index++] = dataType;
        const dataLength = data.length;
        packet[index++] = dataLength >> 8 & 255;
        packet[index++] = dataLength & 255;
        for (let i = 0; i < data.length; i++) {
          packet[index++] = data[i];
        }
        while (index < 499) {
          packet[index++] = 0;
        }
        packet[index++] = 99;
        formatAppLog("log", "at pages/edit/edit3.vue:1024", `构建数据包: 长度=${packet.length}, 数据类型=0x${dataType.toString(16)}, 数据长度=${dataLength}, 尾包=${isLastPacket}`);
        return packet;
      },
      // 发送尾包
      async sendTailPacket() {
        const tailPacket = new Uint8Array(506);
        let index = 0;
        tailPacket[index++] = 170;
        tailPacket[index++] = 255;
        tailPacket[index++] = 0;
        tailPacket[index++] = 0;
        tailPacket[index++] = 0;
        while (index < 499) {
          tailPacket[index++] = 0;
        }
        tailPacket[index++] = 99;
        await this.sendPacketWithQueue(tailPacket);
      },
      // 使用队列机制发送数据包
      async sendPacketWithQueue(packet) {
        return new Promise((resolve, reject) => {
          this.sendQueue.push({
            packet,
            resolve,
            reject
          });
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
            if (this.sendQueue.length > 0) {
              await new Promise((resolve2) => setTimeout(resolve2, 50));
            }
          } catch (error) {
            reject(error);
          }
        }
        this.isSending = false;
      },
      // 发送单个数据包（带重试机制）
      async sendPacket(packet, retryCount = 0) {
        const maxRetries = 3;
        try {
          if (!this.isBluetoothConnected) {
            throw new Error("BLE设备未连接");
          }
          if (!this.currentDeviceId) {
            throw new Error("没有设备ID，请重新连接设备");
          }
          "使用设备ID:", this.currentDeviceId;
          if (!this.characteristics || this.characteristics.length === 0) {
            throw new Error("没有发现特征值，请确保已发现服务");
          }
          const writeableCharacteristics = this.characteristics.filter((char) => {
            `检查特征值 ${char.uuid}:`, {
              properties: char.properties,
              hasWrite: char.properties && char.properties.write,
              hasWriteNoResponse: char.properties && char.properties.writeNoResponse
            };
            return char.properties && (char.properties.write || char.properties.writeNoResponse);
          });
          writeableCharacteristics.sort((a, b) => {
            const aHasWriteNoResponse = a.properties && a.properties.writeNoResponse;
            const bHasWriteNoResponse = b.properties && b.properties.writeNoResponse;
            if (aHasWriteNoResponse && !bHasWriteNoResponse)
              return -1;
            if (!aHasWriteNoResponse && bHasWriteNoResponse)
              return 1;
            return 0;
          });
          "找到的可写特征值:", writeableCharacteristics;
          if (writeableCharacteristics.length === 0) {
            throw new Error("没有找到可写的特征值，请确保设备支持写入操作");
          }
          const characteristic = writeableCharacteristics[0];
          formatAppLog("log", "at pages/edit/edit3.vue:1154", `使用可写特征值: ${characteristic.uuid}`);
          `特征值属性:`, characteristic.properties;
          const arrayBuffer = packet.buffer.slice(packet.byteOffset, packet.byteOffset + packet.byteLength);
          const useWriteNoResponse = characteristic.properties && characteristic.properties.writeNoResponse;
          formatAppLog("log", "at pages/edit/edit3.vue:1162", `使用写入方式: ${useWriteNoResponse ? "writeNoResponse" : "write"}`);
          await new Promise((resolve, reject) => {
            uni.writeBLECharacteristicValue({
              deviceId: this.currentDeviceId,
              serviceId: characteristic.serviceId,
              characteristicId: characteristic.uuid,
              value: arrayBuffer,
              writeType: useWriteNoResponse ? "writeNoResponse" : "write",
              success: (res) => {
                "写入特征值成功:", res;
                resolve(res);
              },
              fail: (err) => {
                "写入特征值失败:", err;
                if (!useWriteNoResponse && characteristic.properties && characteristic.properties.writeNoResponse) {
                  "尝试使用writeNoResponse方式";
                  uni.writeBLECharacteristicValue({
                    deviceId: this.currentDeviceId,
                    serviceId: characteristic.serviceId,
                    characteristicId: characteristic.uuid,
                    value: arrayBuffer,
                    writeType: "writeNoResponse",
                    success: (res) => {
                      "使用writeNoResponse写入成功:", res;
                      resolve(res);
                    },
                    fail: (err2) => {
                      "writeNoResponse也失败:", err2;
                      reject(new Error(`写入失败: ${err.errMsg || err.message || "未知错误"}`));
                    }
                  });
                } else {
                  reject(new Error(`写入失败: ${err.errMsg || err.message || "未知错误"}`));
                }
              }
            });
          });
          formatAppLog("log", "at pages/edit/edit3.vue:1203", `发送数据包成功，长度: ${packet.length}字节`);
        } catch (error) {
          formatAppLog("log", "at pages/edit/edit3.vue:1206", `发送数据包失败 (尝试 ${retryCount + 1}/${maxRetries + 1}):`, error);
          if (retryCount < maxRetries && (error.message.includes("写入失败") || error.message.includes("write") || error.message.includes("characteristic"))) {
            this.adjustSendInterval(false);
            const retryDelay = Math.max(this.adaptiveTiming.currentInterval * 2, 300);
            formatAppLog("log", "at pages/edit/edit3.vue:1219", `等待 ${retryDelay}ms 后重试...`);
            await new Promise((resolve) => setTimeout(resolve, retryDelay));
            return this.sendPacket(packet, retryCount + 1);
          }
          if (error.message.includes("特征值无法写入") || error.message.includes("写入失败") && error.message.includes("特征值")) {
            throw new Error("写入失败，请重启设备");
          } else if (error.message.includes("property not support")) {
            throw new Error("特征值不支持写入操作，请检查设备是否支持数据写入");
          } else if (error.message.includes("没有发现任何特征值")) {
            throw new Error("没有发现任何特征值，请确保：\n1. 设备已连接\n2. 已发现服务\n3. 设备支持写入操作");
          } else if (error.message.includes("没有找到可写的特征值")) {
            throw new Error("没有找到可写的特征值，请确保：\n1. 设备支持写入操作\n2. 特征值权限正确\n3. 服务已正确发现");
          } else {
            throw new Error(`发送失败 (已重试${retryCount}次): ${error.message}`);
          }
        }
      },
      // 加载模板
      loadTemplate() {
        this.currentFont = "STKaiti, KaiTi, 楷体, 楷体_GB2312, cursive";
        this.currentFontSize = 100;
        this.currentColor = "#FFFFFF";
        if (!this.currentText) {
          this.currentText = "";
        }
      },
      // 保存当前设置
      saveCurrentSettings() {
        const settings = {
          text: this.currentText,
          unit: this.currentUnit,
          font: "STKaiti, KaiTi, 楷体, 楷体_GB2312, cursive",
          fontSize: 100,
          unitFontSize: this.currentUnitFontSize,
          nameFontSize: this.currentNameFontSize,
          color: "#FFFFFF"
        };
        uni.setStorageSync("template_text", settings);
      }
    },
    // 监听数据变化，自动保存设置
    watch: {
      currentText() {
        this.saveCurrentSettings();
      },
      currentUnit() {
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
  };
  function _sfc_render$2(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock("view", { class: "page-container" }, [
      vue.createCommentVNode(" 顶部区域 "),
      vue.createElementVNode("view", { class: "top-section" }, [
        vue.createElementVNode("text", { class: "app-title" }, "4.2英寸模板编辑"),
        vue.createCommentVNode(" 蓝牙状态显示 "),
        vue.createElementVNode(
          "view",
          {
            class: vue.normalizeClass(["bluetooth-status", { "connected": $data.isBluetoothConnected }])
          },
          [
            vue.createElementVNode(
              "text",
              { class: "status-icon" },
              vue.toDisplayString($data.isBluetoothConnected ? "●" : "○"),
              1
              /* TEXT */
            ),
            vue.createElementVNode(
              "text",
              { class: "status-text" },
              vue.toDisplayString($data.isBluetoothConnected ? $data.connectedDeviceName || "已连接" : "请先在主页面连接蓝牙设备"),
              1
              /* TEXT */
            ),
            !$data.isBluetoothConnected ? (vue.openBlock(), vue.createElementBlock("button", {
              key: 0,
              class: "connect-btn",
              onClick: _cache[0] || (_cache[0] = (...args) => $options.goToMainPage && $options.goToMainPage(...args))
            }, " 返回主页面连接 ")) : vue.createCommentVNode("v-if", true)
          ],
          2
          /* CLASS */
        )
      ]),
      vue.createCommentVNode(" 编辑区域 "),
      vue.createElementVNode("view", { class: "edit-area" }, [
        vue.createCommentVNode(" 模板图片容器 "),
        vue.createElementVNode("view", { class: "template-container" }, [
          vue.createElementVNode("image", {
            class: "template-image",
            src: _imports_0$1,
            mode: "aspectFit"
          }),
          vue.createCommentVNode(" 单位文字预览 "),
          vue.createElementVNode(
            "view",
            {
              class: "unit-text-preview",
              style: vue.normalizeStyle({
                color: "#FFFFFF",
                fontFamily: $data.currentFont,
                fontSize: $options.getUnitPreviewFontSizePx() + "px",
                fontWeight: "bold",
                textAlign: "center"
              })
            },
            vue.toDisplayString($data.currentUnit && $data.currentUnit.trim() ? $data.currentUnit : "单位"),
            5
            /* TEXT, STYLE */
          ),
          vue.createCommentVNode(" 姓名文字预览 "),
          vue.createElementVNode(
            "view",
            {
              class: "name-text-preview",
              style: vue.normalizeStyle({
                color: "#000000",
                fontFamily: $data.currentFont,
                fontSize: $options.getNamePreviewFontSizePx() + "px",
                fontWeight: "bold",
                textAlign: "center"
              })
            },
            vue.toDisplayString($data.currentText && $data.currentText.trim() ? $data.currentText : "姓名"),
            5
            /* TEXT, STYLE */
          )
        ]),
        vue.createCommentVNode(" 隐藏的Canvas用于合并图层 "),
        vue.createElementVNode("canvas", {
          "canvas-id": "mergeCanvas",
          class: "hidden-canvas",
          style: { "width": "400px", "height": "300px" }
        }),
        vue.createCommentVNode(" 处理Canvas "),
        vue.createElementVNode("canvas", {
          "canvas-id": "processCanvas",
          class: "hidden-canvas",
          style: { "width": "400px", "height": "300px" }
        })
      ]),
      vue.createCommentVNode(" 工具栏 "),
      vue.createElementVNode("view", { class: "toolbar" }, [
        vue.createCommentVNode(" 单位输入区域 "),
        vue.createElementVNode("view", { class: "input-section" }, [
          vue.createElementVNode("text", { class: "input-label" }, "单位"),
          vue.withDirectives(vue.createElementVNode(
            "input",
            {
              class: "text-input",
              "onUpdate:modelValue": _cache[1] || (_cache[1] = ($event) => $data.currentUnit = $event),
              placeholder: "请输入单位",
              onInput: _cache[2] || (_cache[2] = (...args) => $options.updateCurrentUnit && $options.updateCurrentUnit(...args))
            },
            null,
            544
            /* NEED_HYDRATION, NEED_PATCH */
          ), [
            [vue.vModelText, $data.currentUnit]
          ])
        ]),
        vue.createCommentVNode(" 姓名输入区域 "),
        vue.createElementVNode("view", { class: "input-section" }, [
          vue.createElementVNode("text", { class: "input-label" }, "姓名"),
          vue.withDirectives(vue.createElementVNode(
            "input",
            {
              class: "text-input",
              "onUpdate:modelValue": _cache[3] || (_cache[3] = ($event) => $data.currentText = $event),
              placeholder: "请输入姓名",
              onInput: _cache[4] || (_cache[4] = (...args) => $options.updateCurrentText && $options.updateCurrentText(...args))
            },
            null,
            544
            /* NEED_HYDRATION, NEED_PATCH */
          ), [
            [vue.vModelText, $data.currentText]
          ])
        ]),
        vue.createCommentVNode(" 单位字体大小调节 "),
        vue.createElementVNode("view", { class: "font-size-section" }, [
          vue.createElementVNode("text", { class: "section-label" }, "单位字体大小"),
          vue.createElementVNode("view", { class: "font-size-control" }, [
            vue.createElementVNode("text", { class: "size-label" }, "小"),
            vue.createElementVNode("slider", {
              class: "font-size-slider",
              value: $data.currentUnitFontSize,
              min: 20,
              max: 80,
              step: 5,
              onChange: _cache[5] || (_cache[5] = (...args) => $options.onUnitFontSizeChange && $options.onUnitFontSizeChange(...args)),
              activeColor: "#87CEEB",
              backgroundColor: "#e9ecef"
            }, null, 40, ["value"]),
            vue.createElementVNode("text", { class: "size-label" }, "大"),
            vue.createElementVNode(
              "view",
              { class: "size-display" },
              vue.toDisplayString($data.currentUnitFontSize) + "px",
              1
              /* TEXT */
            )
          ])
        ]),
        vue.createCommentVNode(" 姓名字体大小调节 "),
        vue.createElementVNode("view", { class: "font-size-section" }, [
          vue.createElementVNode("text", { class: "section-label" }, "姓名字体大小"),
          vue.createElementVNode("view", { class: "font-size-control" }, [
            vue.createElementVNode("text", { class: "size-label" }, "小"),
            vue.createElementVNode("slider", {
              class: "font-size-slider",
              value: $data.currentNameFontSize,
              min: 40,
              max: 150,
              step: 10,
              onChange: _cache[6] || (_cache[6] = (...args) => $options.onNameFontSizeChange && $options.onNameFontSizeChange(...args)),
              activeColor: "#87CEEB",
              backgroundColor: "#e9ecef"
            }, null, 40, ["value"]),
            vue.createElementVNode("text", { class: "size-label" }, "大"),
            vue.createElementVNode(
              "view",
              { class: "size-display" },
              vue.toDisplayString($data.currentNameFontSize) + "px",
              1
              /* TEXT */
            )
          ])
        ]),
        vue.createCommentVNode(" 处理状态显示 "),
        $data.processedData.processing ? (vue.openBlock(), vue.createElementBlock("view", {
          key: 0,
          class: "processing-status"
        }, [
          vue.createElementVNode("view", { class: "processing-indicator" }, [
            vue.createElementVNode("text", { class: "processing-text" }, "正在处理图片..."),
            vue.createElementVNode("view", { class: "loading-dots" }, [
              vue.createElementVNode("text", { class: "dot" }, "."),
              vue.createElementVNode("text", { class: "dot" }, "."),
              vue.createElementVNode("text", { class: "dot" }, ".")
            ])
          ])
        ])) : vue.createCommentVNode("v-if", true),
        vue.createCommentVNode(" 发送状态显示 "),
        $data.sendingData ? (vue.openBlock(), vue.createElementBlock("view", {
          key: 1,
          class: "sending-status"
        }, [
          vue.createElementVNode("view", { class: "sending-indicator" }, [
            vue.createElementVNode("text", { class: "sending-text" }, "正在发送数据..."),
            vue.createElementVNode("view", { class: "progress-container" }, [
              vue.createElementVNode("view", { class: "progress-bar" }, [
                vue.createElementVNode(
                  "view",
                  {
                    class: "progress-fill",
                    style: vue.normalizeStyle({ width: $data.sendProgress + "%" })
                  },
                  null,
                  4
                  /* STYLE */
                )
              ]),
              vue.createElementVNode(
                "text",
                { class: "progress-text" },
                vue.toDisplayString(Math.round($data.sendProgress)) + "%",
                1
                /* TEXT */
              )
            ])
          ])
        ])) : vue.createCommentVNode("v-if", true),
        vue.createCommentVNode(" 操作按钮（仅保留发送） "),
        vue.createElementVNode("view", { class: "action-buttons" }, [
          vue.createElementVNode("button", {
            class: "action-btn send-btn",
            onClick: _cache[7] || (_cache[7] = (...args) => $options.sendDataToDevice && $options.sendDataToDevice(...args)),
            disabled: !$data.processedData.blackWhiteArray || !$data.processedData.redWhiteArray || !$data.isBluetoothConnected || $data.sendingData
          }, vue.toDisplayString($data.sendingData ? "发送中..." : "发送数据"), 9, ["disabled"])
        ])
      ])
    ]);
  }
  const PagesEditEdit3 = /* @__PURE__ */ _export_sfc(_sfc_main$3, [["render", _sfc_render$2], ["__file", "D:/A/UniProject/E_INK05V1_6/pages/edit/edit3.vue"]]);
  const _sfc_main$2 = {
    data() {
      return {
        // 当前输入的文字
        currentText: "",
        // 当前输入的单位
        currentUnit: "",
        // 当前输入的职位
        currentPosition: "",
        // 当前字体（固定楷体）
        currentFont: "STKaiti, KaiTi, 楷体, 楷体_GB2312, cursive",
        // 姓名字体（楷体）
        currentNameFont: "楷体, KaiTi, STKaiti, 楷体_GB2312, cursive",
        // 当前字体大小（固定100px）
        currentFontSize: 100,
        // 单位字体大小
        currentUnitFontSize: 40,
        // 姓名字体大小
        currentNameFontSize: 100,
        // 当前颜色（固定白色）
        currentColor: "#FFFFFF",
        // 合并后的图片数据
        mergedImageData: null,
        // 合并延迟定时器
        mergeTimeout: null,
        // 处理后的数据
        processedData: {
          blackWhiteArray: null,
          // 黑白图层C数组
          redWhiteArray: null,
          // 红白图层C数组
          processing: false
          // 处理状态
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
          baseInterval: 200,
          // 基础间隔时间（ms）
          currentInterval: 200,
          // 当前间隔时间（ms）
          successCount: 0,
          // 连续成功次数
          failureCount: 0,
          // 连续失败次数
          minInterval: 100,
          // 最小间隔时间（ms）
          maxInterval: 500,
          // 最大间隔时间（ms）
          adjustmentStep: 50
          // 调整步长（ms）
        },
        // 删除字体与颜色选项
        fontOptions: [],
        colorOptions: []
      };
    },
    onLoad() {
      this.loadTemplate();
      this.initBluetooth();
    },
    onShow() {
      this.checkBluetoothStatus();
    },
    onUnload() {
    },
    methods: {
      // 计算单位预览字体像素大小：基于屏幕宽度相对400px画布的放大比例
      getUnitPreviewFontSizePx() {
        try {
          const sys = uni.getSystemInfoSync();
          const scale = sys.windowWidth / 400;
          return Math.round(this.currentUnitFontSize * scale);
        } catch (e) {
          return this.currentUnitFontSize;
        }
      },
      // 计算职位预览字体像素大小：基于屏幕宽度相对400px画布的放大比例
      getPositionPreviewFontSizePx() {
        try {
          const sys = uni.getSystemInfoSync();
          const scale = sys.windowWidth / 400;
          return Math.round(40 * scale);
        } catch (e) {
          return 40;
        }
      },
      // 计算预览字体像素大小：基于屏幕宽度相对400px画布的放大比例
      getPreviewFontSizePx() {
        try {
          const sys = uni.getSystemInfoSync();
          const scale = sys.windowWidth / 400;
          return Math.round(this.currentNameFontSize * scale);
        } catch (e) {
          return this.currentNameFontSize;
        }
      },
      // 更新当前单位
      updateCurrentUnit() {
        if (this.currentUnit.trim() || this.currentText.trim() || this.currentPosition.trim()) {
          clearTimeout(this.mergeTimeout);
          this.mergeTimeout = setTimeout(() => {
            this.autoMergeLayers();
          }, 1e3);
        }
      },
      // 更新当前职位
      updateCurrentPosition() {
        if (this.currentPosition.trim() || this.currentText.trim() || this.currentUnit.trim()) {
          clearTimeout(this.mergeTimeout);
          this.mergeTimeout = setTimeout(() => {
            this.autoMergeLayers();
          }, 1e3);
        }
      },
      // 更新当前文字
      updateCurrentText() {
        if (this.currentText.trim() || this.currentUnit.trim() || this.currentPosition.trim()) {
          clearTimeout(this.mergeTimeout);
          this.mergeTimeout = setTimeout(() => {
            this.autoMergeLayers();
          }, 1e3);
        }
      },
      // 单位字体大小拖动条变化处理
      onUnitFontSizeChange(e) {
        this.currentUnitFontSize = e.detail.value;
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
        if (this.currentText.trim() || this.currentUnit.trim() || this.currentPosition.trim()) {
          clearTimeout(this.mergeTimeout);
          this.mergeTimeout = setTimeout(() => {
            this.autoMergeLayers();
          }, 500);
        }
      },
      // 字体大小拖动条变化处理
      onFontSizeChange(e) {
        this.currentFontSize = e.detail.value;
        if (this.currentText.trim()) {
          clearTimeout(this.mergeTimeout);
          this.mergeTimeout = setTimeout(() => {
            this.autoMergeLayers();
          }, 500);
        }
      },
      // 选择字体
      selectFont(font) {
      },
      // 选择颜色
      selectColor(color) {
      },
      // 清空文字
      clearText() {
        this.currentText = "";
        clearTimeout(this.mergeTimeout);
        uni.showToast({
          title: "文字已清空",
          icon: "success"
        });
      },
      // 自动合并图层（静默执行）
      async autoMergeLayers() {
        if (!this.currentText.trim() && !this.currentUnit.trim() && !this.currentPosition.trim()) {
          return;
        }
        try {
          const canvasId = "mergeCanvas";
          const ctx = uni.createCanvasContext(canvasId, this);
          const templateImage = "/static/moban4.jpg";
          ctx.drawImage(templateImage, 0, 0, 400, 300);
          try {
            const sys = uni.getSystemInfoSync();
            const scale = sys.windowWidth / 400;
            if (this.currentUnit.trim()) {
              ctx.setFontSize(Math.round(this.currentUnitFontSize * scale));
              ctx.setFillStyle("#000000");
              ctx.setTextAlign("left");
              ctx.setTextBaseline("middle");
              ctx.font = `bold ${Math.round(this.currentUnitFontSize * scale)}px STKaiti, KaiTi, 楷体, 楷体_GB2312, cursive`;
              ctx.fillText(this.currentUnit, 20, 30);
            }
            if (this.currentPosition.trim()) {
              ctx.setFontSize(Math.round(40 * scale));
              ctx.setFillStyle("#000000");
              ctx.setTextAlign("right");
              ctx.setTextBaseline("middle");
              ctx.font = `bold ${Math.round(40 * scale)}px STKaiti, KaiTi, 楷体, 楷体_GB2312, cursive`;
              ctx.fillText(this.currentPosition, 380, 275);
            }
            if (this.currentText.trim()) {
              ctx.setFontSize(Math.round(this.currentNameFontSize * scale));
              ctx.setFillStyle("#FFFFFF");
              ctx.setTextAlign("center");
              ctx.setTextBaseline("middle");
              ctx.font = `bold ${Math.round(this.currentNameFontSize * scale)}px 楷体, KaiTi, STKaiti, 楷体_GB2312, cursive`;
              ctx.fillText(this.currentText, 200, 155);
            }
          } catch (e) {
            if (this.currentUnit.trim()) {
              ctx.setFontSize(this.currentUnitFontSize);
              ctx.setFillStyle("#000000");
              ctx.setTextAlign("left");
              ctx.setTextBaseline("middle");
              ctx.font = `bold ${this.currentUnitFontSize}px STKaiti, KaiTi, 楷体, 楷体_GB2312, cursive`;
              ctx.fillText(this.currentUnit, 20, 30);
            }
            if (this.currentPosition.trim()) {
              ctx.setFontSize(40);
              ctx.setFillStyle("#000000");
              ctx.setTextAlign("right");
              ctx.setTextBaseline("middle");
              ctx.font = `bold 40px STKaiti, KaiTi, 楷体, 楷体_GB2312, cursive`;
              ctx.fillText(this.currentPosition, 380, 255);
            }
            if (this.currentText.trim()) {
              ctx.setFontSize(this.currentNameFontSize);
              ctx.setFillStyle("#FFFFFF");
              ctx.setTextAlign("center");
              ctx.setTextBaseline("middle");
              ctx.font = `bold ${this.currentNameFontSize}px 楷体, KaiTi, STKaiti, 楷体_GB2312, cursive`;
              ctx.fillText(this.currentText, 200, 150);
            }
          }
          ctx.draw(false, () => {
            uni.canvasToTempFilePath({
              canvasId,
              success: (res) => {
                this.mergedImageData = res.tempFilePath;
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
          const processCanvasId = "processCanvas";
          const ctx = uni.createCanvasContext(processCanvasId, this);
          const canvasWidth = 400;
          const canvasHeight = 300;
          ctx.drawImage(this.mergedImageData, 0, 0, canvasWidth, canvasHeight);
          ctx.draw(false, () => {
            uni.canvasGetImageData({
              canvasId: processCanvasId,
              x: 0,
              y: 0,
              width: canvasWidth,
              height: canvasHeight,
              success: (imageData) => {
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
        this.processedData.blackWhiteArray = this.pixelsToByteArray(imageData, width, height, "blackWhite");
        this.processedData.redWhiteArray = this.pixelsToByteArray(imageData, width, height, "redWhite");
      },
      // 将像素数据转换为字节数组
      pixelsToByteArray(imageData, width, height, type) {
        const bytesPerRow = Math.ceil(width / 8);
        const totalBytes = bytesPerRow * height;
        const result = new Uint8Array(totalBytes);
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x += 8) {
            let byteValue = 0;
            for (let bit = 0; bit < 8; bit++) {
              const pixelX = x + bit;
              if (pixelX < width) {
                const pixelIndex = (y * width + pixelX) * 4;
                const r = imageData[pixelIndex];
                const g = imageData[pixelIndex + 1];
                const b = imageData[pixelIndex + 2];
                const a = imageData[pixelIndex + 3];
                let shouldDisplay = false;
                if (type === "blackWhite") {
                  shouldDisplay = r < 128 && g < 128 && b < 128 && a > 0;
                } else if (type === "redWhite") {
                  shouldDisplay = r > 128 && g < 128 && b < 128 && a > 0;
                }
                if (shouldDisplay) {
                  byteValue |= 1 << 7 - bit;
                }
              }
            }
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
          await this.startBluetoothAdapter();
          const adapterState = await this.checkBluetoothAdapterState();
          if (!adapterState.available) {
            uni.showToast({
              title: "蓝牙不可用",
              icon: "none"
            });
            return;
          }
          this.setupBluetoothListeners();
          await this.checkExistingConnection();
        } catch (error) {
          uni.showToast({
            title: "蓝牙初始化失败",
            icon: "none"
          });
        }
      },
      // 启动蓝牙适配器
      async startBluetoothAdapter() {
        return new Promise((resolve, reject) => {
          uni.openBluetoothAdapter({
            success: (res) => {
              resolve(res);
            },
            fail: (err) => {
              if (err.errCode === 10001) {
                resolve();
              } else {
                reject(err);
              }
            }
          });
        });
      },
      // 返回主页面
      goToMainPage() {
        uni.navigateBack({
          delta: 1,
          success: () => {
          },
          fail: (err) => {
            uni.reLaunch({
              url: "/pages/index/index"
            });
          }
        });
      },
      // 检查蓝牙适配器状态
      async checkBluetoothAdapterState() {
        return new Promise((resolve) => {
          uni.getBluetoothAdapterState({
            success: (res) => {
              resolve({
                available: res.available,
                discovering: res.discovering
              });
            },
            fail: (err) => {
              resolve({ available: false, discovering: false });
            }
          });
        });
      },
      // 设置蓝牙事件监听
      setupBluetoothListeners() {
        uni.onBluetoothDeviceFound((res) => {
          this.onBluetoothDeviceFound(res);
        });
        uni.onBLECharacteristicValueChange((res) => {
          this.onBLECharacteristicValueChange(res);
        });
      },
      // 检查现有连接
      async checkExistingConnection() {
        try {
          const storedConnection = uni.getStorageSync("bluetooth_connected_device");
          if (storedConnection && storedConnection.connected) {
            this.currentDeviceId = storedConnection.deviceId;
            this.connectedDeviceName = storedConnection.deviceName;
            this.isBluetoothConnected = true;
            const connectedDevices = await this.getConnectedDevices();
            const isStillConnected = connectedDevices.some((device) => device.deviceId === storedConnection.deviceId);
            if (isStillConnected) {
              await this.autoDiscoverServices();
              return;
            } else {
              uni.removeStorageSync("bluetooth_connected_device");
              this.isBluetoothConnected = false;
              this.currentDeviceId = null;
              this.connectedDeviceName = null;
            }
          } else {
            this.isBluetoothConnected = false;
          }
        } catch (error) {
          this.isBluetoothConnected = false;
        }
      },
      // 获取已连接的设备
      async getConnectedDevices() {
        return new Promise((resolve) => {
          uni.getConnectedBluetoothDevices({
            services: [],
            success: (res) => {
              resolve(res.devices || []);
            },
            fail: (err) => {
              resolve([]);
            }
          });
        });
      },
      // 蓝牙设备发现回调
      onBluetoothDeviceFound(res) {
        uni.stopBluetoothDevicesDiscovery();
        uni.hideLoading();
      },
      // 特征值变化回调
      onBLECharacteristicValueChange(res) {
      },
      // 自动发现服务
      async autoDiscoverServices() {
        try {
          if (!this.currentDeviceId) {
            return;
          }
          await this.discoverServices();
        } catch (error) {
        }
      },
      // 发现服务
      async discoverServices() {
        return new Promise((resolve, reject) => {
          uni.getBLEDeviceServices({
            deviceId: this.currentDeviceId,
            success: (res) => {
              this.services = res.services;
              this.discoverCharacteristics();
              resolve(res);
            },
            fail: (err) => {
              reject(err);
            }
          });
        });
      },
      // 发现特征值
      async discoverCharacteristics() {
        if (!this.services || this.services.length === 0) {
          return;
        }
        this.characteristics = [];
        for (const service of this.services) {
          await this.getCharacteristicsForService(service.uuid);
        }
        this.characteristics.filter((char) => {
          const hasWrite = char.properties && (char.properties.write || char.properties.writeNoResponse);
          return hasWrite;
        });
      },
      // 获取服务的特征值
      async getCharacteristicsForService(serviceId) {
        return new Promise((resolve) => {
          uni.getBLEDeviceCharacteristics({
            deviceId: this.currentDeviceId,
            serviceId,
            success: (res) => {
              const characteristics = res.characteristics.map((char) => ({
                ...char,
                serviceId
              }));
              this.characteristics.push(...characteristics);
              resolve(res);
            },
            fail: (err) => {
              resolve(null);
            }
          });
        });
      },
      // 检查蓝牙状态
      checkBluetoothStatus() {
        try {
          if (this.currentDeviceId && this.isBluetoothConnected) {
          } else {
            this.isBluetoothConnected = false;
          }
        } catch (error) {
        }
      },
      // 自适应调整发送间隔时间
      adjustSendInterval(success) {
        if (success) {
          this.adaptiveTiming.successCount++;
          this.adaptiveTiming.failureCount = 0;
          if (this.adaptiveTiming.successCount >= 3) {
            this.adaptiveTiming.currentInterval = Math.max(
              this.adaptiveTiming.minInterval,
              this.adaptiveTiming.currentInterval - this.adaptiveTiming.adjustmentStep
            );
            this.adaptiveTiming.successCount = 0;
            formatAppLog("log", "at pages/edit/edit4.vue:884", `发送成功，缩短间隔时间至: ${this.adaptiveTiming.currentInterval}ms`);
          }
        } else {
          this.adaptiveTiming.failureCount++;
          this.adaptiveTiming.successCount = 0;
          this.adaptiveTiming.currentInterval = Math.min(
            this.adaptiveTiming.maxInterval,
            this.adaptiveTiming.currentInterval + this.adaptiveTiming.adjustmentStep
          );
          formatAppLog("log", "at pages/edit/edit4.vue:895", `发送失败，增加间隔时间至: ${this.adaptiveTiming.currentInterval}ms`);
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
            title: "蓝牙未连接",
            icon: "none"
          });
          return;
        }
        if (!this.processedData.blackWhiteArray || !this.processedData.redWhiteArray) {
          uni.showToast({
            title: "没有可发送的数据",
            icon: "none"
          });
          return;
        }
        this.sendingData = true;
        this.sendProgress = 0;
        this.resetAdaptiveTiming();
        this.sendQueue = [];
        this.isSending = false;
        uni.showLoading({
          title: "正在发送数据..."
        });
        try {
          const maxDataLength = await this.requestMTU(506);
          await this.sendArrayData(this.processedData.blackWhiteArray, 37);
          "黑白数组发送完成";
          "开始发送红白数组...";
          await this.sendArrayData(this.processedData.redWhiteArray, 20);
          "红白数组发送完成";
          "开始发送尾包...";
          await this.sendTailPacket();
          "尾包发送完成";
          uni.hideLoading();
          uni.showToast({
            title: "数据发送完成",
            icon: "success"
          });
          "数据发送完成";
        } catch (error) {
          uni.hideLoading();
          uni.showModal({
            title: "发送失败",
            content: `发送数据失败: ${error.message || "未知错误"}`,
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
          formatAppLog("log", "at pages/edit/edit4.vue:981", `尝试申请MTU到${mtu}字节`);
          if (!this.currentDeviceId) {
            throw new Error("没有设备ID，无法申请MTU");
          }
          "MTU申请使用的设备ID:", this.currentDeviceId;
          const result = await new Promise((resolve, reject) => {
            uni.setBLEMTU({
              deviceId: this.currentDeviceId,
              mtu,
              success: (res) => {
                "MTU申请成功:", res;
                resolve(res);
              },
              fail: (err) => {
                "MTU申请失败:", err;
                reject(err);
              }
            });
          });
          const actualMTU = result.mtu || mtu;
          formatAppLog("log", "at pages/edit/edit4.vue:1007", `MTU申请成功，实际MTU: ${actualMTU}字节`);
          const maxDataLength = actualMTU - 6;
          formatAppLog("log", "at pages/edit/edit4.vue:1011", `可用数据长度: ${maxDataLength}字节`);
          return maxDataLength;
        } catch (error) {
          const maxDataLength = 506 - 6;
          formatAppLog("log", "at pages/edit/edit4.vue:1019", `使用默认MTU: ${maxDataLength}字节`);
          return maxDataLength;
        }
      },
      // 发送数组数据
      async sendArrayData(dataArray, dataType) {
        const totalLength = dataArray.length;
        const maxDataLength = 506 - 6;
        const totalPackets = Math.ceil(totalLength / maxDataLength);
        formatAppLog("log", "at pages/edit/edit4.vue:1032", `发送${dataType === 37 ? "黑白" : "红白"}数组，共${totalPackets}个包，每包${maxDataLength}字节`);
        formatAppLog("log", "at pages/edit/edit4.vue:1033", `数组总长度: ${totalLength}字节`);
        this.totalPackets = totalPackets;
        this.currentPacket = 0;
        for (let i = 0; i < totalPackets; i++) {
          const startIndex = i * maxDataLength;
          const endIndex = Math.min(startIndex + maxDataLength, totalLength);
          const packetData = dataArray.slice(startIndex, endIndex);
          formatAppLog("log", "at pages/edit/edit4.vue:1044", `发送第${i + 1}/${totalPackets}包，数据长度: ${packetData.length}字节`);
          const packet = this.buildDataPacket(packetData, dataType, false);
          await this.sendPacketWithQueue(packet);
          formatAppLog("log", "at pages/edit/edit4.vue:1051", `第${i + 1}包发送成功`);
          this.adjustSendInterval(true);
          this.currentPacket = i + 1;
          this.sendProgress = this.currentPacket / this.totalPackets * 100;
          await new Promise((resolve) => setTimeout(resolve, this.adaptiveTiming.currentInterval));
        }
        formatAppLog("log", "at pages/edit/edit4.vue:1064", `${dataType === 37 ? "黑白" : "红白"}数组发送完成，共发送${totalPackets}个包`);
      },
      // 构建数据包
      buildDataPacket(data, dataType, isLastPacket) {
        const packet = new Uint8Array(506);
        let index = 0;
        packet[index++] = 170;
        packet[index++] = isLastPacket ? 255 : 0;
        packet[index++] = dataType;
        const dataLength = data.length;
        packet[index++] = dataLength >> 8 & 255;
        packet[index++] = dataLength & 255;
        for (let i = 0; i < data.length; i++) {
          packet[index++] = data[i];
        }
        while (index < 499) {
          packet[index++] = 0;
        }
        packet[index++] = 99;
        formatAppLog("log", "at pages/edit/edit4.vue:1100", `构建数据包: 长度=${packet.length}, 数据类型=0x${dataType.toString(16)}, 数据长度=${dataLength}, 尾包=${isLastPacket}`);
        return packet;
      },
      // 发送尾包
      async sendTailPacket() {
        const tailPacket = new Uint8Array(506);
        let index = 0;
        tailPacket[index++] = 170;
        tailPacket[index++] = 255;
        tailPacket[index++] = 0;
        tailPacket[index++] = 0;
        tailPacket[index++] = 0;
        while (index < 499) {
          tailPacket[index++] = 0;
        }
        tailPacket[index++] = 99;
        await this.sendPacketWithQueue(tailPacket);
      },
      // 使用队列机制发送数据包
      async sendPacketWithQueue(packet) {
        return new Promise((resolve, reject) => {
          this.sendQueue.push({
            packet,
            resolve,
            reject
          });
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
            if (this.sendQueue.length > 0) {
              await new Promise((resolve2) => setTimeout(resolve2, 50));
            }
          } catch (error) {
            reject(error);
          }
        }
        this.isSending = false;
      },
      // 发送单个数据包（带重试机制）
      async sendPacket(packet, retryCount = 0) {
        const maxRetries = 3;
        try {
          if (!this.isBluetoothConnected) {
            throw new Error("BLE设备未连接");
          }
          if (!this.currentDeviceId) {
            throw new Error("没有设备ID，请重新连接设备");
          }
          "使用设备ID:", this.currentDeviceId;
          if (!this.characteristics || this.characteristics.length === 0) {
            throw new Error("没有发现特征值，请确保已发现服务");
          }
          const writeableCharacteristics = this.characteristics.filter((char) => {
            `检查特征值 ${char.uuid}:`, {
              properties: char.properties,
              hasWrite: char.properties && char.properties.write,
              hasWriteNoResponse: char.properties && char.properties.writeNoResponse
            };
            return char.properties && (char.properties.write || char.properties.writeNoResponse);
          });
          writeableCharacteristics.sort((a, b) => {
            const aHasWriteNoResponse = a.properties && a.properties.writeNoResponse;
            const bHasWriteNoResponse = b.properties && b.properties.writeNoResponse;
            if (aHasWriteNoResponse && !bHasWriteNoResponse)
              return -1;
            if (!aHasWriteNoResponse && bHasWriteNoResponse)
              return 1;
            return 0;
          });
          "找到的可写特征值:", writeableCharacteristics;
          if (writeableCharacteristics.length === 0) {
            throw new Error("没有找到可写的特征值，请确保设备支持写入操作");
          }
          const characteristic = writeableCharacteristics[0];
          formatAppLog("log", "at pages/edit/edit4.vue:1230", `使用可写特征值: ${characteristic.uuid}`);
          `特征值属性:`, characteristic.properties;
          const arrayBuffer = packet.buffer.slice(packet.byteOffset, packet.byteOffset + packet.byteLength);
          const useWriteNoResponse = characteristic.properties && characteristic.properties.writeNoResponse;
          formatAppLog("log", "at pages/edit/edit4.vue:1238", `使用写入方式: ${useWriteNoResponse ? "writeNoResponse" : "write"}`);
          await new Promise((resolve, reject) => {
            uni.writeBLECharacteristicValue({
              deviceId: this.currentDeviceId,
              serviceId: characteristic.serviceId,
              characteristicId: characteristic.uuid,
              value: arrayBuffer,
              writeType: useWriteNoResponse ? "writeNoResponse" : "write",
              success: (res) => {
                "写入特征值成功:", res;
                resolve(res);
              },
              fail: (err) => {
                "写入特征值失败:", err;
                if (!useWriteNoResponse && characteristic.properties && characteristic.properties.writeNoResponse) {
                  "尝试使用writeNoResponse方式";
                  uni.writeBLECharacteristicValue({
                    deviceId: this.currentDeviceId,
                    serviceId: characteristic.serviceId,
                    characteristicId: characteristic.uuid,
                    value: arrayBuffer,
                    writeType: "writeNoResponse",
                    success: (res) => {
                      "使用writeNoResponse写入成功:", res;
                      resolve(res);
                    },
                    fail: (err2) => {
                      "writeNoResponse也失败:", err2;
                      reject(new Error(`写入失败: ${err.errMsg || err.message || "未知错误"}`));
                    }
                  });
                } else {
                  reject(new Error(`写入失败: ${err.errMsg || err.message || "未知错误"}`));
                }
              }
            });
          });
          formatAppLog("log", "at pages/edit/edit4.vue:1279", `发送数据包成功，长度: ${packet.length}字节`);
        } catch (error) {
          formatAppLog("log", "at pages/edit/edit4.vue:1282", `发送数据包失败 (尝试 ${retryCount + 1}/${maxRetries + 1}):`, error);
          if (retryCount < maxRetries && (error.message.includes("写入失败") || error.message.includes("write") || error.message.includes("characteristic"))) {
            this.adjustSendInterval(false);
            const retryDelay = Math.max(this.adaptiveTiming.currentInterval * 2, 300);
            formatAppLog("log", "at pages/edit/edit4.vue:1295", `等待 ${retryDelay}ms 后重试...`);
            await new Promise((resolve) => setTimeout(resolve, retryDelay));
            return this.sendPacket(packet, retryCount + 1);
          }
          if (error.message.includes("特征值无法写入") || error.message.includes("写入失败") && error.message.includes("特征值")) {
            throw new Error("写入失败，请重启设备");
          } else if (error.message.includes("property not support")) {
            throw new Error("特征值不支持写入操作，请检查设备是否支持数据写入");
          } else if (error.message.includes("没有发现任何特征值")) {
            throw new Error("没有发现任何特征值，请确保：\n1. 设备已连接\n2. 已发现服务\n3. 设备支持写入操作");
          } else if (error.message.includes("没有找到可写的特征值")) {
            throw new Error("没有找到可写的特征值，请确保：\n1. 设备支持写入操作\n2. 特征值权限正确\n3. 服务已正确发现");
          } else {
            throw new Error(`发送失败 (已重试${retryCount}次): ${error.message}`);
          }
        }
      },
      // 加载模板
      loadTemplate() {
        this.currentFont = "STKaiti, KaiTi, 楷体, 楷体_GB2312, cursive";
        this.currentFontSize = 100;
        this.currentColor = "#FFFFFF";
        if (!this.currentText) {
          this.currentText = "";
        }
      },
      // 保存当前设置
      saveCurrentSettings() {
        const settings = {
          text: this.currentText,
          unit: this.currentUnit,
          position: this.currentPosition,
          font: "STKaiti, KaiTi, 楷体, 楷体_GB2312, cursive",
          nameFont: this.currentNameFont,
          fontSize: 100,
          unitFontSize: this.currentUnitFontSize,
          nameFontSize: this.currentNameFontSize,
          color: "#FFFFFF"
        };
        uni.setStorageSync("template_text", settings);
      }
    },
    // 监听数据变化，自动保存设置
    watch: {
      currentText() {
        this.saveCurrentSettings();
      },
      currentUnit() {
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
      currentNameFont() {
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
  };
  function _sfc_render$1(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock("view", { class: "page-container" }, [
      vue.createCommentVNode(" 顶部区域 "),
      vue.createElementVNode("view", { class: "top-section" }, [
        vue.createElementVNode("text", { class: "app-title" }, "4.2英寸模板编辑"),
        vue.createCommentVNode(" 蓝牙状态显示 "),
        vue.createElementVNode(
          "view",
          {
            class: vue.normalizeClass(["bluetooth-status", { "connected": $data.isBluetoothConnected }])
          },
          [
            vue.createElementVNode(
              "text",
              { class: "status-icon" },
              vue.toDisplayString($data.isBluetoothConnected ? "●" : "○"),
              1
              /* TEXT */
            ),
            vue.createElementVNode(
              "text",
              { class: "status-text" },
              vue.toDisplayString($data.isBluetoothConnected ? $data.connectedDeviceName || "已连接" : "请先在主页面连接蓝牙设备"),
              1
              /* TEXT */
            ),
            !$data.isBluetoothConnected ? (vue.openBlock(), vue.createElementBlock("button", {
              key: 0,
              class: "connect-btn",
              onClick: _cache[0] || (_cache[0] = (...args) => $options.goToMainPage && $options.goToMainPage(...args))
            }, " 返回主页面连接 ")) : vue.createCommentVNode("v-if", true)
          ],
          2
          /* CLASS */
        )
      ]),
      vue.createCommentVNode(" 编辑区域 "),
      vue.createElementVNode("view", { class: "edit-area" }, [
        vue.createCommentVNode(" 模板图片容器 "),
        vue.createElementVNode("view", { class: "template-container" }, [
          vue.createElementVNode("image", {
            class: "template-image",
            src: _imports_0$2,
            mode: "aspectFit"
          }),
          vue.createCommentVNode(" 单位文字预览（顶部10%区域，靠左） "),
          vue.createElementVNode(
            "view",
            {
              class: "unit-text-preview",
              style: vue.normalizeStyle({
                color: "#000000",
                fontFamily: $data.currentFont,
                fontSize: $options.getUnitPreviewFontSizePx() + "px",
                textAlign: "left"
              })
            },
            vue.toDisplayString($data.currentUnit && $data.currentUnit.trim() ? $data.currentUnit : "单位"),
            5
            /* TEXT, STYLE */
          ),
          vue.createCommentVNode(" 职位文字预览（底部20%区域，靠右） "),
          vue.createElementVNode(
            "view",
            {
              class: "position-text-preview",
              style: vue.normalizeStyle({
                color: "#000000",
                fontFamily: $data.currentFont,
                fontSize: $options.getPositionPreviewFontSizePx() + "px",
                textAlign: "right"
              })
            },
            vue.toDisplayString($data.currentPosition && $data.currentPosition.trim() ? $data.currentPosition : "职位"),
            5
            /* TEXT, STYLE */
          ),
          vue.createCommentVNode(" 中心姓名文字预览 "),
          vue.createElementVNode(
            "view",
            {
              class: "center-text-preview",
              style: vue.normalizeStyle({
                color: $data.currentColor,
                fontFamily: $data.currentNameFont,
                fontSize: $options.getPreviewFontSizePx() + "px",
                textAlign: "center"
              })
            },
            vue.toDisplayString($data.currentText && $data.currentText.trim() ? $data.currentText : "姓名"),
            5
            /* TEXT, STYLE */
          )
        ]),
        vue.createCommentVNode(" 隐藏的Canvas用于合并图层 "),
        vue.createElementVNode("canvas", {
          "canvas-id": "mergeCanvas",
          class: "hidden-canvas",
          style: { "width": "400px", "height": "300px" }
        }),
        vue.createCommentVNode(" 处理Canvas "),
        vue.createElementVNode("canvas", {
          "canvas-id": "processCanvas",
          class: "hidden-canvas",
          style: { "width": "400px", "height": "300px" }
        })
      ]),
      vue.createCommentVNode(" 工具栏 "),
      vue.createElementVNode("view", { class: "toolbar" }, [
        vue.createCommentVNode(" 单位输入区域 "),
        vue.createElementVNode("view", { class: "input-section" }, [
          vue.createElementVNode("text", { class: "input-label" }, "单位"),
          vue.withDirectives(vue.createElementVNode(
            "input",
            {
              class: "text-input",
              "onUpdate:modelValue": _cache[1] || (_cache[1] = ($event) => $data.currentUnit = $event),
              placeholder: "请输入单位",
              onInput: _cache[2] || (_cache[2] = (...args) => $options.updateCurrentUnit && $options.updateCurrentUnit(...args))
            },
            null,
            544
            /* NEED_HYDRATION, NEED_PATCH */
          ), [
            [vue.vModelText, $data.currentUnit]
          ])
        ]),
        vue.createCommentVNode(" 姓名输入区域 "),
        vue.createElementVNode("view", { class: "input-section" }, [
          vue.createElementVNode("text", { class: "input-label" }, "姓名"),
          vue.withDirectives(vue.createElementVNode(
            "input",
            {
              class: "text-input",
              "onUpdate:modelValue": _cache[3] || (_cache[3] = ($event) => $data.currentText = $event),
              placeholder: "请输入姓名",
              onInput: _cache[4] || (_cache[4] = (...args) => $options.updateCurrentText && $options.updateCurrentText(...args))
            },
            null,
            544
            /* NEED_HYDRATION, NEED_PATCH */
          ), [
            [vue.vModelText, $data.currentText]
          ])
        ]),
        vue.createCommentVNode(" 职位输入区域 "),
        vue.createElementVNode("view", { class: "input-section" }, [
          vue.createElementVNode("text", { class: "input-label" }, "职位"),
          vue.withDirectives(vue.createElementVNode(
            "input",
            {
              class: "text-input",
              "onUpdate:modelValue": _cache[5] || (_cache[5] = ($event) => $data.currentPosition = $event),
              placeholder: "请输入职位",
              onInput: _cache[6] || (_cache[6] = (...args) => $options.updateCurrentPosition && $options.updateCurrentPosition(...args))
            },
            null,
            544
            /* NEED_HYDRATION, NEED_PATCH */
          ), [
            [vue.vModelText, $data.currentPosition]
          ])
        ]),
        vue.createCommentVNode(" 单位字体大小调节 "),
        vue.createElementVNode("view", { class: "font-size-section" }, [
          vue.createElementVNode("text", { class: "section-label" }, "单位字体大小"),
          vue.createElementVNode("view", { class: "font-size-control" }, [
            vue.createElementVNode("text", { class: "size-label" }, "小"),
            vue.createElementVNode("slider", {
              class: "font-size-slider",
              value: $data.currentUnitFontSize,
              min: 20,
              max: 60,
              step: 5,
              onChange: _cache[7] || (_cache[7] = (...args) => $options.onUnitFontSizeChange && $options.onUnitFontSizeChange(...args)),
              activeColor: "#87CEEB",
              backgroundColor: "#e9ecef"
            }, null, 40, ["value"]),
            vue.createElementVNode("text", { class: "size-label" }, "大"),
            vue.createElementVNode(
              "view",
              { class: "size-display" },
              vue.toDisplayString($data.currentUnitFontSize) + "px",
              1
              /* TEXT */
            )
          ])
        ]),
        vue.createCommentVNode(" 姓名字体大小调节 "),
        vue.createElementVNode("view", { class: "font-size-section" }, [
          vue.createElementVNode("text", { class: "section-label" }, "姓名字体大小"),
          vue.createElementVNode("view", { class: "font-size-control" }, [
            vue.createElementVNode("text", { class: "size-label" }, "小"),
            vue.createElementVNode("slider", {
              class: "font-size-slider",
              value: $data.currentNameFontSize,
              min: 40,
              max: 150,
              step: 10,
              onChange: _cache[8] || (_cache[8] = (...args) => $options.onNameFontSizeChange && $options.onNameFontSizeChange(...args)),
              activeColor: "#87CEEB",
              backgroundColor: "#e9ecef"
            }, null, 40, ["value"]),
            vue.createElementVNode("text", { class: "size-label" }, "大"),
            vue.createElementVNode(
              "view",
              { class: "size-display" },
              vue.toDisplayString($data.currentNameFontSize) + "px",
              1
              /* TEXT */
            )
          ])
        ]),
        vue.createCommentVNode(" 处理状态显示 "),
        $data.processedData.processing ? (vue.openBlock(), vue.createElementBlock("view", {
          key: 0,
          class: "processing-status"
        }, [
          vue.createElementVNode("view", { class: "processing-indicator" }, [
            vue.createElementVNode("text", { class: "processing-text" }, "正在处理图片..."),
            vue.createElementVNode("view", { class: "loading-dots" }, [
              vue.createElementVNode("text", { class: "dot" }, "."),
              vue.createElementVNode("text", { class: "dot" }, "."),
              vue.createElementVNode("text", { class: "dot" }, ".")
            ])
          ])
        ])) : vue.createCommentVNode("v-if", true),
        vue.createCommentVNode(" 发送状态显示 "),
        $data.sendingData ? (vue.openBlock(), vue.createElementBlock("view", {
          key: 1,
          class: "sending-status"
        }, [
          vue.createElementVNode("view", { class: "sending-indicator" }, [
            vue.createElementVNode("text", { class: "sending-text" }, "正在发送数据..."),
            vue.createElementVNode("view", { class: "progress-container" }, [
              vue.createElementVNode("view", { class: "progress-bar" }, [
                vue.createElementVNode(
                  "view",
                  {
                    class: "progress-fill",
                    style: vue.normalizeStyle({ width: $data.sendProgress + "%" })
                  },
                  null,
                  4
                  /* STYLE */
                )
              ]),
              vue.createElementVNode(
                "text",
                { class: "progress-text" },
                vue.toDisplayString(Math.round($data.sendProgress)) + "%",
                1
                /* TEXT */
              )
            ])
          ])
        ])) : vue.createCommentVNode("v-if", true),
        vue.createCommentVNode(" 操作按钮（仅保留发送） "),
        vue.createElementVNode("view", { class: "action-buttons" }, [
          vue.createElementVNode("button", {
            class: "action-btn send-btn",
            onClick: _cache[9] || (_cache[9] = (...args) => $options.sendDataToDevice && $options.sendDataToDevice(...args)),
            disabled: !$data.processedData.blackWhiteArray || !$data.processedData.redWhiteArray || !$data.isBluetoothConnected || $data.sendingData
          }, vue.toDisplayString($data.sendingData ? "发送中..." : "发送数据"), 9, ["disabled"])
        ])
      ])
    ]);
  }
  const PagesEditEdit4 = /* @__PURE__ */ _export_sfc(_sfc_main$2, [["render", _sfc_render$1], ["__file", "D:/A/UniProject/E_INK05V1_6/pages/edit/edit4.vue"]]);
  const _sfc_main$1 = {
    data() {
      return {
        // 当前输入的文字
        currentText: "",
        // 当前字体
        currentFont: "Arial",
        // 当前字体大小
        currentFontSize: 16,
        // 当前颜色
        currentColor: "#000000",
        // 合并后的图片数据
        mergedImageData: null,
        // 合并延迟定时器
        mergeTimeout: null,
        // 处理后的数据
        processedData: {
          blackWhiteImage: null,
          // 黑白图片
          redWhiteImage: null,
          // 红白图片（红色转为黑色）
          blackWhiteArray: null,
          // 黑白图层C数组
          redWhiteArray: null,
          // 红白图层C数组
          processing: false
          // 处理状态
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
          { name: "Arial", value: "Arial" },
          { name: "Times", value: "Times New Roman" },
          { name: "Courier", value: "Courier New" },
          { name: "Helvetica", value: "Helvetica" },
          { name: "Georgia", value: "Georgia" }
        ],
        // 颜色选项
        colorOptions: [
          { name: "黑色", value: "#000000" },
          { name: "红色", value: "#FF0000" },
          { name: "白色", value: "#FFFFFF" }
        ]
      };
    },
    onLoad() {
      this.loadTemplate();
      this.initBluetooth();
    },
    onShow() {
      this.checkBluetoothStatus();
    },
    onUnload() {
    },
    methods: {
      // 更新当前文字
      updateCurrentText() {
        if (this.currentText.trim()) {
          clearTimeout(this.mergeTimeout);
          this.mergeTimeout = setTimeout(() => {
            this.autoMergeLayers();
          }, 1e3);
        }
      },
      // 增加字体大小
      increaseFontSize() {
        if (this.currentFontSize < 48) {
          this.currentFontSize += 2;
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
        if (this.currentText.trim()) {
          clearTimeout(this.mergeTimeout);
          this.mergeTimeout = setTimeout(() => {
            this.autoMergeLayers();
          }, 500);
        }
      },
      // 清空文字
      clearText() {
        this.currentText = "";
        clearTimeout(this.mergeTimeout);
        uni.showToast({
          title: "文字已清空",
          icon: "success"
        });
      },
      // 自动合并图层（静默执行）
      async autoMergeLayers() {
        if (!this.currentText.trim()) {
          return;
        }
        try {
          const canvasId = "mergeCanvas";
          const ctx = uni.createCanvasContext(canvasId, this);
          const templateImage = "/static/moban75.jpg";
          ctx.drawImage(templateImage, 0, 0, 800, 480);
          ctx.setFontSize(this.currentFontSize);
          ctx.setFillStyle(this.currentColor);
          ctx.setTextAlign("center");
          ctx.setTextBaseline("middle");
          ctx.fillText(this.currentText, 400, 120);
          ctx.draw(false, () => {
            uni.canvasToTempFilePath({
              canvasId,
              success: (res) => {
                this.mergedImageData = res.tempFilePath;
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
          const processCanvasId = "processCanvas";
          const ctx = uni.createCanvasContext(processCanvasId, this);
          const canvasWidth = 800;
          const canvasHeight = 480;
          ctx.drawImage(this.mergedImageData, 0, 0, canvasWidth, canvasHeight);
          ctx.draw(false, () => {
            uni.canvasGetImageData({
              canvasId: processCanvasId,
              x: 0,
              y: 0,
              width: canvasWidth,
              height: canvasHeight,
              success: (imageData) => {
                this.createBlackWhiteImage(imageData.data, canvasWidth, canvasHeight);
                this.createRedWhiteImage(imageData.data, canvasWidth, canvasHeight);
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
        const canvasId = "blackWhiteCanvas";
        const ctx = uni.createCanvasContext(canvasId, this);
        ctx.clearRect(0, 0, width, height);
        ctx.setFillStyle("#FFFFFF");
        ctx.fillRect(0, 0, width, height);
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const index = (y * width + x) * 4;
            const r = imageData[index];
            const g = imageData[index + 1];
            const b = imageData[index + 2];
            const a = imageData[index + 3];
            const isBlack = r < 100 && g < 100 && b < 100 && a > 0;
            const isNotRed = !(r > 150 && g < 100 && b < 100);
            if (isBlack && isNotRed) {
              ctx.setFillStyle("#000000");
              ctx.fillRect(x, y, 1, 1);
            }
          }
        }
        ctx.draw(false, () => {
          uni.canvasToTempFilePath({
            canvasId,
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
        const canvasId = "redWhiteCanvas";
        const ctx = uni.createCanvasContext(canvasId, this);
        ctx.clearRect(0, 0, width, height);
        ctx.setFillStyle("#FFFFFF");
        ctx.fillRect(0, 0, width, height);
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const index = (y * width + x) * 4;
            const r = imageData[index];
            const g = imageData[index + 1];
            const b = imageData[index + 2];
            const a = imageData[index + 3];
            const isRed = r > 150 && g < 100 && b < 100 && a > 0;
            if (isRed) {
              ctx.setFillStyle("#000000");
              ctx.fillRect(x, y, 1, 1);
            }
          }
        }
        ctx.draw(false, () => {
          uni.canvasToTempFilePath({
            canvasId,
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
        this.processedData.blackWhiteArray = this.pixelsToByteArray(imageData, width, height, "blackWhite");
        this.processedData.redWhiteArray = this.pixelsToByteArray(imageData, width, height, "redWhite");
      },
      // 将像素数据转换为字节数组
      pixelsToByteArray(imageData, width, height, type) {
        const bytesPerRow = Math.ceil(width / 8);
        const totalBytes = bytesPerRow * height;
        const result = new Uint8Array(totalBytes);
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x += 8) {
            let byteValue = 0;
            for (let bit = 0; bit < 8; bit++) {
              const pixelX = x + bit;
              if (pixelX < width) {
                const pixelIndex = (y * width + pixelX) * 4;
                const r = imageData[pixelIndex];
                const g = imageData[pixelIndex + 1];
                const b = imageData[pixelIndex + 2];
                const a = imageData[pixelIndex + 3];
                let shouldDisplay = false;
                if (type === "blackWhite") {
                  shouldDisplay = r < 128 && g < 128 && b < 128 && a > 0;
                } else if (type === "redWhite") {
                  shouldDisplay = r > 128 && g < 128 && b < 128 && a > 0;
                }
                if (shouldDisplay) {
                  byteValue |= 1 << 7 - bit;
                }
              }
            }
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
          await this.startBluetoothAdapter();
          const adapterState = await this.checkBluetoothAdapterState();
          if (!adapterState.available) {
            uni.showToast({
              title: "蓝牙不可用",
              icon: "none"
            });
            return;
          }
          this.setupBluetoothListeners();
          await this.checkExistingConnection();
        } catch (error) {
          uni.showToast({
            title: "蓝牙初始化失败",
            icon: "none"
          });
        }
      },
      // 启动蓝牙适配器
      async startBluetoothAdapter() {
        return new Promise((resolve, reject) => {
          uni.openBluetoothAdapter({
            success: (res) => {
              resolve(res);
            },
            fail: (err) => {
              if (err.errCode === 10001) {
                resolve();
              } else {
                reject(err);
              }
            }
          });
        });
      },
      // 返回主页面
      goToMainPage() {
        uni.navigateBack({
          delta: 1,
          success: () => {
          },
          fail: (err) => {
            uni.reLaunch({
              url: "/pages/index/index"
            });
          }
        });
      },
      // 检查蓝牙适配器状态
      async checkBluetoothAdapterState() {
        return new Promise((resolve) => {
          uni.getBluetoothAdapterState({
            success: (res) => {
              resolve({
                available: res.available,
                discovering: res.discovering
              });
            },
            fail: (err) => {
              resolve({ available: false, discovering: false });
            }
          });
        });
      },
      // 设置蓝牙事件监听
      setupBluetoothListeners() {
        uni.onBluetoothDeviceFound((res) => {
          this.onBluetoothDeviceFound(res);
        });
        uni.onBLECharacteristicValueChange((res) => {
          this.onBLECharacteristicValueChange(res);
        });
      },
      // 检查现有连接
      async checkExistingConnection() {
        try {
          const storedConnection = uni.getStorageSync("bluetooth_connected_device");
          if (storedConnection && storedConnection.connected) {
            this.currentDeviceId = storedConnection.deviceId;
            this.connectedDeviceName = storedConnection.deviceName;
            this.isBluetoothConnected = true;
            const connectedDevices = await this.getConnectedDevices();
            const isStillConnected = connectedDevices.some((device) => device.deviceId === storedConnection.deviceId);
            if (isStillConnected) {
              await this.autoDiscoverServices();
              return;
            } else {
              uni.removeStorageSync("bluetooth_connected_device");
              this.isBluetoothConnected = false;
              this.currentDeviceId = null;
              this.connectedDeviceName = null;
            }
          } else {
            this.isBluetoothConnected = false;
          }
        } catch (error) {
          this.isBluetoothConnected = false;
        }
      },
      // 获取已连接的设备
      async getConnectedDevices() {
        return new Promise((resolve) => {
          uni.getConnectedBluetoothDevices({
            services: [],
            success: (res) => {
              resolve(res.devices || []);
            },
            fail: (err) => {
              resolve([]);
            }
          });
        });
      },
      // 蓝牙设备发现回调
      onBluetoothDeviceFound(res) {
        uni.stopBluetoothDevicesDiscovery();
        uni.hideLoading();
      },
      // 特征值变化回调
      onBLECharacteristicValueChange(res) {
      },
      // 自动发现服务
      async autoDiscoverServices() {
        try {
          if (!this.currentDeviceId) {
            return;
          }
          await this.discoverServices();
        } catch (error) {
        }
      },
      // 发现服务
      async discoverServices() {
        return new Promise((resolve, reject) => {
          uni.getBLEDeviceServices({
            deviceId: this.currentDeviceId,
            success: (res) => {
              this.services = res.services;
              this.discoverCharacteristics();
              resolve(res);
            },
            fail: (err) => {
              reject(err);
            }
          });
        });
      },
      // 发现特征值
      async discoverCharacteristics() {
        if (!this.services || this.services.length === 0) {
          return;
        }
        this.characteristics = [];
        for (const service of this.services) {
          await this.getCharacteristicsForService(service.uuid);
        }
        this.characteristics.filter((char) => {
          const hasWrite = char.properties && (char.properties.write || char.properties.writeNoResponse);
          return hasWrite;
        });
      },
      // 获取服务的特征值
      async getCharacteristicsForService(serviceId) {
        return new Promise((resolve) => {
          uni.getBLEDeviceCharacteristics({
            deviceId: this.currentDeviceId,
            serviceId,
            success: (res) => {
              const characteristics = res.characteristics.map((char) => ({
                ...char,
                serviceId
              }));
              this.characteristics.push(...characteristics);
              resolve(res);
            },
            fail: (err) => {
              resolve(null);
            }
          });
        });
      },
      // 检查蓝牙状态
      checkBluetoothStatus() {
        try {
          if (this.currentDeviceId && this.isBluetoothConnected) {
          } else {
            this.isBluetoothConnected = false;
          }
        } catch (error) {
        }
      },
      // 发送数据到设备
      async sendDataToDevice() {
        if (!this.isBluetoothConnected) {
          uni.showToast({
            title: "蓝牙未连接",
            icon: "none"
          });
          return;
        }
        if (!this.processedData.blackWhiteArray || !this.processedData.redWhiteArray) {
          uni.showToast({
            title: "没有可发送的数据",
            icon: "none"
          });
          return;
        }
        this.sendingData = true;
        this.sendQueue = [];
        this.isSending = false;
        uni.showLoading({
          title: "正在发送数据..."
        });
        try {
          const maxDataLength = await this.requestMTU(506);
          await this.sendArrayData(this.processedData.blackWhiteArray, 37);
          "黑白数组发送完成";
          "开始发送红白数组...";
          await this.sendArrayData(this.processedData.redWhiteArray, 20);
          "红白数组发送完成";
          "开始发送尾包...";
          await this.sendTailPacket();
          "尾包发送完成";
          uni.hideLoading();
          uni.showToast({
            title: "数据发送完成",
            icon: "success"
          });
          "数据发送完成";
        } catch (error) {
          uni.hideLoading();
          uni.showModal({
            title: "发送失败",
            content: `发送数据失败: ${error.message || "未知错误"}`,
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
          `尝试申请MTU到${mtu}字节`;
          if (!this.currentDeviceId) {
            throw new Error("没有设备ID，无法申请MTU");
          }
          "MTU申请使用的设备ID:", this.currentDeviceId;
          const result = await new Promise((resolve, reject) => {
            uni.setBLEMTU({
              deviceId: this.currentDeviceId,
              mtu,
              success: (res) => {
                "MTU申请成功:", res;
                resolve(res);
              },
              fail: (err) => {
                "MTU申请失败:", err;
                reject(err);
              }
            });
          });
          const actualMTU = result.mtu || mtu;
          `MTU申请成功，实际MTU: ${actualMTU}字节`;
          const maxDataLength = actualMTU - 6;
          `可用数据长度: ${maxDataLength}字节`;
          return maxDataLength;
        } catch (error) {
          const maxDataLength = 506 - 6;
          return maxDataLength;
        }
      },
      // 发送数组数据
      async sendArrayData(dataArray, dataType) {
        const totalLength = dataArray.length;
        const maxDataLength = 506 - 6;
        const totalPackets = Math.ceil(totalLength / maxDataLength);
        this.totalPackets = totalPackets;
        this.currentPacket = 0;
        for (let i = 0; i < totalPackets; i++) {
          const startIndex = i * maxDataLength;
          const endIndex = Math.min(startIndex + maxDataLength, totalLength);
          const packetData = dataArray.slice(startIndex, endIndex);
          `发送第${i + 1}/${totalPackets}包，数据长度: ${packetData.length}字节`;
          const packet = this.buildDataPacket(packetData, dataType, false);
          await this.sendPacketWithQueue(packet);
          this.currentPacket = i + 1;
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      },
      // 构建数据包
      buildDataPacket(data, dataType, isLastPacket) {
        const packet = new Uint8Array(506);
        let index = 0;
        packet[index++] = 170;
        packet[index++] = isLastPacket ? 255 : 0;
        packet[index++] = dataType;
        const dataLength = data.length;
        packet[index++] = dataLength >> 8 & 255;
        packet[index++] = dataLength & 255;
        for (let i = 0; i < data.length; i++) {
          packet[index++] = data[i];
        }
        while (index < 499) {
          packet[index++] = 0;
        }
        packet[index++] = 99;
        `构建数据包: 长度=${packet.length}, 数据类型=0x${dataType.toString(16)}, 数据长度=${dataLength}, 尾包=${isLastPacket}`;
        return packet;
      },
      // 发送尾包
      async sendTailPacket() {
        const tailPacket = new Uint8Array(506);
        let index = 0;
        tailPacket[index++] = 170;
        tailPacket[index++] = 255;
        tailPacket[index++] = 0;
        tailPacket[index++] = 0;
        tailPacket[index++] = 0;
        while (index < 499) {
          tailPacket[index++] = 0;
        }
        tailPacket[index++] = 99;
        await this.sendPacketWithQueue(tailPacket);
      },
      // 使用队列机制发送数据包
      async sendPacketWithQueue(packet) {
        return new Promise((resolve, reject) => {
          this.sendQueue.push({
            packet,
            resolve,
            reject
          });
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
          if (!this.isBluetoothConnected) {
            throw new Error("BLE设备未连接");
          }
          if (!this.currentDeviceId) {
            throw new Error("没有设备ID，请重新连接设备");
          }
          "使用设备ID:", this.currentDeviceId;
          if (!this.characteristics || this.characteristics.length === 0) {
            throw new Error("没有发现特征值，请确保已发现服务");
          }
          const writeableCharacteristics = this.characteristics.filter((char) => {
            `检查特征值 ${char.uuid}:`, {
              properties: char.properties,
              hasWrite: char.properties && char.properties.write,
              hasWriteNoResponse: char.properties && char.properties.writeNoResponse
            };
            return char.properties && (char.properties.write || char.properties.writeNoResponse);
          });
          writeableCharacteristics.sort((a, b) => {
            const aHasWriteNoResponse = a.properties && a.properties.writeNoResponse;
            const bHasWriteNoResponse = b.properties && b.properties.writeNoResponse;
            if (aHasWriteNoResponse && !bHasWriteNoResponse)
              return -1;
            if (!aHasWriteNoResponse && bHasWriteNoResponse)
              return 1;
            return 0;
          });
          "找到的可写特征值:", writeableCharacteristics;
          if (writeableCharacteristics.length === 0) {
            throw new Error("没有找到可写的特征值，请确保设备支持写入操作");
          }
          const characteristic = writeableCharacteristics[0];
          `使用可写特征值: ${characteristic.uuid}`;
          `特征值属性:`, characteristic.properties;
          const arrayBuffer = packet.buffer.slice(packet.byteOffset, packet.byteOffset + packet.byteLength);
          const useWriteNoResponse = characteristic.properties && characteristic.properties.writeNoResponse;
          `使用写入方式: ${useWriteNoResponse ? "writeNoResponse" : "write"}`;
          await new Promise((resolve, reject) => {
            uni.writeBLECharacteristicValue({
              deviceId: this.currentDeviceId,
              serviceId: characteristic.serviceId,
              characteristicId: characteristic.uuid,
              value: arrayBuffer,
              writeType: useWriteNoResponse ? "writeNoResponse" : "write",
              success: (res) => {
                "写入特征值成功:", res;
                resolve(res);
              },
              fail: (err) => {
                "写入特征值失败:", err;
                if (!useWriteNoResponse && characteristic.properties && characteristic.properties.writeNoResponse) {
                  "尝试使用writeNoResponse方式";
                  uni.writeBLECharacteristicValue({
                    deviceId: this.currentDeviceId,
                    serviceId: characteristic.serviceId,
                    characteristicId: characteristic.uuid,
                    value: arrayBuffer,
                    writeType: "writeNoResponse",
                    success: (res) => {
                      "使用writeNoResponse写入成功:", res;
                      resolve(res);
                    },
                    fail: (err2) => {
                      "writeNoResponse也失败:", err2;
                      reject(new Error(`写入失败: ${err.errMsg || err.message || "未知错误"}`));
                    }
                  });
                } else {
                  reject(new Error(`写入失败: ${err.errMsg || err.message || "未知错误"}`));
                }
              }
            });
          });
          `发送数据包成功，长度: ${packet.length}字节`;
        } catch (error) {
          if (error.message.includes("特征值无法写入") || error.message.includes("写入失败") && error.message.includes("特征值")) {
            throw new Error("写入失败，请重启设备");
          } else if (error.message.includes("property not support")) {
            throw new Error("特征值不支持写入操作，请检查设备是否支持数据写入");
          } else if (error.message.includes("没有发现任何特征值")) {
            throw new Error("没有发现任何特征值，请确保：\n1. 设备已连接\n2. 已发现服务\n3. 设备支持写入操作");
          } else if (error.message.includes("没有找到可写的特征值")) {
            throw new Error("没有找到可写的特征值，请确保：\n1. 设备支持写入操作\n2. 特征值权限正确\n3. 服务已正确发现");
          } else {
            throw new Error(`发送失败: ${error.message}`);
          }
        }
      },
      // 加载模板
      loadTemplate() {
        const savedText = uni.getStorageSync("template_text");
        if (savedText) {
          this.currentText = savedText.text || "";
          this.currentFont = savedText.font || "Arial";
          this.currentFontSize = savedText.fontSize || 16;
          this.currentColor = savedText.color || "#000000";
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
        uni.setStorageSync("template_text", settings);
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
  };
  function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock("view", { class: "page-container" }, [
      vue.createCommentVNode(" 顶部区域 "),
      vue.createElementVNode("view", { class: "top-section" }, [
        vue.createElementVNode("text", { class: "app-title" }, "7.5英寸模板编辑"),
        vue.createCommentVNode(" 蓝牙状态显示 "),
        vue.createElementVNode(
          "view",
          {
            class: vue.normalizeClass(["bluetooth-status", { "connected": $data.isBluetoothConnected }])
          },
          [
            vue.createElementVNode(
              "text",
              { class: "status-icon" },
              vue.toDisplayString($data.isBluetoothConnected ? "●" : "○"),
              1
              /* TEXT */
            ),
            vue.createElementVNode(
              "text",
              { class: "status-text" },
              vue.toDisplayString($data.isBluetoothConnected ? $data.connectedDeviceName || "已连接" : "请先在主页面连接蓝牙设备"),
              1
              /* TEXT */
            ),
            !$data.isBluetoothConnected ? (vue.openBlock(), vue.createElementBlock("button", {
              key: 0,
              class: "connect-btn",
              onClick: _cache[0] || (_cache[0] = (...args) => $options.goToMainPage && $options.goToMainPage(...args))
            }, " 返回主页面连接 ")) : vue.createCommentVNode("v-if", true)
          ],
          2
          /* CLASS */
        )
      ]),
      vue.createCommentVNode(" 编辑区域 "),
      vue.createElementVNode("view", { class: "edit-area" }, [
        vue.createCommentVNode(" 模板图片容器 "),
        vue.createElementVNode("view", { class: "template-container" }, [
          vue.createElementVNode("image", {
            class: "template-image",
            src: _imports_0,
            mode: "aspectFit"
          }),
          vue.createCommentVNode(" 中心文字预览 "),
          $data.currentText ? (vue.openBlock(), vue.createElementBlock(
            "view",
            {
              key: 0,
              class: "center-text-preview",
              style: vue.normalizeStyle({
                color: $data.currentColor,
                fontFamily: $data.currentFont,
                fontSize: $data.currentFontSize * 0.5 + "px",
                textAlign: "center"
              })
            },
            vue.toDisplayString($data.currentText),
            5
            /* TEXT, STYLE */
          )) : vue.createCommentVNode("v-if", true)
        ]),
        vue.createCommentVNode(" 隐藏的Canvas用于合并图层 "),
        vue.createElementVNode("canvas", {
          "canvas-id": "mergeCanvas",
          class: "hidden-canvas",
          style: { "width": "800px", "height": "480px" }
        }),
        vue.createCommentVNode(" 处理Canvas "),
        vue.createElementVNode("canvas", {
          "canvas-id": "processCanvas",
          class: "hidden-canvas",
          style: { "width": "800px", "height": "480px" }
        }),
        vue.createElementVNode("canvas", {
          "canvas-id": "blackWhiteCanvas",
          class: "hidden-canvas",
          style: { "width": "800px", "height": "480px" }
        }),
        vue.createElementVNode("canvas", {
          "canvas-id": "redWhiteCanvas",
          class: "hidden-canvas",
          style: { "width": "800px", "height": "480px" }
        })
      ]),
      vue.createCommentVNode(" 工具栏 "),
      vue.createElementVNode("view", { class: "toolbar" }, [
        vue.createCommentVNode(" 文字输入区域 "),
        vue.createElementVNode("view", { class: "input-section" }, [
          vue.withDirectives(vue.createElementVNode(
            "input",
            {
              class: "text-input",
              "onUpdate:modelValue": _cache[1] || (_cache[1] = ($event) => $data.currentText = $event),
              placeholder: "输入文字内容",
              onInput: _cache[2] || (_cache[2] = (...args) => $options.updateCurrentText && $options.updateCurrentText(...args))
            },
            null,
            544
            /* NEED_HYDRATION, NEED_PATCH */
          ), [
            [vue.vModelText, $data.currentText]
          ])
        ]),
        vue.createCommentVNode(" 字体大小选择 "),
        vue.createElementVNode("view", { class: "font-size-section" }, [
          vue.createElementVNode("text", { class: "section-label" }, "字体大小"),
          vue.createElementVNode("view", { class: "font-size-control" }, [
            vue.createElementVNode("button", {
              class: "size-btn",
              onClick: _cache[3] || (_cache[3] = (...args) => $options.decreaseFontSize && $options.decreaseFontSize(...args))
            }, "-"),
            vue.createElementVNode(
              "text",
              { class: "size-display" },
              vue.toDisplayString($data.currentFontSize) + "px",
              1
              /* TEXT */
            ),
            vue.createElementVNode("button", {
              class: "size-btn",
              onClick: _cache[4] || (_cache[4] = (...args) => $options.increaseFontSize && $options.increaseFontSize(...args))
            }, "+")
          ])
        ]),
        vue.createCommentVNode(" 字体选择 "),
        vue.createElementVNode("view", { class: "font-section" }, [
          vue.createElementVNode("text", { class: "section-label" }, "字体"),
          vue.createElementVNode("view", { class: "font-options" }, [
            (vue.openBlock(true), vue.createElementBlock(
              vue.Fragment,
              null,
              vue.renderList($data.fontOptions, (font) => {
                return vue.openBlock(), vue.createElementBlock("view", {
                  key: font.value,
                  class: vue.normalizeClass(["font-option", { "active": $data.currentFont === font.value }]),
                  onClick: ($event) => $options.selectFont(font.value)
                }, [
                  vue.createElementVNode(
                    "text",
                    {
                      class: "font-preview",
                      style: vue.normalizeStyle({ fontFamily: font.value })
                    },
                    vue.toDisplayString(font.name),
                    5
                    /* TEXT, STYLE */
                  )
                ], 10, ["onClick"]);
              }),
              128
              /* KEYED_FRAGMENT */
            ))
          ])
        ]),
        vue.createCommentVNode(" 颜色选择 "),
        vue.createElementVNode("view", { class: "color-section" }, [
          vue.createElementVNode("text", { class: "section-label" }, "颜色"),
          vue.createElementVNode("view", { class: "color-options" }, [
            (vue.openBlock(true), vue.createElementBlock(
              vue.Fragment,
              null,
              vue.renderList($data.colorOptions, (color) => {
                return vue.openBlock(), vue.createElementBlock("view", {
                  key: color.value,
                  class: vue.normalizeClass(["color-option", { "active": $data.currentColor === color.value }]),
                  onClick: ($event) => $options.selectColor(color.value)
                }, [
                  vue.createElementVNode(
                    "view",
                    {
                      class: "color-circle",
                      style: vue.normalizeStyle({ backgroundColor: color.value })
                    },
                    null,
                    4
                    /* STYLE */
                  ),
                  vue.createElementVNode(
                    "text",
                    { class: "color-name" },
                    vue.toDisplayString(color.name),
                    1
                    /* TEXT */
                  )
                ], 10, ["onClick"]);
              }),
              128
              /* KEYED_FRAGMENT */
            ))
          ])
        ]),
        vue.createCommentVNode(" 处理状态显示 "),
        $data.processedData.processing ? (vue.openBlock(), vue.createElementBlock("view", {
          key: 0,
          class: "processing-status"
        }, [
          vue.createElementVNode("view", { class: "processing-indicator" }, [
            vue.createElementVNode("text", { class: "processing-text" }, "正在处理图片..."),
            vue.createElementVNode("view", { class: "loading-dots" }, [
              vue.createElementVNode("text", { class: "dot" }, "."),
              vue.createElementVNode("text", { class: "dot" }, "."),
              vue.createElementVNode("text", { class: "dot" }, ".")
            ])
          ])
        ])) : vue.createCommentVNode("v-if", true),
        vue.createCommentVNode(" 发送状态显示 "),
        $data.sendingData ? (vue.openBlock(), vue.createElementBlock("view", {
          key: 1,
          class: "sending-status"
        }, [
          vue.createElementVNode("view", { class: "sending-indicator" }, [
            vue.createElementVNode("text", { class: "sending-text" }, "正在发送数据..."),
            vue.createElementVNode(
              "text",
              { class: "sending-progress" },
              vue.toDisplayString($data.currentPacket) + "/" + vue.toDisplayString($data.totalPackets) + " 包",
              1
              /* TEXT */
            ),
            vue.createElementVNode("view", { class: "loading-dots" }, [
              vue.createElementVNode("text", { class: "dot" }, "."),
              vue.createElementVNode("text", { class: "dot" }, "."),
              vue.createElementVNode("text", { class: "dot" }, ".")
            ])
          ])
        ])) : vue.createCommentVNode("v-if", true),
        vue.createCommentVNode(" 操作按钮 "),
        vue.createElementVNode("view", { class: "action-buttons" }, [
          vue.createElementVNode("button", {
            class: "action-btn clear-btn",
            onClick: _cache[5] || (_cache[5] = (...args) => $options.clearText && $options.clearText(...args))
          }, " 清空文字 "),
          vue.createElementVNode("button", {
            class: "action-btn send-btn",
            onClick: _cache[6] || (_cache[6] = (...args) => $options.sendDataToDevice && $options.sendDataToDevice(...args)),
            disabled: !$data.processedData.blackWhiteArray || !$data.processedData.redWhiteArray || !$data.isBluetoothConnected || $data.sendingData
          }, vue.toDisplayString($data.sendingData ? "发送中..." : "发送数据"), 9, ["disabled"])
        ])
      ])
    ]);
  }
  const PagesEditEdit75 = /* @__PURE__ */ _export_sfc(_sfc_main$1, [["render", _sfc_render], ["__file", "D:/A/UniProject/E_INK05V1_6/pages/edit/edit75.vue"]]);
  __definePage("pages/index/index", PagesIndexIndex);
  __definePage("pages/template/template", PagesTemplateTemplate);
  __definePage("pages/template/template75", PagesTemplateTemplate75);
  __definePage("pages/template/blank", PagesTemplateBlank);
  __definePage("pages/edit/edit", PagesEditEdit);
  __definePage("pages/edit/edit2", PagesEditEdit2);
  __definePage("pages/edit/edit3", PagesEditEdit3);
  __definePage("pages/edit/edit4", PagesEditEdit4);
  __definePage("pages/edit/edit75", PagesEditEdit75);
  const _sfc_main = {
    onLaunch: function() {
      formatAppLog("log", "at App.vue:4", "App Launch");
    },
    onShow: function() {
      formatAppLog("log", "at App.vue:7", "App Show");
    },
    onHide: function() {
      formatAppLog("log", "at App.vue:10", "App Hide");
    }
  };
  const App = /* @__PURE__ */ _export_sfc(_sfc_main, [["__file", "D:/A/UniProject/E_INK05V1_6/App.vue"]]);
  function createApp() {
    const app = vue.createVueApp(App);
    return {
      app
    };
  }
  const { app: __app__, Vuex: __Vuex__, Pinia: __Pinia__ } = createApp();
  uni.Vuex = __Vuex__;
  uni.Pinia = __Pinia__;
  __app__.provide("__globalStyles", __uniConfig.styles);
  __app__._component.mpType = "app";
  __app__._component.render = () => {
  };
  __app__.mount("#app");
})(Vue);
