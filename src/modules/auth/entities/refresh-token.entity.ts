import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type RefreshTokenDocument = HydratedDocument<RefreshToken>;

/**
 * Refresh tokens are opaque random strings; only their sha256 hash is stored.
 * `familyId` groups a rotation chain so token reuse revokes the whole family.
 */
@Schema({
  timestamps: true,
  collection: 'refresh_tokens',
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
})
export class RefreshToken {
  id!: string;

  @Prop({ required: true, type: Types.ObjectId, ref: 'User', index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true, unique: true })
  tokenHash!: string;

  @Prop({ required: true, index: true })
  familyId!: string;

  @Prop({ required: true, type: Date })
  expiresAt!: Date;

  @Prop({ type: Date, default: null })
  revokedAt!: Date | null;

  @Prop({ type: String, maxlength: 255, default: null })
  deviceInfo!: string | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export const RefreshTokenSchema = SchemaFactory.createForClass(RefreshToken);
