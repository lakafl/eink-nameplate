#include <Arduino.h>
#include <GxEPD2_3C.h>
#include <SPI.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <esp_gap_ble_api.h>
#include <BLEClient.h>

// ---- Pin definitions (ESP32-C3) ----
#define BUSY_PIN 10
#define RST_PIN  2
#define DC_PIN   3
#define CS_PIN   7
#define SCK_PIN  4
#define SDI_PIN  5

// ---- Display dimensions ----
#define EPD_WIDTH  640
#define EPD_HEIGHT 384
#define LAYER_SIZE (EPD_WIDTH * EPD_HEIGHT / 8)   // 30720 bytes

// ---- BLE UUIDs ----
#define SERVICE_UUID "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHAR_UUID_RX "beb5483e-36e1-4688-b7f5-ea07361b26a8"   // Write (App → MCU)
#define CHAR_UUID_TX "beb5483e-36e1-4688-b7f5-ea07361b26a9"   // Notify (MCU → App)

// ---- Protocol constants ----
#define MAGIC_0  0xAA
#define MAGIC_1  0x55
#define ACK_HEADER     0x01
#define ACK_CHUNK      0x02
#define ACK_LAYER_DONE 0x03
#define ACK_REFRESHED  0x04

// ---- GxEPD2 display object ----
GxEPD2_3C<GxEPD2_750c, GxEPD2_750c::HEIGHT> display(
    GxEPD2_750c(CS_PIN, DC_PIN, RST_PIN, BUSY_PIN));

// ---- Bitmap buffers ----
uint8_t bmp_black[LAYER_SIZE];
uint8_t bmp_red[LAYER_SIZE];

// ---- Transfer state ----
volatile bool     header_ok      = false;
volatile uint8_t  total_layers   = 0;
volatile uint8_t  rx_layer       = 0;
volatile uint32_t rx_size        = 0;
volatile uint32_t rx_offset      = 0;
volatile bool     layer_done[2]  = {false, false};
volatile bool     do_refresh     = false;
volatile bool     rle_compressed = false;   // 当前图层是否 RLE 压缩
static uint32_t   progress_mark  = 0;       // for sparse progress logging

// ★ RLE 解压临时缓冲区（压缩数据先写入图层 buffer，解压时以此为临时输出）
static uint8_t rle_temp[LAYER_SIZE];

// ---- BLE objects ----
static BLEServer*         pServer = nullptr;
static BLEService*        pService = nullptr;
static BLECharacteristic* pCharRX = nullptr;
static BLECharacteristic* pCharTX = nullptr;
static bool               deviceConnected = false;

// ============================================================
// RLE 解压：字节级 run-length encoding
// 格式：[count-1][value] 对，count 范围 1-256，存储为 0-255
// ============================================================
void decompressRLE(const uint8_t* src, size_t src_len, uint8_t* dst, size_t dst_size)
{
    size_t di = 0, si = 0;
    while (si < src_len && di < dst_size) {
        uint16_t count = (uint16_t)src[si] + 1;   // 1-256，uint16 防止溢出
        uint8_t  value = src[si + 1];
        si += 2;
        for (uint16_t i = 0; i < count && di < dst_size; i++) {
            dst[di++] = value;
        }
    }
}

// ============================================================
// BLE Write callback: App → MCU
// ============================================================
class RxCallback : public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic* pChar) override {
        std::string val = pChar->getValue();
        const uint8_t* d = (const uint8_t*)val.data();
        size_t len = val.length();
        if (len == 0) return;

        // --- Header packet: [AA 55] [total_layers] [layer|flags] [size 4B LE] [chunks 2B LE] ---
        if (len >= 10 && d[0] == MAGIC_0 && d[1] == MAGIC_1) {
            total_layers   = d[2];
            rle_compressed = (d[3] & 0x80) != 0;   // bit7 = RLE compression flag
            rx_layer       = d[3] & 0x7F;           // 真实图层号 0/1
            rx_size        = d[4] | ((uint32_t)d[5] << 8) | ((uint32_t)d[6] << 16) | ((uint32_t)d[7] << 24);
            uint16_t chunks = d[8] | ((uint16_t)d[9] << 8);
            rx_offset      = 0;
            header_ok      = true;
            progress_mark  = 0;

            // 传输期间减少日志，仅打印 Header 摘要
            // Serial.printf("[RX] Header: layers=%d layer=%d rle=%d size=%u chunks=%u\n",
            //               total_layers, rx_layer, rle_compressed, rx_size, chunks);

            uint8_t ack[] = {ACK_HEADER};
            pCharTX->setValue(ack, 1);
            pCharTX->notify();
            return;
        }

        // --- Data chunk: [seq 2B LE] [payload...] ---
        if (header_ok && len >= 2) {
            size_t   plen = len - 2;
            uint8_t* buf  = (rx_layer == 0) ? bmp_black : bmp_red;

            if (rx_offset + plen <= LAYER_SIZE) {
                memcpy(buf + rx_offset, d + 2, plen);
                rx_offset += plen;
            }

            // 传输期间关闭逐包日志以提速
            // if (rx_offset - progress_mark >= 8192) {
            //     Serial.printf("[RX] layer=%d progress %u/%u\n", rx_layer, rx_offset, rx_size);
            //     progress_mark = rx_offset;
            // }

            if (rx_offset >= rx_size) {
                uint8_t* layer_buf = (rx_layer == 0) ? bmp_black : bmp_red;

                // ★ RLE 解压
                if (rle_compressed) {
                    decompressRLE(layer_buf, rx_offset, rle_temp, LAYER_SIZE);
                    memcpy(layer_buf, rle_temp, LAYER_SIZE);
                    Serial.printf("[RX] Layer %d decompressed: %u -> %u bytes\n",
                                  rx_layer, rx_offset, LAYER_SIZE);
                } else {
                    Serial.printf("[RX] Layer %d complete (%u bytes)\n", rx_layer, rx_offset);
                }

                layer_done[rx_layer] = true;
                header_ok = false;

                uint8_t done[] = {ACK_LAYER_DONE, rx_layer};
                pCharTX->setValue(done, 2);
                pCharTX->notify();

                // All layers received?
                if (total_layers == 1 || (layer_done[0] && layer_done[1])) {
                    do_refresh = true;
                }
            } else {
                // ★ 诊断日志：每收满 4KB 打印一次进度，便于排查丢包
                if (rx_offset - progress_mark >= 4096) {
                    Serial.printf("[RX] layer=%d progress %u/%u\n", rx_layer, rx_offset, rx_size);
                    progress_mark = rx_offset;
                }
            }
        }
    }
};

