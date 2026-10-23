// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { verify } from 'node:crypto';

const signMessage = vi.fn();
vi.mock('@vercel/kms', () => ({ signMessage: (...args: unknown[]) => signMessage(...args) }));

const { defaultSealer, devPublicKey, devSealer, kmsSealer, sealMessage } = await import('@/lib/agreements/signed/seal');

afterEach(() => {
  vi.unstubAllEnvs();
  signMessage.mockReset();
});

describe('sealMessage', () => {
  it('has the fixed ASEAL1 layout', () => {
    expect(sealMessage('doc-1', 'ab'.repeat(32))).toBe(`ASEAL1\ndoc-1\n${'ab'.repeat(32)}`);
  });
});

describe('devSealer', () => {
  it('signs with Ed25519 and the signature verifies against the seal message', async () => {
    const msg = sealMessage('doc-1', 'cd'.repeat(32));
    const seal = await devSealer().seal(msg);
    expect(seal.alg).toBe('Ed25519');
    expect(seal.keyId).toBe('dev-ephemeral');
    expect(seal.fingerprint).toMatch(/^SHA256:/);
    const sig = Buffer.from(seal.signature, 'base64');
    expect(verify(null, Buffer.from(msg), devPublicKey(), sig)).toBe(true);
    expect(verify(null, Buffer.from(sealMessage('doc-1', 'ce'.repeat(32))), devPublicKey(), sig)).toBe(false);
  });

  it('uses one key per process', async () => {
    const a = await devSealer().seal('x');
    const b = await devSealer().seal('x');
    expect(a.fingerprint).toBe(b.fingerprint);
  });
});

describe('kmsSealer', () => {
  it('calls signMessage with the issuer and message and maps the result', async () => {
    signMessage.mockResolvedValue({
      signature: new Uint8Array([1, 2, 3]),
      keyId: 'kid-1',
      algorithm: 'EdDSA',
      fingerprint: 'SHA256:abc',
    });
    const seal = await kmsSealer('iss_123').seal('hello');
    expect(signMessage).toHaveBeenCalledWith({ issuerId: 'iss_123', message: 'hello' });
    expect(seal).toEqual({ alg: 'EdDSA', keyId: 'kid-1', fingerprint: 'SHA256:abc', signature: 'AQID' });
  });

  it('propagates KMS errors', async () => {
    signMessage.mockRejectedValue(new Error('issuer_not_found'));
    await expect(kmsSealer('iss_123').seal('hello')).rejects.toThrow('issuer_not_found');
  });
});

describe('defaultSealer', () => {
  it('uses KMS when SEAL_KMS_ISSUER_ID is set', async () => {
    vi.stubEnv('SEAL_KMS_ISSUER_ID', 'iss_env');
    vi.stubEnv('VERCEL_ENV', 'production');
    signMessage.mockResolvedValue({ signature: new Uint8Array([9]), keyId: 'k', algorithm: 'EdDSA', fingerprint: 'f' });
    await defaultSealer().seal('m');
    expect(signMessage).toHaveBeenCalledWith({ issuerId: 'iss_env', message: 'm' });
  });

  it('throws in production without an issuer', () => {
    vi.stubEnv('SEAL_KMS_ISSUER_ID', '');
    vi.stubEnv('VERCEL_ENV', 'production');
    expect(() => defaultSealer()).toThrow(/SEAL_KMS_ISSUER_ID/);
  });

  it('falls back to the dev sealer outside production', async () => {
    vi.stubEnv('SEAL_KMS_ISSUER_ID', '');
    vi.stubEnv('VERCEL_ENV', 'preview');
    expect((await defaultSealer().seal('m')).keyId).toBe('dev-ephemeral');
    expect(signMessage).not.toHaveBeenCalled();
  });
});
