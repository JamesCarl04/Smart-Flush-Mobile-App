// ═════════════════════════════════════════════════════════════════════════════
// Smart Flush ESP32 Firmware — Enterprise Edition with Edge Fault Detection
// ═════════════════════════════════════════════════════════════════════════════

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <ESP32Servo.h>

// ── 1. Configuration & Credentials ───────────────────────────────────────────
#define DEVICE_ID             "TOILET_ESP32_01"
#define RESTROOM_LOCATION     "Main Building - 2F - Stall 1"

#define WIFI_SSID             "4th generation"
#define WIFI_PASSWORD         "Behappy@131516"
#define MQTT_BROKER           "ffc98acba62649a5b591fc33df78cc7a.s1.eu.hivemq.cloud"
#define MQTT_PORT             8883
#define MQTT_USER             "hardware_push"
#define MQTT_PASS             "Qhs8wWtUs5U77bg"

// ── 2. Pin Definitions ───────────────────────────────────────────────────────
#define TRIG_PIN              12
#define ECHO_PIN              13
#define PUMP_PIN              14    // Active LOW relay
#define UV_PIN                27    // Active LOW relay
#define SERVO1_PIN            25    // Standard Positional Servo
#define FLOW_PIN              32    // Hall effect flow sensor
#define LED_PIN               2     // Status LED indicator

// ── 3. Operational & Threshold Parameters ─────────────────────────────────────
int DETECTION_THRESHOLD_CM    = 30;     // Max distance for person detection (cm)
int PUMP_DURATION_MS          = 3000;   // Pump active duration (ms)
int UV_DURATION_MS            = 5000;   // UV sterilization duration (ms)
int PERSON_GONE_CONFIRM_MS    = 3000;   // Confirmation delay before closing lid (ms)

#define MIN_EXPECTED_VOLUME_L 0.30      // Min volume (L) in 3s; below this = No Water / Pump Failure
#define LOW_PRESSURE_VOLUME_L 0.80      // Below this = Low pressure warning
#define LEAK_PULSE_THRESHOLD  15        // Flow pulses during STANDBY = Water Leak alert
#define MAX_OCCUPANCY_TIMEOUT 900000    // 15 minutes (ms) = Stuck sensor / Prolonged stall alert

#define SENSOR_GRACE_MS       5000      // Sensor ignore period after opening lid (ms)
#define STANDBY_SETTLE_MS     2000      // Sensor settle period when returning to STANDBY (ms)

#define LID_OPEN_POS          0         // Servo angle for lid open
#define LID_CLOSE_POS         180       // Servo angle for lid closed
#define OPEN_TIME             2500      // Servo travel time (ms)
#define CLOSE_TIME            2500      // Servo travel time (ms)

// ── 4. State Enum ─────────────────────────────────────────────────────────────
enum State {
  STANDBY,
  PERSON_DETECTED,
  LID_OPEN,
  WAITING_FOR_DEPARTURE,
  LID_CLOSING,
  FLUSHING,
  UV_ACTIVE
};

State currentState = STANDBY;

// ── 5. Global Variables & Objects ─────────────────────────────────────────────
Servo servo1;

volatile int pulseCount       = 0;
float totalVolume             = 0;
float flushDuration           = 0;

unsigned long lastUltrasonicPublish = 0;
unsigned long lastDistanceTrigger   = 0;
unsigned long lastReconnectAttempt  = 0;
unsigned long lastLedBlink          = 0;
unsigned long lastLeakCheck         = 0;
unsigned long personGoneTimer       = 0;
unsigned long pumpStartTime         = 0;
unsigned long uvStartTime           = 0;
unsigned long flushStartTime        = 0;
unsigned long lidOpenedAt           = 0;
unsigned long standbyEnteredAt      = 0;
unsigned long stallOccupiedSince    = 0;

