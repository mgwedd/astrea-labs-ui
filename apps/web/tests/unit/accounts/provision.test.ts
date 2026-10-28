// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const listUsersByEmail = vi.fn();
const create = vi.fn();
vi.mock('auth0', () => ({ ManagementClient: class { users = { listUsersByEmail, create }; } }));

import { provisionAccount } from '@/lib/accounts/auth0-mgmt';

beforeEach(() => {
  listUsersByEmail.mockReset();
  create.mockReset();
  Object.assign(process.env, {
    AUTH0_DOMAIN: 't.us.auth0.com',
    AUTH0_MGMT_CLIENT_ID: 'id',
    AUTH0_MGMT_CLIENT_SECRET: 'secret',
    AUTH0_PASSWORDLESS_CONNECTION: 'email',
  });
});

describe('provisionAccount', () => {
  it('creates a verified, invited passwordless user for the email', async () => {
    listUsersByEmail.mockResolvedValue([]);
    await provisionAccount('Dr@Example.com ');
    expect(listUsersByEmail).toHaveBeenCalledWith({ email: 'dr@example.com' });
    expect(create).toHaveBeenCalledWith({ connection: 'email', email: 'dr@example.com', email_verified: true, app_metadata: { invited: true } });
  });
  it('treats a 409 conflict on create as already provisioned', async () => {
    listUsersByEmail.mockResolvedValue([]);
    create.mockRejectedValue(Object.assign(new Error('Conflict'), { statusCode: 409 }));
    await expect(provisionAccount('dr@example.com')).resolves.toBeUndefined();
  });
  it('does nothing when the passwordless user exists', async () => {
    listUsersByEmail.mockResolvedValue([{ identities: [{ connection: 'email' }] }]);
    await provisionAccount('dr@example.com');
    expect(create).not.toHaveBeenCalled();
  });
  it('still creates one when only a database-connection user (e.g. an admin) exists', async () => {
    listUsersByEmail.mockResolvedValue([{ identities: [{ connection: 'Username-Password-Authentication' }] }]);
    await provisionAccount('dr@example.com');
    expect(create).toHaveBeenCalledOnce();
  });
  it('throws when the env is incomplete', async () => {
    delete process.env.AUTH0_PASSWORDLESS_CONNECTION;
    await expect(provisionAccount('dr@example.com')).rejects.toThrow();
  });
});
