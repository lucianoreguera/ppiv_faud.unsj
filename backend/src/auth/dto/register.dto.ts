import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({
    example: 'Ramiro Quiroga',
    description: 'Nombre y apellido completo del solicitante',
  })
  @IsString()
  @IsNotEmpty({ message: 'El nombre completo es obligatorio.' })
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres.' })
  @MaxLength(120, { message: 'El nombre no puede superar los 120 caracteres.' })
  nombre!: string;

  @ApiProperty({
    example: 'ramiro.quiroga@jachal.gov.ar',
    description: 'Correo electrónico institucional o personal (único)',
  })
  @IsEmail(
    {},
    { message: 'Debe proporcionar un correo electrónico con formato válido.' },
  )
  @IsNotEmpty({ message: 'El correo electrónico es obligatorio.' })
  email!: string;

  @ApiProperty({
    example: 'Alumno123!',
    description: 'Contraseña de acceso (mínimo 6 caracteres)',
    minLength: 6,
  })
  @IsString()
  @IsNotEmpty({ message: 'La contraseña es obligatoria.' })
  @MinLength(6, {
    message: 'La contraseña debe tener al menos 6 caracteres.',
  })
  @MaxLength(100)
  password!: string;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description:
      'UUID del departamento de San Juan al que pertenece el usuario (RF05)',
  })
  @IsUUID('4', {
    message: 'Debe seleccionar un departamento válido (UUID v4).',
  })
  @IsNotEmpty({ message: 'El departamento de residencia es obligatorio.' })
  departamentoId!: string;
}
