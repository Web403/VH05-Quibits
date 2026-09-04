/**
 * Scanner screen tests. The camera, haptics and the API are all mocked
 * (jest-expo): these run in plain Node with no device and no backend.
 *
 * Covered: permission granted/prompt/permanently-denied, camera render,
 * valid/invalid/unknown/unauthorized codes, duplicate-scan prevention,
 * retry, successful resolution + confirmation sheet, navigation to machine
 * details, and the manual machine-code fallback sharing the same flow.
 */
import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import ScanMachineScreen from '@/app/(app)/scan';
import { resolveMachineQr } from '@/api/endpoints';
import { ApiError } from '@/api/errors';
import { setMockCameraPermission, simulateScan } from '@/test/setup';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import type { MachineQrSummary } from '@/api/types';

jest.mock('@/api/endpoints', () => ({
  resolveMachineQr: jest.fn(),
}));

const mockedResolve = resolveMachineQr as jest.MockedFunction<typeof resolveMachineQr>;

const MACHINE: MachineQrSummary = {
  id: 'machine-1',
  name: 'Mill A',
  machineCode: 'CNC-001',
  serialNumber: 'SN-1001',
  machineModelId: 'model-1',
  machineModelName: 'Haas VF-2',
  location: { site: 'Plant 1' },
  status: 'operational',
  openIncidentCount: 0,
};

beforeEach(() => {
  jest.clearAllMocks();
  setMockCameraPermission({ granted: true, canAskAgain: true, status: 'granted' });
});

afterEach(() => {
  setMockCameraPermission({ granted: true, canAskAgain: true, status: 'granted' });
});

describe('camera permission states', () => {
  it('shows the camera when permission is granted', () => {
    const { getByTestId, getByText } = render(<ScanMachineScreen />);
    expect(getByTestId('camera-view')).toBeTruthy();
    expect(getByText('Align the machine QR code inside the frame.')).toBeTruthy();
    expect(getByTestId('scan-close')).toBeTruthy();
    expect(getByTestId('scan-torch')).toBeTruthy();
  });

  it('shows the loading state while permissions load', () => {
    setMockCameraPermission(null);
    const { getByText } = render(<ScanMachineScreen />);
    expect(getByText('Preparing the scanner…')).toBeTruthy();
  });

  it('asks for permission and offers manual entry', () => {
    setMockCameraPermission({ granted: false, canAskAgain: true, status: 'undetermined' });
    const { getByTestId, getByText, queryByTestId } = render(<ScanMachineScreen />);
    expect(getByTestId('scan-permission-prompt')).toBeTruthy();
    expect(getByText('Camera access needed')).toBeTruthy();
    expect(queryByTestId('camera-view')).toBeNull();
  });

  it('explains the permanently-denied state with settings guidance', () => {
    setMockCameraPermission({ granted: false, canAskAgain: false, status: 'denied' });
    const { getByTestId, getByText } = render(<ScanMachineScreen />);
    expect(getByTestId('scan-permission-blocked')).toBeTruthy();
    expect(getByText('Camera is turned off')).toBeTruthy();
    expect(getByText(/Settings/)).toBeTruthy();
  });
});

