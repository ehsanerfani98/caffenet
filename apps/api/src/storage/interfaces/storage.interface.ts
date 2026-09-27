export interface IStorage {
  /**
   * Upload a file.
   * @returns the storage path/key (relative for local, S3 key for S3)
   */
  upload(
    file: Buffer,
    filename: string,
    mimeType: string,
    visibility?: 'public' | 'private',
  ): Promise<{ path: string; url?: string }>;

  /**
   * Get a signed URL for a private file (limited time).
   */
  getSignedUrl(path: string, expiresInSeconds: number): Promise<string>;

  /**
   * Get a direct (public) URL for a public file.
   */
  getPublicUrl(path: string): string;

  /**
   * Read a file as a Buffer (for streaming downloads).
   */
  read(path: string): Promise<Buffer>;

  /**
   * Delete a file.
   */
  delete(path: string): Promise<void>;

  /**
   * Check if a file exists.
   */
  exists(path: string): Promise<boolean>;
}

export const STORAGE_TOKEN = Symbol('STORAGE_TOKEN');
