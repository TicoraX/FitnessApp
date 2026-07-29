import { IsEmail, IsString, Matches, MaxLength } from 'class-validator';

export class ForgotDto {
  @IsEmail()
  @MaxLength(255)
  email!: string;
}

export class ResetDto {
  @IsString()
  @MaxLength(128)
  token!: string;

  // Mismo requisito que el registro: no tiene sentido que el camino de
  // recuperación acepte una contraseña más débil que el de alta.
  @IsString()
  @MaxLength(72)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{10,}$/, {
    message: 'La contraseña necesita 10 caracteres, una mayúscula, una minúscula y un número',
  })
  password!: string;
}
