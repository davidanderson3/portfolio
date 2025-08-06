import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';

vi.mock('../js/helpers.js', () => ({
  restoreBackup: vi.fn().mockResolvedValue('backup-1')
}));

import { initBackupsPanel } from '../js/backups.js';
import { restoreBackup } from '../js/helpers.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('initBackupsPanel', () => {
  it('renders backups and invokes restore', async () => {
    const dom = new JSDOM('<div id="backupsPanel"><ul id="backupList"></ul></div>');
    global.window = dom.window;
    global.document = dom.window.document;
    global.alert = vi.fn();
    global.localStorage = {
      length: 2,
      key: i => ['backup-1', 'other'][i],
      getItem: () => '[]'
    };

    initBackupsPanel();
    const btn = document.querySelector('#backupList li button');
    expect(btn).toBeTruthy();
    btn.click();
    expect(restoreBackup).toHaveBeenCalledWith(expect.any(Function));
  });
});
