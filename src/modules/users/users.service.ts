import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TravelMode, User, type UserDocument } from './entities/user.entity';
import { UserResponseDto } from './dto/user-response.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { PasswordService } from '../auth/password.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @Inject(PasswordService) private readonly passwords: PasswordService,
  ) {}

  normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel
      .findOne({ email: this.normalizeEmail(email), deletedAt: null })
      .exec();
  }

  async findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ _id: id, deletedAt: null }).exec();
  }

  async getByIdOrFail(id: string): Promise<UserDocument> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException({ message: 'User not found', code: 'USER_NOT_FOUND' });
    return user;
  }

  async create(data: { name: string; email: string; password: string }): Promise<UserDocument> {
    return this.userModel.create({
      name: data.name.trim(),
      email: this.normalizeEmail(data.email),
      passwordHash: await this.passwords.hash(data.password),
      preferredTravelMode: TravelMode.WALK,
      voiceGuidance: true,
      language: 'ar',
      deletedAt: null,
    });
  }

  async updateProfile(id: string, dto: UpdateProfileDto): Promise<UserDocument> {
    const user = await this.getByIdOrFail(id);
    if (dto.name !== undefined) user.name = dto.name.trim();
    if (dto.preferredTravelMode !== undefined) user.preferredTravelMode = dto.preferredTravelMode;
    if (dto.voiceGuidance !== undefined) user.voiceGuidance = dto.voiceGuidance;
    if (dto.language !== undefined) user.language = dto.language;
    return user.save();
  }

  async changePassword(id: string, newPassword: string): Promise<void> {
    const user = await this.getByIdOrFail(id);
    user.passwordHash = await this.passwords.hash(newPassword);
    await user.save();
  }

  async verifyPassword(user: UserDocument, password: string): Promise<boolean> {
    return this.passwords.verify(user.passwordHash, password);
  }

  /**
   * Soft delete + anonymize: keeps referential integrity for reports while
   * removing personal data. The anonymized email frees the original address.
   */
  async softDeleteAndAnonymize(id: string): Promise<void> {
    const user = await this.getByIdOrFail(id);
    user.deletedAt = new Date();
    user.name = 'Deleted user';
    user.email = `deleted+${user.id}@invalid.local`;
    user.passwordHash = await this.passwords.hash(`${user.id}-${Date.now()}-erased`);
    user.voiceGuidance = false;
    user.language = 'ar';
    user.preferredTravelMode = TravelMode.WALK;
    await user.save();
  }

  toDto(user: UserDocument): UserResponseDto {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      preferredTravelMode: user.preferredTravelMode,
      voiceGuidance: user.voiceGuidance,
      language: user.language,
      createdAt: user.createdAt,
    };
  }
}
