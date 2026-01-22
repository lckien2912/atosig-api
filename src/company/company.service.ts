import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Company } from "./entities/company.entity";
import { Repository } from "typeorm";

@Injectable()
export class CompanyService {
    constructor(
        @InjectRepository(Company)
        private readonly companyRepository: Repository<Company>,
    ) { }

    async getCompanyBySymbol(symbol: string): Promise<Company> {
        const company = await this.companyRepository.findOne({
            where: {
                symbol: symbol.toUpperCase()
            },
            order: {
                year: 'DESC',
                quarter: 'DESC'
            }
        });

        if (!company) throw new NotFoundException(`Không tìm thấy thông tin công ty với mã: ${symbol}`);

        return company;
    }
}