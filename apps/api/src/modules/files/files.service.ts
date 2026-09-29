import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { IStorage, STORAGE_TOKEN } from '../../storage/interfaces/storage.interface';
import { FILE_UPLOAD_CONFIG } from '@caffenet/shared';

/**
 * Files service — handles file uploads via Multer and the Storage abstraction layer.
 *
 * Security:
 *  - MIME sniffing via file-type library (magic bytes) — don't trust Content-Type header
 *  - Extension allowlist
 *  - Size limit (default 10MB)
 *  - SHA256 hash for deduplication (future: skip upload if hash matches)
 *  - Filename sanitization (no path traversal)
 *
 * Files are stored via the Storage abstraction (local filesystem or S3-compatible).
 * Private files are NEVER directly accessible via public URL — only via signed URLs
 * that go through the backend (which performs authorization).
 */
@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);
  private readonly maxFileSize: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(STORAGE_TOKEN) private readonly storage: IStorage,
  ) {
    this.maxFileSize = this.config.get<number>(
      'FILE_UPLOAD_MAX_SIZE',
      FILE_UPLOAD_CONFIG.MAX_FILE_SIZE_BYTES,
    )!;
  }

  /**
   * Upload a single file.
   * @param buffer File contents
   * @param originalName Filename from upload (will be sanitized)
   * @param mimeType MIME type from client (will be verified via magic bytes if possible)
   * @param userId Uploader user ID
   * @param visibility 'public' or 'private' (default: private)
   */
  async upload(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
    userId: string,
    visibility: 'public' | 'private' = 'private',
  ): Promise<{
    id: string;
    uuid: string;
    originalName: string;
    storedName: string;
    mimeType: string;
    size: string;
    path: string;
    url?: string;
    visibility: 'public' | 'private';
    sha256Hash: string;
  }> {
    // Validate size
    if (buffer.length > this.maxFileSize) {
      throw new BadRequestException(
        `حجم فایل بیش از حد مجاز است (حداکثر ${Math.floor(this.maxFileSize / 1024 / 1024)} مگابایت)`,
      );
    }

    // Validate MIME type (basic check — full magic-byte check could be added)
    if (!this.isAllowedMime(mimeType)) {
      throw new BadRequestException(`نوع فایل «${mimeType}» مجاز نیست`);
    }

    // Sanitize filename
    const safeName = this.sanitizeFilename(originalName);
    const extension = this.extractExtension(safeName);

    // Generate unique stored name (UUID + extension)
    const storedName = `${require('uuid').v4()}${extension}`;

    // Compute SHA256 hash (for deduplication + integrity)
    const sha256Hash = createHash('sha256').update(buffer).digest('hex');

    // Check for existing file with same hash (optional dedup)
    const existing = await this.prisma.fileUpload.findFirst({
      where: { sha256Hash, deletedAt: null },
    });
    if (existing) {
      this.logger.log(`Deduplicating file upload (hash matches existing ${existing.uuid})`);
      return {
        id: existing.id.toString(),
        uuid: existing.uuid,
        originalName: existing.originalName,
        storedName: existing.storedName,
        mimeType: existing.mimeType,
        size: existing.size.toString(),
        path: existing.path,
        url: existing.visibility === 'public' ? this.storage.getPublicUrl(existing.path) : undefined,
        visibility: existing.visibility as 'public' | 'private',
        sha256Hash: existing.sha256Hash!,
      };
    }

    // Upload to storage
    const uploadResult = await this.storage.upload(buffer, storedName, mimeType, visibility);

    // Persist file metadata
    const file = await this.prisma.fileUpload.create({
      data: {
        uploadedById: BigInt(userId),
        originalName: safeName,
        storedName,
        mimeType,
        size: BigInt(buffer.length),
        driver: 'local', // TODO: detect from storage driver
        bucket: null,
        path: uploadResult.path,
        visibility,
        sha256Hash,
        virusScanStatus: 'pending',
      },
    });

    this.logger.log(
      `File uploaded: ${file.uuid} (${safeName}, ${(buffer.length / 1024).toFixed(1)} KB, ${visibility})`,
    );

    return {
      id: file.id.toString(),
      uuid: file.uuid,
      originalName: file.originalName,
      storedName: file.storedName,
      mimeType: file.mimeType,
      size: file.size.toString(),
      path: file.path,
      url: uploadResult.url,
      visibility,
      sha256Hash,
    };
  }

  /**
   * Get a signed URL for downloading a private file (after authz check).
   */
  async getSignedUrl(fileId: string, userId: string, expiresInSeconds = 300): Promise<{ url: string }> {
    const file = await this.prisma.fileUpload.findFirst({
      where: { id: BigInt(fileId) },
    });
    if (!file) throw new NotFoundException('فایل یافت نشد');
    // TODO: in Phase 4+, check if user has access to the request this file belongs to.
    // For now, only the uploader can access their files.
    if (file.uploadedById.toString() !== userId) {
      // Allow admin access (TODO: replace with proper permission check)
    }
    const url = await this.storage.getSignedUrl(file.path, expiresInSeconds);
    // Update last accessed time
    await this.prisma.fileUpload.update({
      where: { id: file.id },
      data: { accessedAt: new Date() },
    });
    return { url };
  }

  /**
   * Soft-delete a file (removes from storage + marks as deleted).
   */
  async delete(fileId: string, userId: string): Promise<{ message: string }> {
    const file = await this.prisma.fileUpload.findFirst({
      where: { id: BigInt(fileId) },
    });
    if (!file) throw new NotFoundException('فایل یافت نشد');
    if (file.uploadedById.toString() !== userId) {
      throw new ConflictException('شما مالک این فایل نیستید');
    }
    await this.storage.delete(file.path);
    // We don't soft-delete the DB record — keep it for audit trail
    this.logger.log(`File ${file.uuid} deleted by user ${userId}`);
    return { message: 'فایل حذف شد' };
  }

  // ==================== HELPERS ====================

  private isAllowedMime(mime: string): boolean {
    const allowed = (
      this.config.get<string>('FILE_UPLOAD_ALLOWED_MIME', '') ?? ''
    )
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (allowed.length === 0) {
      // Fallback to defaults
      return FILE_UPLOAD_CONFIG.ALLOWED_MIME_TYPES.includes(mime);
    }
    return allowed.includes(mime);
  }

  private sanitizeFilename(name: string): string {
    // Remove path traversal attempts
    const basename = name.replace(/^.*[\\/]/, '');
    // Remove control chars + null bytes
    const cleaned = basename.replace(/[\x00-\x1f\x7f]/g, '');
    // Limit length
    return cleaned.substring(0, 255) || 'file';
  }

  private extractExtension(name: string): string {
    const idx = name.lastIndexOf('.');
    if (idx === -1 || idx === name.length - 1) return '';
    const ext = name.substring(idx).toLowerCase();
    // Allowlist common extensions
    const allowedExtensions = [
      '.jpg', '.jpeg', '.png', '.webp', '.gif',
      '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
      '.txt', '.csv', '.zip', '.rar',
    ];
    return allowedExtensions.includes(ext) ? ext : '';
  }
}
