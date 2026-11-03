import { describe, expect, it } from 'vitest';
import { answerQuestion } from './helpAssistant';


describe('Phase 39: top-ups and the free tier', () => {
  it('"Can I buy top-ups?" → top-ups are not available yet', () => {
    expect(answerQuestion('Can I buy top-ups?').text).toBe('Top-ups are not available yet.');
    expect(answerQuestion('can I top up my AI credits').text).toBe('Top-ups are not available yet.');
  });
  it('the free tools stay free after the trial; saving needs a free account', () => {
    const a = answerQuestion('What happens to the free tools after my trial?').text;
    expect(a).toMatch(/stay free after a trial ends/);
    expect(a).toMatch(/With a free account you can save your work/);
    expect(answerQuestion('Is there a free trial?').text).toMatch(/14-day free trial/); // unchanged
  });
});