describe('scanning', () => {
  it('resolves a valid QR code once and shows the confirmation sheet', async () => {
    mockedResolve.mockResolvedValue(MACHINE);
    const { getByTestId, getByText } = render(<ScanMachineScreen />);

    act(() => simulateScan('machine:CNC-001'));
    // The latch must swallow every duplicate detection of the same frame.
    act(() => simulateScan('machine:CNC-001'));
    act(() => simulateScan('machine:CNC-001'));

    await waitFor(() => getByTestId('scan-confirm'));
    expect(mockedResolve).toHaveBeenCalledTimes(1);
    expect(mockedResolve).toHaveBeenCalledWith('machine:CNC-001');
    expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1);
    expect(getByText('Mill A')).toBeTruthy();
    expect(getByText('CNC-001')).toBeTruthy();
  });

  it('opens the machine details from the confirmation sheet', async () => {
    mockedResolve.mockResolvedValue(MACHINE);
    const { getByTestId } = render(<ScanMachineScreen />);
    act(() => simulateScan('machine:CNC-001'));
    await waitFor(() => getByTestId('scan-confirm'));

    fireEvent.press(getByTestId('scan-confirm-open'));
    expect(router.push).toHaveBeenCalledWith('/(app)/machines/machine-1');
  });

  it('lets the user scan again when the wrong machine was detected', async () => {
    mockedResolve.mockResolvedValueOnce(MACHINE);
    const { getByTestId, getByText } = render(<ScanMachineScreen />);
    act(() => simulateScan('machine:CNC-001'));
    await waitFor(() => getByTestId('scan-confirm'));
    expect(getByText('Is this your machine?')).toBeTruthy();

    mockedResolve.mockResolvedValueOnce({ ...MACHINE, id: 'machine-2', name: 'Press B', machineCode: 'PRESS-07' });
    fireEvent.press(getByTestId('scan-confirm-rescan'));
    act(() => simulateScan('machine:PRESS-07'));
    await waitFor(() => getByTestId('scan-confirm'));
    // The sheet now shows the second machine - never a stale first result.
    await waitFor(() => getByText('Press B'));
    expect(mockedResolve).toHaveBeenCalledTimes(2);
    expect(mockedResolve).toHaveBeenLastCalledWith('machine:PRESS-07');
  });

  it('rejects a non-machine QR locally without touching the backend', async () => {
    const { getByTestId } = render(<ScanMachineScreen />);
    act(() => simulateScan('https://example.com/not-a-machine'));
    await waitFor(() => getByTestId('scan-problem'));
    expect(getByTestId('scan-problem')).toHaveTextContent(/Not a machine code/);
    expect(mockedResolve).not.toHaveBeenCalled();
  });

  it('shows the unknown-machine state for 404s', async () => {
    mockedResolve.mockRejectedValue(new ApiError('NOT_FOUND', 'No machine matches this code.', 404));
    const { getByTestId } = render(<ScanMachineScreen />);
    act(() => simulateScan('machine:NOPE-99'));
    await waitFor(() => getByTestId('scan-problem'));
    expect(getByTestId('scan-problem')).toHaveTextContent(/Unknown machine/);
  });

  it('shows the no-access state for 403s', async () => {
    mockedResolve.mockRejectedValue(new ApiError('FORBIDDEN', 'denied', 403));
    const { getByTestId } = render(<ScanMachineScreen />);
    act(() => simulateScan('machine:CNC-001'));
    await waitFor(() => getByTestId('scan-problem'));
    expect(getByTestId('scan-problem')).toHaveTextContent(/No access/);
  });

  it('offers a retry on network failure and recovers', async () => {
    mockedResolve.mockRejectedValueOnce(new ApiError('NETWORK_ERROR', 'Cannot reach the API.'));
    mockedResolve.mockResolvedValue(MACHINE);
    const { getByTestId } = render(<ScanMachineScreen />);

    act(() => simulateScan('machine:CNC-001'));
    await waitFor(() => getByTestId('scan-problem'));
    expect(getByTestId('scan-problem')).toHaveTextContent(/No connection/);

    fireEvent.press(getByTestId('scan-retry'));
    act(() => simulateScan('machine:CNC-001'));
    await waitFor(() => getByTestId('scan-confirm'));
    expect(mockedResolve).toHaveBeenCalledTimes(2);
  });
});

describe('manual machine code entry', () => {
  it('resolves typed codes through the same backend flow', async () => {
    mockedResolve.mockResolvedValue(MACHINE);
    const { getByTestId } = render(<ScanMachineScreen />);

    fireEvent.press(getByTestId('scan-manual'));
    fireEvent.changeText(getByTestId('manual-code-input'), 'cnc-001');
    fireEvent.press(getByTestId('manual-submit'));

    await waitFor(() => getByTestId('scan-confirm'));
    expect(mockedResolve).toHaveBeenCalledWith('machine:CNC-001');
  });

  it('validates typed codes before calling the backend', async () => {
    const { getByTestId, getByText, queryByTestId } = render(<ScanMachineScreen />);

    fireEvent.press(getByTestId('scan-manual'));
    fireEvent.changeText(getByTestId('manual-code-input'), '!!!');
    fireEvent.press(getByTestId('manual-submit'));

    await waitFor(() => getByText(/Enter the machine code from the label/));
    expect(mockedResolve).not.toHaveBeenCalled();
    expect(queryByTestId('scan-confirm')).toBeNull();
  });

  it('is available even when the camera is unavailable', () => {
    setMockCameraPermission({ granted: false, canAskAgain: false, status: 'denied' });
    const { getByText } = render(<ScanMachineScreen />);
    expect(getByText('Enter machine code instead')).toBeTruthy();
  });
});
