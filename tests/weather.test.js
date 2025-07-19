import { describe, it, expect, vi } from 'vitest';
import { JSDOM } from 'jsdom';

// Test fallback coordinates when geolocation is unavailable

describe('weather panel', () => {
  it('uses default coordinates when geolocation fails', async () => {
    const dom = new JSDOM(`<div id="weatherPanel"></div>`);
    global.window = dom.window;
    global.document = dom.window.document;
    global.navigator = dom.window.navigator;
    delete global.navigator.geolocation;

    const fetchMock = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({
        hourly: { time: [], temperature_2m: [] },
        daily: { time: [], temperature_2m_max: [], temperature_2m_min: [] }
      })
    });
    global.fetch = fetchMock;

    const mod = await import('../js/weather.js');
    await mod.initWeatherPanel();
    expect(fetchMock).toHaveBeenCalled();
    const url = fetchMock.mock.calls[0][0];
    expect(url).toMatch(/latitude=37\.7749/);
    expect(url).toMatch(/longitude=-122\.4194/);
  });
});
