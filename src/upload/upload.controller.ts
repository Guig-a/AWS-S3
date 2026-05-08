import {
  Controller,
  Post,
  Get,
  Query,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadService } from './upload.service';

@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async upload(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Envie o arquivo no campo "file" (multipart/form-data).');
    }
    const key = await this.uploadService.upload(file);
    return { key };
  }

  @Get('url')
  async getUrl(@Query('key') key: string) {
    if (!key?.trim()) {
      throw new BadRequestException('Informe o query param "key" (ex.: uploads/uuid.pdf).');
    }
    const url = await this.uploadService.getPresignedUrl(key);
    return { url, expiresIn: '2 minutos', expiresInSeconds: 120 };
  }
}
