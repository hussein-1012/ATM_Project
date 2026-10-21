import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

export enum TravelMode {
  WALK = 'walk',
  DRIVE = 'drive',
}

@Schema({
  timestamps: true,
  collection: 'users',
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
})
export class User {
  /** Mongoose virtual — `_id.toHexString()`. Declared for TypeScript compatibility. */
  id!: string;

  @Prop({ required: true, maxlength: 120, trim: true })
  name!: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true, maxlength: 255 })
  email!: string;

  @Prop({ required: true })
  passwordHash!: string;

  @Prop({ type: String, enum: Object.values(TravelMode), default: TravelMode.WALK })
  preferredTravelMode!: TravelMode;

  @Prop({ default: true })
  voiceGuidance!: boolean;

  @Prop({ default: 'ar', maxlength: 10 })
  language!: string;

  @Prop({ type: Date, default: null })
  deletedAt!: Date | null;

  /** Populated by `timestamps: true`. */
  createdAt!: Date;
  updatedAt!: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
