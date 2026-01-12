import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, any> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => {
        // Handle if data is already in correct format (optional)
        if (data && data.status && data.status_code) {
          return data;
        }

        const response: any = {
          status: "success",
          status_code: context.switchToHttp().getResponse().statusCode,
        };

        if (data && typeof data === 'object' && 'message' in data && Object.keys(data).length === 1) {
          response.message = data.message;
        } else {
          response.data = data;
        }

        return response;
      }),
    );
  }
}
