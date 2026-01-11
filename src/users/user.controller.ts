import { Controller, Get, Body, Patch, Param, Delete, UseGuards, Request, ForbiddenException, Query } from '@nestjs/common';
import { UsersService } from './user.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PaginationDto } from './dto/pagination.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
    constructor(private readonly usersService: UsersService) { }

    // ==========================================
    // PHẦN CỦA USER (Tự quản lý tài khoản mình)
    // ==========================================

    @Get('me')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'Lấy thông tin profile của chính mình' })
    @ApiBearerAuth('access-token')
    getProfile(@Request() req) {
        // req.user lấy từ JWT Payload
        return this.usersService.findOne(req.user.id);
    }

    @Patch('me')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth('access-token')
    @ApiOperation({ summary: 'Cập nhật thông tin profile của chính mình' })
    updateProfile(@Request() req, @Body() updateUserDto: UpdateUserDto) {
        return this.usersService.update(req.user.id, updateUserDto);
    }

    // ==========================================
    // PHẦN CỦA ADMIN (Quản lý người khác)
    // ==========================================

    @Get()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @ApiOperation({ summary: '[ADMIN] Lấy danh sách toàn bộ user' })
    @ApiBearerAuth('access-token')
    @ApiQuery({ name: 'search', required: false, description: 'Tìm kiếm theo tên, email, sđt' })
    findAll(@Query() query: PaginationDto) {
        return this.usersService.findAll(query);
    }

    @Delete(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @ApiOperation({ summary: '[ADMIN] Xóa tài khoản user' })
    @ApiBearerAuth('access-token')
    remove(@Param('id') id: string) {
        return this.usersService.deactivate(id);
    }

    @Patch(':id/restore')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @ApiOperation({ summary: '[ADMIN] Khôi phục tài khoản user' })
    @ApiBearerAuth('access-token')
    restore(@Param('id') id: string) {
        return this.usersService.restore(id);
    }
}