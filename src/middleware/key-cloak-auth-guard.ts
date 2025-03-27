import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, LoggerService, Inject, HttpException, HttpStatus, ConflictException, NotFoundException } from '@nestjs/common';
import { Observable, from, of, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import axios, { HttpStatusCode } from 'axios';
import * as qs from 'qs';  
import moment = require('moment');
import { KEY_CLOAK_INTROSPECT, KEY_CLOAK_USER, KEY_CLOAK_TOKEN } from 'src/library/interfaces/api-endpoints.prod';
import { utilities as nestWinstonModuleUtilities, WinstonModule,  } from 'nest-winston';
import { transports,format } from 'winston';
import { KCloginAuthDto, authTokenDto } from 'src/authentication/dto/authentication.dto';
const path = require('path');
import { Reflector } from '@nestjs/core';
import { axiosInstance, axiosRejectUnauthorisedAgent } from './axiosConfig';
import { CREATE_TOKEN, FETCH_TOKEN } from 'src/library/interfaces/api-endpoints.local';
import { KCcreatUserDto } from 'src/users/dto/createuser.dto';
const fs = require('fs');
require('dotenv').config();

const logDir = './logs';
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}
const combinedLog = path.join(logDir, 'combined.log');
const errorLog = path.join(logDir, 'error.log');
const now = Date.now();
const delay = Date.now() - now;

const logger = WinstonModule.createLogger({
transports: [
    new transports.File({ filename: combinedLog }),
    new transports.File({ filename: errorLog, level: 'error' }),
    new transports.Console({
    format: format.combine(
        format.ms(),
        nestWinstonModuleUtilities.format.nestLike('Ifin', {
        colors: true,
        prettyPrint: true,
        }),
    ),
    }),
],
});

