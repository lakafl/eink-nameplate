// BLE Manager for WeChat Mini Program
// Handles connection, data transfer with MCU protocol

const SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
const CHAR_UUID_RX = 'beb5483e-36e1-4688-b7f5-ea07361b26a8'; // App → MCU
const CHAR_UUID_TX = 'beb5483e-36e1-4688-b7f5-ea07361b26a9'; // MCU → App

const MAGIC_0 = 0xAA;
const MAGIC_1 = 0x55;
const ACK_HEADER     = 0x01;
const ACK_CHUNK      = 0x02;
const ACK_LAYER_DONE = 0x03;
const ACK_REFRESHED  = 0x04;

// Display config — set by editor before sending
let _epdWidth  = 640;
let _epdHeight = 384;

function setDisplayConfig(w, h) {
  _epdWidth  = w;
  _epdHeight = h;
}

function getEPDWidth()  { return _epdWidth; }
function getEPDHeight() { return _epdHeight; }
function getLayerSize() { return _epdWidth * _epdHeight / 8; }

let deviceId = '';
let connected = false;

let _serviceId  = '';
let _rxCharUUID = '';
let _txCharUUID = '';

let mtu = 20;
let notifyCallback = null;

// ============================================================
// Promise wrappers
// ============================================================

function initBluetooth() {
  return new Promise((resolve, reject) => {
    wx.openBluetoothAdapter({
      success: () => { console.log('[BLE] Adapter opened'); resolve(); },
      fail: (err) => {
        if (err.errCode === 10001) resolve();
        else { console.error('[BLE] Adapter open failed', err); reject(err); }
      }
    });
  });
}

function startScan(timeout = 10000) {
  return new Promise((resolve, reject) => {
    const devices = [];
    wx.startBluetoothDevicesDiscovery({
      services: [SERVICE_UUID],
      allowDuplicatesKey: false,
      success: () => { console.log('[BLE] Scan started'); },
      fail: reject
    });
    wx.onBluetoothDeviceFound((res) => {
      res.devices.forEach((d) => {
        if (d.name && d.name.startsWith('ESP32') && !devices.find(x => x.deviceId === d.deviceId)) {
          devices.push(d);
        }
      });
    });
    setTimeout(() => {
      wx.stopBluetoothDevicesDiscovery();
      wx.offBluetoothDeviceFound();
      resolve(devices);
    }, timeout);
  });
}

function connect(devId) {
  return new Promise((resolve, reject) => {
    deviceId = devId;
    wx.createBLEConnection({
      deviceId: devId,
      timeout: 15000,
      success: () => { console.log('[BLE] Connected:', devId); connected = true; resolve(); },
      fail: reject
    });
  });
}

function disconnect() {
  if (deviceId) {
    wx.closeBLEConnection({ deviceId });
    deviceId = '';
    connected = false;
    _serviceId = '';
    _rxCharUUID = '';
    _txCharUUID = '';
  }
}

async function negotiateMTU(targetMTU = 512) {
  // ★ 修复：onBLEMTUChange 是实际协商结果的权威来源，
  //   setBLEMTU 的 success 回调返回值在部分安卓机上不可靠（仍返回 20）。
  //   策略：先注册 MTU 变化监听，再发起协商，用 Promise.race 取先到的结果。
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await sleep(600);

    const result = await new Promise((resolve) => {
      let settled = false;
      const done = (val) => {
        if (settled) return;
        settled = true;
        // 不能 offBLEMTUChange，但后续变化会继续更新全局 mtu
        resolve(val);
      };

      // 监听系统级 MTU 变化事件（最可靠）
      wx.onBLEMTUChange((res) => {
        console.log('[BLE] onBLEMTUChange:', res.mtu);
        mtu = res.mtu;
        done(res.mtu);
      });

      // 同时发起协商请求
      wx.setBLEMTU({
        deviceId,
        mtu: targetMTU,
        success: (res) => {
          const reported = res.mtu || 0;
          console.log('[BLE] setBLEMTU success, reported mtu:', reported);
          // 只有 onBLEMTUChange 没先触发时才用这个值
          if (reported > 20) {
            mtu = reported;
            done(reported);
          }
          // 若 reported <= 20，继续等 onBLEMTUChange（最多 1s）
          setTimeout(() => done(mtu), 1000);
        },
        fail: (err) => {
          console.log('[BLE] setBLEMTU fail:', err);
          setTimeout(() => done(mtu), 500);
        }
      });
    });

    if (result > 20) {
      console.log('[BLE] MTU negotiated:', mtu, '(attempt', attempt + 1, ')');
      return mtu;
    }
    console.log('[BLE] MTU attempt', attempt + 1, 'result:', result, ', retrying...');
  }

  // ★ 协商失败 fallback：MTU=20 时每包仅 17 字节有效载荷，
  //   1808 包 WRITE_NR 高速发送极易丢包导致 layer_done 永不触发。
  //   强制使用 128 作为安全值（大多数手机实际支持，只是协商 API 有 bug）。
  console.warn('[BLE] MTU negotiation failed, forcing safe fallback mtu=128');
  mtu = 128;
  return mtu;
}

