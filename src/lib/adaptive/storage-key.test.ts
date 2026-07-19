import { describe, expect, it } from 'vitest';
import { resolveOwnedAdaptivePipelineS3Key } from './storage-key';

const USER_ID = '507f191e810c19729de860ea';
const OTHER_USER_ID = '507f191e810c19729de860eb';
const ADAPTIVE_PIPELINE_UPLOAD_PREFIX = 'uploads/adaptive_pipeline';

function objectPrefix(userId: string): string {
  return `${ADAPTIVE_PIPELINE_UPLOAD_PREFIX}/${userId}/`;
}

function ownedKey(fileName = '1710000000000-source.pdf'): string {
  return `${objectPrefix(USER_ID)}${fileName}`;
}

describe('resolveOwnedAdaptivePipelineS3Key', () => {
  it('accepts a legitimate own-namespace key', () => {
    const key = ownedKey();
    expect(resolveOwnedAdaptivePipelineS3Key(key, USER_ID)).toEqual({ ok: true, key });
  });

  it('denies another user namespace', () => {
    const foreign = `${objectPrefix(OTHER_USER_ID)}file.pdf`;
    expect(resolveOwnedAdaptivePipelineS3Key(foreign, USER_ID)).toEqual({
      ok: false,
      error: 's3Key is outside the authenticated user namespace',
    });
  });

  it('denies keys outside the adaptive pipeline prefix', () => {
    expect(
      resolveOwnedAdaptivePipelineS3Key(`uploads/quiz_extract/${USER_ID}/file.pdf`, USER_ID),
    ).toEqual({
      ok: false,
      error: 's3Key is outside the authenticated user namespace',
    });
    expect(resolveOwnedAdaptivePipelineS3Key(`users/${USER_ID}/source.pdf`, USER_ID)).toEqual({
      ok: false,
      error: 's3Key is outside the authenticated user namespace',
    });
  });

  it('denies dot traversal and parent-directory escapes', () => {
    const cases = [
      `${ADAPTIVE_PIPELINE_UPLOAD_PREFIX}/${USER_ID}/../${OTHER_USER_ID}/secret.pdf`,
      `${ADAPTIVE_PIPELINE_UPLOAD_PREFIX}/${USER_ID}/./secret.pdf`,
      `${ADAPTIVE_PIPELINE_UPLOAD_PREFIX}/../${USER_ID}/secret.pdf`,
      `${ADAPTIVE_PIPELINE_UPLOAD_PREFIX}/${USER_ID}/foo/../../etc/passwd`,
    ];
    for (const key of cases) {
      expect(resolveOwnedAdaptivePipelineS3Key(key, USER_ID).ok).toBe(false);
    }
  });

  it('denies encoded traversal when decoding exposes it', () => {
    const cases = [
      `${ADAPTIVE_PIPELINE_UPLOAD_PREFIX}/${USER_ID}/%2e%2e/${OTHER_USER_ID}/secret.pdf`,
      `${ADAPTIVE_PIPELINE_UPLOAD_PREFIX}/${USER_ID}/%2E%2E/secret.pdf`,
      `${ADAPTIVE_PIPELINE_UPLOAD_PREFIX}/${USER_ID}/%252e%252e/secret.pdf`,
    ];
    for (const key of cases) {
      expect(resolveOwnedAdaptivePipelineS3Key(key, USER_ID).ok).toBe(false);
    }
  });

  it('denies absolute paths, backslashes, and ambiguous separators', () => {
    const cases = [
      `/${ownedKey()}`,
      `C:\\uploads\\adaptive_pipeline\\${USER_ID}\\file.pdf`,
      ownedKey().replaceAll('/', '\\'),
      `${ADAPTIVE_PIPELINE_UPLOAD_PREFIX}//${USER_ID}/file.pdf`,
      `${ADAPTIVE_PIPELINE_UPLOAD_PREFIX}/${USER_ID}//file.pdf`,
      `s3://${ADAPTIVE_PIPELINE_UPLOAD_PREFIX}/${USER_ID}/file.pdf`,
    ];
    for (const key of cases) {
      expect(resolveOwnedAdaptivePipelineS3Key(key, USER_ID)).toEqual({
        ok: false,
        error: 'Invalid s3Key',
      });
    }
  });

  it('denies empty, whitespace, and malformed keys', () => {
    const cases = ['', '   ', 'file.pdf', ownedKey() + '/', ` ${ownedKey()}`, `${ownedKey()} `];
    for (const key of cases) {
      expect(resolveOwnedAdaptivePipelineS3Key(key, USER_ID).ok).toBe(false);
    }
  });

  it('denies prefix-only keys with no object name', () => {
    expect(resolveOwnedAdaptivePipelineS3Key(objectPrefix(USER_ID).slice(0, -1), USER_ID).ok).toBe(
      false,
    );
  });
});
