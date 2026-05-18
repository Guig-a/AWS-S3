# S3 Upload API — projeto de estudo

Projeto para estudar **AWS**, com upload no S3 e salvamento dos metadados no **RDS da AWS**. O fluxo principal é:

1. fazer upload do arquivo para o S3;
2. registrar a chave e os metadados no banco;
3. listar, filtrar e paginar os arquivos pelo banco;
4. gerar uma **URL pré-assinada** temporária para visualizar o arquivo privado.

## Por que existe?

Guardar arquivos privados no S3 sem expor o bucket publicamente, usando o banco como fonte de verdade para consulta e gerenciamento dos registros.

## O que tem aqui

- API NestJS para upload, listagem, visualização e exclusão
- Persistência de metadados com Prisma + PostgreSQL/RDS
- Página HTML em `http://localhost:3000/` para testar o fluxo completo

## Endpoints

### `POST /upload`

Recebe `multipart/form-data` com o campo `file`, envia o arquivo para o S3 e registra no banco.

Resposta:

```json
{
  "id": "uuid-do-registro",
  "key": "uploads/uuid.ext"
}
```

### `GET /upload/files`

Lista os arquivos registrados no banco.

Query params opcionais:

- `type=image` para filtrar por categoria de MIME type
- `type=application/pdf` para filtrar por MIME type exato
- `page=1`
- `limit=10`

Resposta:

```json
{
  "items": [
    {
      "id": "uuid-do-registro",
      "key": "uploads/uuid.ext",
      "originalName": "arquivo.pdf",
      "mimeType": "application/pdf",
      "sizeBytes": 12345,
      "createdAt": "2026-05-18T15:00:00.000Z"
    }
  ],
  "page": 1,
  "limit": 10,
  "total": 1,
  "totalPages": 1
}
```

### `GET /upload/url?key=...`

Busca a `key` no banco e gera uma URL pré-assinada com validade de aproximadamente **2 minutos**.

Resposta:

```json
{
  "url": "https://...",
  "expiresIn": "2 minutos",
  "expiresInSeconds": 120
}
```

### `DELETE /upload?key=...`

Remove o arquivo do S3 e depois remove o registro no banco.

Resposta:

```json
{
  "deleted": true,
  "id": "uuid-do-registro",
  "key": "uploads/uuid.ext"
}
```

## Interface local

A página servida em `http://localhost:3000/` permite:

- enviar arquivo;
- gerar URL temporária;
- listar arquivos do banco;
- filtrar por tipo;
- paginar resultados;
- excluir registros e objetos.

## Antes de rodar

- Node instalado
- Um bucket S3 na AWS
- Usuário IAM com permissão de `PutObject`, `GetObject` e `DeleteObject`
- Um PostgreSQL local ou no RDS
- Copiar `.env.example` para `.env` e preencher os valores

## Como rodar

```bash
npm install
npx prisma generate
npx prisma migrate deploy
npm run start:dev
```

Depois abre **`http://localhost:3000/`** ou testa via Insomnia/Postman/curl.

## Variáveis de ambiente

Veja `.env.example`. O projeto precisa de:

- região da AWS;
- bucket S3;
- credenciais IAM;
- `DATABASE_URL` do PostgreSQL;
- porta da aplicação.

## Licença

MIT