function discoverServices() {
  return new Promise((resolve, reject) => {
    wx.getBLEDeviceServices({
      deviceId,
      success: (res) => { console.log('[BLE] Services:', res.services.length); resolve(res.services); },
      fail: reject
    });
  });
}

function discoverCharacteristics(svcId) {
  return new Promise((resolve, reject) => {
    wx.getBLEDeviceCharacteristics({
      deviceId,
      serviceId: svcId,
      success: (res) => { console.log('[BLE] Characteristics:', res.characteristics.length); resolve(res.characteristics); },
      fail: reject
    });
  });
}

function enableNotify() {
  return new Promise((resolve, reject) => {
    console.log('[BLE] Enabling notify, serviceId:', _serviceId, 'txCharUUID:', _txCharUUID);
    wx.notifyBLECharacteristicValueChange({
      deviceId,
      serviceId:        _serviceId,
      characteristicId: _txCharUUID,
      state: true,
      success: () => { console.log('[BLE] Notify enabled'); resolve(); },
      fail: (err) => { console.error('[BLE] Notify FAILED:', JSON.stringify(err)); reject(err); }
    });
  });
}

function writeToRX(buffer) {
  return new Promise((resolve, reject) => {
    wx.writeBLECharacteristicValue({
      deviceId,
      serviceId:        _serviceId,
      characteristicId: _rxCharUUID,
      value: buffer,
      success: resolve,
      fail: reject
    });
  });
}

// ============================================================
// ACK listener（幂等，只注册一次）
// ============================================================

let _ackListenerReady = false;

function setupACKListener() {
  if (_ackListenerReady) return;
  _ackListenerReady = true;
  wx.onBLECharacteristicValueChange((res) => {
    const data = new Uint8Array(res.value);
    // 传输期间关闭逐包日志以提速
    // console.log('[BLE] Received:', Array.from(data).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
    // 分发给所有注册的监听器
    _dispatchACK(data);
    if (notifyCallback) notifyCallback(data);
  });
}

// ============================================================
// ★ 新 ACK 系统：支持多个并发监听，解决"ACK 比等待先到"问题
// ============================================================

// 每个监听器格式：{ type, expectedParam, resolve, timer, received }
const _ackListeners = [];

// 收到数据时分发给所有监听器
function _dispatchACK(data) {
  for (let i = _ackListeners.length - 1; i >= 0; i--) {
    const listener = _ackListeners[i];
    if (data[0] !== listener.type) continue;

    if (listener.type === ACK_CHUNK && listener.expectedParam !== null) {
      if ((data[1] | (data[2] << 8)) !== listener.expectedParam) continue;
    } else if (listener.type === ACK_LAYER_DONE && listener.expectedParam !== null) {
      if (data[1] !== listener.expectedParam) continue;
    }

    // 命中：标记已收到，如果 promise 已在等待则立即 resolve
    listener.received = true;
    if (listener.resolve) {
      clearTimeout(listener.timer);
      listener.resolve(true);
      _ackListeners.splice(i, 1);
    }
    // 如果 resolve 还没注册（ACK 比 await 先到），保留 listener，
    // waitForACK 检测到 received=true 会立刻 resolve
  }
}

