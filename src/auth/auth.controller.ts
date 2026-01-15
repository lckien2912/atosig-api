import { Body, Controller, Get, Post, Req, Res, UseGuards, UseInterceptors } from "@nestjs/common";
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { TransformInterceptor } from "../common/interceptors/transform.interceptor";
import { AuthGuard } from "@nestjs/passport";

@ApiTags('Authentication')
@Controller('auth')
@UseInterceptors(TransformInterceptor)
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    @Post('register')
    @ApiOperation({ summary: 'Register new user' })
    @ApiResponse({ status: 201, description: 'User successfully registered' })
    @ApiResponse({ status: 400, description: 'Bad Request' })
    async register(@Body() registerDto: RegisterDto) {
        return this.authService.register(registerDto);
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

    @Post('send-verify-code')
    @ApiOperation({ summary: 'Bước 1: Gửi mã OTP về email' })
    @ApiBody({ schema: { type: 'object', properties: { email: { type: 'string' } } } })
    async sendVerifyCode(@Body('email') email: string) {
        return this.authService.sendVerificationCode(email);
    }

    @Post('check-verify-code')
    @ApiOperation({ summary: 'Bước 2: Kiểm tra mã OTP người dùng nhập' })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                email: { type: 'string' },
                code: { type: 'string' }
            }
        }
    })
    async checkVerifyCode(@Body() body: { email: string; code: string }) {
        return this.authService.verifyCode(body.email, body.code);
    }

    @Get('google')
    @UseGuards(AuthGuard('google'))
    @ApiOperation({ summary: 'Chuyển hướng sang trang đăng nhập Google' })
    async googleAuth(@Req() req) {
    }

    @Get('google/redirect')
    @UseGuards(AuthGuard('google'))
    @ApiOperation({ summary: 'Google gọi lại để trả kết quả' })
    async googleAuthRedirect(@Req() req, @Res() res) {
        const data = await this.authService.loginWithGoogle(req.user);
        return res.json({
            message: 'Login Google thành công!',
            token: data.access_token,
            user: data.user
        });
        // const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

        // return res.redirect(`${frontendUrl}/auth/success?token=${data.access_token}&email=${data.user.email}`);
    }


}
