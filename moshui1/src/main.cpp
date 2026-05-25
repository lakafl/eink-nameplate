#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEServer.h>

#include <GxEPD2_3C.h>
#include <Fonts/FreeMonoBold9pt7b.h>
#include <SPI.h>

// ========================
// 引脚定义（与 main1 测试成功的引脚一致）
// ========================
#define BUSY_PIN   10
#define RST_PIN    2
#define DC_PIN     3
#define CS_PIN     7
#define SCK_PIN    4
#define SDI_PIN    5   // MOSI

// ========================
// BLE 与显示状态
// ========================
volatile bool newDataAvaliable = false;
volatile bool isConnected = false;

// ========================
// 墨水屏对象
// GDEW075Z09 (7.5" 640x384 三色)
// 使用通用模板，BUSY 禁用 (-1)，高度 384
// ========================
GxEPD2_3C<GxEPD2_750c, 384> display(
  GxEPD2_750c(CS_PIN, DC_PIN, RST_PIN, -1)
);

// ========================
// 通信协议定义
// ========================
#define PACKET_HEADER      0xAA
#define PACKET_FOOTER      0x63
#define PACKET_TYPE_RED    0x14
#define PACKET_TYPE_BW     0x25
#define END_PACKET         0xFF

// 分辨率 640x384，每个字节存 8 像素
#define BUFFER_SIZE        (640 * 384 / 8)   // 30720

#define SERVICE_UUID        "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHARACTERISTIC_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"

BLEServer *pServer = nullptr;
BLEAdvertising *pAdvertising = nullptr;

unsigned char receiveData_red[BUFFER_SIZE];
unsigned char receiveData_bw[BUFFER_SIZE];

uint32_t currentIndexred = 0;
uint32_t currentIndexblack = 0;

// ========================
// 函数声明
// ========================
void initDisplay();
void showBootScreen();
void clearDisplay();
void ShowBitmap();


// ========================
// BLE Server 回调
// ========================
class MyServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer* pServer) {
    isConnected = true;
    Serial.println("BLE connected");
  }

  void onDisconnect(BLEServer* pServer) {
    isConnected = false;
    Serial.println("BLE disconnected, restart advertising");
    delay(100);
    BLEDevice::startAdvertising();
  }
};


// ========================
// BLE 数据接收回调
// ========================
class MyCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *pCharacteristic) {
    std::string rxdata = pCharacteristic->getValue();

    if (rxdata.length() < 5) {
      Serial.println("Invalid packet: too short");
      return;
    }

    uint8_t header   = (uint8_t)rxdata[0];
    uint8_t endFlag  = (uint8_t)rxdata[1];
    uint8_t dataType = (uint8_t)rxdata[2];
    uint16_t dataLength = ((uint8_t)rxdata[3] << 8) | (uint8_t)rxdata[4];

    if (header != PACKET_HEADER) {
      Serial.println("Invalid packet: wrong header");
      return;
    }

    if (rxdata.length() < 5 + dataLength) {
      Serial.println("Invalid packet: length mismatch");
      return;
    }

    if (dataType == PACKET_TYPE_RED) {
      for (int i = 0; i < dataLength; i++) {
        if (currentIndexred < BUFFER_SIZE) {
          receiveData_red[currentIndexred++] = (uint8_t)rxdata[5 + i];
        }
      }
    } 
    else if (dataType == PACKET_TYPE_BW) {
      for (int i = 0; i < dataLength; i++) {
        if (currentIndexblack < BUFFER_SIZE) {
          receiveData_bw[currentIndexblack++] = (uint8_t)rxdata[5 + i];
        }
      }
    } 
    else {
      Serial.println("Unknown data type");
      return;
    }

    if (endFlag == END_PACKET) {
      Serial.println("Image data received");
      Serial.print("BW data size: ");
      Serial.println(currentIndexblack);
      Serial.print("RED data size: ");
      Serial.println(currentIndexred);

      newDataAvaliable = true;
      currentIndexred = 0;
      currentIndexblack = 0;
    }
  }
};


// ========================
// setup
// ========================
void setup() {
  Serial.begin(115200);
  delay(2000);
  Serial.println("System start");

  // 手动硬件复位（确保屏幕时序稳定）
  pinMode(RST_PIN, OUTPUT);
  digitalWrite(RST_PIN, LOW);
  delay(100);
  digitalWrite(RST_PIN, HIGH);
  delay(500);

  // 初始化 SPI
  SPI.begin(SCK_PIN, -1, SDI_PIN, CS_PIN);

  initDisplay();
  showBootScreen();

  Serial.println("Init BLE");
  BLEDevice::init("E_Ink42");
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());

  BLEService *pService = pServer->createService(SERVICE_UUID);
  BLECharacteristic *pCharacteristic = pService->createCharacteristic(
    CHARACTERISTIC_UUID,
    BLECharacteristic::PROPERTY_READ |
    BLECharacteristic::PROPERTY_WRITE
  );
  pCharacteristic->setAccessPermissions(ESP_GATT_PERM_READ | ESP_GATT_PERM_WRITE);
  pCharacteristic->setCallbacks(new MyCallbacks());
  pService->start();

  pAdvertising = pServer->getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  pAdvertising->start();

  Serial.println("BLE advertising started");
}


// ========================
// 初始化屏幕（仿 main1 安全模式）
// ========================
void initDisplay() {
  Serial.println("Init display");
  // 降速，使用硬件复位，禁用 BUSY 检查
  display.init(115200, true, 2, false);
  display.setRotation(0);
  display.setFullWindow();
  display.setTextColor(GxEPD_BLACK);
  display.setFont(&FreeMonoBold9pt7b);
  Serial.printf("屏幕尺寸: %dx%d\n", display.epd2.WIDTH, display.epd2.HEIGHT);
  Serial.println("Display init done");
}


// ========================
// 开机测试画面
// ========================
void showBootScreen() {
  Serial.println("Show boot screen");

  display.setRotation(0);
  display.setFullWindow();

  display.fillScreen(GxEPD_WHITE);

  display.setCursor(20, 40);
  display.setTextColor(GxEPD_BLACK);
  display.print("E-Ink Display OK");

  display.setCursor(20, 80);
  display.print("GDEW075Z09 640x384");

  display.setCursor(20, 120);
  display.setTextColor(GxEPD_RED);
  display.print("Waiting BLE data...");

  display.display();
  Serial.println("Boot screen finished");
}


// ========================
// 清屏函数
// ========================
void clearDisplay() {
  Serial.println("Clear display");
  display.setFullWindow();
  display.fillScreen(GxEPD_WHITE);
  display.display();
  Serial.println("Clear finished");
}


// ========================
// 显示 BLE 接收到的图片
// ========================
void ShowBitmap() {
  Serial.println("Show bitmap");

  display.setRotation(0);
  display.setFullWindow();

  display.fillScreen(GxEPD_WHITE);

  // 绘制黑白图层
  display.drawInvertedBitmap(
    0, 0,
    receiveData_bw,
    640, 384,      // 实际分辨率
    GxEPD_BLACK
  );

  // 绘制红色图层
  display.drawInvertedBitmap(
    0, 0,
    receiveData_red,
    640, 384,
    GxEPD_RED
  );

  display.display();
  Serial.println("Bitmap display finished");
}


// ========================
// loop
// ========================
void loop() {
  if (newDataAvaliable) {
    Serial.println("New image available");
    ShowBitmap();
    newDataAvaliable = false;
    currentIndexred = 0;
    currentIndexblack = 0;
  }
  delay(100);
}