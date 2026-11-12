const request = require('supertest');
const app = require('../server/app');

describe('Health and Static File Serving', () => {
  it('GET /api/health should return 200 with status ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('GET /api/unknown-endpoint should return 404 with error and empty details array', async () => {
    const res = await request(app).get('/api/unknown-endpoint');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
    expect(Array.isArray(res.body.details)).toBe(true);
    expect(res.body.details).toEqual([]);
  });

  it('GET /index.html should serve the static homepage', async () => {
    const res = await request(app).get('/index.html');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/html/);
    expect(res.text).toContain('TaskFlow');
  });
});
