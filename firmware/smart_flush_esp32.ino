// ═════════════════════════════════════════════════════════════════════════════
// Smart Flush ESP32 Firmware — Enterprise Edition with Live Serial Telemetry
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
#define OPEN_TIME             2000      // Servo travel time (ms)
#define CLOSE_TIME            2000      // Servo travel time (ms)

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

const char* getStateName(State s) {
  switch (s) {
    case STANDBY:               return "STANDBY";
    case PERSON_DETECTED:       return "PERSON_DETECTED";
    case LID_OPEN:              return "LID_OPEN";
    case WAITING_FOR_DEPARTURE: return "WAITING_FOR_DEPARTURE";
    case LID_CLOSING:           return "LID_CLOSING";
    case FLUSHING:              return "FLUSHING";
    case UV_ACTIVE:             return "UV_ACTIVE";
    default:                    return "UNKNOWN";
  }
}

// ── 5. Global Variables & Objects ─────────────────────────────────────────────
Servo servo1;

volatile int pulseCount       = 0;
float totalVolume             = 0;
float flushDuration           = 0;

unsigned long lastUltrasonicPublish = 0;
unsigned long lastDistanceTrigger   = 0;
unsigned long lastSerialTelemetry   = 0;
unsigned long lastDeparturePrint    = 0;
unsigned long lastGracePrint        = 0;
unsigned long lastFlushPrint        = 0;
unsigned long lastUvPrint           = 0;
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
uint8_t distanceIndex         = 0;
float lastRawDistance         = 999.0;
bool ledState                 = false;
bool occupancyAlertSent       = false;
bool manualLidOverride        = false; // Set true when opened from dashboard; prevents auto-flush
bool manualFlushOnly          = false; // Set true when flushed from dashboard; prevents auto-UV

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
  Serial.printf("[%lu] [SENSOR] Distance buffer reset to [999, 999, 999, 999, 999]\n", millis());
}

// ── 8. Alert Publishing Helper ────────────────────────────────────────────────
void publishHardwareAlert(const char* component, const char* message, const char* severity) {
  StaticJsonDocument<384> doc;
  doc["deviceId"]   = DEVICE_ID;
  doc["location"]   = RESTROOM_LOCATION;
  doc["component"]  = component;
  doc["message"]    = message;
  doc["severity"]   = severity; // "critical" | "warning"
  doc["timestamp"]  = millis();

  char buffer[384];
  serializeJson(doc, buffer);
  client.publish("toilet/alerts/hardware", buffer, true);
  Serial.println("══════════════════════════════════════════════════════════════");
  Serial.printf(">>> [ALERT (%s)] Component '%s': %s\n", severity, component, message);
  Serial.println("══════════════════════════════════════════════════════════════");
}

// ── 9. Servo Functions ────────────────────────────────────────────────────────
void openLid() {
  Serial.printf("[%lu] [LID] Opening — moving servo to %d°...\n", millis(), LID_OPEN_POS);
  if (!servo1.attached()) {
    servo1.attach(SERVO1_PIN);
    delay(15);
  }
  servo1.write(LID_OPEN_POS);
  delay(OPEN_TIME);
  // CRITICAL: DO NOT detach here! With yarn/cable, the servo must maintain
  // active holding torque at LID_OPEN_POS to keep the lid lifted against gravity.
  Serial.printf("[%lu] [LID] Open position reached. Holding yarn tension at %d°.\n", millis(), LID_OPEN_POS);

  StaticJsonDocument<128> doc;
  doc["deviceId"]  = DEVICE_ID;
  doc["status"]    = "open";
  doc["timestamp"] = millis();
  char buffer[128];
  serializeJson(doc, buffer);
  client.publish("toilet/events/lid", buffer);
}

