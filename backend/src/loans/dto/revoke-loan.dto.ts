import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RevokeLoanDto {
  @ApiPropertyOptional({
    description:
      'Motivo administrativo de la revocación anticipada del préstamo por parte de Biblioteca FAUD-UNSJ',
    example:
      'Revocación solicitada por actualización de versión del documento en archivo de Biblioteca.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  motivo?: string;
}
