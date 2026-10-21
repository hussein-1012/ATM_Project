import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { Types } from 'mongoose';

/**
 * Validates that a route parameter is a valid MongoDB ObjectId hex string.
 * Replaces ParseUUIDPipe used with PostgreSQL UUIDs.
 */
@Injectable()
export class ParseObjectIdPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!Types.ObjectId.isValid(value)) {
      throw new BadRequestException({
        message: `"${value}" is not a valid ID`,
        code: 'INVALID_ID',
      });
    }
    return value;
  }
}
