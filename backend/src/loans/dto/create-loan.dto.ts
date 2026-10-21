import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class CreateLoanDto {
  @ApiProperty({
    description:
      'UUID del documento académico del catálogo sobre el cual se solicita el préstamo digital de 7 días',
    example: '9a8b7c6d-1234-4a5b-8c9d-0e1f2a3b4c5d',
  })
  @IsUUID('4', {
    message:
      'El campo documentoId debe ser un identificador UUID v4 válido correspondiente a un documento del catálogo.',
  })
  @IsNotEmpty({
    message: 'El campo documentoId es obligatorio para solicitar un préstamo.',
  })
  documentoId!: string;
}
