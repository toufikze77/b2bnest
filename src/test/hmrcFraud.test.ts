// HMRC P2: the browser part of the fraud prevention headers (WEB_APP_VIA_SERVER, spec v3.3).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { collectHmrcFraudData, HMRC_DEVICE_ID_KEY, hmrcDeviceId, utcOffset, WEB_APP_VERSION } from '@/lib/hmrcFraud';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

afterEach(() => { vi.restoreAllMocks(); try { localStorage.clear(); } catch { /* ignore */ } });

describe('HMRC browser fraud data', () => {
  it('collects only the browser-side items on HMRC\'s list', () => {
    const d = collectHmrcFraudData();
    expect(Object.keys(d).every((k) => ['deviceId', 'jsUserAgent', 'screens', 'windowSize', 'timezone', 'webVersion'].includes(k))).toBe(true);
    expect(d.webVersion).toBe(WEB_APP_VERSION);
    expect(d.deviceId).toMatch(UUID);
    expect(d.jsUserAgent).toBe(navigator.userAgent);
    expect(d.timezone).toMatch(/^UTC[+-]\d\d:\d\d$/);
    if (d.windowSize) expect(d.windowSize).toEqual({ width: window.innerWidth, height: window.innerHeight });
    expect(JSON.stringify(d)).not.toMatch(/@/);
  });

  it('screens: width, height, scaling factor and colour depth, positive whole numbers', () => {
    vi.spyOn(window, 'screen', 'get').mockReturnValue({ width: 1920, height: 1080, colorDepth: 24 } as Screen);
    vi.spyOn(window, 'devicePixelRatio', 'get').mockReturnValue(2);
    expect(collectHmrcFraudData().screens).toEqual([{ width: 1920, height: 1080, scalingFactor: 2, colourDepth: 24 }]);
    vi.spyOn(window, 'screen', 'get').mockReturnValue({ width: 0, height: 1080, colorDepth: 24 } as Screen);
    expect(collectHmrcFraudData().screens).toBeUndefined();
  });

  it('the device id is a random UUID kept in this browser and reused', () => {
    const a = hmrcDeviceId();
    expect(a).toMatch(UUID);
    expect(localStorage.getItem(HMRC_DEVICE_ID_KEY)).toBe(a);
    expect(hmrcDeviceId()).toBe(a);
    localStorage.setItem(HMRC_DEVICE_ID_KEY, 'not-a-uuid');
    const b = hmrcDeviceId();
    expect(b).toMatch(UUID);
    expect(b).not.toBe(a);
  });

  it('works when storage is blocked: one id for the page, no crash', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    const a = hmrcDeviceId();
    expect(a).toMatch(UUID);
    expect(hmrcDeviceId()).toBe(a);
    expect(collectHmrcFraudData().deviceId).toBe(a);
  });

  it('timezone as UTC±hh:mm, as in HMRC\'s examples', () => {
    expect(utcOffset(0)).toBe('UTC+00:00');
    expect(utcOffset(-60)).toBe('UTC+01:00');
    expect(utcOffset(75)).toBe('UTC-01:15');
    expect(utcOffset(-330)).toBe('UTC+05:30');
    expect(utcOffset(Number.NaN)).toBeUndefined();
  });
});