// ============================================================
// BLE Server callbacks: connect / disconnect
// ============================================================
class SrvCallback : public BLEServerCallbacks {
    void onConnect(BLEServer* s) override {
        deviceConnected = true;
        Serial.println("[BLE] Connected");
        // 请求高速连接间隔 (7.5ms~15ms, 延迟=0)
        uint16_t cid = s->getConnId();
        if (cid != 0xFFFF) {
            auto peers = s->getPeerDevices(false);
            auto it = peers.find(cid);
            if (it != peers.end()) {
                BLEClient* client = (BLEClient*)it->second.peer_device;
                s->updateConnParams(*client->getPeerAddress().getNative(), 6, 12, 0, 400);
            }
        }
    }
    void onDisconnect(BLEServer* s) override {
        deviceConnected = false;
        Serial.println("[BLE] Disconnected");
        BLEDevice::startAdvertising();
    }
};

// ============================================================
// Draw default "ready" screen
// ============================================================
void showReadyScreen() {
    display.init(0);
    display.setFullWindow();
    display.firstPage();
    do {
        display.fillScreen(GxEPD_WHITE);
        display.setCursor(80, 170);
        display.setTextColor(GxEPD_BLACK);
        display.setTextSize(2);
        display.print("ESP32 Nameplate");
        display.setCursor(80, 210);
        display.setTextSize(1);
        display.print("Waiting for BLE...");
    } while (display.nextPage());
    display.powerOff();
}

// ============================================================
// Refresh e-ink with received bitmaps
// ============================================================
void refreshScreen() {
    Serial.println("[EPD] Refreshing screen...");
    unsigned long t0 = millis();

    display.init(0);
    display.setFullWindow();
    display.firstPage();
    do {
        display.fillScreen(GxEPD_WHITE);
        if (layer_done[0]) {
            display.drawBitmap(0, 0, bmp_black, EPD_WIDTH, EPD_HEIGHT, GxEPD_BLACK);
        }
        if (layer_done[1]) {
            display.drawBitmap(0, 0, bmp_red, EPD_WIDTH, EPD_HEIGHT, GxEPD_RED);
        }
    } while (display.nextPage());
    display.powerOff();

    Serial.printf("[EPD] Refresh done in %lu ms\n", millis() - t0);

    if (deviceConnected) {
        uint8_t ok[] = {ACK_REFRESHED};
        pCharTX->setValue(ok, 1);
        pCharTX->notify();
    }
}

// ============================================================
// Setup
// ============================================================
void setup() {
    Serial.begin(115200);
    delay(500);
    Serial.println("\n=== Electronic Nameplate BLE v1.0 ===");
    Serial.println("[SYS] Boot OK, starting BLE...");

    BLEDevice::setMTU(512);  // ★ 必须在 init() 之前！
    BLEDevice::init("ESP32-NP");

    pServer = BLEDevice::createServer();
    pServer->setCallbacks(new SrvCallback());

    pService = pServer->createService(SERVICE_UUID);

    // ★ 修复：改用 WRITE（带响应）替代 WRITE_NO_RESPONSE。
    //   WRITE_NR 虽然速度略快，但在 MTU=20 + 高速连续写入场景下，
    //   ESP32 BLE 栈接收缓冲区溢出会静默丢包，导致 rx_offset 不足 rx_size
    //   而永远不触发 ACK_LAYER_DONE。WRITE 的 L2CAP 确认机制可彻底避免此问题。
    pCharRX = pService->createCharacteristic(
        CHAR_UUID_RX,
        BLECharacteristic::PROPERTY_WRITE);  // WRITE（带响应，防丢包）
    pCharRX->setCallbacks(new RxCallback());

    pCharTX = pService->createCharacteristic(
        CHAR_UUID_TX,
        BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
    pCharTX->setValue("0");
    pCharTX->addDescriptor(new BLE2902());

    pService->start();

    BLEAdvertising* adv = BLEDevice::getAdvertising();
    adv->addServiceUUID(SERVICE_UUID);
    adv->setScanResponse(true);
    adv->start();

    Serial.println("[BLE] Advertising as 'ESP32-NP'");
    Serial.println("[SYS] BLE ready, now init display...");

    SPI.begin(SCK_PIN, -1, SDI_PIN, CS_PIN);
    Serial.println("[SYS] SPI init done, starting display...");
    showReadyScreen();
    Serial.println("[SYS] Display init done. System ready.");
}

// ============================================================
// Loop
// ============================================================
void loop() {
    if (do_refresh) {
        do_refresh = false;
        refreshScreen();
        layer_done[0] = false;
        layer_done[1] = false;
        total_layers  = 0;
        header_ok     = false;
    }
    delay(50);
}