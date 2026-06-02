const ble = require('../../utils/ble');

Page({
  data: {
    scanning: false,
    connected: false,
    deviceName: '',
    devices: [],
    errorMsg: ''
  },

  _bluetoothReady: false,

  onLoad() {
    // 先检查隐私授权，通过后再初始化蓝牙
    this._checkPrivacyThenInit();
  },

  onUnload() {
    // 清理蓝牙扫描监听器，避免内存泄漏
    wx.offBluetoothDeviceFound();
    wx.stopBluetoothDevicesDiscovery();
  },

  // ★ 核心修复：隐私授权检查 → 蓝牙初始化
  // 微信基础库 2.32.3+ 要求：调用蓝牙等隐私 API 前必须先检查隐私授权
  _checkPrivacyThenInit() {
    if (wx.getPrivacySetting) {
      wx.getPrivacySetting({
        success: (res) => {
          console.log('[Privacy] getPrivacySetting:', res);
          if (res.needAuthorization) {
            // 用户尚未同意隐私协议 → 弹出授权窗口
            this.setData({ errorMsg: '请先同意隐私协议后再使用蓝牙功能' });
            wx.requirePrivacyAuthorize({
              success: () => {
                console.log('[Privacy] 用户已同意隐私协议');
                this.setData({ errorMsg: '' });
                this._initBluetooth();
              },
              fail: () => {
                this.setData({ errorMsg: '需要同意隐私协议才能使用蓝牙功能' });
              }
            });
          } else {
            // 已授权，直接初始化蓝牙
            this._initBluetooth();
          }
        },
        fail: () => {
          // 基础库可能不支持该 API，直接尝试初始化
          this._initBluetooth();
        }
      });
    } else {
      // 旧版基础库，直接初始化
      this._initBluetooth();
    }
  },

  _initBluetooth() {
    if (this._bluetoothReady) return;
    ble.initBluetooth().then(() => {
      this._bluetoothReady = true;
      console.log('[Scan] 蓝牙初始化成功');
    }).catch(err => {
      this.setData({ errorMsg: '蓝牙初始化失败: ' + JSON.stringify(err) });
    });
  },

  async startScanning() {
    this.setData({ scanning: true, devices: [], errorMsg: '' });

    // 如果蓝牙还没就绪（用户直接点扫描），重新尝试初始化
    if (!this._bluetoothReady) {
      try {
        await ble.initBluetooth();
        this._bluetoothReady = true;
      } catch (e) {
        this.setData({
          scanning: false,
          errorMsg: '蓝牙未就绪，请检查隐私授权和蓝牙开关'
        });
        return;
      }
    }

    try {
      const devices = await ble.startScan(10000);
      this.setData({ scanning: false, devices });
      if (devices.length === 0) {
        this.setData({ errorMsg: '未发现 ESP32 设备，请确认设备已上电' });
      }
    } catch (e) {
      this.setData({
        scanning: false,
        errorMsg: '扫描失败: ' + (e.errMsg || e.message || e)
      });
    }
  },

  async connectDevice(e) {
    const device = e.currentTarget.dataset.device;
    wx.showLoading({ title: '连接中...' });

    try {
      // ★ prepareConnection 内部已经调用 setupACKListener + enableNotify
      //    不需要在外面再调用 setupACKListener
      await ble.prepareConnection(device.deviceId);

      wx.hideLoading();
      wx.showToast({ title: '连接成功', icon: 'success' });

      this.setData({
        connected: true,
        deviceName: device.name || device.deviceId
      });

      const app = getApp();
      app.globalData.deviceId = device.deviceId;
      app.globalData.deviceName = device.name;
      app.globalData.connected = true;

    } catch (err) {
      wx.hideLoading();
      const msg = typeof err === 'string' ? err : (err.errMsg || err.message || '连接失败');
      this.setData({ errorMsg: msg });
      console.error('[Scan] Connect failed:', err);
    }
  },

  goEditor() {
    wx.navigateTo({
      url: '/pages/editor/editor'
    });
  }
});
