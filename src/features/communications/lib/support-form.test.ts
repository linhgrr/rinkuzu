import { describe, expect, it } from 'vitest';
import { acceptSupportImages, validateSupportReply, validateSupportRequest } from './support-form';

function image(name: string, type = 'image/png', size = 1024): File {
  const file = new File(['x'], name, { type, lastModified: 1 });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

describe('support form checks (RIN-1018)', () => {
  it('mirrors the server: subject of 4+ trimmed characters and a non-blank body', () => {
    expect(validateSupportRequest('   abc ', '  ')).toEqual({
      subject: 'subjectTooShort',
      body: 'bodyRequired',
    });
    expect(validateSupportRequest('Help me', 'x')).toEqual({});
    expect(validateSupportReply(' \n ')).toBe('replyRequired');
    expect(validateSupportReply('ok')).toBeNull();
  });

  it('keeps PNG, JPEG and WebP up to 5 MB, three at most, never the same file twice', () => {
    const first = image('a.png');
    const picked = [
      first,
      image('doc.pdf', 'application/pdf'),
      image('big.jpg', 'image/jpeg', 5 * 1024 * 1024 + 1),
      image('b.webp', 'image/webp'),
    ];

    const once = acceptSupportImages([], picked);
    expect(once.files.map((file) => file.name)).toEqual(['a.png', 'b.webp']);
    expect(once.rejected).toBe(true);

    const again = acceptSupportImages(once.files, [image('a.png'), image('c.jpg', 'image/jpeg')]);
    expect(again.files.map((file) => file.name)).toEqual(['a.png', 'b.webp', 'c.jpg']);
    expect(again.rejected).toBe(true);

    expect(acceptSupportImages(again.files, [image('d.png')])).toEqual({
      files: again.files,
      rejected: true,
    });
    expect(acceptSupportImages([], [image('e.png')]).rejected).toBe(false);
  });
});
