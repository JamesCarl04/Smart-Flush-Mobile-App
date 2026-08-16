import { getRestroomLabel } from '../../lib/restrooms';

describe('restrooms utility', () => {
  describe('getRestroomLabel', () => {
    it('should return custom restroomName when provided and non-empty', () => {
      expect(
        getRestroomLabel({
          deviceId: 'toilet-01',
          restroomName: 'Executive Restroom 3F',
        }),
      ).toBe('Executive Restroom 3F');

      expect(
        getRestroomLabel({
          deviceId: 'FShQvy5eRcTVcREcNbns',
          restroomName: 'Main Lobby Restroom',
        }),
      ).toBe('Main Lobby Restroom');
    });

    it('should return predefined mapping for recognized device IDs when restroomName is null or undefined', () => {
      expect(
        getRestroomLabel({
          deviceId: 'FShQvy5eRcTVcREcNbns',
          restroomName: null,
        }),
      ).toBe('Restroom 1');

      expect(
        getRestroomLabel({
          deviceId: 'toilet-01',
          restroomName: undefined,
        }),
      ).toBe('Restroom 2');
    });

    it('should fallback to deviceId mapping when restroomName is empty string or whitespace', () => {
      expect(
        getRestroomLabel({
          deviceId: 'FShQvy5eRcTVcREcNbns',
          restroomName: '   ',
        }),
      ).toBe('Restroom 1');

      expect(
        getRestroomLabel({
          deviceId: 'toilet-01',
          restroomName: '',
        }),
      ).toBe('Restroom 2');
    });

    it('should fallback to raw deviceId for unknown device IDs without a custom restroomName', () => {
      expect(
        getRestroomLabel({
          deviceId: 'unmapped-sensor-999',
          restroomName: null,
        }),
      ).toBe('unmapped-sensor-999');

      expect(
        getRestroomLabel({
          deviceId: 'custom-toilet-xyz',
          restroomName: undefined,
        }),
      ).toBe('custom-toilet-xyz');
    });
  });
});
