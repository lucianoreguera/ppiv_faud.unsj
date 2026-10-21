import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'ana.perez@jachal.gov.ar',
    description: 'Correo electrónico registrado del usuario o administrador',
  })
  @IsEmail(
    {},
    { message: 'Debe proporcionar un correo electrónico con formato válido.' },
  )
  @IsNotEmpty({ message: 'El correo electrónico es obligatorio.' })
  email!: string;

  @ApiProperty({
    example: 'Alumno123!',
    description: 'Contraseña de la cuenta',
  })
  @IsString()
  @IsNotEmpty({ message: 'La contraseña es obligatoria.' })
  password!: string;
}
