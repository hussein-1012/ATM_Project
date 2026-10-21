import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type AtmReportDocument = HydratedDocument<AtmReport>;

export enum AtmReportStatus {
  WORKING = 'WORKING',
  OUT_OF_CASH = 'OUT_OF_CASH',
  OUT_OF_SERVICE = 'OUT_OF_SERVICE',
}

/** Crowd-sourced, never bank-confirmed. */
@Schema({
  timestamps: true,
  collection: 'atm_reports',
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
})
export class AtmReport {
  id!: string;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Atm', index: true })
  atmId!: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'User', index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true, type: String, enum: Object.values(AtmReportStatus) })
  status!: AtmReportStatus;

  createdAt!: Date;
  updatedAt!: Date;
}

export const AtmReportSchema = SchemaFactory.createForClass(AtmReport);

AtmReportSchema.index({ atmId: 1, createdAt: -1 });
AtmReportSchema.index({ userId: 1, atmId: 1, createdAt: -1 });
