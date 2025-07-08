import request from 'supertest';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';

let server;

beforeAll(async () => {
  const mod = await import('../backend/server.js');
  server = mod.default || mod;
});

afterAll((done) => {
  server.close(done);
});

describe('server', () => {
  it('serves index.html at GET /', async () => {
    await request(server)
      .get('/')
      .expect('Content-Type', /html/)
      .expect(200)
      .then(res => {
        expect(res.text).toMatch(/<html/i);
      });
  });
});