float distanceBuffer[5]       = {999, 999, 999, 999, 999};
int distanceIndex             = 0;
bool ledState                 = false;
bool occupancyAlertSent       = false;

WiFiClientSecure espClient;
PubSubClient client(espClient);

// ── 6. Flow Sensor Interrupt ─────────────────────────────────────────────────
void IRAM_ATTR pulseCounter() {
  pulseCount++;
}

// ── 7. Distance Buffer Helper ─────────────────────────────────────────────────
void clearDistanceBuffer() {
  for (int i = 0; i < 5; i++) {
    distanceBuffer[i] = 999.0;
  }
  distanceIndex = 0;
  Serial.printf("[%lu] [SENSOR] Distance buffer reset\n", millis());
}

// ── 8. Alert Publishing Helper ────────────────────────────────────────────────
void publishHardwareAlert(const char* component, const char* message, const char* severity) {
  StaticJsonDocument<256> doc;
  doc["deviceId"]   = DEVICE_ID;
  doc["location"]   = RESTROOM_LOCATION;
  doc["component"]  = component;
  doc["message"]    = message;
  doc["severity"]   = severity; // "critical" | "warning"
  doc["timestamp"]  = millis();

  char buffer[256];
  serializeJson(doc, buffer);
  client.publish("toilet/alerts/hardware", buffer, true);
  Serial.printf("[%lu] [ALERT (%s)] Component '%s': %s\n", millis(), severity, component, message);
}

// ── 9. Servo Functions ────────────────────────────────────────────────────────
void openLid() {
  Serial.printf("[%lu] [LID] Opening — moving servo to %d°\n", millis(), LID_OPEN_POS);
  servo1.attach(SERVO1_PIN);
  delay(10);
  servo1.write(LID_OPEN_POS);
  delay(OPEN_TIME);

  StaticJsonDocument<128> doc;
  doc["deviceId"]  = DEVICE_ID;
  doc["status"]    = "open";
  doc["timestamp"] = millis();
  char buffer[128];
  serializeJson(doc, buffer);
  client.publish("toilet/events/lid", buffer);
}

void closeLid() {
  Serial.printf("[%lu] [LID] Closing — moving servo to %d°\n", millis(), LID_CLOSE_POS);
  if (!servo1.attached()) {
    servo1.attach(SERVO1_PIN);
    delay(10);
  }
  servo1.write(LID_CLOSE_POS);
  delay(CLOSE_TIME);
  servo1.detach();

  StaticJsonDocument<128> doc;
  doc["deviceId"]  = DEVICE_ID;
  doc["status"]    = "closed";
  doc["timestamp"] = millis();
  char buffer[128];
  serializeJson(doc, buffer);
  client.publish("toilet/events/lid", buffer);
}

// ── 10. Distance Measurement ──────────────────────────────────────────────────
float getDistance(bool shouldUpdate = true) {
  if (shouldUpdate && millis() - lastDistanceTrigger >= 200) {
    lastDistanceTrigger = millis();
    digitalWrite(TRIG_PIN, LOW);
    delayMicroseconds(2);
    digitalWrite(TRIG_PIN, HIGH);
    delayMicroseconds(10);
    digitalWrite(TRIG_PIN, LOW);
    long duration = pulseIn(ECHO_PIN, HIGH, 60000);
    float dist = duration / 58.0;
    if (dist > 0 && dist < 400) {
      distanceBuffer[distanceIndex % 5] = dist;
      distanceIndex++;
    }
  }

  float sorted[5];
  memcpy(sorted, distanceBuffer, sizeof(sorted));
  for (int i = 0; i < 4; i++) {
    for (int j = i + 1; j < 5; j++) {
      if (sorted[i] > sorted[j]) {
        float tmp = sorted[i];
        sorted[i] = sorted[j];
        sorted[j] = tmp;
      }
    }
  }
  return sorted[2];
}

