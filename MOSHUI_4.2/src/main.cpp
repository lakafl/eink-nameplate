#include <Arduino.h>
#include <GxEPD2_3C.h>
#include <SPI.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <esp_gap_ble_api.h>

// ---- Pin definitions (ESP32-C3) ----
#define BUSY_PIN 10
#define RST_PIN  2
#define DC_PIN   3
#define CS_PIN   7
#define SCK_PIN  4
#define SDI_PIN  5

// ---- Display dimensions (4.2" 400x300) ----
#define EPD_WIDTH  400
#define EPD_HEIGHT 300
#define LAYER_SIZE (EPD_WIDTH * EPD_HEIGHT / 8) // 15000 bytes

// ---- BLE UUIDs ----
#define SERVICE_UUID    "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHAR_UUID_RX    "beb5483e-36e1-4688-b7f5-ea07361b26a8" // Write (App -> MCU)
#define CHAR_UUID_TX    "beb5483e-36e1-4688-b7f5-ea07361b26a9" // Notify (MCU -> App)

// ---- Protocol constants ----
#define MAGIC_0        0xAA
#define MAGIC_1        0x55
#define ACK_HEADER     0x01
#define ACK_CHUNK      0x02
#define ACK_LAYER_DONE 0x03
#define ACK_REFRESHED  0x04

// ---- GxEPD2 display object (4.2" 400x300 3-color, GDEY042Z98 / SSD1683) ----
GxEPD2_3C<GxEPD2_420c_GDEY042Z98, GxEPD2_420c_GDEY042Z98::HEIGHT> display(
    GxEPD2_420c_GDEY042Z98(CS_PIN, DC_PIN, RST_PIN, BUSY_PIN));

// ---- Bitmap buffers ----
uint8_t bmp_black[LAYER_SIZE];
uint8_t bmp_red[LAYER_SIZE];

// ---- Transfer state ----
volatile bool     header_ok    = false;
volatile uint8_t  total_layers = 0;
volatile uint8_t  rx_layer     = 0;
volatile uint32_t rx_size      = 0;
volatile uint32_t rx_offset    = 0;
volatile bool     layer_done[2] = {false, false};
volatile bool     do_refresh   = false;
static   uint32_t progress_mark = 0;

// ---- BLE objects ----
static BLEServer         *pServer        = nullptr;
static BLEService        *pService       = nullptr;
static BLECharacteristic *pCharRX        = nullptr;
static BLECharacteristic *pCharTX        = nullptr;
static bool               deviceConnected = false;

// ============================================================
// 统一的屏幕初始化函数
// 修复要点：
//   1. display.init() 完整参数，避免复位时序错误
//   2. SPI.end() + SPI.begin() 重新绑定自定义引脚
//   3. BUSY_PIN 用 INPUT（不用 INPUT_PULLUP，避免与屏幕开漏冲突）
// ============================================================
void initDisplay()
{
    // GxEPD2 init: serial_diag_bitrate=115200, initial=true, reset_duration=10ms, pulldown_rst_mode=false
    // GDEY042Z98 (SSD1683): BUSY=HIGH when busy, push-pull output
    display.init(115200, true, 10, false);

    // display.init() 内部调用了 SPI.begin()（默认引脚），需重新绑定自定义引脚
    SPI.end();
    SPI.begin(SCK_PIN, /*MISO=*/-1, SDI_PIN, CS_PIN);

    // 修复 SPI.begin() 可能覆盖的 BUSY 引脚配置
    // 使用 INPUT（不用 INPUT_PULLUP，e-ink BUSY 为推挽输出，外部上拉会干扰）
    pinMode(BUSY_PIN, INPUT);
}

