import { api } from './api';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

/** Shrinks a camera photo before upload: a 4 MB phone photo becomes ~150 KB, which matters on 3G. */
export async function compressImage(file: File, maxSide = 1280, quality = 0.75): Promise<Blob> {
  try {
    if (typeof createImageBitmap === 'undefined' || typeof document === 'undefined') return file;
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file; // not an image the browser can decode: let the server judge it
  }
}

/** sign -> PUT to the short-lived URL. The server computes the hash that ends up on-chain. */
export async function uploadEvidence(kind: 'DELIVERY' | 'DISPUTE' | 'WAYBILL', poolId: string, file: File): Promise<{ evidenceId: string; sha256: string }> {
  const blob = await compressImage(file);
  const mime = blob.type || file.type || 'image/jpeg';
  const slot = await api<{ evidenceId: string; uploadUrl: string }>('/uploads/sign', { body: { kind, mime, size: blob.size, poolId } });
  const res = await fetch(`${BASE}${slot.uploadUrl}`, { method: 'PUT', body: blob, headers: { 'content-type': mime } });
  if (!res.ok) throw new Error(`upload failed (${res.status})`);
  return res.json();
}
