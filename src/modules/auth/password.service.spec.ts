import { PasswordService } from './password.service';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('hashes with argon2id and never returns the plaintext', async () => {
    const plaintext = 'correct horse battery staple';
    const hash = await service.hash(plaintext);

    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(hash).not.toContain(plaintext);
    await expect(service.verify(hash, plaintext)).resolves.toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hash = await service.hash('s3cret-password');
    await expect(service.verify(hash, 'wrong-password')).resolves.toBe(false);
  });

  it('returns false (never throws) for a malformed hash', async () => {
    await expect(service.verify('not-a-real-hash', 'whatever')).resolves.toBe(false);
  });
});