void closeLid() {
  Serial.printf("[%lu] [LID] Closing — moving servo to %d°...\n", millis(), LID_CLOSE_POS);
  if (!servo1.attached()) {
    servo1.attach(SERVO1_PIN);
    delay(15);
  }
  servo1.write(LID_CLOSE_POS);
  delay(CLOSE_TIME);
  servo1.detach(); // Detach once lid is down and resting on bowl
  Serial.printf("[%lu] [LID] Closed position reached. Servo detached.\n", millis());

  StaticJsonDocument<128> doc;
  doc["deviceId"]  = DEVICE_ID;
  doc["status"]    = "closed";
  doc["timestamp"] = millis();
  char buffer[128];
  serializeJson(doc, buffer);
  client.publish("toilet/events/lid", buffer);
}

// ── 10. Distance Measurement with Live Output ─────────────────────────────────
float getDistance(bool shouldUpdate = true) {
  if (shouldUpdate && millis() - lastDistanceTrigger >= 200) {
    lastDistanceTrigger = millis();
    digitalWrite(TRIG_PIN, LOW);
    delayMicroseconds(2);
    digitalWrite(TRIG_PIN, HIGH);
    delayMicroseconds(10);
    digitalWrite(TRIG_PIN, LOW);

    long duration = pulseIn(ECHO_PIN, HIGH, 30000); // 30ms timeout (~5 meters max)
    
    float dist = 999.0;
    if (duration == 0) {
      dist = 999.0; // Echo timeout (No pulse received on ECHO pin)
    } else {
      dist = duration / 58.0;
      if (dist <= 0 || dist > 400) dist = 999.0;
    }

    lastRawDistance = dist;
    distanceBuffer[distanceIndex % 5] = dist;
    distanceIndex = (distanceIndex + 1) % 5;
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
  return sorted[2]; // Median
}

void publishDistance(float distance) {
  if (millis() - lastUltrasonicPublish >= 1000) {
    lastUltrasonicPublish = millis();
    StaticJsonDocument<128> doc;
    doc["deviceId"]  = DEVICE_ID;
    doc["distance"]  = (distance >= 999.0) ? -1 : distance;
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

      noInterrupts();
      int idlePulses = pulseCount;
      pulseCount = 0; // Clear window so pulses don't accumulate indefinitely
      interrupts();

      if (idlePulses > LEAK_PULSE_THRESHOLD) {
        Serial.printf("\n>>> [LEAK TRIGGERED] Registered %d pulses in 5s! (Threshold is %d)\n",
                      idlePulses, LEAK_PULSE_THRESHOLD);
        publishHardwareAlert(
          "water_leak",
          "Continuous water flow detected while toilet is idle (Stuck flapper valve or pipe leakage).",
          "critical"
        );
      } else {
        Serial.printf("[%lu] [LEAK MONITOR] Standby idle flow check: %d pulses in 5s (Limit: %d) -> Pipe OK\n",
                      millis(), idlePulses, LEAK_PULSE_THRESHOLD);
      }
    }
  }
}

// ── 12. WiFi & MQTT ───────────────────────────────────────────────────────────
void publishSystemState(const char* stateStr, bool occupied, const char* lidStr) {
  StaticJsonDocument<192> doc;
  doc["deviceId"]  = DEVICE_ID;
  doc["state"]     = stateStr;
  doc["occupied"]  = occupied;
  doc["lid"]       = lidStr;
  doc["timestamp"] = millis();

  char buffer[192];
  serializeJson(doc, buffer);
  client.publish("toilet/status/state", buffer, true);
  Serial.printf("[%lu] [STATE BROADCAST] State: %s | Occupied: %s | Lid: %s\n",
                millis(), stateStr, occupied ? "YES" : "NO", lidStr);
}

