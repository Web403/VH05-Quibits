/**
 * Machine QR card: the printable label generator for admins.
 */
import { render, screen } from '@testing-library/react';
import { MachineQrCard, machineQrValue } from './machine-qr-card';
import type { MachineRecord } from '../lib/api-client';

const machine = {
  id: 'm1',
  assetTag: 'CNC-001',
  displayName: 'Mill A',
} as MachineRecord;

describe('MachineQrCard', () => {
  it('renders the canonical payload the mobile scanner resolves', () => {
    render(<MachineQrCard machine={machine} />);
    expect(screen.getByTestId('machine-qr-payload').textContent).toBe('machine:CNC-001');
    // No database ids, org data or secrets ever reach the QR payload.
    expect(screen.getByTestId('machine-qr-payload').textContent).not.toContain('m1');
    expect(screen.getByTestId('machine-qr-card').querySelector('canvas')).toBeTruthy();
  });

  it('builds the canonical value identically to the mobile helper', () => {
    expect(machineQrValue('CNC-001')).toBe('machine:CNC-001');
  });

  it('offers download and print actions', () => {
    render(<MachineQrCard machine={machine} />);
    expect(screen.getByRole('button', { name: 'Download PNG' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Print label' })).toBeTruthy();
  });
});