void publishDistance(float distance) {
  if (millis() - lastUltrasonicPublish >= 1000) {
    lastUltrasonicPublish = millis();
    StaticJsonDocument<128> doc;
    doc["deviceId"]  = DEVICE_ID;
    doc["distance"]  = distance;
    doc["unit"]      = "cm";
    doc["timestamp"] = millis();
    char buffer[128];
    serializeJson(doc, buffer);
    client.publish("toilet/sensors/ultrasonic", buffer);
  }
}

// ── 11. Leak Detection Monitor ────────────────────────────────────────────────
void checkLeakageInStandby() {
  if (currentState == STANDBY) {
    if (millis() - lastLeakCheck >= 5000) {
      lastLeakCheck = millis();
      if (pulseCount > LEAK_PULSE_THRESHOLD) {
        publishHardwareAlert(
          "water_leak",
          "Continuous water flow detected while toilet is idle (Stuck flapper valve or pipe leakage).",
          "critical"
        );
        noInterrupts();
        pulseCount = 0;
        interrupts();
      }
    }
  }
}

// ── 12. WiFi & MQTT ───────────────────────────────────────────────────────────
void connectWiFi() {
  Serial.printf("[%lu] [WIFI] Connecting to %s...\n", millis(), WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED) {
    if (millis() - start >= 20000) {
      Serial.printf("[%lu] [WIFI] Connection timeout!\n", millis());
      return;
    }
    delay(500);
    Serial.print(".");
  }
  Serial.printf("\n[%lu] [WIFI] Connected! IP: %s\n", millis(), WiFi.localIP().toString().c_str());
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String message = "";
  for (int i = 0; i < length; i++) message += (char)payload[i];
  Serial.printf("[%lu] [MQTT] Received [%s]: %s\n", millis(), topic, message.c_str());

  if (String(topic) == "toilet/commands/pump") {
    digitalWrite(PUMP_PIN, message == "ON" ? LOW : HIGH);
  }
  if (String(topic) == "toilet/commands/uv") {
    digitalWrite(UV_PIN, message == "ON" ? LOW : HIGH);
  }
  if (String(topic) == "toilet/commands/lid") {
    if (message == "OPEN")  openLid();
    if (message == "CLOSE") closeLid();
  }
  if (String(topic) == "toilet/commands/config") {
    StaticJsonDocument<200> doc;
    deserializeJson(doc, message);
    if (doc.containsKey("pumpDuration")) PUMP_DURATION_MS = (int)doc["pumpDuration"] * 1000;
    if (doc.containsKey("uvDuration"))   UV_DURATION_MS   = (int)doc["uvDuration"] * 1000;
    if (doc.containsKey("threshold"))    DETECTION_THRESHOLD_CM = (int)doc["threshold"];
  }
}

bool connectMQTT() {
  Serial.printf("[%lu] [MQTT] Connecting to HiveMQ broker...\n", millis());
  
  const char* willTopic = "toilet/status/lwt";
  const char* willPayload = "{\"status\":\"offline\",\"deviceId\":\"TOILET_ESP32_01\"}";

  if (client.connect("ESP32SmartFlush", MQTT_USER, MQTT_PASS, willTopic, 1, true, willPayload)) {
    Serial.printf("[%lu] [MQTT] Connected successfully!\n", millis());
    client.publish("toilet/status/lwt", "{\"status\":\"online\",\"deviceId\":\"TOILET_ESP32_01\"}", true);

    client.subscribe("toilet/commands/pump");
    client.subscribe("toilet/commands/uv");
    client.subscribe("toilet/commands/lid");
    client.subscribe("toilet/commands/config");
    digitalWrite(LED_PIN, HIGH);
    return true;
  }

  Serial.printf("[%lu] [MQTT] Failed rc=%d\n", millis(), client.state());
  return false;
}

void reconnectMQTT() {
  if (!client.connected() && millis() - lastReconnectAttempt >= 5000) {
    lastReconnectAttempt = millis();
    connectMQTT();
  }
}

