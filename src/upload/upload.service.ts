import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import {
  DeleteObjectCommand,
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

const PRESIGN_EXPIRES_SECONDS = 120;

type StoredFile = {
  id: string;
  key: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
};

@Injectable()
export class UploadService {
  private readonly client: S3Client;
  private readonly bucket = process.env.AWS_S3_BUCKET;

  constructor(private readonly prisma: PrismaService) {
    this.client = new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
      },
    });
  }

  async upload(file: Express.Multer.File): Promise<StoredFile> {
    const ext = file.originalname.includes('.')
      ? file.originalname.split('.').pop()
      : '';
    const key = ext ? `uploads/${randomUUID()}.${ext}` : `uploads/${randomUUID()}`;

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );

    try {
      const asset = await this.prisma.fileAsset.create({
        data: {
          s3Key: key,
          originalName: file.originalname,
          mimeType: file.mimetype,
          sizeBytes: file.size,
        },
      });

      return this.toStoredFile(asset);
    } catch {
      try {
        await this.client.send(
          new DeleteObjectCommand({
            Bucket: this.bucket,
            Key: key,
          }),
        );
      } catch {
        // Melhor esforço para evitar órfãos no bucket quando o registro falha.
      }

      throw new InternalServerErrorException(
        'Falha ao registrar o arquivo no banco de dados.',
      );
    }
  }

  async listFiles(type?: string): Promise<StoredFile[]> {
    const normalizedType = type?.toLowerCase();
    const where = normalizedType
      ? normalizedType.includes('/')
        ? { mimeType: normalizedType }
        : { mimeType: { startsWith: `${normalizedType}/` } }
      : undefined;

    const assets = await this.prisma.fileAsset.findMany({
      ...(where ? { where } : {}),
      orderBy: {
        createdAt: 'desc',
      },
    });

    return assets.map((asset) => this.toStoredFile(asset));
  }

  async getPresignedUrl(key: string): Promise<string> {
    const asset = await this.prisma.fileAsset.findUnique({
      where: {
        s3Key: key,
      },
    });

    if (!asset) {
      throw new NotFoundException('Arquivo não encontrado para a key informada.');
    }

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: asset.s3Key,
    });

    return getSignedUrl(this.client, command, {
      expiresIn: PRESIGN_EXPIRES_SECONDS,
    });
  }

  async deleteFile(key: string): Promise<StoredFile> {
    const asset = await this.prisma.fileAsset.findUnique({
      where: {
        s3Key: key,
      },
    });

    if (!asset) {
      throw new NotFoundException('Arquivo não encontrado para a key informada.');
    }

    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: asset.s3Key,
      }),
    );

    const deletedAsset = await this.prisma.fileAsset.delete({
      where: {
        s3Key: asset.s3Key,
      },
    });

    return this.toStoredFile(deletedAsset);
  }

  private toStoredFile(asset: {
    id: string;
    s3Key: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    createdAt: Date;
  }): StoredFile {
    return {
      id: asset.id,
      key: asset.s3Key,
      originalName: asset.originalName,
      mimeType: asset.mimeType,
      sizeBytes: asset.sizeBytes,
      createdAt: asset.createdAt,
    };
  }
}
