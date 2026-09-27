import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs, createReadStream, createWriteStream } from 'fs';
import { join, resolve, extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { IStorage } from '../interfaces/storage.interface';

/**
 * Local filesystem storage driver — for shared hosting profile.
 * Files stored in storage/app/public and storage/app/private.
 *
 * Public files are served directly by Apache/Next.js from a configured route.
 * Private files are NEVER directly accessible — only via signed URLs (which
 * for local driver means: backend streams them after auth check).
 */
@Injectable()
export class LocalStorage implements IStorage, OnModuleInit {
  private readonly logger = new Logger(LocalStorage.name);
  private publicBase: string;
  private privateBase: string;

  constructor(private readonly config: ConfigService) {
    this.publicBase = resolve(
      process.cwd(),
      this.config.get<string>('STORAGE_LOCAL_PUBLIC_PATH', './storage/app/public')!,
    );
    this.privateBase = resolve(
      process.cwd(),
      this.config.get<string>('STORAGE_LOCAL_PRIVATE_PATH', './storage/app/private')!,
    );
  }

  async onModuleInit() {
    await fs.mkdir(this.publicBase, { recursive: true });
    await fs.mkdir(this.privateBase, { recursive: true });
    this.logger.log(`📁 Local storage initialized (public: ${this.publicBase}, private: ${this.privateBase})`);
  }

  async upload(
    file: Buffer,
    filename: string,
    mimeType: string,
    visibility: 'public' | 'private' = 'private',
  ): Promise<{ path: string; url?: string }> {
    const base = visibility === 'public' ? this.publicBase : this.privateBase;
    const ext = extname(filename).toLowerCase();
    const storedName = `${uuidv4()}${ext}`;
    const yearMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    const relativePath = `${visibility}/${yearMonth}/${storedName}`;
    const fullPath = join(base, yearMonth, storedName);
    await fs.mkdir(join(base, yearMonth), { recursive: true });
    await fs.writeFile(fullPath, file);
    return {
      path: relativePath,
      url: visibility === 'public' ? this.getPublicUrl(relativePath) : undefined,
    };
  }

  async getSignedUrl(path: string, _expiresInSeconds: number): Promise<string> {
    // For local storage, signed URLs are not real signed URLs — the backend
    // streams the file after auth check. So we return an API endpoint that
    // performs the auth and streams the file.
    return `/api/v1/files/${encodeURIComponent(path)}`;
  }

  getPublicUrl(path: string): string {
    // Public files served at /storage/public/...
    return `/storage/public/${path.replace(/^public\//, '')}`;
  }

  async read(path: string): Promise<Buffer> {
    // Path is like "private/2026-09/abc.pdf" or "public/2026-09/abc.pdf"
    const isPrivate = path.startsWith('private/');
    const base = isPrivate ? this.privateBase : this.publicBase;
    const relativePath = path.replace(/^(public|private)\//, '');
    const fullPath = join(base, relativePath);
    return fs.readFile(fullPath);
  }

  async delete(path: string): Promise<void> {
    const isPrivate = path.startsWith('private/');
    const base = isPrivate ? this.privateBase : this.publicBase;
    const relativePath = path.replace(/^(public|private)\//, '');
    await fs.unlink(join(base, relativePath)).catch(() => undefined);
  }

  async exists(path: string): Promise<boolean> {
    try {
      const isPrivate = path.startsWith('private/');
      const base = isPrivate ? this.privateBase : this.publicBase;
      const relativePath = path.replace(/^(public|private)\//, '');
      await fs.access(join(base, relativePath));
      return true;
    } catch {
      return false;
    }
  }
}
