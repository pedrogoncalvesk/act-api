import { HttpException, HttpStatus, Injectable, Scope } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { v4 as uuidV4 } from 'uuid';

import {
  ActivitiesDocument,
  ActivitiesEntity,
  ActivityTypesEnum,
} from './schemas/activities.schema';
import { Activity } from './interfaces/activity.interface';

@Injectable({ scope: Scope.TRANSIENT })
export class ActivitiesService {
  constructor(
    @InjectModel(ActivitiesEntity.name)
    private activitiesModel: Model<ActivitiesDocument>,
  ) {}

  async create(data: Partial<Activity>): Promise<Activity> {
    const dataToSave = new this.activitiesModel({
      id: uuidV4(),
      ...data,
    });

    const { type, options } = dataToSave;

    if (type === ActivityTypesEnum.essay && options.length) {
      throw new HttpException(
        'Essay activity must not have statements.',
        HttpStatus.NOT_FOUND,
      );
    }

    if (type === ActivityTypesEnum.multipleChoice && options.length < 2) {
      throw new HttpException(
        'Multiple-choice activity must have more than 2 statements.',
        HttpStatus.NOT_FOUND,
      );
    }

    if (type === ActivityTypesEnum.singleChoice && options.length < 2) {
      throw new HttpException(
        'Single-choice activity must have more than 2 statements.',
        HttpStatus.NOT_FOUND,
      );
    }

    let count = 0;
    for (let i = 0; i < options.length; i++) {
      if (options[i].isCorrect === true) {
        count++;
      }
    }

    if (type !== ActivityTypesEnum.essay && count < 1) {
      throw new HttpException(
        'An activity must have at least 1 correct answer.',
        HttpStatus.NOT_FOUND,
      );
    }

    const dataSaved = await dataToSave.save();
    return dataSaved.toJSON();
  }

  async findAll({
    page,
    pageSize,
    orderBy,
    orderDirection,
    search,
    active,
  }): Promise<[Activity[], number]> {
    const filter: Record<string, any> = {};

    if (search) {
      filter.search = { $regex: `*${search}.*`, $options: 'i' };
    }

    if (active) {
      filter.active = active;
    }

    const sortBy = { [orderBy]: orderDirection === 'asc' ? 1 : -1 };
    const count = await this.activitiesModel.countDocuments(filter);
    const result = await this.activitiesModel
      .find(filter)
      .limit(pageSize)
      .skip(pageSize * (page - 1))
      .sort(sortBy)
      .lean();

    return [result, count];
  }

  async findOne(id: string): Promise<Activity> {
    const data = await this.activitiesModel.findOne({ id }).lean();

    if (!data) {
      throw new HttpException('Activity not found.', HttpStatus.NOT_FOUND);
    }

    return data;
  }

  async update(id: string, data: any): Promise<Activity> {
    if (!(await this.activitiesModel.findOne({ id }).lean())) {
      throw new HttpException('Activity not found.', HttpStatus.NOT_FOUND);
    }

    return this.activitiesModel
      .findOneAndUpdate({ id }, data, {
        timestamps: true,
        new: true,
      })
      .lean();
  }

  async remove(id: string): Promise<void> {
    const data = await this.activitiesModel.findOne({ id });

    if (!data) {
      throw new HttpException('Activity not found.', HttpStatus.NOT_FOUND);
    }

    await this.activitiesModel.deleteOne({ id });
  }
}