void connectWiFi() {
  Serial.printf("\n[%lu] [WIFI] Connecting to '%s'...\n", millis(), WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED) {
    if (millis() - start >= 15000) {
      Serial.printf("[%lu] [WIFI] Connection timeout! Will retry in main loop...\n", millis());
      return;
    }
    delay(500);
    Serial.print(".");
  }
  Serial.printf("\n[%lu] [WIFI] Connected! IP: %s | RSSI: %d dBm\n",
                millis(), WiFi.localIP().toString().c_str(), WiFi.RSSI());
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String message = "";
  for (int i = 0; i < length; i++) message += (char)payload[i];
  String strTopic = String(topic);
  Serial.printf("[%lu] [MQTT RECEIVED] [%s]: %s\n", millis(), topic, message.c_str());

  // ═════════════════════════════════════════════════════════════════════════════
  // SAFETY INTERLOCK: Actuator commands ONLY permitted when IDLE (STANDBY) & VACANT!
  // ═════════════════════════════════════════════════════════════════════════════
  bool isActuatorCmd = (strTopic == "toilet/commands/pump" ||
                        strTopic == "toilet/commands/uv"   ||
                        strTopic == "toilet/commands/lid");

  if (isActuatorCmd) {
    // Explicitly allow closing the lid if it was opened manually from the dashboard
    bool isClosingManualLid = (strTopic == "toilet/commands/lid" && message == "CLOSE" && currentState == LID_OPEN && manualLidOverride);
    
    // Always allow emergency stop / OFF commands
    bool isEmergencyStop = (message == "OFF");

    if (!isClosingManualLid && !isEmergencyStop) {
      // 1. Block if toilet is in an active cycle or occupied
      if (currentState != STANDBY) {
        Serial.println("══════════════════════════════════════════════════════════════");
        Serial.printf(">>> [SAFETY INTERLOCK BLOCKED] Remote command '%s' REJECTED!\n", message.c_str());
        Serial.printf("    Reason: Toilet is busy in state '%s'. Controls are locked to protect user.\n",
                      getStateName(currentState));
        Serial.println("══════════════════════════════════════════════════════════════");
        publishHardwareAlert("manual_control", "Remote command blocked: Stall is currently OCCUPIED or active.", "warning");
        return;
      }

      // 2. Block even in STANDBY if a person is standing in front of the sensor
      if (lastRawDistance > 0 && lastRawDistance < DETECTION_THRESHOLD_CM) {
        Serial.println("══════════════════════════════════════════════════════════════");
        Serial.printf(">>> [SAFETY INTERLOCK BLOCKED] Remote command '%s' REJECTED!\n", message.c_str());
        Serial.printf("    Reason: Person detected entering stall (Dist: %.1f cm < %d cm).\n",
                      lastRawDistance, DETECTION_THRESHOLD_CM);
        Serial.println("══════════════════════════════════════════════════════════════");
        publishHardwareAlert("manual_control", "Remote command blocked: Person detected in stall.", "warning");
        return;
      }
    }
  }

  // ── Authorized Idle Commands ────────────────────────────────────────────────
  if (strTopic == "toilet/commands/pump") {
    if (message == "ON") {
      // Safe Manual Flush: Triggers normal timed cycle without auto-UV
      Serial.printf("[%lu] [MANUAL FLUSH] Initiated from Web App (Timed for %d ms)\n", millis(), PUMP_DURATION_MS);
      manualFlushOnly = true; // Prevents auto-UV after manual flush test
      closeLid(); // Ensure lid is down before flushing
      noInterrupts();
      pulseCount = 0;
      interrupts();
      totalVolume    = 0;
      flushStartTime = millis();
      pumpStartTime  = millis();
      digitalWrite(PUMP_PIN, LOW);
      currentState = FLUSHING;
      publishSystemState("FLUSHING", false, "closed");
    } else {
      digitalWrite(PUMP_PIN, HIGH);
      manualFlushOnly = false;
      if (currentState == FLUSHING) {
        currentState = STANDBY;
        standbyEnteredAt = millis();
        publishSystemState("STANDBY", false, "closed");
      }
      Serial.printf("[%lu] [COMMAND] Pump forced OFF\n", millis());
    }
  }

  if (strTopic == "toilet/commands/uv") {
    if (message == "ON") {
      // Safe Manual UV: Closes lid first for eye/skin safety, then runs timed cycle
      Serial.printf("[%lu] [MANUAL UV] Initiated from Web App (Timed for %d ms)\n", millis(), UV_DURATION_MS);
      closeLid();
      digitalWrite(UV_PIN, LOW);
      uvStartTime = millis();
      currentState = UV_ACTIVE;
      publishSystemState("UV_ACTIVE", false, "closed");
    } else {
      digitalWrite(UV_PIN, HIGH);
      Serial.printf("[%lu] [COMMAND] UV forced OFF\n", millis());
      if (currentState == UV_ACTIVE) {
        currentState = STANDBY;
        standbyEnteredAt = millis();
        publishSystemState("STANDBY", false, "closed");
      }
    }
  }

  if (strTopic == "toilet/commands/lid") {
    if (message == "OPEN") {
      openLid();
      currentState = LID_OPEN;
      lidOpenedAt = millis();
      manualLidOverride = true; // Suspends autonomous departure/flush!
      publishSystemState("LID_OPEN", false, "open");
      Serial.printf("[%lu] [MANUAL LID] Lid opened via dashboard. Autonomous auto-flush suspended.\n", millis());
    }
    if (message == "CLOSE") {
      closeLid();
      manualLidOverride = false;
      currentState = STANDBY;
      standbyEnteredAt = millis();
      publishSystemState("STANDBY", false, "closed");
      Serial.printf("[%lu] [MANUAL LID] Lid closed via dashboard. System returned to STANDBY.\n", millis());
    }
  }

  if (strTopic == "toilet/commands/config") {
    StaticJsonDocument<200> doc;
    deserializeJson(doc, message);
    if (doc.containsKey("pumpDuration")) {
      PUMP_DURATION_MS = (int)doc["pumpDuration"] * 1000;
      Serial.printf("[%lu] [CONFIG] Pump Duration updated: %d ms\n", millis(), PUMP_DURATION_MS);
    }
    if (doc.containsKey("uvDuration")) {
      UV_DURATION_MS = (int)doc["uvDuration"] * 1000;
      Serial.printf("[%lu] [CONFIG] UV Duration updated: %d ms\n", millis(), UV_DURATION_MS);
    }
    if (doc.containsKey("threshold")) {
      DETECTION_THRESHOLD_CM = (int)doc["threshold"];
      Serial.printf("[%lu] [CONFIG] Detection Threshold updated: %d cm\n", millis(), DETECTION_THRESHOLD_CM);
    }
  }
}

