import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    InternalServerErrorException,
    NotFoundException,
    UnauthorizedException
} from '@nestjs/common';
import { AxiosError } from 'axios';
import { AffiliateErrorCode } from '../enums/affiliate-error-code.enum';

/**
 * Maps affiliate error codes to appropriate NestJS exceptions
 * @param code - The error code from affiliate service
 * @param message - The error message from affiliate service
 * @throws NestJS exception based on error code
 */
export const handleAffiliateError = (code: AffiliateErrorCode, message: string): never => {
    switch (code) {
        case AffiliateErrorCode.SOME_THING_ERROR:
            throw new InternalServerErrorException(message);
        case AffiliateErrorCode.VALIDATION_CONSTRAINTS:
            throw new BadRequestException(message);
        case AffiliateErrorCode.NOT_FOUND:
            throw new NotFoundException(message);
        case AffiliateErrorCode.EXISTS:
            throw new ConflictException(message);
        case AffiliateErrorCode.INVALID:
            throw new BadRequestException(message);
        default:
            throw new InternalServerErrorException(`Unknown error code: ${code}. Message: ${message}`);
    }
};

/**
 * Handles Axios errors from HTTP requests
 * @param error - The Axios error object
 * @throws NestJS exception based on HTTP status code
 */
export const handleAxiosError = (error: AxiosError): never => {
    if (error.response) {
        const status = error.response.status;
        const message = (error.response.data as { message?: string })?.message || error.message || 'Request failed';

        switch (status) {
            case 401:
                throw new UnauthorizedException(message);
            case 403:
                throw new ForbiddenException(message);
            case 404:
                throw new NotFoundException(message);
            case 400:
                throw new BadRequestException(message);
            default:
                throw new InternalServerErrorException(`HTTP ${status}: ${message}`);
        }
    }

    // Network error or other Axios errors
    throw new InternalServerErrorException(error.message || 'Network error occurred');
};
