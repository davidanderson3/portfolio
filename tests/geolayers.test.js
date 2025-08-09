import request from 'supertest';
import server from '../backend/server';
import { afterAll, describe, expect, it } from 'vitest';

afterAll(() => {
  server.close();
});

describe('geolayers API', () => {
  it('returns daily data with layers', async () => {
    const res = await request(server).get('/daily');
    expect(res.status).toBe(200);
    expect(res.body.locationId).toBeTruthy();
    expect(Array.isArray(res.body.layers)).toBe(true);
  });

  it('returns list of countries', async () => {
    const res = await request(server).get('/countries');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.find(c => c.code === 'USA')).toBeTruthy();
  });
});
