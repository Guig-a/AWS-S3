import {
  Controller,
  Post,
  Get,
  Delete,
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
    const storedFile = await this.uploadService.upload(file);
    return { id: storedFile.id, key: storedFile.key };
  }

  @Get('files')
  async listFiles() {
    return this.uploadService.listFiles();
  }

  @Get('url')
  async getUrl(@Query('key') key: string) {
    if (!key?.trim()) {
      throw new BadRequestException('Informe o query param "key" (ex.: uploads/uuid.pdf).');
    }
    const url = await this.uploadService.getPresignedUrl(key.trim());
    return { url, expiresIn: '2 minutos', expiresInSeconds: 120 };
  }

  @Delete()
  async deleteFile(@Query('key') key: string) {
    if (!key?.trim()) {
      throw new BadRequestException('Informe o query param "key" para excluir o arquivo.');
    }

    const deletedFile = await this.uploadService.deleteFile(key.trim());
    return { deleted: true, id: deletedFile.id, key: deletedFile.key };
  }
}
