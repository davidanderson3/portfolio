import { describe, it, expect, vi } from 'vitest';
import { JSDOM } from 'jsdom';

import { renderDecisionList } from '../js/decisionList.js';

describe('renderDecisionList', () => {
  it('renders outcomes and next steps for decision items', () => {
    const dom = new JSDOM('<div id="c"></div>');
    global.document = dom.window.document;
    const container = dom.window.document.getElementById('c');
    const items = [
      { id: 'd1', type: 'goal', text: 'Pick', outcomes: ['a','b'], nextSteps: ['x'] },
      { id: 'g1', type: 'goal', text: 'Other' }
    ];
    renderDecisionList(items, container);
    expect(container.querySelectorAll('li').length).toBe(3);
    expect(container.textContent).toContain('Pick');
    expect(container.textContent).not.toContain('Other');
    expect(container.textContent).toContain('Next Steps');
  });
});
