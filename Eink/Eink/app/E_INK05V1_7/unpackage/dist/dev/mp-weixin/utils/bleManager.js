"use strict";
const common_vendor = require("../common/vendor.js");
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
      common_vendor.index.__f__("log", "at utils/bleManager.js:37", "检查蓝牙权限...");
      const bluetoothState = await new Promise((resolve, reject) => {
        common_vendor.index.getBluetoothAdapterState({
          success: resolve,
          fail: reject
        });
      });
      common_vendor.index.__f__("log", "at utils/bleManager.js:46", "蓝牙状态:", bluetoothState);
      if (!bluetoothState.available) {
        throw new Error("蓝牙未开启，请在设置中开启蓝牙");
      }
      if (!this.isWeixinMP()) {
        try {
          common_vendor.index.__f__("log", "at utils/bleManager.js:57", "检查位置权限...");
          await new Promise((resolve, reject) => {
            common_vendor.index.getLocation({
              type: "wgs84",
              altitude: false,
              highAccuracyExpireTime: 1e3,
              success: resolve,
              fail: reject
            });
          });
          common_vendor.index.__f__("log", "at utils/bleManager.js:67", "位置权限检查通过");
        } catch (locationError) {
          common_vendor.index.__f__("warn", "at utils/bleManager.js:69", "位置权限检查失败:", locationError);
          common_vendor.index.__f__("log", "at utils/bleManager.js:71", "位置权限可能不足，但继续尝试初始化蓝牙");
        }
      } else {
        common_vendor.index.__f__("log", "at utils/bleManager.js:74", "微信小程序：跳过位置权限检查");
      }
      return true;
    } catch (error) {
      common_vendor.index.__f__("error", "at utils/bleManager.js:79", "权限检查失败:", error);
      if (this.isWeixinMP() && (error.errCode === 1e4 || error.code === 1e4)) {
        common_vendor.index.__f__("log", "at utils/bleManager.js:82", "微信小程序：适配器可能未初始化，尝试初始化");
        return true;
      }
      throw error;
    }
  }
  /**
   * 检查是否为微信小程序平台
   */
  isWeixinMP() {
    return true;
  }
  /**
   * 简化的蓝牙初始化（跳过权限检查）
   */
  async initBluetoothSimple() {
    try {
      common_vendor.index.__f__("log", "at utils/bleManager.js:106", "开始简化蓝牙初始化...");
      if (this.isWeixinMP()) {
        try {
          const stateRes = await new Promise((resolve, reject) => {
            common_vendor.index.getBluetoothAdapterState({
              success: resolve,
              fail: reject
            });
          });
          if (!stateRes.available) {
            throw new Error("系统蓝牙未开启，请先在系统设置中开启蓝牙");
          }
          common_vendor.index.__f__("log", "at utils/bleManager.js:123", "微信小程序：系统蓝牙已开启");
        } catch (stateError) {
          common_vendor.index.__f__("log", "at utils/bleManager.js:126", "微信小程序：无法获取蓝牙状态，尝试初始化适配器");
        }
      }
      await new Promise((resolve, reject) => {
        common_vendor.index.openBluetoothAdapter({
          mode: "central",
          success: (res2) => {
            common_vendor.index.__f__("log", "at utils/bleManager.js:135", "蓝牙适配器已打开", res2);
            resolve(res2);
          },
          fail: (err) => {
            common_vendor.index.__f__("error", "at utils/bleManager.js:139", "打开蓝牙适配器失败:", err);
            if (this.isWeixinMP()) {
              if (err.errCode === 10001 || err.errCode === 1e4) {
                common_vendor.index.__f__("log", "at utils/bleManager.js:144", "微信小程序：适配器可能已初始化，继续检查状态");
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
        common_vendor.index.getBluetoothAdapterState({
          success: resolve,
          fail: reject
        });
      });
      common_vendor.index.__f__("log", "at utils/bleManager.js:166", "蓝牙适配器状态:", res);
      if (!res.available) {
        throw new Error("蓝牙适配器不可用，请检查蓝牙是否已开启");
      }
      common_vendor.index.__f__("log", "at utils/bleManager.js:172", "蓝牙简化初始化成功");
      return true;
    } catch (error) {
      common_vendor.index.__f__("error", "at utils/bleManager.js:175", "简化蓝牙初始化失败:", error);
      if (this.isWeixinMP() && error.errCode) {
        common_vendor.index.__f__("error", "at utils/bleManager.js:178", "微信小程序错误码:", error.errCode);
        if (error.errCode === 10001) {
          common_vendor.index.__f__("log", "at utils/bleManager.js:180", "微信小程序：适配器已初始化，尝试继续");
          try {
            const stateRes = await new Promise((resolve, reject) => {
              common_vendor.index.getBluetoothAdapterState({
                success: resolve,
                fail: reject
              });
            });
            if (stateRes.available) {
              common_vendor.index.__f__("log", "at utils/bleManager.js:190", "微信小程序：适配器状态正常，初始化成功");
              return true;
            }
          } catch (e) {
            common_vendor.index.__f__("error", "at utils/bleManager.js:194", "检查适配器状态失败:", e);
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
        common_vendor.index.__f__("log", "at utils/bleManager.js:209", "蓝牙适配器已初始化，跳过重复初始化");
        return true;
      }
      common_vendor.index.__f__("log", "at utils/bleManager.js:213", "开始初始化蓝牙适配器...");
      const simpleSuccess = await this.initBluetoothSimple();
      if (simpleSuccess) {
        common_vendor.index.__f__("log", "at utils/bleManager.js:218", "简化初始化成功");
        this.adapterInitialized = true;
        return true;
      }
      common_vendor.index.__f__("log", "at utils/bleManager.js:224", "简化初始化失败，尝试完整初始化...");
      await this.checkPermissions();
      let retryCount = 0;
      const maxRetries = 3;
      while (retryCount < maxRetries) {
        try {
          common_vendor.index.__f__("log", "at utils/bleManager.js:235", `第${retryCount + 1}次尝试打开蓝牙适配器...`);
          await new Promise((resolve, reject) => {
            common_vendor.index.openBluetoothAdapter({
              mode: "central",
              success: (res2) => {
                common_vendor.index.__f__("log", "at utils/bleManager.js:241", "蓝牙适配器已打开", res2);
                resolve(res2);
              },
              fail: (err) => {
                common_vendor.index.__f__("error", "at utils/bleManager.js:245", "打开蓝牙适配器失败:", err);
                if (this.isWeixinMP()) {
                  if (err.errCode === 10001 || err.errCode === 1e4) {
                    common_vendor.index.__f__("log", "at utils/bleManager.js:250", "微信小程序：适配器可能已初始化，继续检查状态");
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
          common_vendor.index.__f__("log", "at utils/bleManager.js:261", "蓝牙适配器已打开");
          break;
        } catch (adapterError) {
          retryCount++;
          common_vendor.index.__f__("error", "at utils/bleManager.js:265", `第${retryCount}次尝试失败:`, adapterError);
          if (retryCount >= maxRetries) {
            throw adapterError;
          }
          await new Promise((resolve) => setTimeout(resolve, 1e3 * retryCount));
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 1e3));
      const res = await new Promise((resolve, reject) => {
        common_vendor.index.getBluetoothAdapterState({
          success: resolve,
          fail: reject
        });
      });
      common_vendor.index.__f__("log", "at utils/bleManager.js:286", "蓝牙适配器状态:", res);
      if (!res.available) {
        throw new Error("蓝牙适配器不可用，请检查蓝牙是否已开启");
      }
      this.adapterInitialized = true;
      common_vendor.index.__f__("log", "at utils/bleManager.js:293", "蓝牙初始化成功");
      return true;
    } catch (error) {
      common_vendor.index.__f__("error", "at utils/bleManager.js:296", "初始化蓝牙失败:", error);
      let errorMessage = "蓝牙初始化失败";
      const errorCode = error.code || error.errCode;
      if (errorCode === 10001) {
        if (this.isWeixinMP()) {
          common_vendor.index.__f__("log", "at utils/bleManager.js:305", "微信小程序：错误码10001，可能是适配器已初始化");
          try {
            const stateRes = await new Promise((resolve, reject) => {
              common_vendor.index.getBluetoothAdapterState({
                success: resolve,
                fail: reject
              });
            });
            if (stateRes.available) {
              common_vendor.index.__f__("log", "at utils/bleManager.js:315", "微信小程序：适配器状态正常，初始化成功");
              this.adapterInitialized = true;
              return true;
            }
          } catch (e) {
            common_vendor.index.__f__("error", "at utils/bleManager.js:320", "检查适配器状态失败:", e);
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
        common_vendor.index.__f__("log", "at utils/bleManager.js:361", "正在扫描中，请等待当前扫描完成");
        return false;
      }
      if (!skipPermissionCheck && !this.permissionChecked) {
        common_vendor.index.__f__("log", "at utils/bleManager.js:367", "首次扫描，检查权限...");
        await this.checkPermissions();
        this.permissionChecked = true;
      } else {
        common_vendor.index.__f__("log", "at utils/bleManager.js:371", "跳过权限检查，直接开始扫描");
      }
      const maxDuration = Math.min(duration, 1e4);
      common_vendor.index.__f__("log", "at utils/bleManager.js:376", `开始扫描BLE设备，持续${maxDuration / 1e3}秒...`);
      this.scannedDevices = [];
      await common_vendor.index.startBluetoothDevicesDiscovery({
        allowDuplicatesKey: false,
        interval: 0
      });
      this.isScanning = true;
      if (!this.listenersRegistered.deviceFound) {
        common_vendor.index.__f__("log", "at utils/bleManager.js:391", "注册设备发现监听器");
        this.deviceFoundListener = (res) => {
          const devices = res.devices;
          devices.forEach((device) => {
            if (this.isBLEDevice(device)) {
              common_vendor.index.__f__("log", "at utils/bleManager.js:396", "发现BLE设备:", device);
              const existingDevice = this.scannedDevices.find((d) => d.deviceId === device.deviceId);
              if (!existingDevice) {
                this.scannedDevices.push(device);
                this.triggerCallback("onDeviceFound", device);
              }
            }
          });
        };
        common_vendor.index.onBluetoothDeviceFound(this.deviceFoundListener);
        this.listenersRegistered.deviceFound = true;
      }
      this.scanTimeout = setTimeout(() => {
        common_vendor.index.__f__("log", "at utils/bleManager.js:414", "扫描超时，自动停止扫描");
        this.stopScan();
      }, maxDuration);
      setTimeout(() => {
        if (this.isScanning) {
          common_vendor.index.__f__("log", "at utils/bleManager.js:421", "安全机制：强制停止扫描");
          this.stopScan();
        }
      }, 15e3);
      return true;
    } catch (error) {
      common_vendor.index.__f__("error", "at utils/bleManager.js:428", "开始扫描失败:", error);
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
        common_vendor.index.__f__("log", "at utils/bleManager.js:441", "当前没有在扫描");
        return;
      }
      common_vendor.index.__f__("log", "at utils/bleManager.js:445", "正在停止扫描...");
      if (this.scanTimeout) {
        clearTimeout(this.scanTimeout);
        this.scanTimeout = null;
      }
      await common_vendor.index.stopBluetoothDevicesDiscovery();
      this.isScanning = false;
      common_vendor.index.__f__("log", "at utils/bleManager.js:459", "扫描已停止");
    } catch (error) {
      common_vendor.index.__f__("error", "at utils/bleManager.js:461", "停止扫描失败:", error);
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
        common_vendor.index.__f__("log", "at utils/bleManager.js:502", "已连接到设备，请先断开连接");
        return false;
      }
      common_vendor.index.__f__("log", "at utils/bleManager.js:506", "正在连接设备:", deviceId);
      if (this.isScanning) {
        await this.stopScan();
      }
      await common_vendor.index.createBLEConnection({
        deviceId
      });
      this.isConnected = true;
      this.connectedDevice = deviceId;
      common_vendor.index.__f__("log", "at utils/bleManager.js:520", "设备连接成功");
      if (!this.listenersRegistered.connectionState) {
        common_vendor.index.__f__("log", "at utils/bleManager.js:524", "注册连接状态监听器");
        this.connectionStateListener = (res) => {
          common_vendor.index.__f__("log", "at utils/bleManager.js:526", "连接状态变化:", res);
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
        common_vendor.index.onBLEConnectionStateChange(this.connectionStateListener);
        this.listenersRegistered.connectionState = true;
      }
      this.triggerCallback("onDeviceConnected", { deviceId });
      return true;
    } catch (error) {
      common_vendor.index.__f__("error", "at utils/bleManager.js:545", "连接设备失败:", error);
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
        common_vendor.index.__f__("log", "at utils/bleManager.js:560", "没有连接的设备");
        return;
      }
      const deviceIdToDisconnect = this.connectedDevice;
      await common_vendor.index.closeBLEConnection({
        deviceId: deviceIdToDisconnect
      });
      this.isConnected = false;
      this.connectedDevice = null;
      this.services = [];
      this.characteristics = [];
      common_vendor.index.__f__("log", "at utils/bleManager.js:576", "设备已断开连接");
    } catch (error) {
      common_vendor.index.__f__("error", "at utils/bleManager.js:578", "断开连接失败:", error);
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
      common_vendor.index.__f__("log", "at utils/bleManager.js:597", "正在发现服务...");
      await new Promise((resolve) => setTimeout(resolve, 1e3));
      const servicesRes = await common_vendor.index.getBLEDeviceServices({
        deviceId: this.connectedDevice
      });
      const targetServiceUUID = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
      const allServices = servicesRes.services;
      const targetServices = allServices.filter(
        (service) => service.uuid.toLowerCase() === targetServiceUUID.toLowerCase()
      );
      common_vendor.index.__f__("log", "at utils/bleManager.js:616", "所有发现的服务:", allServices);
      common_vendor.index.__f__("log", "at utils/bleManager.js:617", "目标服务:", targetServices);
      if (targetServices.length > 0) {
        this.services = targetServices;
        common_vendor.index.__f__("log", "at utils/bleManager.js:622", "找到目标服务，只处理目标服务");
      } else {
        this.services = allServices;
        common_vendor.index.__f__("log", "at utils/bleManager.js:625", "未找到目标服务，处理所有服务");
      }
      this.characteristics = [];
      for (const service of this.services) {
        try {
          await new Promise((resolve) => setTimeout(resolve, 200));
          const characteristicsRes = await common_vendor.index.getBLEDeviceCharacteristics({
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
          common_vendor.index.__f__("log", "at utils/bleManager.js:647", `服务 ${service.uuid} 的特征值:`, serviceCharacteristics);
        } catch (charError) {
          common_vendor.index.__f__("warn", "at utils/bleManager.js:649", `获取服务 ${service.uuid} 特征值失败:`, charError);
        }
      }
      common_vendor.index.__f__("log", "at utils/bleManager.js:653", "过滤后的特征值:", this.characteristics);
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
      common_vendor.index.__f__("error", "at utils/bleManager.js:666", "发现服务失败:", error);
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
      const res = await common_vendor.index.readBLECharacteristicValue({
        deviceId: this.connectedDevice,
        serviceId,
        characteristicId
      });
      common_vendor.index.__f__("log", "at utils/bleManager.js:689", "读取特征值成功:", res);
      return res;
    } catch (error) {
      common_vendor.index.__f__("error", "at utils/bleManager.js:692", "读取特征值失败:", error);
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
      const res = await common_vendor.index.writeBLECharacteristicValue({
        deviceId: this.connectedDevice,
        serviceId,
        characteristicId,
        value
      });
      common_vendor.index.__f__("log", "at utils/bleManager.js:717", "写入特征值成功:", res);
      return res;
    } catch (error) {
      common_vendor.index.__f__("error", "at utils/bleManager.js:720", "写入特征值失败:", error);
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
      common_vendor.index.__f__("log", "at utils/bleManager.js:787", "蓝牙资源已清理（适配器未关闭）");
    } catch (error) {
      common_vendor.index.__f__("error", "at utils/bleManager.js:789", "清理蓝牙资源失败:", error);
    }
  }
  /**
   * 完全清理资源（包括关闭适配器，仅在应用退出时使用）
   */
  async fullCleanup() {
    try {
      await this.cleanup();
      await common_vendor.index.closeBluetoothAdapter();
      this.adapterInitialized = false;
      this.listenersRegistered = {
        deviceFound: false,
        connectionState: false
      };
      this.connectionStateListener = null;
      this.deviceFoundListener = null;
      common_vendor.index.__f__("log", "at utils/bleManager.js:813", "蓝牙资源已完全清理（适配器已关闭）");
    } catch (error) {
      common_vendor.index.__f__("error", "at utils/bleManager.js:815", "完全清理蓝牙资源失败:", error);
    }
  }
}
const bleManager = new BLEManager();
exports.bleManager = bleManager;
//# sourceMappingURL=../../.sourcemap/mp-weixin/utils/bleManager.js.map
