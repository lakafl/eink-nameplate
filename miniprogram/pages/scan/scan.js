const ble = require('../../utils/ble');

Page({
  data: {
    scanning: false,
    connected: false,
    deviceName: '',
    devices: [],
    errorMsg: ''
  },

  onLoad() {
    ble.initBluetooth().catch(err => {
      this.setData({ errorMsg: '蓝牙初始化失败: ' + JSON.stringify(err) });
    });
  },

  onUnload() {
    // Keep BLE connection alive when navigating to editor
  },

  async startScanning() {
    this.setData({ scanning: true, devices: [], errorMsg: '' });

    try {
      await ble.initBluetooth();
    } catch (e) {
      this.setData({
        scanning: false,
        errorMsg: '请打开手机蓝牙后再试'
      });
      return;
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