import { IsEmail, IsString, Matches, MaxLength } from 'class-validator';

export class ClaimDto {
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsString()
  @MaxLength(72)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{10,}$/, {
    message: 'password: mínimo 10 caracteres, con mayúscula, minúscula y número',
  })
  password!: string;
}