// ★ 核心修复：先注册监听器槽位，再发包，ACK 无论何时到来都不会丢失
function waitForACK(type, timeout, expectedParam = null) {
  return new Promise((resolve) => {
    // Clean up stale pre-registered listeners (same type+param, resolve=null)
    const staleIdx = _ackListeners.findIndex(
      l => l.type === type && l.expectedParam === expectedParam && l.resolve === null
    );
    if (staleIdx !== -1) _ackListeners.splice(staleIdx, 1);

    // Check for ACK that arrived before this call (received=true, no resolve)
    const existingIdx = _ackListeners.findIndex(
      l => l.type === type && l.expectedParam === expectedParam && l.received && !l.resolve
    );
    if (existingIdx !== -1) {
      // ACK 已经提前到达，直接 resolve
      _ackListeners.splice(existingIdx, 1);
      resolve(true);
      return;
    }

    // 正常注册监听器
    const listener = {
      type, expectedParam, received: false, resolve: null, timer: null
    };

    listener.timer = setTimeout(() => {
      const idx = _ackListeners.indexOf(listener);
      if (idx !== -1) _ackListeners.splice(idx, 1);
      resolve(false);
    }, timeout);

    listener.resolve = resolve;
    _ackListeners.push(listener);
  });
}

// ★ 提前注册一个 ACK 监听槽（发包前调用，防止 ACK 比 await 先到被丢弃）
function preRegisterACK(type, expectedParam = null) {
  // 避免重复注册
  const exists = _ackListeners.find(
    l => l.type === type && l.expectedParam === expectedParam
  );
  if (exists) return;

  _ackListeners.push({
    type,
    expectedParam,
    received: false,
    resolve: null,   // 还没有 promise，收到 ACK 时只标记 received=true
    timer: null
  });
}

// ============================================================
// High-level: Connect and prepare
// ============================================================

async function prepareConnection(devId) {
  await connect(devId);
  await sleep(500);       // 等连接稳定再协商 MTU
  await negotiateMTU(512);

  const services = await discoverServices();
  const targetService = services.find(s => s.uuid.toLowerCase() === SERVICE_UUID.toLowerCase());
  if (!targetService) throw new Error('Service not found');
  _serviceId = targetService.uuid;
  console.log('[BLE] serviceId (device):', _serviceId);

  const chars = await discoverCharacteristics(_serviceId);
  chars.forEach(c => console.log('[BLE] char:', c.uuid, JSON.stringify(c.properties)));

  const rxChar = chars.find(c => c.uuid.toLowerCase() === CHAR_UUID_RX.toLowerCase());
  const txChar = chars.find(c => c.uuid.toLowerCase() === CHAR_UUID_TX.toLowerCase());

  if (!rxChar) throw new Error('RX characteristic not found');
  if (!txChar) throw new Error('TX characteristic not found');

  _rxCharUUID = rxChar.uuid;
  _txCharUUID = txChar.uuid;
  console.log('[BLE] rxCharUUID (device):', _rxCharUUID);
  console.log('[BLE] txCharUUID (device):', _txCharUUID);

  setupACKListener();
  await enableNotify();
  await sleep(200);

  console.log('[BLE] Connection prepared, MTU:', mtu);
  return { mtu };
}

// ============================================================
// Send bitmap layers
// ============================================================

