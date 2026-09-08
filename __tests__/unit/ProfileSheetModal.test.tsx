import React from 'react';
import { render, screen } from '@testing-library/react-native';
import Constants from 'expo-constants';
import { ProfileSheetModal } from '../../components/ProfileSheetModal';
import * as useAuthHook from '../../hooks/useAuth';

jest.mock('../../hooks/useAuth');

describe('ProfileSheetModal Version Sync', () => {
  const mockOnDismiss = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useAuthHook.useAuth as jest.Mock).mockReturnValue({
      user: {
        name: 'John Doe',
        email: 'technician@sdca.edu.ph',
        building: 'SDCA Annex',
      },
      role: 'maintenance',
      logout: jest.fn(),
    });
  });

  it('renders dynamic app version from Constants.expoConfig', () => {
    (Constants as any).expoConfig = {
      ...(Constants as any).expoConfig,
      version: '1.24.4',
    };

    render(<ProfileSheetModal visible={true} onDismiss={mockOnDismiss} />);

    expect(screen.getByText('Klir Facility Ops • v1.24.4')).toBeTruthy();
    expect(screen.getByText('SDCA Smart Flush System')).toBeTruthy();
  });

  it('falls back to 1.24.4 if expoConfig version is missing', () => {
    const originalVersion = Constants.expoConfig?.version;
    if (Constants.expoConfig) {
      delete (Constants.expoConfig as any).version;
    }

    render(<ProfileSheetModal visible={true} onDismiss={mockOnDismiss} />);

    expect(screen.getByText('Klir Facility Ops • v1.24.4')).toBeTruthy();

    if (Constants.expoConfig) {
      (Constants.expoConfig as any).version = originalVersion;
    }
  });

  it('renders Supervisor profile with dynamic app version', () => {
    (useAuthHook.useAuth as jest.Mock).mockReturnValue({
      user: {
        name: 'Jane Supervisor',
        email: 'supervisor@sdca.edu.ph',
        building: 'SDCA Main',
      },
      role: 'supervisor',
      logout: jest.fn(),
    });

    (Constants as any).expoConfig = {
      ...(Constants as any).expoConfig,
      version: '1.24.4',
    };

    render(<ProfileSheetModal visible={true} onDismiss={mockOnDismiss} />);

    expect(screen.getByText('Facility Supervisor')).toBeTruthy();
    expect(screen.getByText('Klir Facility Ops • v1.24.4')).toBeTruthy();
  });
});