// ============================================================
// BLE Write callback: App -> MCU
// ============================================================
class RxCallback : public BLECharacteristicCallbacks
{
    void onWrite(BLECharacteristic *pChar) override
    {
        std::string val = pChar->getValue();
        const uint8_t *d = (const uint8_t *)val.data();
        size_t len = val.length();
        if (len == 0) return;

        // --- Header packet: [AA 55] [total_layers] [layer] [size 4B LE] [chunks 2B LE] ---
        if (len >= 10 && d[0] == MAGIC_0 && d[1] == MAGIC_1)
        {
            total_layers  = d[2];
            rx_layer      = d[3];
            rx_size       = d[4] | ((uint32_t)d[5] << 8) | ((uint32_t)d[6] << 16) | ((uint32_t)d[7] << 24);
            uint16_t chunks = d[8] | ((uint16_t)d[9] << 8);
            rx_offset     = 0;
            header_ok     = true;
            progress_mark = 0;

            // 传输期间减少日志，仅打印 Header 摘要
            // Serial.printf("[RX] Header: layers=%d layer=%d size=%u chunks=%u\n",
            //               total_layers, rx_layer, rx_size, chunks);

            uint8_t ack[] = {ACK_HEADER};
            pCharTX->setValue(ack, 1);
            pCharTX->notify();
            return;
        }

        // --- Data chunk: [seq 2B LE] [payload...] ---
        if (header_ok && len >= 2)
        {
            size_t  plen = len - 2;
            uint8_t *buf = (rx_layer == 0) ? bmp_black : bmp_red;

            if (rx_offset + plen <= LAYER_SIZE)
            {
                memcpy(buf + rx_offset, d + 2, plen);
                rx_offset += plen;
            }

            // 传输期间关闭逐包日志以提速
            // if (rx_offset - progress_mark >= 8192)
            // {
            //     Serial.printf("[RX] layer=%d progress %u/%u\n", rx_layer, rx_offset, rx_size);
            //     progress_mark = rx_offset;
            // }

            // Layer complete?
            if (rx_offset >= rx_size)
            {
                layer_done[rx_layer] = true;
                header_ok = false;

                Serial.printf("[RX] Layer %d complete (%u bytes)\n", rx_layer, rx_offset);

                // ★ 修复3：ACK_LAYER_DONE 重发3次，间隔50ms。
                //   单次 notify 在 BLE 栈繁忙时可能被丢弃（indication 才有确认，
                //   notify 没有）。重发是应对 notify 丢失的标准做法。
                uint8_t done[] = {ACK_LAYER_DONE, rx_layer};
                for (int i = 0; i < 3; i++) {
                    pCharTX->setValue(done, 2);
                    pCharTX->notify();
                    if (i < 2) delay(50);
                }

                // All layers received?
                if (total_layers == 1 || (layer_done[0] && layer_done[1]))
                {
                    do_refresh = true;
                }
            }
            else
            {
                // 诊断日志：每收满 4KB 打印一次进度
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
class SrvCallback : public BLEServerCallbacks
{
    void onConnect(BLEServer *s) override
    {
        deviceConnected = true;
        Serial.println("[BLE] Connected");
        // ★ 修复2：移除 onConnect 里的 updateConnParams。
        //   连接参数协商（LL_CONNECTION_UPDATE_IND）会产生约 100-200ms 的通信中断窗口，
        //   若 ACK_LAYER_DONE notify 恰好在此窗口发出，App 端永远收不到。
        //   ESP32-C3 的默认连接间隔（通常 45ms）对本场景完全够用，无需主动协商。
    }
    void onDisconnect(BLEServer *s) override
    {
        deviceConnected = false;
        Serial.println("[BLE] Disconnected");
        BLEDevice::startAdvertising();
    }
};

// ============================================================
// Draw default "ready" screen
// ============================================================
void showReadyScreen()
{
    initDisplay(); // 使用统一初始化函数

    display.setFullWindow();
    display.firstPage();
    do
    {
        display.fillScreen(GxEPD_WHITE);
        display.setCursor(30, 130);
        display.setTextColor(GxEPD_BLACK);
        display.setTextSize(2);
        display.print("ESP32 Nameplate");
        display.setCursor(30, 165);
        display.setTextSize(1);
        display.print("Waiting for BLE...");
    } while (display.nextPage());

    display.powerOff();
}

// ============================================================
// Refresh e-ink with received bitmaps
// ============================================================
void refreshScreen()
{
    Serial.println("[EPD] Refreshing screen...");
    unsigned long t0 = millis();

    initDisplay(); // 使用统一初始化函数

    display.setFullWindow();
    display.firstPage();
    do
    {
        display.fillScreen(GxEPD_WHITE);
        if (layer_done[0])
        {
            display.drawBitmap(0, 0, bmp_black, EPD_WIDTH, EPD_HEIGHT, GxEPD_BLACK);
        }
        if (layer_done[1])
        {
            display.drawBitmap(0, 0, bmp_red, EPD_WIDTH, EPD_HEIGHT, GxEPD_RED);
        }
    } while (display.nextPage());

    display.powerOff();

    Serial.printf("[EPD] Refresh done in %lu ms\n", millis() - t0);

    // ★ 同样重发3次，理由同 ACK_LAYER_DONE
    if (deviceConnected)
    {
        uint8_t ok[] = {ACK_REFRESHED};
        for (int i = 0; i < 3; i++) {
            pCharTX->setValue(ok, 1);
            pCharTX->notify();
            if (i < 2) delay(50);
        }
    }
}

// ============================================================
// Setup
// ============================================================
void setup()
{
    Serial.begin(115200);
    delay(500);
    Serial.println("\n=== Electronic Nameplate BLE v1.0 (4.2\" 400x300) ===");
    Serial.println("[SYS] Boot OK, starting BLE...");

    BLEDevice::setMTU(512);  // ★ 必须在 init() 之前！
    BLEDevice::init("ESP32-NP");

    pServer = BLEDevice::createServer();
    pServer->setCallbacks(new SrvCallback());

    pService = pServer->createService(SERVICE_UUID);

    // ★ 修复1：WRITE_NR 在高速连续写入时 ESP32 BLE 栈会静默丢包，
    //   onWrite 回调不保证每包都触发。改用 WRITE（带 ATT 确认），
    //   每包写入后主机等到 ATT Response 才发下一包，彻底避免丢包。
    pCharRX = pService->createCharacteristic(
        CHAR_UUID_RX,
        BLECharacteristic::PROPERTY_WRITE);
    pCharRX->setCallbacks(new RxCallback());

    pCharTX = pService->createCharacteristic(
        CHAR_UUID_TX,
        BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
    pCharTX->setValue("0");
    pCharTX->addDescriptor(new BLE2902());

    pService->start();

    BLEAdvertising *adv = BLEDevice::getAdvertising();
    adv->addServiceUUID(SERVICE_UUID);
    adv->setScanResponse(true);
    adv->start();

    Serial.println("[BLE] Advertising as 'ESP32-NP'");
    Serial.println("[SYS] BLE ready, now init display...");

    // 注意：不在此处单独调用 SPI.begin()，由 showReadyScreen() -> initDisplay() 统一管理
    showReadyScreen();
    Serial.println("[SYS] Display init done. System ready.");
}

// ============================================================
// Loop
// ============================================================
void loop()
{
    if (do_refresh)
    {
        do_refresh   = false;
        refreshScreen();
        layer_done[0] = false;
        layer_done[1] = false;
        total_layers  = 0;
        header_ok     = false;
    }
    delay(50);
}