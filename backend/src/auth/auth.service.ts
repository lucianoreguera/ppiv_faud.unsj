import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { EstadoValidacionUsuario, RolUsuario } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { JwtPayload } from '../common/interfaces/authenticated-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import {
  LoginResponseDto,
  RegisterResponseDto,
  UserProfileResponseDto,
} from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

const BCRYPT_SALT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Registra un nuevo usuario departamental (RF05).
   * La cuenta se crea con rol USUARIO y estadoValidacion PENDIENTE hasta que Biblioteca la apruebe.
   */
  async register(dto: RegisterDto): Promise<RegisterResponseDto> {
    const normalizedEmail = dto.email.trim().toLowerCase();

    const existingUser = await this.prisma.usuario.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      throw new ConflictException(
        `Ya existe una cuenta registrada con el correo electrónico "${normalizedEmail}".`,
      );
    }

    const departamento = await this.prisma.departamento.findUnique({
      where: { id: dto.departamentoId },
    });

    if (!departamento) {
      throw new BadRequestException(
        `El departamento seleccionado (ID: "${dto.departamentoId}") no existe en la provincia de San Juan.`,
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);

    const nuevoUsuario = await this.prisma.usuario.create({
      data: {
        nombre: dto.nombre.trim(),
        email: normalizedEmail,
        passwordHash,
        rol: RolUsuario.USUARIO,
        estadoValidacion: EstadoValidacionUsuario.PENDIENTE,
        departamentoId: departamento.id,
      },
      include: {
        departamento: {
          select: {
            id: true,
            nombre: true,
            esCapital: true,
          },
        },
      },
    });

    return {
      message:
        'Registro exitoso. Su cuenta se encuentra PENDIENTE de validación por parte de la Biblioteca FAUD-UNSJ.',
      usuario: this.toUserProfileDto(nuevoUsuario),
    };
  }

  /**
   * Autentica las credenciales de un usuario o administrador (RF05).
   * Bloquea el inicio de sesión con 403 Forbidden si el estadoValidacion es PENDIENTE o RECHAZADO.
   */
  async login(dto: LoginDto): Promise<LoginResponseDto> {
    const normalizedEmail = dto.email.trim().toLowerCase();

    const usuario = await this.prisma.usuario.findUnique({
      where: { email: normalizedEmail },
      include: {
        departamento: {
          select: {
            id: true,
            nombre: true,
            esCapital: true,
          },
        },
      },
    });

    if (!usuario) {
      throw new UnauthorizedException(
        'Credenciales inválidas. Verifique su correo electrónico y contraseña.',
      );
    }

    const isPasswordValid = await bcrypt.compare(
      dto.password,
      usuario.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException(
        'Credenciales inválidas. Verifique su correo electrónico y contraseña.',
      );
    }

    if (usuario.estadoValidacion === EstadoValidacionUsuario.PENDIENTE) {
      throw new ForbiddenException(
        'Su cuenta aguarda validación por parte de la Biblioteca FAUD-UNSJ (estado: PENDIENTE).',
      );
    }

    if (usuario.estadoValidacion === EstadoValidacionUsuario.RECHAZADO) {
      throw new ForbiddenException(
        'Su solicitud de cuenta fue rechazada por la Biblioteca FAUD-UNSJ (estado: RECHAZADO).',
      );
    }

    const payload: JwtPayload = {
      sub: usuario.id,
      email: usuario.email,
      nombre: usuario.nombre,
      rol: usuario.rol,
      departamentoId: usuario.departamentoId,
      departamentoNombre: usuario.departamento.nombre,
    };

    const accessToken = await this.jwtService.signAsync(payload);
    const expiresIn = this.configService.get<string>(
      'auth.jwtExpiresIn',
      '8h',
    );

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn,
      usuario: this.toUserProfileDto(usuario),
    };
  }

  /**
   * Devuelve el perfil actualizado del usuario autenticado.
   */
  async getProfile(userId: string): Promise<UserProfileResponseDto> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: userId },
      include: {
        departamento: {
          select: {
            id: true,
            nombre: true,
            esCapital: true,
          },
        },
      },
    });

    if (!usuario) {
      throw new NotFoundException('No se encontró el perfil del usuario.');
    }

    return this.toUserProfileDto(usuario);
  }

  private toUserProfileDto(usuario: {
    id: string;
    nombre: string;
    email: string;
    rol: RolUsuario;
    estadoValidacion: EstadoValidacionUsuario;
    departamentoId: string;
    departamento: {
      id: string;
      nombre: string;
      esCapital: boolean;
    };
    createdAt: Date;
    updatedAt: Date;
  }): UserProfileResponseDto {
    return {
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email,
      rol: usuario.rol,
      estadoValidacion: usuario.estadoValidacion,
      departamentoId: usuario.departamentoId,
      departamento: usuario.departamento,
      createdAt: usuario.createdAt,
      updatedAt: usuario.updatedAt,
    };
  }
}
