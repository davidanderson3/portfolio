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

  it('requests data in Fahrenheit', async () => {
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
    const url = fetchMock.mock.calls[0][0];
    expect(url).toMatch(/temperature_unit=fahrenheit/);
  });

  it('starts hourly forecast from the current hour', async () => {
    const dom = new JSDOM(`<div id="weatherPanel"></div>`);
    global.window = dom.window;
    global.document = dom.window.document;
    global.navigator = dom.window.navigator;
    delete global.navigator.geolocation;

    const data = {
      hourly: {
        time: ['2024-01-01T10:00', '2024-01-01T11:00', '2024-01-01T12:00'],
        temperature_2m: [60, 61, 62],
        precipitation_probability: [0, 0, 0]
      },
      daily: { time: [], temperature_2m_max: [], temperature_2m_min: [] }
    };

    const fetchMock = vi.fn().mockResolvedValue({ json: vi.fn().mockResolvedValue(data) });
    global.fetch = fetchMock;

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T11:30'));

    const mod = await import('../js/weather.js');
    await mod.initWeatherPanel();

    const cell = dom.window.document.querySelector('tbody td');
    const expected = new Date('2024-01-01T12:00').toLocaleTimeString([], { hour: 'numeric', hour12: true });
    expect(cell.textContent).toBe(expected);

    vi.useRealTimers();
  });
});
