#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEServer.h>
#include <GxEPD2_3C.h>
#include <Fonts/FreeMonoBold9pt7b.h>

int BUSY_Pin1 = 9;
int BUSY_Pin2 = 10; 
int RES_Pin = 7; 
int DC_Pin = 8; 
int CS_Pin1 = 20;
int CS_Pin2 = 21; 
int SCK_Pin = 5; 
int SDI_Pin = 6; 
int led_pin1= 3;
int led_pin2= 4;


bool newDataAvaliable = false;
bool isConnected = false;

GxEPD2_3C<GxEPD2_420c_GDEY042Z98, GxEPD2_420c_GDEY042Z98::HEIGHT> display1(
  GxEPD2_420c_GDEY042Z98(/*CS=*/ CS_Pin1, /*DC=*/ DC_Pin, /*RST=*/ RES_Pin, /*BUSY=*/ BUSY_Pin1));

GxEPD2_3C<GxEPD2_420c_GDEY042Z98, GxEPD2_420c_GDEY042Z98::HEIGHT> display2(
  GxEPD2_420c_GDEY042Z98(/*CS=*/ CS_Pin2, /*DC=*/ DC_Pin, /*RST=*/ RES_Pin, /*BUSY=*/ BUSY_Pin2));


#define PACKET_HEADER      0xAA
#define PACKET_FOOTER      0x63
#define PACKET_TYPE_RED    0x14
#define PACKET_TYPE_BW     0x25
#define END_PACKET         0xFF
#define BUFFER_SIZE        15000
#define ESP_CS1_1 digitalWrite(CS_Pin1,HIGH)
#define ESP_CS2_1 digitalWrite(CS_Pin2,HIGH)

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
bool isDisplayBusy(int busyPin);
void waitForDisplayReady(int busyPin);
bool pageReady();

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
  SPI.begin (SCK_Pin, 99, SDI_Pin, 99);
  Serial.begin(115200);

  pinMode(CS_Pin1, OUTPUT);
  pinMode(CS_Pin2, OUTPUT);
  pinMode(BUSY_Pin1, INPUT);
  pinMode(BUSY_Pin2, INPUT);
  pinMode(led_pin2, OUTPUT);
  pinMode(led_pin1, OUTPUT);
  digitalWrite(CS_Pin1, HIGH); 
  digitalWrite(CS_Pin2, HIGH); 
  digitalWrite(3,HIGH);
  digitalWrite(4,HIGH);


  initDisplay();
  //updateDisplay();

  BLEDevice::init("E_Ink42_WRITE01");
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
    digitalWrite(CS_Pin2, HIGH);
    display1.init(115200);
    display1.setRotation(0);
    display1.setTextColor(GxEPD_BLACK);
    display1.setFont(&FreeMonoBold9pt7b);
    display1.fillScreen(GxEPD_WHITE);
    display1.setFullWindow();

    digitalWrite(CS_Pin1, HIGH); 
    display2.init(115200);
    display2.setRotation(0);
    display2.setTextColor(GxEPD_BLACK);
    display2.setFont(&FreeMonoBold9pt7b);
    display2.fillScreen(GxEPD_WHITE);
    display2.setFullWindow();
}

void updateDisplay()
{   
    display1.firstPage();
    display2.firstPage();

    do {

    } while (pageReady());
}


bool isDisplayBusy(int busyPin) 
{
  return digitalRead(busyPin) == HIGH; 
}

void waitForDisplayReady(int busyPin) 
{
  while (isDisplayBusy(busyPin)) {
  }
}

bool pageReady()
{
  bool Page1 = true;
  bool Page2 = true;
  if(Page1){
    Page1 = display1.nextPage();
    //Serial.println("refresh Page1");
  }
  if(Page2){
    Page2 = display2.nextPage();
    //Serial.println("refresh Page2");
  }
  if(!Page1 && !Page2){
    Page1 = true;
    Page2 = true;
    return false;
  }
  return true;
}

void ShowBitmap()
{
  display1.setRotation(0);
  display1.setFullWindow();
  display1.firstPage();

  display2.setRotation(0);
  display2.setFullWindow();
  display2.firstPage();

  do {
    display1.fillScreen(GxEPD_WHITE);
    display1.drawInvertedBitmap(0, 0, receiveData_bw, display1.epd2.WIDTH, display1.epd2.HEIGHT, GxEPD_BLACK);
    display1.drawInvertedBitmap(0, 0, receiveData_red, display1.epd2.WIDTH, display1.epd2.HEIGHT, GxEPD_RED);

    display2.fillScreen(GxEPD_WHITE);
    display2.drawInvertedBitmap(0, 0, receiveData_bw, display2.epd2.WIDTH, display2.epd2.HEIGHT, GxEPD_BLACK);
    display2.drawInvertedBitmap(0, 0, receiveData_red, display2.epd2.WIDTH, display2.epd2.HEIGHT, GxEPD_RED);
  } while(pageReady());
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
