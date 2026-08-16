/**
 * Smart Flush Backend MQTT Ingestion & Dispatch Engine
 * 
 * Subscribes to HiveMQ Cloud MQTT Broker, processes edge hardware alerts,
 * auto-creates work orders in Firestore, and sends FCM push notifications.
 * 
 * Usage:
 *   node scripts/backend_mqtt_worker.js
 */

const mqtt = require('mqtt');
const admin = require('firebase-admin');

// 1. Firebase Admin SDK Initialization
// Assumes GOOGLE_APPLICATION_CREDENTIALS environment variable or serviceAccount.json
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
  } catch (err) {
    console.warn('[Firebase] Initializing with default app credentials');
    admin.initializeApp();
  }
}

const db = admin.firestore();
const messaging = admin.messaging();

// 2. MQTT Broker Credentials
const MQTT_CONFIG = {
  host: process.env.MQTT_BROKER || 'ffc98acba62649a5b591fc33df78cc7a.s1.eu.hivemq.cloud',
  port: parseInt(process.env.MQTT_PORT || '8883', 10),
  protocol: 'mqtts',
  username: process.env.MQTT_USER || 'hardware_push',
  password: process.env.MQTT_PASSWORD || 'Qhs8wWtUs5U77bg',
  rejectUnauthorized: false,
};

console.log(`[MQTT] Connecting to ${MQTT_CONFIG.host}:${MQTT_CONFIG.port}...`);
const client = mqtt.connect(MQTT_CONFIG);

client.on('connect', () => {
  console.log('[MQTT] Connected to HiveMQ Broker successfully!');

  // Subscribe to all telemetry, events, alerts, and LWT
  client.subscribe('toilet/alerts/#', (err) => {
    if (!err) console.log('[MQTT] Subscribed to toilet/alerts/#');
  });
  client.subscribe('toilet/status/#', (err) => {
    if (!err) console.log('[MQTT] Subscribed to toilet/status/#');
  });
  client.subscribe('toilet/sensors/#', (err) => {
    if (!err) console.log('[MQTT] Subscribed to toilet/sensors/#');
  });
  client.subscribe('toilet/events/#', (err) => {
    if (!err) console.log('[MQTT] Subscribed to toilet/events/#');
  });
});

client.on('error', (err) => {
  console.error('[MQTT] Connection error:', err.message);
});

// 3. Task Creation & FCM Dispatch Helper
async function handleHardwareAlert(payload) {
  const { deviceId, location, component, message, severity, timestamp } = payload;
  console.log(`[ALERT RECEIVED] Device: ${deviceId} | Component: ${component} | Severity: ${severity}`);

  try {
    // Determine building and floor from location string (e.g. "Main Building - 2F - Stall 1")
    const parts = (location || 'GB3 - 2F - Stall 1').split(' - ');
    const building = parts[0] || 'GB3';
    const floor = parts[1] || '2F';
    const stall = parts[2] || location || 'Restroom 1';

    // 1. Create Task in Firestore
    const taskData = {
      deviceId: deviceId || 'TOILET_ESP32_01',
      restroomName: `${building} ${floor} ${stall}`,
      type: 'maintenance',
      component: component || 'pump',
      location: stall,
      floor: floor,
      building: building,
      shift: '1st',
      triggerType: 'hardware_failure',
      message: message || `Hardware failure detected on ${component}. Immediate inspection required.`,
      status: 'unassigned',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      assignedTo: null,
      createdBy: 'esp32_hardware_edge',
      reassignCount: 0,
      checklist: null,
      remarks: '',
    };

    const taskRef = await db.collection('tasks').add(taskData);
    console.log(`[Firestore] Created task ${taskRef.id} with status: unassigned`);

    // 2. Dispatch FCM Push Notification to Maintenance Topic or available personnel
    const fcmPayload = {
      topic: 'maintenance_alerts',
      notification: {
        title: `🚨 Hardware Alert: ${component.toUpperCase().replace('_', ' ')}`,
        body: `${taskData.restroomName} — ${taskData.message}`,
      },
      data: {
        taskId: taskRef.id,
        deviceId: String(deviceId || ''),
        triggerType: 'hardware_failure',
        component: String(component || ''),
        building: String(building),
        floor: String(floor),
      },
      android: {
        priority: 'high',
        notification: {
          channelId: 'hardware_alerts',
          sound: 'default',
          color: '#DC2626',
        },
      },
    };

    const fcmResponse = await messaging.send(fcmPayload);
    console.log(`[FCM] Notification dispatched successfully. Message ID: ${fcmResponse}`);
  } catch (error) {
    console.error('[Error] Failed to process hardware alert:', error);
  }
}

// 4. Message Router
client.on('message', (topic, rawMessage) => {
  try {
    const payload = JSON.parse(rawMessage.toString());

    if (topic.startsWith('toilet/alerts/hardware')) {
      handleHardwareAlert(payload);
    } else if (topic.startsWith('toilet/status/lwt')) {
      if (payload.status === 'offline') {
        handleHardwareAlert({
          deviceId: payload.deviceId || 'TOILET_ESP32_01',
          location: 'Main Building - 2F - Stall 1',
          component: 'connectivity',
          message: 'Smart Toilet hardware went offline unexpectedly (Power failure or WiFi dropped).',
          severity: 'critical',
          timestamp: Date.now(),
        });
      }
    }
  } catch (err) {
    console.error(`[MQTT Parser] Failed to parse message on ${topic}:`, err.message);
  }
});
