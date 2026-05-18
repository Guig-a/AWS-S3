import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { S3Client } from '@aws-sdk/client-s3';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';

describe('Upload API (e2e)', () => {
  let app: INestApplication<App>;
  let prismaMock: {
    fileAsset: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      delete: jest.Mock;
    };
    $connect: jest.Mock;
    $disconnect: jest.Mock;
  };

  beforeEach(async () => {
    prismaMock = {
      fileAsset: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'file-1',
            s3Key: 'uploads/file-1.png',
            originalName: 'avatar.png',
            mimeType: 'image/png',
            sizeBytes: 2048,
            createdAt: new Date('2026-05-18T12:00:00.000Z'),
          },
        ]),
        findUnique: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
      $connect: jest.fn(),
      $disconnect: jest.fn(),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('GET /upload/url sem key retorna 400', () => {
    return request(app.getHttpServer()).get('/upload/url').expect(400);
  });

  it('GET /upload/files lista arquivos do banco', async () => {
    const response = await request(app.getHttpServer()).get('/upload/files').expect(200);

    expect(response.body).toEqual([
      {
        id: 'file-1',
        key: 'uploads/file-1.png',
        originalName: 'avatar.png',
        mimeType: 'image/png',
        sizeBytes: 2048,
        createdAt: '2026-05-18T12:00:00.000Z',
      },
    ]);
    expect(prismaMock.fileAsset.findMany).toHaveBeenCalledWith({
      orderBy: {
        createdAt: 'desc',
      },
    });
  });

  it('DELETE /upload remove arquivo do S3 e do banco', async () => {
    const asset = {
      id: 'file-1',
      s3Key: 'uploads/file-1.png',
      originalName: 'avatar.png',
      mimeType: 'image/png',
      sizeBytes: 2048,
      createdAt: new Date('2026-05-18T12:00:00.000Z'),
    };

    prismaMock.fileAsset.findUnique.mockResolvedValue(asset);
    prismaMock.fileAsset.delete.mockResolvedValue(asset);
    const sendSpy = jest.spyOn(S3Client.prototype, 'send').mockResolvedValue({} as never);

    const response = await request(app.getHttpServer())
      .delete('/upload')
      .query({ key: 'uploads/file-1.png' })
      .expect(200);

    expect(response.body).toEqual({
      deleted: true,
      id: 'file-1',
      key: 'uploads/file-1.png',
    });
    expect(prismaMock.fileAsset.findUnique).toHaveBeenCalledWith({
      where: {
        s3Key: 'uploads/file-1.png',
      },
    });
    expect(prismaMock.fileAsset.delete).toHaveBeenCalledWith({
      where: {
        s3Key: 'uploads/file-1.png',
      },
    });
    expect(sendSpy).toHaveBeenCalledTimes(1);
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await app.close();
  });
});