void updateLED() {
  if (WiFi.status() != WL_CONNECTED) {
    if (millis() - lastLedBlink >= 200) {
      ledState = !ledState;
      digitalWrite(LED_PIN, ledState);
      lastLedBlink = millis();
    }
  } else if (!client.connected()) {
    if (millis() - lastLedBlink >= 1000) {
      ledState = !ledState;
      digitalWrite(LED_PIN, ledState);
      lastLedBlink = millis();
    }
  } else {
    digitalWrite(LED_PIN, HIGH);
  }
}

// ── 13. State Machine with Fault Detection ────────────────────────────────────
void updateStateMachine(float distance) {
  switch (currentState) {

    case STANDBY:
      if (standbyEnteredAt > 0 && millis() - standbyEnteredAt < STANDBY_SETTLE_MS) {
        break;
      }
      if (distance > 0 && distance < DETECTION_THRESHOLD_CM) {
        currentState = PERSON_DETECTED;
        stallOccupiedSince = millis();
        occupancyAlertSent = false;
        Serial.printf("[%lu] [STATE] STANDBY -> PERSON_DETECTED\n", millis());
      }
      break;

    case PERSON_DETECTED:
      openLid();
      lidOpenedAt     = millis();
      currentState    = LID_OPEN;
      personGoneTimer = 0;
      Serial.printf("[%lu] [STATE] PERSON_DETECTED -> LID_OPEN\n", millis());
      break;

    case LID_OPEN:
      if (millis() - lidOpenedAt < SENSOR_GRACE_MS) {
        break;
      }
      currentState    = WAITING_FOR_DEPARTURE;
      personGoneTimer = 0;
      Serial.printf("[%lu] [STATE] LID_OPEN -> WAITING_FOR_DEPARTURE\n", millis());
      break;

    case WAITING_FOR_DEPARTURE:
      {
        bool personPresent = (distance > 0 && distance < DETECTION_THRESHOLD_CM);

        if (personPresent && !occupancyAlertSent) {
          if (millis() - stallOccupiedSince >= MAX_OCCUPANCY_TIMEOUT) {
            publishHardwareAlert(
              "sensor_ultrasonic",
              "Cubicle occupied > 15 mins or ultrasonic sensor lens is obstructed.",
              "warning"
            );
            occupancyAlertSent = true;
          }
        }

        if (!personPresent) {
          if (personGoneTimer == 0) {
            personGoneTimer = millis();
          } else if (millis() - personGoneTimer >= (unsigned long)PERSON_GONE_CONFIRM_MS) {
            personGoneTimer = 0;
            currentState    = LID_CLOSING;
            Serial.printf("[%lu] [STATE] WAITING_FOR_DEPARTURE -> LID_CLOSING\n", millis());
          }
        } else {
          if (personGoneTimer != 0) {
            personGoneTimer = 0;
          }
        }
      }
      break;

    case LID_CLOSING:
      closeLid();
      delay(500);

      pulseCount     = 0;
      totalVolume    = 0;
      flushStartTime = millis();
      pumpStartTime  = millis();
      digitalWrite(PUMP_PIN, LOW);

      {
        StaticJsonDocument<128> doc;
        doc["deviceId"]  = DEVICE_ID;
        doc["status"]    = "active";
        doc["timestamp"] = millis();
        char buffer[128];
        serializeJson(doc, buffer);
        client.publish("toilet/events/pump", buffer);
      }

      currentState = FLUSHING;
      Serial.printf("[%lu] [STATE] LID_CLOSING -> FLUSHING (PUMP ON)\n", millis());
      break;

    case FLUSHING:
      if (millis() - pumpStartTime >= (unsigned long)PUMP_DURATION_MS) {
        digitalWrite(PUMP_PIN, HIGH);
        flushDuration = (millis() - flushStartTime) / 1000.0;

        noInterrupts();
        int pulses = pulseCount;
        pulseCount = 0;
        interrupts();

        float flowRate = (pulses / 7.5);
        totalVolume   += (flowRate / 60.0);

        if (totalVolume < MIN_EXPECTED_VOLUME_L) {
          publishHardwareAlert(
            "pump",
            "No water flow detected during 3s flush cycle. Water supply cutoff or pump failure.",
            "critical"
          );
        } else if (totalVolume < LOW_PRESSURE_VOLUME_L) {
          publishHardwareAlert(
            "waterflow",
            "Low flush volume recorded. Check for weak water pressure or pipe blockage.",
            "warning"
          );
        }

        {
          StaticJsonDocument<128> doc;
          doc["deviceId"]  = DEVICE_ID;
          doc["volume"]    = totalVolume;
          doc["duration"]  = flushDuration;
          doc["unit"]      = "L";
          char buffer[128];
          serializeJson(doc, buffer);
          client.publish("toilet/sensors/waterflow", buffer);
        }

        {
          StaticJsonDocument<128> doc;
          doc["deviceId"]  = DEVICE_ID;
          doc["status"]    = "inactive";
          doc["timestamp"] = millis();
          char buffer[128];
          serializeJson(doc, buffer);
          client.publish("toilet/events/pump", buffer);
        }

        Serial.printf("[%lu] [PUMP] OFF — %.2f L in %.1f s\n", millis(), totalVolume, flushDuration);

        digitalWrite(UV_PIN, LOW);
        uvStartTime  = millis();
        currentState = UV_ACTIVE;
        Serial.printf("[%lu] [STATE] FLUSHING -> UV_ACTIVE (UV ON)\n", millis());
      }
      break;

    case UV_ACTIVE:
      if (millis() - uvStartTime >= (unsigned long)UV_DURATION_MS) {
        digitalWrite(UV_PIN, HIGH);

        {
          StaticJsonDocument<128> doc;
          doc["deviceId"]  = DEVICE_ID;
          doc["duration"]  = UV_DURATION_MS / 1000;
          doc["completed"] = true;
          doc["timestamp"] = millis();
          char buffer[128];
          serializeJson(doc, buffer);
          client.publish("toilet/events/uv", buffer);
        }

        Serial.printf("[%lu] [UV] OFF — cycle complete\n", millis());

        clearDistanceBuffer();
        standbyEnteredAt = millis();
        currentState = STANDBY;
        Serial.printf("[%lu] [STATE] UV_ACTIVE -> STANDBY (Ready)\n", millis());
      }
      break;
  }
}