@Injectable()
export class KeyCloakAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    const accessToken = request.headers['authorization'];

    const reflectorHandler = new Reflector();
    
    const requiredRoles = reflectorHandler.get<string[]>('roles', context.getHandler()) || [];

    if (!accessToken) {
      logger.error(
        `${moment(now)} | ${HttpStatusCode.NotFound} | Access Token Missing - ${delay}ms `,
      );
    }

    return this.validateToken(accessToken, requiredRoles);
  }

  private validateToken(accessToken: string, roles:Array<string>): Observable<boolean> {
    return from(
        axios.post(
          KEY_CLOAK_INTROSPECT,
          qs.stringify(
            { 
              token: accessToken,
              client_secret: process.env.KEY_CLOAK_CLIENT_SECRET,
              client_id: process.env.KEY_CLOAK_CLIENT_ID,
            }
          ),
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          },
        )
      ).pipe(
        switchMap((response:any) => {
            const method = response.config.method;
            const url = response.config.url;

            if(!response.data.active)
              throw new UnauthorizedException({error:response,message:'Invalid access token'});

            const realAccessRoles = response.data.realm_access.roles;
            const hasRequiredRole = roles.some(role => realAccessRoles.includes(role));
            if (!hasRequiredRole && roles?.length) {
              throw new UnauthorizedException({error:response,message:'Insufficient role'});
            }
            // logger.log(
            //     `${moment(now)} | ${response.status} | Authentication | [${method.toUpperCase()}] ${url} - ${delay}ms ${JSON.stringify(
            //       response.data,
            //     )}`,
            //   );
            return [true];

        }),
        catchError((error:any) => {
          logger.error(
            `${moment(now)} | ${error.status} | [${error.config?.method?.toUpperCase() ||  error?.response?.error.config.method.toUpperCase()}] ${error.config?.url || error.response.error.config.url} - ${delay}ms ${JSON.stringify(
              {token:error.config?.data  || error.response.error.config.data},
            )} ${JSON.stringify(error.config?.data || error.response.error.data)} | ${JSON.stringify({message:error?.response?.message || error?.response?.message})}`,
          );
          throw new UnauthorizedException(
            {
              status: false,
              msg: error.response?.message,
            }
          );
        })
      );
  }

  authoriseKCUser(KCAuth: KCloginAuthDto) {
    return from(
      axios.post(
          KEY_CLOAK_TOKEN, 
          qs.stringify(this.createLoginKCStructure(KCAuth)), 
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          }
        )
      ).
      pipe(
        switchMap((loginResponse) => {
          const tokenLog = new authTokenDto();
          tokenLog.sessionState = loginResponse.data.session_state;
          tokenLog.accessToken = loginResponse.data.access_token;
          tokenLog.refreshToken = loginResponse.data.refresh_token;
          
      return from(
        axiosInstance.put(`${CREATE_TOKEN}`, tokenLog, { httpsAgent: axiosRejectUnauthorisedAgent })
          ).
          pipe(
            switchMap((authCreate)=>{
              logger.log(
                `${moment(now)} | Authentication | [POST] ${KEY_CLOAK_TOKEN} - ${delay}ms ${JSON.stringify(
                  {access_token:loginResponse.data.access_token,...KCAuth}
                )}` ,
              );
              return of({
                access_token:loginResponse.data.access_token,
                refreshToken:loginResponse.data.refresh_token,
                session_state:loginResponse.data.session_state
              });
            }),
            catchError((error) => {
              throw new UnauthorizedException({message:'Token creation failed, contact administrator',...error.response.data});
            }
            )
          );
        }
      ),
        catchError((error) => {
          throw new UnauthorizedException({message:'Login failed, contact administrator',...error.response.data});
        }
      )
    );
  }

  refreshToken(session_state){
      return from(
        axiosInstance.get(
          `${FETCH_TOKEN}/${session_state}`,
          { 
            httpsAgent: axiosRejectUnauthorisedAgent 
          }
        )
      ).pipe(
        switchMap((authFetchToken)=>{
          const refreshTokenDetails = authFetchToken?.data?.data;
          return from(
            axios.post(
            KEY_CLOAK_TOKEN,
            qs.stringify(this.createRefreshTokenStructure(refreshTokenDetails)), 
            {
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
              },
            }
          )).pipe(
            switchMap((authRefreshTokenDetails:any)=>{
              const tokenLog = new authTokenDto();
              tokenLog.sessionState = authRefreshTokenDetails.data.session_state;
              tokenLog.accessToken = authRefreshTokenDetails.data.access_token;
              tokenLog.refreshToken = authRefreshTokenDetails.data.refresh_token;
              return from(
                axiosInstance.put(`${CREATE_TOKEN}`, tokenLog, { httpsAgent: axiosRejectUnauthorisedAgent })
              ).
              pipe(
                switchMap((authCreate)=>{
                  return of({accessToken:authCreate.data.accessToken,sessionState:authCreate.data.sessionState})
                }),
                catchError((error) => {
                  throw new UnauthorizedException({message:'Token upsertion failed, contact administrator',error});
                }));
            }),
            catchError((error)=>{
              throw new UnauthorizedException({message:'Token refresh failed, contact administrator',...error.response});
            }))
        }),
        catchError((error)=>{
          logger.error(
            `${moment(now)} | ${error.status} | [GET] ${error.config?.url} - ${delay}ms ${JSON.stringify(
              {token:error.config?.data},
            )} ${JSON.stringify(error.response?.data)} | ${JSON.stringify({message:error?.response?.message})}`,
          );
          throw new UnauthorizedException({message:'Token fetch failed - (db error), contact administrator',...error.response.data});
        }))
  }

  fetchAuthUser(request):any{
    const token = request.headers.authorization;
      
    if (!token) {
      return { status:false, msg: 'Unauthorized' };
    }

    return from(
      axios.post(
        KEY_CLOAK_INTROSPECT,
        qs.stringify(
          { 
            token: token,
            client_secret: process.env.KEY_CLOAK_CLIENT_SECRET,
            client_id: process.env.KEY_CLOAK_CLIENT_ID,
          }
        ),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      )
    ).pipe(
      switchMap((response:any) => {
          const method = response.config.method;
          const url = response.config.url;

          if(!response.data.active)
            throw new UnauthorizedException({error:response,message:'Invalid access token'});

          logger.log(
              `${moment(now)} | ${response.status} | Authentication | [${method.toUpperCase()}] ${url} - ${delay}ms ${JSON.stringify(
                response.data,
              )}`,
            );
          return of({...response.data,status:true,userId:response.data.sub});
          
      }),
      catchError((error:any) => {
        logger.error(
          `${moment(now)} | ${error.status} | [${error.response?.error?.config.method.toUpperCase()}] ${error.response.error.config.url} - ${delay}ms ${JSON.stringify(
            {token:error.response.error.config.data},
          )} ${JSON.stringify(error.response.error.data)} | ${JSON.stringify({message:error.response.message})}`,
        );
        throw new UnauthorizedException(
          {
            status: false,
            msg: error.response.message,
          }
        );
      })
    );
  }

  createAuthUser(payload){
    let KCUserConfig = new KCcreatUserDto();
    KCUserConfig.email = payload.email;
    KCUserConfig.username = payload.username;
    return from(this.checkUserExistence(KCUserConfig.email, KCUserConfig.username)).pipe(
      switchMap((userExistence)=>{
      if(userExistence.isEmailExisting || userExistence.isUserNameExisting)
        throw new ConflictException(userExistence).getResponse();
      return from(this.generateClientToken()).pipe(
        switchMap((accessTokenResponse)=>{
          return from(
            axios.post(
              KEY_CLOAK_USER,
              payload,
              {
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${accessTokenResponse.access_token}`
                },
              }
            )
          ).pipe(
            switchMap((response:any) => {
                return of(response.data);                
            }),
            catchError((error:any) => {
              logger.error(
                `${moment(now)} | ${error.response.status} | [${error?.request?.method.toUpperCase()}] ${error.response.config.url} - ${delay}ms ${JSON.stringify(
                  {token:error.response.config.data},
                )} ${JSON.stringify(error.response.data)} | ${JSON.stringify({message:error.response.message})}`,
              );
              throw new UnauthorizedException(error.response?.data).getResponse();
            })
          );
        })
      )
    }),catchError((error)=>{
      return throwError(error)
    }))
  }

  checkUserExistence(email, username) {
    return from(this.generateClientToken()).pipe(
      switchMap((accessTokenResponse)=>{
        return from(
          axios.get(
            `${KEY_CLOAK_USER}?username=${username}`,
            {
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Bearer ${accessTokenResponse.access_token}`
              },
            },
          )
        ).pipe(
          switchMap((response:any) => {
            let isEmailExisting = false,isUserNameExisting = false;
            if (response.data?.length) {
              response.data.forEach(indUser => {
                  if (indUser.email === `${email}`) {
                      isEmailExisting = true;
                      return;
                  }
              });
              isUserNameExisting = true;
            }
            return of({isEmailExisting, isUserNameExisting});
          }),
          catchError((error:any) => {
            logger.error(
              `${moment(now)} | ${error.response?.status} | [${error.request?.method.toUpperCase()}] ${error.response?.config?.url} - ${delay}ms ${JSON.stringify(
                {token:error.response.config.data},
              )} ${JSON.stringify(error.response?.data)} | ${JSON.stringify({message:error.response?.statusText})}`,
            );
            throw new UnauthorizedException(
              {
                status: false,
                msg: error.response.message,
              }
            );
          })
        );
    }),catchError((error)=>{
      throw new UnauthorizedException(
        {
          status: false,
          msg: error.response.message,
        }
      );
    })
    )
  }

  checkEmailExistence(email) {
    return from(this.generateClientToken()).pipe(
      switchMap((accessTokenResponse)=>{
        return from(
          axios.get(
            `${KEY_CLOAK_USER}?email=${email}`,
            {
              headers: {
                // 'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Bearer ${accessTokenResponse.access_token}`
              },
            },
          )
        ).pipe(
          switchMap((response:any) => {
            console.log(response,"email response")
            let isEmailExisting = false;
            if (response.data?.length) {
              isEmailExisting = true;
            }
            return of({isEmailExisting, userDetails:response?.data});
          }),
          catchError((error:any) => {
            console.log(error,"email check error")
            logger.error(
              `${moment(now)} | ${error.response?.status} | [${error.request?.method.toUpperCase()}] ${error.response?.config?.url} - ${delay}ms ${JSON.stringify(
                {token:error.response.config.data},
              )} ${JSON.stringify(error.response?.data)} | ${JSON.stringify({message:error.response?.statusText})}`,
            );
            throw new UnauthorizedException(
              {
                status: false,
                msg: error.response.message,
              }
            );
          })
        );
    }),catchError((error)=>{
      throw new UnauthorizedException(
        {
          status: false,
          msg: error.response.message,
        }
      );
    })
    )
  }

  resetPassword(body) {
    return from(this.generateClientToken()).pipe(
      switchMap((accessTokenResponse)=>{
      return from(this.checkEmailExistence(body.email)).pipe(
        switchMap((userExistence)=>{
          const userId = userExistence.userDetails[0].id;
          return from(
            axios.put(
              `${KEY_CLOAK_USER}/${userId}/reset-password`,
              body.cred,
              {
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${accessTokenResponse.access_token}`
                },
              },
            )
          ).pipe(
            switchMap((response:any) => {
              return of(true)
            }),
            catchError((error:any) => {
              logger.error(
                `${moment(now)} | ${error.response?.status} | [${error.request?.method.toUpperCase()}] ${error.response?.config?.url} - ${delay}ms ${JSON.stringify(
                  {token:error.response.config.data},
                )} ${JSON.stringify(error.response?.data)} | ${JSON.stringify({message:error.response?.statusText})}`,
              );
              throw new UnauthorizedException(
                {
                  status: false,
                  msg: error.response.message,
                }
              );
            })
          );
      }),catchError((error)=>{
        throw new UnauthorizedException(
          {
            status: false,
            msg: error.response.message,
          }
        );
      })
      )
    }),catchError((error)=>{
      throw new UnauthorizedException(
        {
          status: false,
          msg: error.response.message,
        }
      );
    }))
  }

  generateClientToken(){
    return from(
      axios.post(
        KEY_CLOAK_TOKEN,
        qs.stringify(
          { 
            client_secret: process.env.KEY_CLOAK_CLIENT_SECRET,
            client_id: process.env.KEY_CLOAK_CLIENT_ID,
            grant_type: 'client_credentials',
          }
        ),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      )
    ).pipe(
      switchMap((response:any) => {
          if(!response.data.access_token)
            throw new UnauthorizedException({error:response,message:'Invalid access token'});

          return of(response.data);
          
      }),
      catchError((error:any) => {
        console.log(error)
        throw new UnauthorizedException(
          {
            status: false,
            msg: error.response.message,
          }
        );
      })
    );
  }

  fetchUserRoles(request){
    return from(this.fetchAuthUser(request)).pipe(
      switchMap((auth: any)=>{
        const userId = auth.userId;
        if(!userId)
          throw new NotFoundException('UserId not found').getResponse();
        return from(this.generateClientToken()).pipe(
          switchMap((clientTokenInfo)=>{
            return this.searchRolesByUserId(userId, clientTokenInfo.access_token);
          }),
          catchError((error)=>{
            return throwError(error);
          })
        )
      }),
      catchError((error)=>{
        return throwError(error);
      })
    )
  }

  searchRolesByUserId(userId, accessToken){
    return from(
      axios.get(
        `${KEY_CLOAK_USER}/${userId}/role-mappings/realm/composite`,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Bearer ${accessToken}`
          },
        },
      )
    ).pipe(
      switchMap((response:any) => {
        return of(response.data)
      }),
      catchError((error:any) => {
        logger.error(
          `${moment(now)} | ${error.response?.status} | [${error.request?.method.toUpperCase()}] ${error.response?.config?.url} - ${delay}ms ${JSON.stringify(
            {token:error.response.config.data},
          )} ${JSON.stringify(error.response?.data)} | ${JSON.stringify({message:error.response?.statusText})}`,
        );
        throw new UnauthorizedException(
          {
            status: false,
            msg: error.response.message,
          }
        );
      })
    );
  }

  private createLoginKCStructure(KCAuth){
    return {
      client_id: process.env.KEY_CLOAK_CLIENT_ID,
      client_secret: process.env.KEY_CLOAK_CLIENT_SECRET,
      grant_type: 'password',
      username:KCAuth.userName,
      password:KCAuth.password
    }
  }

  private createRefreshTokenStructure(authToken){
    return {
      client_id: process.env.KEY_CLOAK_CLIENT_ID,
      client_secret: process.env.KEY_CLOAK_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token:authToken.refreshToken
    }
  }
}
