#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEServer.h>
#include <GxEPD2_3C.h>
#include <Fonts/FreeMonoBold9pt7b.h>
#include <string.h>

int BUSY_Pin = 9; 
int RES_Pin = 7; 
int DC_Pin  = 8; 
int CS_Pin  = 20;
int SCK_Pin = 5; 
int SDI_Pin = 6; 

bool newDataAvaliable = false;
bool isConnected = false; 

GxEPD2_3C<GxEPD2_420c_GDEY042Z98, GxEPD2_420c_GDEY042Z98::HEIGHT> display(
  GxEPD2_420c_GDEY042Z98(/*CS=*/ CS_Pin, /*DC=*/ DC_Pin, /*RST=*/ RES_Pin, /*BUSY=*/ BUSY_Pin));

#define PACKET_HEADER      0xAA
#define PACKET_FOOTER      0x63
#define PACKET_TYPE_RED    0x14
#define PACKET_TYPE_BW     0x25
#define END_PACKET         0xFF
#define BUFFER_SIZE        15000
// See the following for generating UUIDs:
// https://www.uuidgenerator.net/

#define SERVICE_UUID        "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHARACTERISTIC_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"

BLEServer *pServer = nullptr;
BLEAdvertising *pAdvertising = nullptr;
unsigned char receiveData_red[BUFFER_SIZE];
unsigned char receiveData_bw[BUFFER_SIZE];
uint32_t currentIndexred = 0;
uint32_t currentIndexblack = 0;


void initDisplay();
void updateDisplay();

class MyServerCallbacks: public BLEServerCallbacks {
    void onConnect(BLEServer* pServer) {
      isConnected = true;
    }

    void onDisconnect(BLEServer* pServer) {
      isConnected = false;
      BLEDevice::startAdvertising();
      delay(100);
    }
};

class MyCallbacks: public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *pCharacteristic) {
     String rxdata = pCharacteristic->getValue();

    uint8_t endFlag  = rxdata[1];
    uint8_t dataType = rxdata[2];
    uint16_t dataLength = (rxdata[3] << 8) | rxdata[4];

    if(dataType == PACKET_TYPE_RED){
      for(int i = 0;i < dataLength; i++){
        if(currentIndexred < BUFFER_SIZE){
          receiveData_red[currentIndexred++] = rxdata[5+i];
        }
      }
    }else if(dataType == PACKET_TYPE_BW){
      for(int i = 0;i < dataLength; i++){
        if(currentIndexblack < BUFFER_SIZE){
          receiveData_bw[currentIndexblack++] = rxdata[5+i];
        }
      }
    }
    if(endFlag == END_PACKET){
      newDataAvaliable = true;
      currentIndexred = 0;
      currentIndexblack = 0;
    }
  }
};

void setup() {
  SPI.begin (SCK_Pin,99,SDI_Pin,99);

  initDisplay();
  updateDisplay();

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
}

void initDisplay() 
{

    display.init(115200);
    display.setRotation(0); // 根据屏幕方向调整
    display.setTextColor(GxEPD_BLACK);
    display.setFont(&FreeMonoBold9pt7b);
    display.fillScreen(GxEPD_WHITE);//-------------------------------------------
    display.setFullWindow();
}

void updateDisplay()
{
 
    display.firstPage();
    do {
        display.fillScreen(GxEPD_WHITE);
    } while (display.nextPage());
}

void ShowBitmap()
{
  display.setRotation(0);
  display.setFullWindow();
  display.firstPage();

  for(int i=0;i<BUFFER_SIZE;i++){
    receiveData_bw[i] = ~(receiveData_bw[i]);
    receiveData_red[i] = ~(receiveData_red[i]);
  }

  do{
    display.fillScreen(GxEPD_WHITE);

    display.drawInvertedBitmap(0, 0, receiveData_bw, display.epd2.WIDTH, display.epd2.HEIGHT, GxEPD_BLACK);

    display.drawInvertedBitmap(0, 0, receiveData_red, display.epd2.WIDTH, display.epd2.HEIGHT, GxEPD_RED);
  }while(display.nextPage());
}

void loop() {
  if(newDataAvaliable){
    ShowBitmap();
    newDataAvaliable = false;
    currentIndexred=0;
    currentIndexblack=0;
  }
  // put your main code here, to run repeatedly:
  delay(10);
}