// ── 14. Setup ─────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);

  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(PUMP_PIN, OUTPUT);
  pinMode(UV_PIN,   OUTPUT);
  pinMode(LED_PIN,  OUTPUT);

  digitalWrite(PUMP_PIN, HIGH);
  digitalWrite(UV_PIN,   HIGH);
  digitalWrite(LED_PIN,  LOW);

  servo1.detach();

  pinMode(FLOW_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(FLOW_PIN), pulseCounter, RISING);

  espClient.setInsecure();
  connectWiFi();
  client.setServer(MQTT_BROKER, MQTT_PORT);
  client.setCallback(mqttCallback);
  connectMQTT();

  Serial.printf("[%lu] [SYSTEM] Smart Flush ready on STANDBY\n", millis());
}

// ── 15. Main Loop ─────────────────────────────────────────────────────────────
void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }

  if (!client.connected()) {
    reconnectMQTT();
  }
  client.loop();

  bool sensorRelevant = (currentState == STANDBY ||
                         currentState == PERSON_DETECTED ||
                         currentState == LID_OPEN ||
                         currentState == WAITING_FOR_DEPARTURE);

  float distance = getDistance(sensorRelevant);

  if (client.connected()) {
    publishDistance(distance);
  }

  updateStateMachine(distance);
  checkLeakageInStandby();
  updateLED();
}
