"use strict";
const common_vendor = require("../../common/vendor.js");
const utils_bleManager = require("../../utils/bleManager.js");
const _sfc_main = {
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
    utils_bleManager.bleManager.cleanup();
  },
  methods: {
    checkPermissionStatus() {
      const permissionStatus = common_vendor.index.getStorageSync("bluetooth_permission_checked");
      if (permissionStatus) {
        this.permissionChecked = true;
        common_vendor.index.__f__("log", "at pages/index/index.vue:146", "权限已检查过，跳过权限提示");
      } else {
        common_vendor.index.__f__("log", "at pages/index/index.vue:148", "首次使用，需要检查权限");
      }
    },
    savePermissionStatus() {
      common_vendor.index.setStorageSync("bluetooth_permission_checked", true);
      common_vendor.index.__f__("log", "at pages/index/index.vue:154", "权限检查状态已保存");
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
        common_vendor.index.__f__("log", "at pages/index/index.vue:170", "开始初始化蓝牙...");
        const success = await utils_bleManager.bleManager.initBluetooth();
        if (success) {
          common_vendor.index.__f__("log", "at pages/index/index.vue:173", "蓝牙初始化成功");
          utils_bleManager.bleManager.setCallback("onDeviceFound", this.onDeviceFound);
          utils_bleManager.bleManager.setCallback("onDeviceConnected", this.onDeviceConnected);
          utils_bleManager.bleManager.setCallback("onDeviceDisconnected", this.onDeviceDisconnected);
          utils_bleManager.bleManager.setCallback("onServicesDiscovered", this.onServicesDiscovered);
          utils_bleManager.bleManager.setCallback("onError", this.onBluetoothError);
          this.selectedBluetooth = "蓝牙已就绪";
        } else {
          common_vendor.index.__f__("log", "at pages/index/index.vue:184", "蓝牙初始化失败");
          this.selectedBluetooth = "蓝牙初始化失败，点击重试";
        }
      } catch (error) {
        common_vendor.index.__f__("log", "at pages/index/index.vue:196", "蓝牙初始化错误:", error);
        this.selectedBluetooth = "蓝牙初始化错误，点击重试";
      }
    },
    async startBluetoothScan() {
      try {
        const status = utils_bleManager.bleManager.getConnectionStatus();
        if (status.isScanning) {
          common_vendor.index.showToast({
            title: "正在扫描中，请稍候",
            icon: "none"
          });
          return;
        }
        if (this.permissionChecked) {
          common_vendor.index.__f__("log", "at pages/index/index.vue:222", "权限已检查过，直接开始扫描");
          this.bluetoothDevices = [];
          this.selectedBluetooth = "正在扫描...";
          const success = await utils_bleManager.bleManager.startScan(4e3, true);
          if (success) {
            this.isScanning = true;
          } else {
            this.isScanning = false;
            this.selectedBluetooth = "扫描失败";
          }
          setTimeout(() => {
            const currentStatus = utils_bleManager.bleManager.getConnectionStatus();
            if (currentStatus.isScanning) {
              common_vendor.index.__f__("log", "at pages/index/index.vue:239", "扫描状态检查：强制停止扫描");
              this.stopBluetoothScan();
            }
          }, 6e3);
        } else {
          common_vendor.index.showModal({
            title: "权限检查",
            content: "请确保已开启蓝牙和位置权限，然后点击确定开始扫描",
            success: async (res) => {
              if (res.confirm) {
                this.permissionChecked = true;
                this.savePermissionStatus();
                this.bluetoothDevices = [];
                this.selectedBluetooth = "正在扫描...";
                const success = await utils_bleManager.bleManager.startScan(4e3);
                if (success) {
                  this.isScanning = true;
                } else {
                  this.isScanning = false;
                  this.selectedBluetooth = "扫描失败";
                }
                setTimeout(() => {
                  const currentStatus = utils_bleManager.bleManager.getConnectionStatus();
                  if (currentStatus.isScanning) {
                    common_vendor.index.__f__("log", "at pages/index/index.vue:269", "扫描状态检查：强制停止扫描");
                    this.stopBluetoothScan();
                  }
                }, 6e3);
              }
            }
          });
        }
      } catch (error) {
        common_vendor.index.__f__("log", "at pages/index/index.vue:278", "开始扫描失败:", error);
        common_vendor.index.showToast({
          title: "扫描失败",
          icon: "none"
        });
        this.isScanning = false;
      }
    },
    async stopBluetoothScan() {
      try {
        common_vendor.index.__f__("log", "at pages/index/index.vue:288", "用户手动停止扫描");
        await utils_bleManager.bleManager.stopScan();
        const status = utils_bleManager.bleManager.getConnectionStatus();
        this.isScanning = status.isScanning;
        if (this.bluetoothDevices.length === 0) {
          this.selectedBluetooth = "未发现BLE设备";
        } else {
          this.selectedBluetooth = "选择设备";
        }
        common_vendor.index.__f__("log", "at pages/index/index.vue:300", "扫描已停止，状态已更新");
      } catch (error) {
        common_vendor.index.__f__("log", "at pages/index/index.vue:302", "停止扫描失败:", error);
        const status = utils_bleManager.bleManager.getConnectionStatus();
        this.isScanning = status.isScanning;
        this.selectedBluetooth = "扫描停止失败";
      }
    },
    async retryInitBluetooth() {
      common_vendor.index.showLoading({
        title: "重新初始化蓝牙..."
      });
      try {
        await utils_bleManager.bleManager.cleanup();
        await new Promise((resolve) => setTimeout(resolve, 1e3));
        const success = await utils_bleManager.bleManager.initBluetooth();
        common_vendor.index.hideLoading();
        if (success) {
          utils_bleManager.bleManager.setCallback("onDeviceFound", this.onDeviceFound);
          utils_bleManager.bleManager.setCallback("onDeviceConnected", this.onDeviceConnected);
          utils_bleManager.bleManager.setCallback("onDeviceDisconnected", this.onDeviceDisconnected);
          utils_bleManager.bleManager.setCallback("onServicesDiscovered", this.onServicesDiscovered);
          utils_bleManager.bleManager.setCallback("onError", this.onBluetoothError);
          common_vendor.index.showToast({
            title: "蓝牙初始化成功",
            icon: "success"
          });
        } else {
          common_vendor.index.showModal({
            title: "蓝牙初始化失败",
            content: "请检查设备蓝牙是否开启，或重新启动应用",
            showCancel: false
          });
        }
      } catch (error) {
        common_vendor.index.hideLoading();
        common_vendor.index.__f__("log", "at pages/index/index.vue:341", "重新初始化蓝牙失败:", error);
        common_vendor.index.showModal({
          title: "重新初始化失败",
          content: "请确保设备支持蓝牙功能并已开启蓝牙",
          showCancel: false
        });
      }
    },
    async connectBluetoothDevice(device) {
      try {
        common_vendor.index.showLoading({
          title: "连接设备中..."
        });
        const success = await utils_bleManager.bleManager.connectDevice(device.deviceId);
        if (success) {
          const status = utils_bleManager.bleManager.getConnectionStatus();
          this.connectedDevice = device;
          this.isConnected = status.isConnected;
          this.selectedBluetooth = `已连接: ${device.name || device.localName || "未知设备"}`;
          common_vendor.index.setStorageSync("bluetooth_connected_device", {
            deviceId: device.deviceId,
            deviceName: device.name || device.localName || "未知设备",
            connected: true,
            connectTime: Date.now()
          });
          common_vendor.index.hideLoading();
          common_vendor.index.showToast({
            title: "连接成功",
            icon: "success"
          });
          this.showBluetoothDropdown = false;
        } else {
          const status = utils_bleManager.bleManager.getConnectionStatus();
          this.isConnected = status.isConnected;
          common_vendor.index.hideLoading();
          common_vendor.index.showToast({
            title: "连接失败",
            icon: "none"
          });
        }
      } catch (error) {
        common_vendor.index.__f__("log", "at pages/index/index.vue:388", "连接设备失败:", error);
        const status = utils_bleManager.bleManager.getConnectionStatus();
        this.isConnected = status.isConnected;
        common_vendor.index.hideLoading();
        common_vendor.index.showToast({
          title: "连接失败",
          icon: "none"
        });
      }
    },
    async disconnectBluetooth() {
      try {
        await utils_bleManager.bleManager.disconnectDevice();
        const status = utils_bleManager.bleManager.getConnectionStatus();
        this.connectedDevice = null;
        this.isConnected = status.isConnected;
        this.selectedBluetooth = "未连接";
        this.services = [];
        this.characteristics = [];
        common_vendor.index.removeStorageSync("bluetooth_connected_device");
        common_vendor.index.showToast({
          title: "已断开连接",
          icon: "success"
        });
        this.showBluetoothDropdown = false;
      } catch (error) {
        common_vendor.index.__f__("log", "at pages/index/index.vue:418", "断开连接失败:", error);
        const status = utils_bleManager.bleManager.getConnectionStatus();
        this.isConnected = status.isConnected;
        common_vendor.index.showToast({
          title: "断开连接失败",
          icon: "none"
        });
      }
    },
    async discoverServices() {
      try {
        common_vendor.index.showLoading({
          title: "发现目标服务中..."
        });
        const result = await utils_bleManager.bleManager.discoverServices();
        common_vendor.index.hideLoading();
        if (result) {
          this.services = result.services;
          this.characteristics = result.characteristics;
          if (result.targetServiceFound) {
            common_vendor.index.showModal({
              title: "目标服务发现成功",
              content: `成功找到目标服务 4fafc201-1fb5-459e-8fcc-c5c9c331914b
发现 ${result.services.length} 个服务，${result.characteristics.length} 个特征值`,
              showCancel: false
            });
          } else {
            common_vendor.index.showModal({
              title: "目标服务未找到",
              content: `未找到目标服务 4fafc201-1fb5-459e-8fcc-c5c9c331914b
但发现了 ${result.services.length} 个其他服务，${result.characteristics.length} 个特征值`,
              showCancel: false
            });
          }
          common_vendor.index.__f__("log", "at pages/index/index.vue:456", "服务发现完成:", result);
        } else {
          common_vendor.index.showToast({
            title: "服务发现失败",
            icon: "none"
          });
        }
      } catch (error) {
        common_vendor.index.hideLoading();
        common_vendor.index.__f__("log", "at pages/index/index.vue:465", "服务发现失败:", error);
        common_vendor.index.showToast({
          title: "服务发现失败",
          icon: "none"
        });
      }
    },
    // 蓝牙回调函数
    onDeviceFound(device) {
      common_vendor.index.__f__("log", "at pages/index/index.vue:474", "发现设备:", device);
      this.bluetoothDevices.push(device);
    },
    onDeviceConnected(data) {
      common_vendor.index.__f__("log", "at pages/index/index.vue:478", "设备已连接:", data);
      const status = utils_bleManager.bleManager.getConnectionStatus();
      this.isConnected = status.isConnected;
    },
    onDeviceDisconnected(data) {
      common_vendor.index.__f__("log", "at pages/index/index.vue:484", "设备已断开:", data);
      const status = utils_bleManager.bleManager.getConnectionStatus();
      this.connectedDevice = null;
      this.isConnected = status.isConnected;
      this.selectedBluetooth = "未连接";
      this.services = [];
      this.characteristics = [];
      common_vendor.index.removeStorageSync("bluetooth_connected_device");
    },
    onServicesDiscovered(data) {
      common_vendor.index.__f__("log", "at pages/index/index.vue:496", "发现服务:", data);
      this.services = data.services;
      this.characteristics = data.characteristics;
      if (data.targetServiceFound) {
        common_vendor.index.showModal({
          title: "目标服务已找到",
          content: `成功找到目标服务 4fafc201-1fb5-459e-8fcc-c5c9c331914b，发现 ${data.services.length} 个服务，${data.characteristics.length} 个特征值`,
          showCancel: false
        });
      } else {
        common_vendor.index.showModal({
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
      common_vendor.index.__f__("log", "at pages/index/index.vue:522", "蓝牙错误:", error);
      if (error.code === 10001) {
        common_vendor.index.showModal({
          title: "蓝牙权限被拒绝",
          content: "请在系统设置中开启蓝牙权限，然后重新启动应用",
          showCancel: false
        });
      } else if (error.code === 1e4) {
        common_vendor.index.showToast({
          title: "蓝牙适配器未初始化",
          icon: "none",
          duration: 2e3
        });
      } else if (error.message && error.message.includes("蓝牙未开启")) {
        common_vendor.index.showModal({
          title: "蓝牙未开启",
          content: "请先在手机设置中开启蓝牙功能，然后重新尝试",
          showCancel: false
        });
      } else if (error.message && error.message.includes("位置权限")) {
        common_vendor.index.showModal({
          title: "位置权限不足",
          content: "Android系统需要位置权限才能扫描BLE设备，请在设置中开启位置权限",
          showCancel: false
        });
      } else {
        common_vendor.index.showToast({
          title: "蓝牙操作失败",
          icon: "none",
          duration: 2e3
        });
      }
    },
    goToTemplate() {
      if (this.selectedSize === "4.2英寸三色墨水屏") {
        common_vendor.index.navigateTo({
          url: "/pages/template/template",
          success: function(res) {
            common_vendor.index.__f__("log", "at pages/index/index.vue:563", "跳转到4.2英寸模板页面成功");
          },
          fail: function(err) {
            common_vendor.index.__f__("log", "at pages/index/index.vue:566", "跳转到4.2英寸模板页面失败:", err);
            common_vendor.index.showToast({
              title: "页面跳转失败，请重新启动项目",
              icon: "none",
              duration: 3e3
            });
          }
        });
      } else if (this.selectedSize === "7.5英寸三色墨水屏") {
        common_vendor.index.navigateTo({
          url: "/pages/template/template75",
          success: function(res) {
            common_vendor.index.__f__("log", "at pages/index/index.vue:579", "跳转到7.5英寸模板页面成功");
          },
          fail: function(err) {
            common_vendor.index.__f__("log", "at pages/index/index.vue:582", "跳转到7.5英寸模板页面失败:", err);
            common_vendor.index.showToast({
              title: "页面跳转失败，请重新启动项目",
              icon: "none",
              duration: 3e3
            });
          }
        });
      } else {
        common_vendor.index.navigateTo({
          url: "/pages/template/blank",
          success: function(res) {
            common_vendor.index.__f__("log", "at pages/index/index.vue:595", "跳转到空白页面成功");
          },
          fail: function(err) {
            common_vendor.index.__f__("log", "at pages/index/index.vue:598", "跳转到空白页面失败:", err);
            common_vendor.index.showToast({
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
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return common_vendor.e({
    a: common_vendor.t($data.selectedSize),
    b: common_vendor.o((...args) => $options.showSizeOptions && $options.showSizeOptions(...args)),
    c: $data.showSizeDropdown
  }, $data.showSizeDropdown ? {
    d: common_vendor.o(($event) => $options.selectSize("4.2英寸三色墨水屏")),
    e: common_vendor.o(($event) => $options.selectSize("7.5英寸三色墨水屏"))
  } : {}, {
    f: common_vendor.t($data.selectedBluetooth),
    g: common_vendor.o((...args) => $options.showBluetoothOptions && $options.showBluetoothOptions(...args)),
    h: $data.showBluetoothDropdown
  }, $data.showBluetoothDropdown ? common_vendor.e({
    i: !$data.isScanning && !$data.isConnected
  }, !$data.isScanning && !$data.isConnected ? {
    j: common_vendor.o((...args) => $options.startBluetoothScan && $options.startBluetoothScan(...args))
  } : {}, {
    k: !$data.isScanning && !$data.isConnected
  }, !$data.isScanning && !$data.isConnected ? {
    l: common_vendor.o((...args) => $options.retryInitBluetooth && $options.retryInitBluetooth(...args))
  } : {}, {
    m: $data.isScanning
  }, $data.isScanning ? {
    n: common_vendor.o((...args) => $options.stopBluetoothScan && $options.stopBluetoothScan(...args))
  } : {}, {
    o: $data.bluetoothDevices.length > 0
  }, $data.bluetoothDevices.length > 0 ? {
    p: common_vendor.f($data.bluetoothDevices, (device, k0, i0) => {
      return {
        a: common_vendor.t(device.name || device.localName || "未知设备"),
        b: common_vendor.t(device.deviceId),
        c: common_vendor.t(device.RSSI),
        d: common_vendor.n($options.getSignalClass(device.RSSI)),
        e: device.deviceId,
        f: common_vendor.o(($event) => $options.connectBluetoothDevice(device), device.deviceId)
      };
    })
  } : {}, {
    q: $data.isConnected
  }, $data.isConnected ? {
    r: common_vendor.o((...args) => $options.disconnectBluetooth && $options.disconnectBluetooth(...args))
  } : {}, {
    s: $data.isConnected
  }, $data.isConnected ? {
    t: common_vendor.o((...args) => $options.discoverServices && $options.discoverServices(...args))
  } : {}) : {}, {
    v: common_vendor.o((...args) => $options.goToTemplate && $options.goToTemplate(...args))
  });
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/index/index.js.map
