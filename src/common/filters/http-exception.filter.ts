import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus,
} from "@nestjs/common";
import { Request, Response } from "express";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();

        const status =
            exception instanceof HttpException
                ? exception.getStatus()
                : HttpStatus.INTERNAL_SERVER_ERROR;

        const exceptionResponse =
            exception instanceof HttpException
                ? exception.getResponse()
                : "Internal server error";

        let message = "Internal server error";

        if (typeof exceptionResponse === 'string') {
            message = exceptionResponse;
        } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
            const resp = exceptionResponse as any;
            if (Array.isArray(resp.message)) {
                // Class validator returns array of messages
                message = resp.message[0];
            } else {
                message = resp.message || resp.error || JSON.stringify(resp);
            }
        }

        console.error('Exception caught:', exception);

        response.status(status).json({
            status: "error",
            status_code: status,
            message: message,
            timestamp: new Date().toISOString(),
            path: request.url,
        });
    }
}
