// import { Injectable, UnauthorizedException } from '@nestjs/common';
// import { PassportStrategy } from '@nestjs/passport';
// import { Strategy } from 'passport-local';
// import { AuthenticationService } from '../authentication.service';

// @Injectable()
// export class LocalStrategy extends PassportStrategy(Strategy) {
//   constructor(private readonly authService: AuthenticationService) {
//     super();
//   }

//   async validate(email: string, password: string): Promise<any> {
//     const user = await this.authService.validateUserCredentials(
//       email,
//       password
//     );
//     if (!user) {
//       console.log(user);
//       throw new UnauthorizedException();
//     }
//     return user;
//   }
// }