import {
    Body,
    Controller,
    Query,
    UseGuards,
    Post,
    Put,
} from '@nestjs/common';
import { KeyCloakAuthGuard } from 'src/middleware/key-cloak-auth-guard';
import { FieldValidationDto } from '../dto/field-validation.dto';
import { FieldValidationService } from '../service/field-validation.service';

@Controller('field-validation/')
export class FieldValidationController {
    constructor(private fieldValidationService: FieldValidationService){}

    @UseGuards(KeyCloakAuthGuard)
    @Post('upsert')
    async upsertProcessState(
        @Body() validation: FieldValidationDto
        ) {
      return await this.fieldValidationService.upsertFieldValidation(validation);
    }
}
