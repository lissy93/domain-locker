import { firstValueFrom, of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { createDbProxy } from '~/app/utils/db-proxy.factory';
import type { FeatureService } from '~/app/services/features.service';
import type { GlobalMessageService } from '~/app/services/messaging.service';

const makeFakeService = () => ({
  saveDomain: vi.fn().mockReturnValue(of({ id: 'd1' })),
  getDomains: vi.fn().mockReturnValue(of(['example.com'])),
  syncReadValue: 'hello',
});

const makeDeps = (canWrite: boolean) => {
  const featureService = {
    isFeatureEnabledPromise: vi.fn().mockResolvedValue(canWrite),
  } as unknown as FeatureService;
  const globalMsg = {
    showWarn: vi.fn(),
  } as unknown as GlobalMessageService;
  return { featureService, globalMsg };
};

const writeMethods = new Set(['saveDomain']);

describe('createDbProxy', () => {
  it('passes through non-function properties', () => {
    const fake = makeFakeService();
    const { featureService, globalMsg } = makeDeps(true);
    const proxy = createDbProxy(fake, featureService, globalMsg, writeMethods);
    expect((proxy as unknown as { syncReadValue: string }).syncReadValue).toBe('hello');
  });

  it('returns read methods unwrapped', async () => {
    const fake = makeFakeService();
    const { featureService, globalMsg } = makeDeps(false);
    const proxy = createDbProxy(fake, featureService, globalMsg, writeMethods);
    const result = await firstValueFrom(proxy.getDomains());
    expect(result).toEqual(['example.com']);
    expect(fake.getDomains).toHaveBeenCalledOnce();
    expect(featureService.isFeatureEnabledPromise).not.toHaveBeenCalled();
  });

  it('runs the real write method when write permissions are enabled', async () => {
    const fake = makeFakeService();
    const { featureService, globalMsg } = makeDeps(true);
    const proxy = createDbProxy(fake, featureService, globalMsg, writeMethods);
    const result = await firstValueFrom(proxy.saveDomain({ name: 'x' }));
    expect(result).toEqual({ id: 'd1' });
    expect(fake.saveDomain).toHaveBeenCalledWith({ name: 'x' });
    expect(
      (globalMsg as unknown as { showWarn: ReturnType<typeof vi.fn> }).showWarn,
    ).not.toHaveBeenCalled();
  });

  it('blocks write methods and warns the user when disabled (demo guard)', async () => {
    const fake = makeFakeService();
    const { featureService, globalMsg } = makeDeps(false);
    const proxy = createDbProxy(fake, featureService, globalMsg, writeMethods);

    await expect(firstValueFrom(proxy.saveDomain({ name: 'x' }))).rejects.toThrow(
      'Write permissions disabled',
    );
    expect(fake.saveDomain).not.toHaveBeenCalled();
    expect(
      (globalMsg as unknown as { showWarn: ReturnType<typeof vi.fn> }).showWarn,
    ).toHaveBeenCalledOnce();
  });

  it('wraps promise-returning write methods into observables', async () => {
    const fake = {
      saveDomain: vi.fn().mockResolvedValue('done'),
    };
    const { featureService, globalMsg } = makeDeps(true);
    const proxy = createDbProxy(
      fake as unknown as object,
      featureService,
      globalMsg,
      writeMethods,
    ) as { saveDomain: (x: unknown) => ReturnType<typeof of> };
    const result = await firstValueFrom(proxy.saveDomain({ name: 'x' }));
    expect(result).toBe('done');
  });
});
