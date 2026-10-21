import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { AuthService } from './auth.service';
import {
  LoginResponseDto,
  RegisterResponseDto,
  UserProfileResponseDto,
} from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@ApiTags('Autenticación y Sesión (RF05)')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({
    summary: 'Registrar un nuevo usuario departamental (estado inicial PENDIENTE)',
    description:
      'Crea una cuenta de usuario asociada a uno de los 19 departamentos de San Juan (RF05). La contraseña se almacena hasheada con bcrypt y la cuenta nace en estado `PENDIENTE` hasta que un Administrador de Biblioteca la apruebe.',
  })
  @ApiCreatedResponse({
    description: 'Usuario registrado exitosamente en estado PENDIENTE.',
    type: RegisterResponseDto,
  })
  @ApiConflictResponse({
    description: 'El correo electrónico ya se encuentra registrado.',
  })
  @ApiBadRequestResponse({
    description: 'Datos de entrada inválidos o departamento inexistente.',
  })
  async register(@Body() dto: RegisterDto): Promise<RegisterResponseDto> {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Iniciar sesión y obtener token JWT de sesión',
    description:
      'Verifica las credenciales y comprueba que la cuenta se encuentre en estado `APROBADO` (RF05). Si la cuenta está `PENDIENTE` o `RECHAZADO`, rechaza el acceso con `403 Forbidden`.',
  })
  @ApiOkResponse({
    description: 'Autenticación exitosa y emisión de JWT.',
    type: LoginResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Credenciales inválidas (email o contraseña incorrectos).',
  })
  @ApiForbiddenResponse({
    description:
      'Cuenta en estado PENDIENTE o RECHAZADO por la Biblioteca FAUD-UNSJ.',
  })
  async login(@Body() dto: LoginDto): Promise<LoginResponseDto> {
    return this.authService.login(dto);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt-auth')
  @ApiOperation({
    summary: 'Obtener los datos del perfil del usuario autenticado',
    description:
      'Devuelve la información actualizada del usuario autenticado y su departamento de pertenencia.',
  })
  @ApiOkResponse({
    description: 'Perfil del usuario autenticado.',
    type: UserProfileResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Token JWT inválido, ausente o expirado.',
  })
  async getProfile(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<UserProfileResponseDto> {
    return this.authService.getProfile(user.id);
  }
}
