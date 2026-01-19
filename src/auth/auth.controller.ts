import { Body, Controller, Post, UseInterceptors } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { TransformInterceptor } from "../common/interceptors/transform.interceptor";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { ConfirmRegisterDto } from "./dto/confirm-register.dto";
import { LoginGoogleDto } from "./dto/login-google.dto";

@ApiTags('Authentication')
@Controller('auth')
@UseInterceptors(TransformInterceptor)
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    @Post('register-request')
    @ApiOperation({ summary: 'Send data register -> Receive OTP' })
    @ApiResponse({ status: 201, description: 'OTP successfully sent' })
    @ApiResponse({ status: 400, description: 'Bad Request' })
    async requestRegister(@Body() dto: RegisterDto) {
        return this.authService.requestRegister(dto);
    }

    @Post('register')
    @ApiOperation({ summary: 'Register new user' })
    @ApiResponse({ status: 201, description: 'User successfully registered' })
    @ApiResponse({ status: 400, description: 'Bad Request' })
    async register(@Body() dto: ConfirmRegisterDto) {
        return this.authService.register(dto);
    }

    @Post('login')
    @ApiOperation({ summary: 'Login user' })
    @ApiResponse({ status: 200, description: 'Login successful' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async login(@Body() loginDto: LoginDto) {
        return this.authService.login(loginDto);
    }

    @Post('admin/login')
    @ApiOperation({ summary: 'Login admin' })
    @ApiResponse({ status: 200, description: 'Login successful' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async adminLogin(@Body() loginDto: LoginDto) {
        return this.authService.adminLogin(loginDto);
    }

    // @Post('send-verify-code')
    // @ApiOperation({ summary: 'Bước 1: Gửi mã OTP về email' })
    // @ApiBody({ schema: { type: 'object', properties: { email: { type: 'string' } } } })
    // async sendVerifyCode(@Body('email') email: string) {
    //     return this.authService.sendVerificationCode(email);
    // }

    // @Post('check-verify-code')
    // @ApiOperation({ summary: 'Bước 2: Kiểm tra mã OTP người dùng nhập' })
    // @ApiBody({
    //     schema: {
    //         type: 'object',
    //         properties: {
    //             email: { type: 'string' },
    //             code: { type: 'string' }
    //         }
    //     }
    // })
    // async checkVerifyCode(@Body() body: { email: string; code: string }) {
    //     return this.authService.verifyCode(body.email, body.code);
    // }

    @Post('login-google')
    @ApiOperation({ summary: 'Đăng nhập bằng Google (FE gửi token_id)' })
    @ApiResponse({ status: 200, description: 'Login Google thành công' })
    @ApiResponse({ status: 401, description: 'Token không hợp lệ' })
    async loginGoogle(@Body() dto: LoginGoogleDto) {
        return this.authService.loginWithGoogle(dto);
    }

    @Post('forgot-password')
    @ApiOperation({ summary: 'Quên mật khẩu -> Gửi OTP' })
    async forgotPassword(@Body() dto: ForgotPasswordDto) {
        return this.authService.forgotPassword(dto);
    }

    @Post('reset-password')
    @ApiOperation({ summary: 'Đặt lại mật khẩu (Dùng OTP)' })
    async resetPassword(@Body() dto: ResetPasswordDto) {
        return this.authService.resetPassword(dto);
    }


}