bool connectMQTT() {
  Serial.printf("[%lu] [MQTT] Connecting to HiveMQ broker (%s:%d)...\n", millis(), MQTT_BROKER, MQTT_PORT);
  
  String clientId = "ESP32SmartFlush_" + String(DEVICE_ID);
  const char* willTopic = "toilet/status/lwt";
  const char* willPayload = "{\"status\":\"offline\",\"deviceId\":\"" DEVICE_ID "\"}";

  if (client.connect(clientId.c_str(), MQTT_USER, MQTT_PASS, willTopic, 1, true, willPayload)) {
    Serial.printf("[%lu] [MQTT] Connected successfully as '%s'!\n", millis(), clientId.c_str());
    client.publish("toilet/status/lwt", "{\"status\":\"online\",\"deviceId\":\"" DEVICE_ID "\"}", true);

    client.subscribe("toilet/commands/pump");
    client.subscribe("toilet/commands/uv");
    client.subscribe("toilet/commands/lid");
    client.subscribe("toilet/commands/config");
    Serial.printf("[%lu] [MQTT] Subscribed to command topics\n", millis());
    digitalWrite(LED_PIN, HIGH);
    return true;
  }

  Serial.printf("[%lu] [MQTT] Connection failed, rc=%d (Will retry in 5s)\n", millis(), client.state());
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

// ── 13. State Machine with Verbose Serial Diagnostics ─────────────────────────
void updateStateMachine(float distance) {
  // Safety check: Never leave pump on outside FLUSHING state
  if (currentState != FLUSHING && digitalRead(PUMP_PIN) == LOW) {
    digitalWrite(PUMP_PIN, HIGH);
    Serial.printf("[%lu] [SAFETY INTERLOCK] Pump was active outside FLUSHING! Forcing PUMP OFF.\n", millis());
  }

  switch (currentState) {

    case STANDBY:
      if (standbyEnteredAt > 0 && millis() - standbyEnteredAt < STANDBY_SETTLE_MS) {
        break; // Settling period
      }
      if (distance > 0 && distance < DETECTION_THRESHOLD_CM) {
        Serial.println("\n────────────────────────────────────────────────────────────");
        Serial.printf("[%lu] >>> [EVENT] Person entered stall! (Distance: %.1f cm < %d cm)\n",
                      millis(), distance, DETECTION_THRESHOLD_CM);
        Serial.println("────────────────────────────────────────────────────────────");
        currentState = PERSON_DETECTED;
        stallOccupiedSince = millis();
        occupancyAlertSent = false;
        publishSystemState("PERSON_DETECTED", true, "opening");
      }
      break;

    case PERSON_DETECTED:
      Serial.printf("[%lu] [STATE] PERSON_DETECTED -> Opening lid for user\n", millis());
      openLid();
      lidOpenedAt     = millis();
      currentState    = LID_OPEN;
      personGoneTimer = 0;
      lastGracePrint  = 0;
      publishSystemState("LID_OPEN", true, "open");
      Serial.printf("[%lu] [STATE] LID_OPEN: Starting %d ms sensor grace period...\n", millis(), SENSOR_GRACE_MS);
      break;

    case LID_OPEN:
      {
        if (manualLidOverride) {
          // Lid was opened manually via dashboard/web app!
          // Hold lid open. Do NOT transition to departure tracking, do NOT close, do NOT flush!
          // Safety timeout: Auto-close back to STANDBY (without flushing) if left forgotten for 15 minutes
          if (millis() - lidOpenedAt >= 900000) {
            Serial.printf("[%lu] [MANUAL LID TIMEOUT] 15 mins elapsed. Auto-closing lid back to STANDBY (No Flush).\n", millis());
            closeLid();
            manualLidOverride = false;
            standbyEnteredAt = millis();
            currentState = STANDBY;
            publishSystemState("STANDBY", false, "closed");
          }
          break;
        }

        unsigned long elapsedGrace = millis() - lidOpenedAt;
        if (elapsedGrace < SENSOR_GRACE_MS) {
          if (millis() - lastGracePrint >= 1000) {
            lastGracePrint = millis();
            Serial.printf("[%lu] [LID_OPEN] Grace period remaining: %.1fs\n",
                          millis(), (SENSOR_GRACE_MS - elapsedGrace) / 1000.0);
          }
          break;
        }
        Serial.printf("[%lu] [STATE] Grace period ended. Now actively tracking departure...\n", millis());
        currentState    = WAITING_FOR_DEPARTURE;
        personGoneTimer = 0;
        lastDeparturePrint = 0;
        publishSystemState("OCCUPIED", true, "open");
      }
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
            Serial.printf("[%lu] [DEPARTURE] User no longer detected (Dist: %.1f cm). Starting %d ms confirmation timer...\n",
                          millis(), distance, PERSON_GONE_CONFIRM_MS);
          } else {
            unsigned long absentDuration = millis() - personGoneTimer;
            if (millis() - lastDeparturePrint >= 1000) {
              lastDeparturePrint = millis();
              Serial.printf("[%lu] [DEPARTURE TIMER] Confirming user left... %.1fs / %.1fs (Dist: %.1f cm)\n",
                            millis(), absentDuration / 1000.0, PERSON_GONE_CONFIRM_MS / 1000.0, distance);
            }

            if (absentDuration >= (unsigned long)PERSON_GONE_CONFIRM_MS) {
              personGoneTimer = 0;
              unsigned long totalOccupiedSec = (millis() - stallOccupiedSince) / 1000;
              Serial.println("\n────────────────────────────────────────────────────────────");
              Serial.printf("[%lu] >>> [DEPARTURE CONFIRMED] User departed after %lu seconds. Closing lid & flushing!\n",
                            millis(), totalOccupiedSec);
              Serial.println("────────────────────────────────────────────────────────────");
              currentState = LID_CLOSING;
              publishSystemState("LID_CLOSING", false, "closing");
            }
          }
        } else {
          // Person is still detected in cubicle
          if (personGoneTimer != 0) {
            Serial.printf("[%lu] [DEPARTURE ABORTED] Person re-detected at %.1f cm. Resetting timer.\n", millis(), distance);
            personGoneTimer = 0;
          }
        }
      }
      break;

    case LID_CLOSING:
      closeLid();
      delay(300);

      noInterrupts();
      pulseCount     = 0;
      interrupts();

      totalVolume    = 0;
      flushStartTime = millis();
      pumpStartTime  = millis();
      lastFlushPrint = 0;

      digitalWrite(PUMP_PIN, LOW); // Turn PUMP ON
      Serial.printf("[%lu] [PUMP] PUMP RELAY ON (Active LOW) — Flushing for %d ms...\n", millis(), PUMP_DURATION_MS);

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
      publishSystemState("FLUSHING", false, "closed");
      break;

    case FLUSHING:
      {
        unsigned long elapsedPump = millis() - pumpStartTime;

        // Print live flow pulses during flush every 500ms
        if (millis() - lastFlushPrint >= 500) {
          lastFlushPrint = millis();
          noInterrupts();
          int currentPulses = pulseCount;
          interrupts();
          float estVol = currentPulses / 450.0;
          Serial.printf("[%lu] [FLOW LIVE] Elapsed: %.1fs/%.1fs | Pulses: %d | Volume: %.2f L\n",
                        millis(), elapsedPump / 1000.0, PUMP_DURATION_MS / 1000.0, currentPulses, estVol);
        }

        if (elapsedPump >= (unsigned long)PUMP_DURATION_MS) {
          digitalWrite(PUMP_PIN, HIGH); // Turn PUMP OFF
          flushDuration = (millis() - flushStartTime) / 1000.0;

          noInterrupts();
          int pulses = pulseCount;
          pulseCount = 0;
          interrupts();

          totalVolume = pulses / 450.0; // 450 pulses/L for standard 1/2" flow sensor

          Serial.println("────────────────────────────────────────────────────────────");
          Serial.printf("[%lu] [PUMP] PUMP OFF — Cycle finished. Total: %.2f L (%d pulses) in %.1f s\n",
                        millis(), totalVolume, pulses, flushDuration);
          Serial.println("────────────────────────────────────────────────────────────");

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
          } else {
            Serial.printf("[%lu] [FLOW EVAL] Water volume is NORMAL (%.2f L >= %.2f L)\n",
                          millis(), totalVolume, LOW_PRESSURE_VOLUME_L);
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

          // If this was a manual test flush from the dashboard, return directly to STANDBY (No UV)
          if (manualFlushOnly) {
            manualFlushOnly = false;
            clearDistanceBuffer();
            standbyEnteredAt = millis();
            currentState = STANDBY;
            publishSystemState("STANDBY", false, "closed");
            Serial.printf("[%lu] [MANUAL FLUSH COMPLETE] Flush test finished. Returned directly to STANDBY (No UV).\n", millis());
            break;
          }

          digitalWrite(UV_PIN, LOW); // Turn UV ON (Autonomous flow only)
          uvStartTime  = millis();
          lastUvPrint  = 0;
          currentState = UV_ACTIVE;
          publishSystemState("UV_ACTIVE", false, "closed");
          Serial.printf("[%lu] [UV] UV RELAY ON (Active LOW) — Sterilizing for %d ms...\n", millis(), UV_DURATION_MS);
        }
      }
      break;

    case UV_ACTIVE:
      {
        unsigned long elapsedUv = millis() - uvStartTime;

        if (millis() - lastUvPrint >= 1000) {
          lastUvPrint = millis();
          Serial.printf("[%lu] [UV LIVE] Sterilizing... %.1fs / %.1fs\n",
                        millis(), elapsedUv / 1000.0, UV_DURATION_MS / 1000.0);
        }

        if (elapsedUv >= (unsigned long)UV_DURATION_MS) {
          digitalWrite(UV_PIN, HIGH); // Turn UV OFF
          Serial.printf("[%lu] [UV] UV OFF — Sterilization cycle complete.\n", millis());

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

          clearDistanceBuffer();
          standbyEnteredAt = millis();
          currentState = STANDBY;
          publishSystemState("STANDBY", false, "closed");
          Serial.println("────────────────────────────────────────────────────────────");
          Serial.printf("[%lu] [STATE] Complete cycle finished -> Returned to STANDBY (Ready)\n", millis());
          Serial.println("────────────────────────────────────────────────────────────\n");
        }
      }
      break;
  }
}

