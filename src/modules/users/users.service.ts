import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { TravelMode, User } from './entities/user.entity';
import { UserResponseDto } from './dto/user-response.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { PasswordService } from '../auth/password.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @Inject(PasswordService) private readonly passwords: PasswordService,
  ) {}

  normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  findByEmail(email: string): Promise<User | null> {
    return this.users.findOne({
      where: { email: this.normalizeEmail(email), deletedAt: IsNull() },
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.users.findOne({ where: { id, deletedAt: IsNull() } });
  }

  async getByIdOrFail(id: string): Promise<User> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException({ message: 'User not found', code: 'USER_NOT_FOUND' });
    return user;
  }

  async create(data: { name: string; email: string; password: string }): Promise<User> {
    const user = this.users.create({
      name: data.name.trim(),
      email: this.normalizeEmail(data.email),
      passwordHash: await this.passwords.hash(data.password),
      preferredTravelMode: TravelMode.WALK,
      voiceGuidance: true,
      language: 'ar',
      deletedAt: null,
    });
    return this.users.save(user);
  }

  async updateProfile(id: string, dto: UpdateProfileDto): Promise<User> {
    const user = await this.getByIdOrFail(id);
    if (dto.name !== undefined) user.name = dto.name.trim();
    if (dto.preferredTravelMode !== undefined) user.preferredTravelMode = dto.preferredTravelMode;
    if (dto.voiceGuidance !== undefined) user.voiceGuidance = dto.voiceGuidance;
    if (dto.language !== undefined) user.language = dto.language;
    return this.users.save(user);
  }

  async changePassword(id: string, newPassword: string): Promise<void> {
    const user = await this.getByIdOrFail(id);
    user.passwordHash = await this.passwords.hash(newPassword);
    await this.users.save(user);
  }

  async verifyPassword(user: User, password: string): Promise<boolean> {
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
    await this.users.save(user);
  }

  toDto(user: User): UserResponseDto {
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