async function sendLayer(layerType, bitmapData, totalLayerCount, onProgress) {
  const chunkPayloadSize = mtu - 3;
  const totalChunks = Math.ceil(bitmapData.byteLength / chunkPayloadSize);

  // ★ 修复：MTU=20 时每包仅 17 字节，WRITE_NR 高速并发严重丢包。
  //   根据实际 MTU 动态调整并发数和包间延迟：
  //   - MTU<=23  → 串行发送 + 10ms 间隔（最保守，彻底避免丢包）
  //   - MTU<=100 → 并发 2 + 5ms 间隔
  //   - MTU>100  → 并发 4，无额外延迟（高速通道）
  const CONCURRENT   = mtu <= 23 ? 1  : mtu <= 100 ? 2  : 4;
  const BATCH_DELAY  = mtu <= 23 ? 10 : mtu <= 100 ? 5  : 0;  // ms

  console.log(`[BLE] Layer ${layerType}: size=${bitmapData.byteLength} chunks=${totalChunks} mtu=${mtu} concurrent=${CONCURRENT} batchDelay=${BATCH_DELAY}ms`);

  preRegisterACK(ACK_LAYER_DONE, layerType);

  // 发送 Header
  const header = new ArrayBuffer(10);
  const h = new Uint8Array(header);
  h[0] = MAGIC_0; h[1] = MAGIC_1;
  h[2] = totalLayerCount; h[3] = layerType;
  h[4] = bitmapData.byteLength & 0xFF;
  h[5] = (bitmapData.byteLength >> 8) & 0xFF;
  h[6] = (bitmapData.byteLength >> 16) & 0xFF;
  h[7] = (bitmapData.byteLength >> 24) & 0xFF;
  h[8] = totalChunks & 0xFF;
  h[9] = (totalChunks >> 8) & 0xFF;

  await writeToRX(header);
  const headerAcked = await waitForACK(ACK_HEADER, 5000);
  if (!headerAcked) throw new Error('Header ACK timeout for layer ' + layerType);

  // 批量发送
  const data = new Uint8Array(bitmapData);
  let offset = 0, seq = 0;

  while (offset < data.length) {
    const batch = [];

    for (let b = 0; b < CONCURRENT && offset < data.length; b++) {
      const chunkLen = Math.min(chunkPayloadSize, data.length - offset);
      const packet = new ArrayBuffer(2 + chunkLen);
      const p = new Uint8Array(packet);
      p[0] = seq & 0xFF; p[1] = (seq >> 8) & 0xFF;
      p.set(data.slice(offset, offset + chunkLen), 2);

      batch.push(writeToRX(packet));
      offset += chunkLen;
      seq++;
    }

    try {
      await Promise.all(batch);
    } catch (e) {
      throw new Error(`Write failed at seq ${seq}: ${e.errMsg || e.message}`);
    }

    // ★ MTU 较小时批次间加延迟，给 ESP32 BLE 栈缓冲区喘息时间
    if (BATCH_DELAY > 0) await sleep(BATCH_DELAY);

    if (onProgress && (seq % 50 === 0 || offset >= data.length)) {
      onProgress({
        layer: layerType,
        sent: offset,
        total: data.length,
        percent: Math.round(offset / data.length * 100)
      });
    }
  }

  console.log(`[BLE] Layer ${layerType}: all ${seq} chunks sent, waiting for done ACK...`);

  const layerAcked = await waitForACK(ACK_LAYER_DONE, 60000, layerType);
  if (!layerAcked) throw new Error(
    `Layer done ACK timeout for layer ${layerType} ` +
    `(sent ${seq}/${totalChunks} chunks, mtu=${mtu}). ` +
    `ESP32 may have missed packets — check serial log for rx_offset vs rx_size.`
  );

  console.log(`[BLE] Layer ${layerType} done`);
  return true;
}

async function sendBitmap(blackData, redData, onProgress) {
  if (!connected || !_rxCharUUID || !_txCharUUID) throw new Error('Not connected or not ready');

  const hasBlack = blackData && blackData.byteLength > 0;
  const hasRed   = redData   && redData.byteLength > 0;
  const totalLayerCount = (hasBlack ? 1 : 0) + (hasRed ? 1 : 0);

  preRegisterACK(ACK_REFRESHED);
  // Clear any stale listeners from previous transmissions
  _ackListeners.length = 0;

  // Brief pause to let ESP32 settle after previous refresh cycle
  await sleep(500);

  if (hasBlack) {
    await sendLayer(0, blackData, totalLayerCount, onProgress);
    // Inter-layer pause: give ESP32 time to process and BLE buffers to drain
    await sleep(800);
  }
  if (hasRed) {
    await sendLayer(1, redData, totalLayerCount, onProgress);
  }

  const refreshed = await waitForACK(ACK_REFRESHED, 60000);
  if (!refreshed) console.warn('[BLE] Refresh ACK timeout');
  return true;
}

// ============================================================
// Helpers
// ============================================================

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function isConnected() { return connected; }
function getDeviceId() { return deviceId; }

module.exports = {
  SERVICE_UUID,
  initBluetooth, startScan, connect, disconnect,
  prepareConnection, sendBitmap, setupACKListener,
  isConnected, getDeviceId, sleep,
  setDisplayConfig, getEPDWidth, getEPDHeight, getLayerSize
};