"use strict";
const common_vendor = require("../../common/vendor.js");
const common_assets = require("../../common/assets.js");
const _sfc_main = {
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
        const sys = common_vendor.index.getSystemInfoSync();
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
        const sys = common_vendor.index.getSystemInfoSync();
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
        const sys = common_vendor.index.getSystemInfoSync();
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
      common_vendor.index.showToast({
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
        const ctx = common_vendor.index.createCanvasContext(canvasId, this);
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
          common_vendor.index.canvasToTempFilePath({
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
        const ctx = common_vendor.index.createCanvasContext(processCanvasId, this);
        const canvasWidth = 400;
        const canvasHeight = 300;
        ctx.drawImage(this.mergedImageData, 0, 0, canvasWidth, canvasHeight);
        ctx.draw(false, () => {
          common_vendor.index.canvasGetImageData({
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
          common_vendor.index.showToast({
            title: "蓝牙不可用",
            icon: "none"
          });
          return;
        }
        this.setupBluetoothListeners();
        await this.checkExistingConnection();
      } catch (error) {
        common_vendor.index.showToast({
          title: "蓝牙初始化失败",
          icon: "none"
        });
      }
    },
    // 启动蓝牙适配器
    async startBluetoothAdapter() {
      return new Promise((resolve, reject) => {
        common_vendor.index.openBluetoothAdapter({
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
      common_vendor.index.navigateBack({
        delta: 1,
        success: () => {
        },
        fail: (err) => {
          common_vendor.index.reLaunch({
            url: "/pages/index/index"
          });
        }
      });
    },
    // 检查蓝牙适配器状态
    async checkBluetoothAdapterState() {
      return new Promise((resolve) => {
        common_vendor.index.getBluetoothAdapterState({
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
      common_vendor.index.onBluetoothDeviceFound((res) => {
        this.onBluetoothDeviceFound(res);
      });
      common_vendor.index.onBLECharacteristicValueChange((res) => {
        this.onBLECharacteristicValueChange(res);
      });
    },
    // 检查现有连接
    async checkExistingConnection() {
      try {
        const storedConnection = common_vendor.index.getStorageSync("bluetooth_connected_device");
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
            common_vendor.index.removeStorageSync("bluetooth_connected_device");
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
        common_vendor.index.getConnectedBluetoothDevices({
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
      common_vendor.index.stopBluetoothDevicesDiscovery();
      common_vendor.index.hideLoading();
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
        common_vendor.index.getBLEDeviceServices({
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
        common_vendor.index.getBLEDeviceCharacteristics({
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
          common_vendor.index.__f__("log", "at pages/edit/edit.vue:837", `发送成功，缩短间隔时间至: ${this.adaptiveTiming.currentInterval}ms`);
        }
      } else {
        this.adaptiveTiming.failureCount++;
        this.adaptiveTiming.successCount = 0;
        this.adaptiveTiming.currentInterval = Math.min(
          this.adaptiveTiming.maxInterval,
          this.adaptiveTiming.currentInterval + this.adaptiveTiming.adjustmentStep
        );
        common_vendor.index.__f__("log", "at pages/edit/edit.vue:848", `发送失败，增加间隔时间至: ${this.adaptiveTiming.currentInterval}ms`);
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
        common_vendor.index.showToast({
          title: "蓝牙未连接",
          icon: "none"
        });
        return;
      }
      if (!this.processedData.blackWhiteArray || !this.processedData.redWhiteArray) {
        common_vendor.index.showToast({
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
      common_vendor.index.showLoading({
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
        common_vendor.index.hideLoading();
        common_vendor.index.showToast({
          title: "数据发送完成",
          icon: "success"
        });
        "数据发送完成";
      } catch (error) {
        common_vendor.index.hideLoading();
        common_vendor.index.showModal({
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
        common_vendor.index.__f__("log", "at pages/edit/edit.vue:934", `尝试申请MTU到${mtu}字节`);
        if (!this.currentDeviceId) {
          throw new Error("没有设备ID，无法申请MTU");
        }
        "MTU申请使用的设备ID:", this.currentDeviceId;
        const result = await new Promise((resolve, reject) => {
          common_vendor.index.setBLEMTU({
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
        common_vendor.index.__f__("log", "at pages/edit/edit.vue:960", `MTU申请成功，实际MTU: ${actualMTU}字节`);
        const maxDataLength = actualMTU - 6;
        common_vendor.index.__f__("log", "at pages/edit/edit.vue:964", `可用数据长度: ${maxDataLength}字节`);
        return maxDataLength;
      } catch (error) {
        const maxDataLength = 506 - 6;
        common_vendor.index.__f__("log", "at pages/edit/edit.vue:972", `使用默认MTU: ${maxDataLength}字节`);
        return maxDataLength;
      }
    },
    // 发送数组数据
    async sendArrayData(dataArray, dataType) {
      const totalLength = dataArray.length;
      const maxDataLength = 506 - 6;
      const totalPackets = Math.ceil(totalLength / maxDataLength);
      common_vendor.index.__f__("log", "at pages/edit/edit.vue:985", `发送${dataType === 37 ? "黑白" : "红白"}数组，共${totalPackets}个包，每包${maxDataLength}字节`);
      common_vendor.index.__f__("log", "at pages/edit/edit.vue:986", `数组总长度: ${totalLength}字节`);
      this.totalPackets = totalPackets;
      this.currentPacket = 0;
      for (let i = 0; i < totalPackets; i++) {
        const startIndex = i * maxDataLength;
        const endIndex = Math.min(startIndex + maxDataLength, totalLength);
        const packetData = dataArray.slice(startIndex, endIndex);
        common_vendor.index.__f__("log", "at pages/edit/edit.vue:997", `发送第${i + 1}/${totalPackets}包，数据长度: ${packetData.length}字节`);
        const packet = this.buildDataPacket(packetData, dataType, false);
        await this.sendPacketWithQueue(packet);
        common_vendor.index.__f__("log", "at pages/edit/edit.vue:1004", `第${i + 1}包发送成功`);
        this.adjustSendInterval(true);
        this.currentPacket = i + 1;
        this.sendProgress = this.currentPacket / this.totalPackets * 100;
        await new Promise((resolve) => setTimeout(resolve, this.adaptiveTiming.currentInterval));
      }
      common_vendor.index.__f__("log", "at pages/edit/edit.vue:1017", `${dataType === 37 ? "黑白" : "红白"}数组发送完成，共发送${totalPackets}个包`);
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
      common_vendor.index.__f__("log", "at pages/edit/edit.vue:1053", `构建数据包: 长度=${packet.length}, 数据类型=0x${dataType.toString(16)}, 数据长度=${dataLength}, 尾包=${isLastPacket}`);
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
        common_vendor.index.__f__("log", "at pages/edit/edit.vue:1146", "使用设备ID:", this.currentDeviceId);
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
        common_vendor.index.__f__("log", "at pages/edit/edit.vue:1183", `使用可写特征值: ${characteristic.uuid}`);
        `特征值属性:`, characteristic.properties;
        const arrayBuffer = packet.buffer.slice(packet.byteOffset, packet.byteOffset + packet.byteLength);
        const useWriteNoResponse = characteristic.properties && characteristic.properties.writeNoResponse;
        common_vendor.index.__f__("log", "at pages/edit/edit.vue:1191", `使用写入方式: ${useWriteNoResponse ? "writeNoResponse" : "write"}`);
        await new Promise((resolve, reject) => {
          common_vendor.index.writeBLECharacteristicValue({
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
                common_vendor.index.writeBLECharacteristicValue({
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
        common_vendor.index.__f__("log", "at pages/edit/edit.vue:1232", `发送数据包成功，长度: ${packet.length}字节`);
      } catch (error) {
        common_vendor.index.__f__("log", "at pages/edit/edit.vue:1235", `发送数据包失败 (尝试 ${retryCount + 1}/${maxRetries + 1}):`, error);
        if (retryCount < maxRetries && (error.message.includes("写入失败") || error.message.includes("write") || error.message.includes("characteristic"))) {
          this.adjustSendInterval(false);
          const retryDelay = Math.max(this.adaptiveTiming.currentInterval * 2, 300);
          common_vendor.index.__f__("log", "at pages/edit/edit.vue:1248", `等待 ${retryDelay}ms 后重试...`);
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
      common_vendor.index.setStorageSync("template_text", settings);
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
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return common_vendor.e({
    a: common_vendor.t($data.isBluetoothConnected ? "●" : "○"),
    b: common_vendor.t($data.isBluetoothConnected ? $data.connectedDeviceName || "已连接" : "请先在主页面连接蓝牙设备"),
    c: !$data.isBluetoothConnected
  }, !$data.isBluetoothConnected ? {
    d: common_vendor.o((...args) => $options.goToMainPage && $options.goToMainPage(...args))
  } : {}, {
    e: $data.isBluetoothConnected ? 1 : "",
    f: common_assets._imports_0,
    g: common_vendor.t($data.currentUnit && $data.currentUnit.trim() ? $data.currentUnit : "单位"),
    h: $data.currentFont,
    i: $options.getUnitPreviewFontSizePx() + "px",
    j: common_vendor.t($data.currentText && $data.currentText.trim() ? $data.currentText : "姓名"),
    k: $data.currentColor,
    l: $data.currentFont,
    m: $options.getNamePreviewFontSizePx() + "px",
    n: common_vendor.t($data.currentPosition && $data.currentPosition.trim() ? $data.currentPosition : "职务"),
    o: $data.currentColor,
    p: $data.currentFont,
    q: $options.getPositionPreviewFontSizePx() + "px",
    r: common_vendor.o([($event) => $data.currentUnit = $event.detail.value, (...args) => $options.updateCurrentUnit && $options.updateCurrentUnit(...args)]),
    s: $data.currentUnit,
    t: common_vendor.o([($event) => $data.currentText = $event.detail.value, (...args) => $options.updateCurrentText && $options.updateCurrentText(...args)]),
    v: $data.currentText,
    w: common_vendor.o([($event) => $data.currentPosition = $event.detail.value, (...args) => $options.updateCurrentPosition && $options.updateCurrentPosition(...args)]),
    x: $data.currentPosition,
    y: $data.currentUnitFontSize,
    z: common_vendor.o((...args) => $options.onUnitFontSizeChange && $options.onUnitFontSizeChange(...args)),
    A: common_vendor.t($data.currentUnitFontSize),
    B: $data.currentNameFontSize,
    C: common_vendor.o((...args) => $options.onNameFontSizeChange && $options.onNameFontSizeChange(...args)),
    D: common_vendor.t($data.currentNameFontSize),
    E: $data.processedData.processing
  }, $data.processedData.processing ? {} : {}, {
    F: $data.sendingData
  }, $data.sendingData ? {
    G: $data.sendProgress + "%",
    H: common_vendor.t(Math.round($data.sendProgress))
  } : {}, {
    I: common_vendor.t($data.sendingData ? "发送中..." : "发送数据"),
    J: common_vendor.o((...args) => $options.sendDataToDevice && $options.sendDataToDevice(...args)),
    K: !$data.processedData.blackWhiteArray || !$data.processedData.redWhiteArray || !$data.isBluetoothConnected || $data.sendingData
  });
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/edit/edit.js.map