// ── 14. Periodic Serial Telemetry ─────────────────────────────────────────────
void printSerialTelemetry(float distance) {
  if (millis() - lastSerialTelemetry >= 800) {
    lastSerialTelemetry = millis();

    // Print live status line for testing and calibrating the sensor
    if (currentState == STANDBY || currentState == WAITING_FOR_DEPARTURE) {
      bool inRange = (distance > 0 && distance < DETECTION_THRESHOLD_CM);
      Serial.printf("[%lu] [%s] Dist: %.1f cm (raw: %.1f cm) | Threshold: %d cm | Detected: %s\n",
                    millis(),
                    getStateName(currentState),
                    distance,
                    lastRawDistance,
                    DETECTION_THRESHOLD_CM,
                    inRange ? "YES (IN RANGE)" : "NO (VACANT)");
    }
  }
}

// ── 15. Setup ─────────────────────────────────────────────────────────────────
void setup() {
  // ── Step 0: CRITICAL HARDWARE SAFETY CLAMP (First CPU instructions) ─────────
  // Clamps active-low relays to HIGH (OFF) in microseconds before any delays run
  digitalWrite(PUMP_PIN, HIGH);
  digitalWrite(UV_PIN,   HIGH);
  digitalWrite(LED_PIN,  LOW);
  digitalWrite(TRIG_PIN, LOW);

  pinMode(PUMP_PIN, OUTPUT);
  pinMode(UV_PIN,   OUTPUT);
  pinMode(LED_PIN,  OUTPUT);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);

  servo1.detach(); // Ensure servo motor is completely unpowered at boot

  Serial.begin(115200);
  delay(300); // Allow UART connection to settle

  Serial.println("\n");
  Serial.println("╔══════════════════════════════════════════════════════════════╗");
  Serial.println("║   SMART FLUSH ESP32 FIRMWARE — LIVE SERIAL TELEMETRY         ║");
  Serial.printf ("║   Device: %-15s Location: %-23s ║\n", DEVICE_ID, "Stall 1");
  Serial.println("╚══════════════════════════════════════════════════════════════╝");
  Serial.printf("[%lu] [INIT] Hardware safety clamp engaged: Relays OFF, Servo detached\n", millis());

  pinMode(FLOW_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(FLOW_PIN), pulseCounter, RISING);
  Serial.printf("[%lu] [INIT] Flow sensor interrupt attached on GPIO %d\n", millis(), FLOW_PIN);

  espClient.setInsecure();
  client.setServer(MQTT_BROKER, MQTT_PORT);
  client.setCallback(mqttCallback);
  client.setBufferSize(512); // Support 256+ byte JSON alerts

  connectWiFi();
  connectMQTT();
  noInterrupts();
  pulseCount = 0; // Clear any power-on contact bounce pulses
  interrupts();

  standbyEnteredAt = millis();
  publishSystemState("STANDBY", false, "closed");
  Serial.printf("[%lu] [SYSTEM] Smart Flush ready on STANDBY. Serial Monitor active at 115200 baud.\n\n", millis());
}

// ── 16. Main Loop ─────────────────────────────────────────────────────────────
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

  // Live Serial Monitor Diagnostics
  printSerialTelemetry(distance);

  updateStateMachine(distance);
  checkLeakageInStandby();
  updateLED();
}
