import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type FavoriteDocument = HydratedDocument<Favorite>;

@Schema({
  timestamps: true,
  collection: 'favorites',
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
})
export class Favorite {
  id!: string;

  @Prop({ required: true, type: Types.ObjectId, ref: 'User', index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Atm', index: true })
  atmId!: Types.ObjectId;

  createdAt!: Date;
  updatedAt!: Date;
}

export const FavoriteSchema = SchemaFactory.createForClass(Favorite);

// Prevent duplicate favorites; also serves as the lookup key
FavoriteSchema.index({ userId: 1, atmId: 1 }, { unique: true });
