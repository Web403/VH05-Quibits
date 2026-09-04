/**
 * Machine QR code card (web admin).
 *
 * The QR payload is exactly `machine:<asset-tag>` - the same canonical value
 * the mobile scanner validates and resolves through
 * GET /machines/resolve-qr/:qrValue. The asset tag is immutable backend-side,
 * which is what makes a printed label safe: it can never go stale. The QR is
 * an identifier only; scanning it authorizes nothing by itself.
 *
 * Rendered client-side (no external service); download produces a PNG
 * suitable for label printing from the on-page canvas.
 */
import { useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import type { MachineRecord } from '../lib/api-client';

const SIZE = 220;

function qrValue(assetTag: string): string {
  return `machine:${assetTag}`;
}

export function machineQrValue(assetTag: string): string {
  return qrValue(assetTag);
}

export function MachineQrCard({ machine }: { machine: MachineRecord }): JSX.Element {
  const canvasHostRef = useRef<HTMLSpanElement>(null);
  const value = qrValue(machine.assetTag);

  const pngDataUrl = (scale = 3): string | null => {
    const canvas = canvasHostRef.current?.querySelector('canvas');
    if (!canvas) return null;
    // Redraw at print scale on an offscreen canvas so labels stay crisp.
    const source = canvas as HTMLCanvasElement;
    const out = document.createElement('canvas');
    out.width = source.width * scale;
    out.height = source.height * scale;
    const ctx = out.getContext('2d');
    if (!ctx) return null;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(source, 0, 0, out.width, out.height);
    return out.toDataURL('image/png');
  };

  const downloadPng = () => {
    const url = pngDataUrl();
    if (!url) return;
    const link = document.createElement('a');
    link.href = url;
    link.download = `${machine.assetTag}-qr.png`;
    link.click();
  };

  const printLabel = () => {
    const url = pngDataUrl();
    if (!url) return;
    const win = window.open('', '_blank', 'width=480,height=640');
    if (!win) return;
    const name = machine.displayName ?? machine.assetTag;
    win.document.write(
      `<!doctype html><html><head><title>${machine.assetTag} label</title>` +
        '<style>body{font-family:system-ui,sans-serif;text-align:center;padding:24px}' +
        'h1{font-size:28px;margin:16px 0 4px}p{margin:2px 0;color:#333;font-size:14px}' +
        '.mono{font-family:ui-monospace,monospace}</style></head><body>' +
        `<img src="${url}" width="360" height="360" alt="QR code"/>` +
        `<h1>${name}</h1><p class="mono">${machine.assetTag}</p>` +
        `<p class="mono">${value}</p></body></html>`,
    );
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <section aria-labelledby="machine-qr-heading" data-testid="machine-qr-card">
      <h2 id="machine-qr-heading" className="subsection">
        Machine QR code
      </h2>
      <p className="text-muted">
        Print this on the machine label. Technicians scan it in the mobile app to open this exact
        machine; access still requires sign-in and permissions.
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginTop: 8 }}>
        <span ref={canvasHostRef} style={{ background: '#fff', padding: 12, borderRadius: 8, lineHeight: 0 }}>
          <QRCodeCanvas value={value} size={SIZE} level="M" includeMargin={false} />
        </span>
        <div style={{ minWidth: 220 }}>
          <p>
            Payload: <code data-testid="machine-qr-payload">{value}</code>
          </p>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button type="button" className="btn btn--secondary btn--sm" onClick={downloadPng}>
              Download PNG
            </button>
            <button type="button" className="btn btn--secondary btn--sm" onClick={printLabel}>
              Print label
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
