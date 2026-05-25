"use strict";
const common_vendor = require("../../common/vendor.js");
const common_assets = require("../../common/assets.js");
const _sfc_main = {
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
      common_vendor.index.showToast({
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
        const ctx = common_vendor.index.createCanvasContext(canvasId, this);
        const templateImage = "/static/moban75.jpg";
        ctx.drawImage(templateImage, 0, 0, 800, 480);
        ctx.setFontSize(this.currentFontSize);
        ctx.setFillStyle(this.currentColor);
        ctx.setTextAlign("center");
        ctx.setTextBaseline("middle");
        ctx.fillText(this.currentText, 400, 120);
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
        const canvasWidth = 800;
        const canvasHeight = 480;
        ctx.drawImage(this.mergedImageData, 0, 0, canvasWidth, canvasHeight);
        ctx.draw(false, () => {
          common_vendor.index.canvasGetImageData({
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
      const ctx = common_vendor.index.createCanvasContext(canvasId, this);
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
        common_vendor.index.canvasToTempFilePath({
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
      const ctx = common_vendor.index.createCanvasContext(canvasId, this);
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
        common_vendor.index.canvasToTempFilePath({
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
      const savedText = common_vendor.index.getStorageSync("template_text");
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
      common_vendor.index.setStorageSync("template_text", settings);
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
  return common_vendor.e({
    a: common_vendor.t($data.isBluetoothConnected ? "●" : "○"),
    b: common_vendor.t($data.isBluetoothConnected ? $data.connectedDeviceName || "已连接" : "请先在主页面连接蓝牙设备"),
    c: !$data.isBluetoothConnected
  }, !$data.isBluetoothConnected ? {
    d: common_vendor.o((...args) => $options.goToMainPage && $options.goToMainPage(...args))
  } : {}, {
    e: $data.isBluetoothConnected ? 1 : "",
    f: common_assets._imports_0$4,
    g: $data.currentText
  }, $data.currentText ? {
    h: common_vendor.t($data.currentText),
    i: $data.currentColor,
    j: $data.currentFont,
    k: $data.currentFontSize * 0.5 + "px"
  } : {}, {
    l: common_vendor.o([($event) => $data.currentText = $event.detail.value, (...args) => $options.updateCurrentText && $options.updateCurrentText(...args)]),
    m: $data.currentText,
    n: common_vendor.o((...args) => $options.decreaseFontSize && $options.decreaseFontSize(...args)),
    o: common_vendor.t($data.currentFontSize),
    p: common_vendor.o((...args) => $options.increaseFontSize && $options.increaseFontSize(...args)),
    q: common_vendor.f($data.fontOptions, (font, k0, i0) => {
      return {
        a: common_vendor.t(font.name),
        b: font.value,
        c: font.value,
        d: $data.currentFont === font.value ? 1 : "",
        e: common_vendor.o(($event) => $options.selectFont(font.value), font.value)
      };
    }),
    r: common_vendor.f($data.colorOptions, (color, k0, i0) => {
      return {
        a: color.value,
        b: common_vendor.t(color.name),
        c: color.value,
        d: $data.currentColor === color.value ? 1 : "",
        e: common_vendor.o(($event) => $options.selectColor(color.value), color.value)
      };
    }),
    s: $data.processedData.processing
  }, $data.processedData.processing ? {} : {}, {
    t: $data.sendingData
  }, $data.sendingData ? {
    v: common_vendor.t($data.currentPacket),
    w: common_vendor.t($data.totalPackets)
  } : {}, {
    x: common_vendor.o((...args) => $options.clearText && $options.clearText(...args)),
    y: common_vendor.t($data.sendingData ? "发送中..." : "发送数据"),
    z: common_vendor.o((...args) => $options.sendDataToDevice && $options.sendDataToDevice(...args)),
    A: !$data.processedData.blackWhiteArray || !$data.processedData.redWhiteArray || !$data.isBluetoothConnected || $data.sendingData
  });
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/edit/edit75.js.map
