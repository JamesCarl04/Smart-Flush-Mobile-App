import {
  COMPONENT_ICONS,
  getComponentMeta,
  hardwareUrgencyTone,
  statusTone,
  taskTriggerTone,
  urgencyTone,
  UI_COLORS,
} from '../../components/MaintenanceUI';

describe('MaintenanceUI helper functions', () => {
  describe('statusTone', () => {
    it('should return correct tone for "completed" status', () => {
      const tone = statusTone('completed');
      expect(tone).toEqual({
        backgroundColor: UI_COLORS.softGreen,
        color: UI_COLORS.success,
        icon: 'check-circle-outline',
      });
    });

    it('should return correct tone for "acknowledged" status', () => {
      const tone = statusTone('acknowledged');
      expect(tone).toEqual({
        backgroundColor: UI_COLORS.softBlue,
        color: UI_COLORS.info,
        icon: 'progress-clock',
      });
    });

    it('should return correct tone for "reassignment_needed" status', () => {
      const tone = statusTone('reassignment_needed');
      expect(tone).toEqual({
        backgroundColor: UI_COLORS.softRed,
        color: UI_COLORS.danger,
        icon: 'alert-octagon-outline',
      });
    });

    it('should return correct tone for "unassigned" status', () => {
      const tone = statusTone('unassigned');
      expect(tone).toEqual({
        backgroundColor: UI_COLORS.softRed,
        color: UI_COLORS.danger,
        icon: 'alert-octagon-outline',
      });
    });

    it('should return correct tone for "assigned" and "flagged" statuses', () => {
      const assignedTone = statusTone('assigned');
      expect(assignedTone).toEqual({
        backgroundColor: UI_COLORS.softOrange,
        color: UI_COLORS.warning,
        icon: 'clock-alert-outline',
      });

      const flaggedTone = statusTone('flagged');
      expect(flaggedTone).toEqual({
        backgroundColor: UI_COLORS.softOrange,
        color: UI_COLORS.warning,
        icon: 'clock-alert-outline',
      });
    });
  });

  describe('urgencyTone', () => {
    it('should return Critical urgency for "reassignment_needed" and "unassigned"', () => {
      const reassignUrgency = urgencyTone('reassignment_needed');
      expect(reassignUrgency).toEqual({
        label: 'Critical',
        backgroundColor: UI_COLORS.softRed,
        color: UI_COLORS.danger,
        icon: 'alert-decagram',
      });

      const unassignedUrgency = urgencyTone('unassigned');
      expect(unassignedUrgency).toEqual({
        label: 'Critical',
        backgroundColor: UI_COLORS.softRed,
        color: UI_COLORS.danger,
        icon: 'alert-decagram',
      });
    });

    it('should return High urgency for "assigned"', () => {
      const assignedUrgency = urgencyTone('assigned');
      expect(assignedUrgency).toEqual({
        label: 'High',
        backgroundColor: UI_COLORS.softOrange,
        color: '#C2410C',
        icon: 'alert-circle-outline',
      });
    });

    it('should return In Progress urgency for "acknowledged"', () => {
      const ackUrgency = urgencyTone('acknowledged');
      expect(ackUrgency).toEqual({
        label: 'In Progress',
        backgroundColor: UI_COLORS.softBlue,
        color: UI_COLORS.info,
        icon: 'timer-sand',
      });
    });

    it('should return Completed urgency for "completed"', () => {
      const completedUrgency = urgencyTone('completed');
      expect(completedUrgency).toEqual({
        label: 'Completed',
        backgroundColor: UI_COLORS.softGreen,
        color: UI_COLORS.success,
        icon: 'shield-check-outline',
      });
    });
  });

  describe('taskTriggerTone', () => {
    it('should return high-urgency red tone for "hardware_failure"', () => {
      const tone = taskTriggerTone('hardware_failure');
      expect(tone).toEqual({
        label: 'Hardware Alert',
        backgroundColor: UI_COLORS.softRed,
        color: UI_COLORS.danger,
        icon: 'alert-octagon',
      });
    });

    it('should return orange tone for "maintenance"', () => {
      const tone = taskTriggerTone('maintenance');
      expect(tone).toEqual({
        label: 'Maintenance',
        backgroundColor: UI_COLORS.softOrange,
        color: '#C2410C',
        icon: 'wrench-outline',
      });
    });

    it('should return blue tone for "manual" or default', () => {
      const toneManual = taskTriggerTone('manual');
      expect(toneManual).toEqual({
        label: 'Manual Request',
        backgroundColor: UI_COLORS.softBlue,
        color: UI_COLORS.info,
        icon: 'account-wrench-outline',
      });

      const toneNull = taskTriggerTone(null);
      expect(toneNull).toEqual({
        label: 'Manual Request',
        backgroundColor: UI_COLORS.softBlue,
        color: UI_COLORS.info,
        icon: 'account-wrench-outline',
      });
    });
  });

  describe('getComponentMeta and hardware failure components', () => {
    it('should cleanly map hardware failure components to descriptive names, icons, and isHardware flag', () => {
      const pumpMeta = getComponentMeta('pump');
      expect(pumpMeta).toEqual({
        label: 'Water Pump',
        icon: 'water-pump',
        isHardware: true,
      });

      const leakMeta = getComponentMeta('water_leak');
      expect(leakMeta).toEqual({
        label: 'Water Leak Detector',
        icon: 'water-alert',
        isHardware: true,
      });

      const ultrasonicMeta = getComponentMeta('sensor_ultrasonic');
      expect(ultrasonicMeta).toEqual({
        label: 'Ultrasonic Distance Sensor',
        icon: 'radar',
        isHardware: true,
      });

      const servoMeta = getComponentMeta('servo_lid');
      expect(servoMeta).toEqual({
        label: 'Servo Lid Mechanism',
        icon: 'robot-industrial',
        isHardware: true,
      });

      const waterflowMeta = getComponentMeta('waterflow');
      expect(waterflowMeta).toEqual({
        label: 'Water Flow Sensor',
        icon: 'water-sync',
        isHardware: true,
      });

      const connectivityMeta = getComponentMeta('connectivity');
      expect(connectivityMeta).toEqual({
        label: 'Device Connectivity',
        icon: 'wifi-alert',
        isHardware: true,
      });

      const flushValveMeta = getComponentMeta('flush_valve');
      expect(flushValveMeta).toEqual({
        label: 'Flush Valve',
        icon: 'valve',
        isHardware: true,
      });
    });

    it('should map standard facility components with appropriate fallbacks', () => {
      const floorMeta = getComponentMeta('floor');
      expect(floorMeta).toEqual({
        label: 'Restroom Floor',
        icon: 'broom',
        isHardware: false,
      });

      const unknownMeta = getComponentMeta('custom_door_handle');
      expect(unknownMeta).toEqual({
        label: 'Custom Door Handle',
        icon: 'wrench-outline',
        isHardware: false,
      });

      const emptyMeta = getComponentMeta('');
      expect(emptyMeta).toEqual({
        label: 'General Maintenance',
        icon: 'wrench-outline',
        isHardware: false,
      });
    });
  });

  describe('hardwareUrgencyTone', () => {
    it('should return red failure tone for active hardware issues', () => {
      const tone = hardwareUrgencyTone('pump', 'assigned');
      expect(tone).toEqual({
        label: 'Water Pump Failure',
        backgroundColor: UI_COLORS.softRed,
        color: UI_COLORS.danger,
        icon: 'water-pump',
      });
    });

    it('should return green resolved tone for completed hardware tasks', () => {
      const tone = hardwareUrgencyTone('sensor_ultrasonic', 'completed');
      expect(tone).toEqual({
        label: 'Ultrasonic Distance Sensor Resolved',
        backgroundColor: UI_COLORS.softGreen,
        color: UI_COLORS.success,
        icon: 'shield-check-outline',
      });
    });
  });
});
