import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import server from '../backend/server.js';

const file = path.join(process.cwd(), 'backend', 'descriptions.json');

describe('description api', () => {
  it('saves and loads descriptions', async () => {
    const original = fs.readFileSync(file, 'utf8');
    try {
      await request(server)
        .post('/api/description')
        .send({ panelId: 'testPanel', position: 'top', text: 'hello' });
      const res = await request(server).get('/api/descriptions');
      expect(res.body.testPanel.top).toBe('hello');
    } finally {
      fs.writeFileSync(file, original);
    }
  });
});

describe('movies api', () => {
  it('returns a list of movies', async () => {
    const res = await request(server).get('/api/movies');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toHaveProperty('title');
    expect(res.body[0]).toHaveProperty('score');
  });
});

afterAll(() => {
  server.close();
});
