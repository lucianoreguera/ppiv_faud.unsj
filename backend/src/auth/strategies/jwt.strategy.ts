import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { EstadoValidacionUsuario } from '@prisma/client';
import { ExtractJwt, Strategy } from 'passport-jwt';
import {
  AuthenticatedUser,
  JwtPayload,
} from '../../common/interfaces/authenticated-user.interface';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const secret = configService.get<string>('auth.jwtSecret');
    if (!secret) {
      throw new Error('JWT_SECRET no está definido en la configuración.');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: payload.sub },
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
        'El usuario asociado al token ya no existe.',
      );
    }

    if (usuario.estadoValidacion !== EstadoValidacionUsuario.APROBADO) {
      throw new ForbiddenException(
        `Su cuenta no se encuentra habilitada para operar (estado actual: ${usuario.estadoValidacion}).`,
      );
    }

    return {
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email,
      rol: usuario.rol,
      estadoValidacion: usuario.estadoValidacion,
      departamentoId: usuario.departamentoId,
      departamento: usuario.departamento,
    };
  }
}
